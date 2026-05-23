package agent2_market

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"strings"
	"time"

	"github.com/Jaypatil588/TheOrebitMarket/backend/agents/minerals"
	"github.com/Jaypatil588/TheOrebitMarket/backend/db"
	"github.com/Jaypatil588/TheOrebitMarket/backend/gemini"
	"github.com/Jaypatil588/TheOrebitMarket/backend/websocket"
)

const systemInstruction = `
You are a live commodity price and supply chain analyst for space mining intelligence.
You monitor ALL critical minerals used in advanced manufacturing, defense, and energy transition.

## INPUT
You receive JSON with:
- mineral_registry: all minerals to monitor with metadata
- active_scenarios: user-injected disruption scenarios (APPLY THESE FIRST)
- previous_prices: last known prices per mineral
- date: today's date

## STEP 1 — APPLY ACTIVE SCENARIOS
Before any searches, read active_scenarios carefully.
For each active scenario, identify which minerals it affects.
Set urgency_score = max(base_urgency, scenario.severity) for affected minerals.
Set scenario_adjusted = true and disruption = scenario.description for those minerals.
Examples:
  "China blocks all rare earth exports" → all minerals with china_control_pct > 60 and category = "rare_earth"
  "DRC cobalt mine flooding" → cobalt, urgency → 0.90
  "Russia sanctions" → palladium, nickel, platinum → urgency boost
  "Taiwan conflict" → gallium, germanium, silicon, tantalum → urgency boost

## STEP 2 — WEB SEARCH PER MINERAL
For each mineral in the registry, search:
  "[mineral_display_name] price [current_month_year]"
  "[mineral_display_name] supply disruption OR shortage [current_year]"
For minerals with china_control_pct > 60, ALSO search:
  "China [mineral_display_name] export restriction [current_year]"
Prioritize tier 1 minerals (criticality=1). For tier 3, one search is enough.

## STEP 3 — URGENCY SCORING (0.0 to 1.0)
For each mineral:
  active_disruption + HIGH severity → 0.75–1.0
  active_disruption + MED severity  → 0.50–0.75
  rising_price + no_disruption      → 0.30–0.55
  stable market                     → 0.05–0.25
  falling_price                     → 0.00–0.15
Multipliers (clamp to 1.0):
  × 1.3 if china_control_pct > 80
  × 1.2 if criticality = 1
  × 1.1 if multiple demand drivers simultaneously active
If scenario_adjusted = true: use MAX(computed_urgency, scenario.severity)

## OUTPUT — JSON ONLY, NO PROSE
{
  "prices": [
    {
      "mineral": "cobalt",
      "price_usd": 33.80,
      "trend": "rising",
      "change_pct": 4.2,
      "urgency": 0.87,
      "disruption": "DRC flooding, 3 mines offline",
      "source_url": "https://...",
      "category": "battery",
      "criticality": 1,
      "scenario_adjusted": false
    }
  ],
  "scenarios_applied": ["id1", "id2"],
  "fetched_at": "2026-05-23T10:30:00Z"
}
Return ALL minerals from the registry. No missing entries. No prose outside JSON.
`

// Agent2Output is the structured response from Gemini
type Agent2Output struct {
	Prices           []db.MarketPrice `json:"prices"`
	ScenariosApplied []string         `json:"scenarios_applied"`
	FetchedAt        time.Time        `json:"fetched_at"`
}

// Agent is the live market feed agent
type Agent struct {
	gemini      *gemini.Client
	db          *db.Store
	hub         *websocket.Hub
	onShift     func([]string) // called when price shifts detected
	lastPrices  map[string]float64
	HasFirstRun bool
}

// New creates Agent 2
func New(g *gemini.Client, d *db.Store, h *websocket.Hub, onShift func([]string)) *Agent {
	return &Agent{
		gemini:     g,
		db:         d,
		hub:        h,
		onShift:    onShift,
		lastPrices: make(map[string]float64),
	}
}

// RunForever loops every 10 seconds, calling Gemini for live prices
func (a *Agent) RunForever() {
	log.Printf("[AGENT2] Starting live market feed | minerals=%d", len(minerals.Registry))
	a.broadcastStatus("starting", "Live market feed initializing...")

	for {
		log.Println("[AGENT2] ── Cycle start ──────────────────────────────────────────────")
		start := time.Now()

		// Step 1: load active scenarios
		scenarios, _ := a.db.GetActiveScenarios()
		log.Printf("[AGENT2] Active scenarios: %d", len(scenarios))
		for _, s := range scenarios {
			log.Printf("[AGENT2]   SCENARIO %q severity=%.2f minerals=%v", s.Description, s.Severity, s.AffectedMinerals)
		}

		// Step 2: build input
		input := map[string]interface{}{
			"date":             time.Now().Format("2006-01-02"),
			"mineral_registry": minerals.Registry,
			"active_scenarios": scenarios,
			"previous_prices":  a.lastPrices,
		}
		inputJSON, _ := json.Marshal(input)
		log.Printf("[AGENT2] Input built | minerals=%d scenarios=%d bytes=%d",
			len(minerals.Registry), len(scenarios), len(inputJSON))

		a.broadcastStatus("active", fmt.Sprintf("Searching live prices for %d minerals...", len(minerals.Registry)))

		// Step 3: call Gemini
		log.Println("[AGENT2] Calling Gemini Antigravity managed agent")
		resp, err := a.gemini.Interact(gemini.AgentAntigravity, systemInstruction, string(inputJSON))
		if err != nil {
			log.Printf("[AGENT2] ERROR: Gemini call failed: %v", err)
			a.broadcastStatus("error", fmt.Sprintf("Market feed error: %v", err))
			// Use defaults so downstream agents can still run
			a.injectDefaultPrices(scenarios)
			time.Sleep(10 * time.Second)
			continue
		}

		log.Printf("[AGENT2] Response received | len=%d chars", len(resp.OutputText))
		log.Printf("[AGENT2] Full raw output:\n%s", resp.OutputText)

		// Step 4: strip markdown fences if present
		cleaned := stripJSON(resp.OutputText)

		// Step 5: parse
		var output Agent2Output
		if err := json.Unmarshal([]byte(cleaned), &output); err != nil {
			log.Printf("[AGENT2] ERROR: JSON parse failed: %v", err)
			log.Printf("[AGENT2] Cleaned output was: %s", cleaned)
			a.injectDefaultPrices(scenarios)
			time.Sleep(10 * time.Second)
			continue
		}
		log.Printf("[AGENT2] Parsed %d mineral prices | scenarios_applied=%v",
			len(output.Prices), output.ScenariosApplied)

		// Step 6: log + write every price row
		inserted := 0
		shifts := []string{}
		for _, p := range output.Prices {
			tag := ""
			if p.ScenarioAdjusted {
				tag = " ⚡SCENARIO"
			}
			log.Printf("[AGENT2] %-14s $%-12.4f trend=%-8s urgency=%.3f crit=%d%s",
				p.Mineral, p.PriceUSD, p.Trend, p.Urgency, p.Criticality, tag)
			if p.Disruption != "" {
				log.Printf("[AGENT2]   disruption: %s", p.Disruption)
			}

			if err := a.db.InsertMarketPrice(p); err != nil {
				log.Printf("[AGENT2] DB insert error %s: %v", p.Mineral, err)
				continue
			}
			inserted++

			// detect shift
			if last, ok := a.lastPrices[p.Mineral]; ok {
				if last > 0 {
					delta := math.Abs((p.PriceUSD-last)/last) * 100
					if delta >= 2.0 || p.ScenarioAdjusted {
						log.Printf("[AGENT2] SHIFT: %s changed %.2f%%%s",
							p.Mineral, delta, tag)
						shifts = append(shifts, p.Mineral)
					}
				}
			}
			a.lastPrices[p.Mineral] = p.PriceUSD
		}
		log.Printf("[AGENT2] DB: inserted %d/%d rows", inserted, len(output.Prices))

		// Step 7: signal Agent 1 if shifts detected
		if len(shifts) > 0 {
			log.Printf("[AGENT2] Signalling Agent 1: %d shifted minerals: %v", len(shifts), shifts)
			go a.onShift(shifts)
		}

		// Step 8: broadcast to frontend
		a.hub.BroadcastJSON(map[string]interface{}{
			"type":              "market_update",
			"prices":            output.Prices,
			"scenarios_applied": output.ScenariosApplied,
			"mineral_count":     len(output.Prices),
			"timestamp":         time.Now().Format(time.RFC3339),
		})
		log.Printf("[AGENT2] Broadcast sent to frontend | %d prices", len(output.Prices))
		a.broadcastStatus("idle", fmt.Sprintf("Updated %d mineral prices. Next cycle in 10s.", len(output.Prices)))

		a.HasFirstRun = true
		log.Printf("[AGENT2] ── Cycle done in %s. Sleeping 10s ──────────────────────────",
			time.Since(start).Round(time.Millisecond))
		time.Sleep(10 * time.Second)
	}
}

// injectDefaultPrices uses registry defaults when Gemini is unavailable
func (a *Agent) injectDefaultPrices(scenarios []db.Scenario) {
	log.Println("[AGENT2] Injecting default prices (Gemini unavailable)")
	defaults := minerals.DefaultPriceMap()
	for _, m := range minerals.Registry {
		price := defaults[m.ID]
		urgency := 0.1 * float64(4-m.Criticality) // tier1=0.3, tier2=0.2, tier3=0.1
		scenarioAdjusted := false
		disruption := ""

		for _, sc := range scenarios {
			for _, affected := range sc.AffectedMinerals {
				if affected == m.ID {
					urgency = math.Max(urgency, sc.Severity)
					scenarioAdjusted = true
					disruption = sc.Description
				}
			}
		}

		p := db.MarketPrice{
			Mineral: m.ID, PriceUSD: price, Trend: "stable",
			Urgency: urgency, Category: m.Category, Criticality: m.Criticality,
			ScenarioAdjusted: scenarioAdjusted, Disruption: disruption,
			FetchedAt: time.Now(),
		}
		a.db.InsertMarketPrice(p)
		a.lastPrices[m.ID] = price
	}
	a.HasFirstRun = true
}

func (a *Agent) broadcastStatus(status, message string) {
	a.hub.BroadcastJSON(map[string]interface{}{
		"type":    "agent_status",
		"agent":   "market_feed",
		"status":  status,
		"message": message,
	})
}

// stripJSON removes markdown code fences from Gemini output
func stripJSON(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```json") {
		s = strings.TrimPrefix(s, "```json")
		s = strings.TrimSuffix(s, "```")
	} else if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```")
		s = strings.TrimSuffix(s, "```")
	}
	return strings.TrimSpace(s)
}
