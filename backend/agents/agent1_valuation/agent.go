package agent1_valuation

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/Jaypatil588/TheOrebitMarket/backend/db"
	"github.com/Jaypatil588/TheOrebitMarket/backend/engine"
	"github.com/Jaypatil588/TheOrebitMarket/backend/gemini"
	"github.com/Jaypatil588/TheOrebitMarket/backend/websocket"
)

const systemInstruction = `
You are an asteroid composition and valuation research analyst.
You receive a batch of Near-Earth Asteroids with known orbital and physical parameters.
You also receive live commodity prices and active market scenarios.

For EACH asteroid in the batch:

1. RESEARCH composition from scientific literature:
   Search "[asteroid_name] spectral type composition" and "[asteroid_name] mineralogy"
   If no specific data found, use Bus-DeMeo spectral taxonomy defaults:
     M-type: iron=0.85, nickel=0.10, cobalt=0.005, platinum_group=0.005 (rest trace)
     S-type: iron=0.25, nickel=0.02, silicon=0.20, magnesium=0.15, stony=0.38
     C-type: water_ice=0.10, carbon=0.05, silicates=0.20, iron=0.03, clay=0.62
     D-type: carbon=0.08, silicates=0.30, organics=0.40, water_ice=0.22
     V-type: basalt=0.70, iron=0.15, nickel=0.10, pyroxene=0.05

2. COMPUTE raw_value_usd:
   raw_value = sum(mineral_fraction × mass_kg × live_price_per_kg[mineral])
   Use ONLY the live_prices provided. Never use hardcoded prices.

3. COMPUTE mission_cost_usd:
   delta_v = orbital.delta_v_km_s (use 6.0 if missing)
   fuel_ratio = exp(delta_v / 3.5) - 1
   launch_cost = 1000 * fuel_ratio * 2700   (2700 $/kg to LEO)
   ops_cost = 365 * 250000                  (ops per day)
   mission_cost = launch_cost + ops_cost + 500000000 (spacecraft)

4. COMPUTE net_value_usd = raw_value_usd - mission_cost_usd
   roi = (net_value_usd / mission_cost_usd) × 100

5. ASSESS scenario_impact_pct:
   If active_scenarios affect this asteroid's primary mineral:
   scenario_impact_pct = (scenario.severity × 100) (percentage valuation boost)

6. ASSESS composition_confidence (0.0 to 1.0):
   0.9 = directly observed spectrum
   0.7 = inferred from orbital class + albedo
   0.5 = estimated from taxonomy only
   0.3 = no data, defaults used

7. Return research_summary: 2 sentences max. What is known about this asteroid specifically.

OUTPUT: JSON array of enriched asteroid objects. ONE array. No prose outside JSON.
[
  {
    "id": "string",
    "name": "string",
    "spec_type": "M|S|C|D|V",
    "diameter_km": 0.0,
    "mass_kg": 0.0,
    "composition": {"iron": 0.85, "nickel": 0.10, ...},
    "valuation": {
      "raw_value_usd": 0.0,
      "mission_cost_usd": 0.0,
      "net_value_usd": 0.0,
      "roi": 0.0,
      "top_mineral": "iron",
      "mineral_breakdown_usd": {"iron": 0.0, ...}
    },
    "orbital": {
      "a": 0.0, "e": 0.0, "i": 0.0,
      "moid_au": 0.0, "delta_v_km_s": 0.0,
      "period_days": 0.0, "launch_window_year": 2028
    },
    "risk": {
      "composition_confidence": 0.7,
      "orbital_uncertainty": "U=0",
      "data_completeness": 0.8
    },
    "research_summary": "string",
    "scenario_impact": 0.0
  }
]
`

// Agent is the valuation deep-research agent
type Agent struct {
	gemini     *gemini.Client
	db         *db.Store
	hub        *websocket.Hub
	eng        *engine.Engine
	onComplete func()
	IsRunning  bool
}

// New creates Agent 1
func New(g *gemini.Client, d *db.Store, h *websocket.Hub, e *engine.Engine, onComplete func()) *Agent {
	return &Agent{gemini: g, db: d, hub: h, eng: e, onComplete: onComplete}
}

// Run fetches top 500 asteroids, values them using live prices, upserts to DB
func (a *Agent) Run() {
	if a.IsRunning {
		log.Println("[AGENT1] Already running — skipping duplicate trigger")
		return
	}
	a.IsRunning = true
	defer func() { a.IsRunning = false }()

	log.Println("[AGENT1] ── Run start ──────────────────────────────────────────────")
	start := time.Now()
	a.broadcastStatus("active", "Starting valuation research on top 500 asteroids...")

	// Step 1: load asteroids
	log.Println("[AGENT1] Loading top 500 asteroids from NASA dataset")
	asteroids, err := a.eng.GetTop500()
	if err != nil {
		log.Printf("[AGENT1] ERROR: Load asteroids: %v", err)
		a.broadcastStatus("error", fmt.Sprintf("Failed to load asteroids: %v", err))
		return
	}
	log.Printf("[AGENT1] Loaded %d asteroids", len(asteroids))

	// Step 2: fetch live prices
	log.Println("[AGENT1] Fetching latest prices from DB")
	priceMap, err := a.db.GetLatestPriceMap()
	if err != nil || len(priceMap) == 0 {
		log.Printf("[AGENT1] WARN: No DB prices, using registry defaults")
		priceMap = getDefaultPrices()
	}
	log.Printf("[AGENT1] Using prices for %d minerals", len(priceMap))

	// Step 3: fetch scenarios
	scenarios, _ := a.db.GetActiveScenarios()
	log.Printf("[AGENT1] Active scenarios: %d", len(scenarios))

	// Step 4: batch process (50 per call)
	batches := chunkAsteroids(asteroids, 50)
	log.Printf("[AGENT1] Processing %d batches of up to 50", len(batches))

	totalValuations := 0

	for i, batch := range batches {
		log.Printf("[AGENT1] ── Batch %d/%d (%d asteroids) ──", i+1, len(batches), len(batch))
		a.broadcastStatus("active", fmt.Sprintf("Researching batch %d/%d (%d asteroids)...",
			i+1, len(batches), len(batch)))

		// build prompt
		batchJSON, _ := json.Marshal(batch)
		pricesJSON, _ := json.Marshal(priceMap)
		scenariosJSON, _ := json.Marshal(scenarios)
		prompt := fmt.Sprintf(
			"Asteroid batch:\n%s\n\nLive prices (USD/kg):\n%s\n\nActive scenarios:\n%s\n\nDate: %s",
			string(batchJSON), string(pricesJSON), string(scenariosJSON),
			time.Now().Format("2006-01-02"),
		)

		log.Printf("[AGENT1] Batch %d: calling Gemini Deep Research | prompt_len=%d", i+1, len(prompt))
		resp, err := a.gemini.Interact(gemini.AgentDeepResearch, systemInstruction, prompt)
		if err != nil {
			log.Printf("[AGENT1] ERROR batch %d: %v — using deterministic fallback", i+1, err)
			a.processBatchFallback(batch, priceMap, scenarios)
			continue
		}

		log.Printf("[AGENT1] Batch %d raw output len=%d", i+1, len(resp.OutputText))
		log.Printf("[AGENT1] Batch %d raw output:\n%.2000s", i+1, resp.OutputText)

		cleaned := stripJSON(resp.OutputText)
		var batchResult []db.AsteroidValuation
		if err := json.Unmarshal([]byte(cleaned), &batchResult); err != nil {
			log.Printf("[AGENT1] ERROR batch %d parse: %v — using deterministic fallback", i+1, err)
			a.processBatchFallback(batch, priceMap, scenarios)
			continue
		}

		log.Printf("[AGENT1] Batch %d: parsed %d valuations", i+1, len(batchResult))
		for _, v := range batchResult {
			netVal := 0.0
			if v.Valuation != nil {
				if nv, ok := v.Valuation["net_value_usd"]; ok {
					netVal, _ = nv.(float64)
				}
			}
			log.Printf("[AGENT1]   %-20s spec=%-2s val=$%.2e conf=%.2f impact=%.1f%%",
				v.Name, v.SpecType, netVal,
				safeFloat(v.Risk, "composition_confidence"), v.ScenarioImpact)
		}

		// upsert each
		for _, v := range batchResult {
			if err := a.db.UpsertAsteroidValuation(v); err != nil {
				log.Printf("[AGENT1] DB upsert error %s: %v", v.ID, err)
			}
		}
		totalValuations += len(batchResult)

		// small pause between batches to be respectful to API
		time.Sleep(2 * time.Second)
	}

	// Step 5: broadcast completion
	elapsed := time.Since(start)
	log.Printf("[AGENT1] ── Run complete: %d valuations in %s ──────────────────────",
		totalValuations, elapsed.Round(time.Second))
	a.hub.BroadcastJSON(map[string]interface{}{
		"type":             "agent1_complete",
		"valuations_count": totalValuations,
		"elapsed_seconds":  elapsed.Seconds(),
		"timestamp":        time.Now().Format(time.RFC3339),
	})
	a.broadcastStatus("idle", fmt.Sprintf("Valued %d asteroids in %s. Signalling ranker...",
		totalValuations, elapsed.Round(time.Second)))

	// Step 6: signal Agent 3
	log.Println("[AGENT1] Signalling Agent 3 to run")
	go a.onComplete()
}

// processBatchFallback uses the deterministic engine when Gemini fails
func (a *Agent) processBatchFallback(batch []engine.Asteroid, prices map[string]float64, scenarios []db.Scenario) {
	log.Printf("[AGENT1] Fallback: computing %d valuations deterministically", len(batch))
	for _, ast := range batch {
		v := deterministicValuation(ast, prices, scenarios)
		if err := a.db.UpsertAsteroidValuation(v); err != nil {
			log.Printf("[AGENT1] Fallback upsert error %s: %v", v.ID, err)
		}
	}
}

func (a *Agent) broadcastStatus(status, message string) {
	a.hub.BroadcastJSON(map[string]interface{}{
		"type":    "agent_status",
		"agent":   "valuation",
		"status":  status,
		"message": message,
	})
}

func chunkAsteroids(all []engine.Asteroid, size int) [][]engine.Asteroid {
	var chunks [][]engine.Asteroid
	for size < len(all) {
		all, chunks = all[size:], append(chunks, all[0:size:size])
	}
	return append(chunks, all)
}

func safeFloat(m map[string]interface{}, key string) float64 {
	if m == nil {
		return 0
	}
	if v, ok := m[key]; ok {
		if f, ok := v.(float64); ok {
			return f
		}
	}
	return 0
}

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

func getDefaultPrices() map[string]float64 {
	return map[string]float64{
		"iron": 0.124, "nickel": 16.42, "cobalt": 33.8,
		"platinum": 31240, "palladium": 35000, "rhodium": 145000,
		"iridium": 52000, "water_ice": 250, "silicon": 4.0,
		"magnesium": 2.2, "neodymium": 210, "dysprosium": 480,
		"terbium": 1900, "gallium": 350, "germanium": 1100,
		"graphite": 1.2, "lithium": 12.8, "tungsten": 35,
	}
}

// deterministicValuation is a fallback when Gemini is down
func deterministicValuation(ast engine.Asteroid, prices map[string]float64, scenarios []db.Scenario) db.AsteroidValuation {
	comp := make(map[string]interface{})
	for k, v := range ast.Composition {
		comp[k] = v / 100.0
	}

	rawVal := ast.ValueUSD
	missionCost := 2e9
	netVal := rawVal - missionCost
	roi := 0.0
	if missionCost > 0 {
		roi = (netVal / missionCost) * 100
	}

	// find top mineral
	topMineral := "iron"
	topFrac := 0.0
	for k, v := range ast.Composition {
		if v > topFrac {
			topFrac = v
			topMineral = k
		}
	}

	// check scenario impact
	scenarioImpact := 0.0
	for _, sc := range scenarios {
		for _, m := range sc.AffectedMinerals {
			if m == topMineral {
				scenarioImpact = sc.Severity * 100
			}
		}
	}

	return db.AsteroidValuation{
		ID: ast.ID, Name: ast.Name, SpecType: ast.SpecType,
		DiameterKm: ast.DiameterKm, MassKg: ast.MassKg,
		Composition: comp,
		Valuation: map[string]interface{}{
			"raw_value_usd":    rawVal,
			"mission_cost_usd": missionCost,
			"net_value_usd":    netVal,
			"roi":              roi,
			"top_mineral":      topMineral,
		},
		Orbital: map[string]interface{}{
			"a": ast.Orbital.A, "e": ast.Orbital.E,
			"i": ast.Orbital.I, "moid_au": ast.Orbital.MoidAu,
		},
		Risk: map[string]interface{}{
			"composition_confidence": 0.5,
			"data_completeness":      0.6,
		},
		ResearchSummary: "Computed deterministically from NASA dataset. Gemini research unavailable.",
		ScenarioImpact:  scenarioImpact,
		PricesSnapshot:  prices,
	}
}
