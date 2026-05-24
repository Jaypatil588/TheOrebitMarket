package agent1_valuation

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/Jaypatil588/TheOrebitMarket/backend/db"
	"github.com/Jaypatil588/TheOrebitMarket/backend/engine"
	"github.com/Jaypatil588/TheOrebitMarket/backend/gemini"
	"github.com/Jaypatil588/TheOrebitMarket/backend/websocket"
)

const topCandidateCount = 10

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

// Run fetches top 500 asteroids, scores them heuristically against market demand,
// runs expensive Gemini deep research ONLY on the top 10 candidates, and gives
// the rest a fast deterministic valuation.
func (a *Agent) Run() {
	if a.IsRunning {
		log.Println("[AGENT1] Already running — skipping duplicate trigger")
		return
	}
	a.IsRunning = true
	defer func() { a.IsRunning = false }()

	log.Println("[AGENT1] ── Run start ──────────────────────────────────────────────")
	start := time.Now()
	a.broadcastStatus("active", "Loading asteroids and market data for heuristic selection...")

	// Step 1: load asteroids
	log.Println("[AGENT1] Loading top 500 asteroids from NASA dataset")
	asteroids, err := a.eng.GetTop500()
	if err != nil {
		log.Printf("[AGENT1] ERROR: Load asteroids: %v", err)
		a.broadcastStatus("error", fmt.Sprintf("Failed to load asteroids: %v", err))
		return
	}
	log.Printf("[AGENT1] Loaded %d asteroids", len(asteroids))

	// Step 2: fetch live prices with urgency data (required - no fallback)
	log.Println("[AGENT1] Fetching latest market prices with urgency from DB")
	marketPrices, err := a.db.GetLatestPrices()
	if err != nil {
		log.Printf("[AGENT1] ERROR: Failed to fetch market prices: %v", err)
		a.broadcastStatus("error", fmt.Sprintf("Failed to fetch market prices: %v", err))
		return
	}
	if len(marketPrices) == 0 {
		log.Printf("[AGENT1] ERROR: No market prices in DB - Agent 2 must run first")
		a.broadcastStatus("error", "No market prices available - waiting for Agent 2")
		return
	}
	log.Printf("[AGENT1] Market data for %d minerals", len(marketPrices))

	// Build price and urgency maps
	priceMap := make(map[string]float64)
	urgencyMap := make(map[string]float64)
	for _, mp := range marketPrices {
		priceMap[mp.Mineral] = mp.PriceUSD
		urgencyMap[mp.Mineral] = mp.Urgency
	}

	// Step 3: fetch scenarios
	scenarios, _ := a.db.GetActiveScenarios()
	log.Printf("[AGENT1] Active scenarios: %d", len(scenarios))

	// Boost urgency for scenario-affected minerals
	for _, sc := range scenarios {
		for _, mineral := range sc.AffectedMinerals {
			if u, ok := urgencyMap[mineral]; ok {
				urgencyMap[mineral] = math.Min(1.0, u+sc.Severity*0.5)
			}
		}
	}

	// Step 4: HEURISTIC SCORING — score all asteroids based on market alignment
	log.Println("[AGENT1] ── Heuristic Scoring Phase ──")
	a.broadcastStatus("active", "Scoring asteroids against market demand...")
	scoredAsteroids := scoreAsteroidsForMarket(asteroids, priceMap, urgencyMap)

	// Select top N for deep research
	topCandidates := scoredAsteroids
	if len(topCandidates) > topCandidateCount {
		topCandidates = topCandidates[:topCandidateCount]
	}
	remainingAsteroids := scoredAsteroids[len(topCandidates):]

	// Log selection reasoning
	log.Printf("[AGENT1] ══════════════════════════════════════════════════════════════")
	log.Printf("[AGENT1] SELECTED TOP %d ASTEROIDS FOR DEEP RESEARCH:", len(topCandidates))
	log.Printf("[AGENT1] ══════════════════════════════════════════════════════════════")
	for i, sc := range topCandidates {
		log.Printf("[AGENT1]  %2d. %-20s | score=%.3f | urgency=%.2f | deltaV=%.1f | value=$%.2e | reason: %s",
			i+1, sc.Asteroid.Name, sc.Score, sc.UrgencyScore, sc.DeltaV, sc.EstValue, sc.Reason)
	}
	log.Printf("[AGENT1] ══════════════════════════════════════════════════════════════")
	log.Printf("[AGENT1] Remaining %d asteroids will receive fast deterministic valuation", len(remainingAsteroids))

	totalValuations := 0

	// Step 5: Fast deterministic valuation first — unblocks Agent 3 while deep research polls
	if len(remainingAsteroids) > 0 {
		log.Printf("[AGENT1] ── Fast valuation for %d remaining asteroids ──", len(remainingAsteroids))
		a.broadcastStatus("active", fmt.Sprintf("Fast valuation for %d remaining asteroids...", len(remainingAsteroids)))

		for _, sc := range remainingAsteroids {
			v := deterministicValuation(sc.Asteroid, priceMap, scenarios)
			v.ResearchSummary = "Fast deterministic valuation — not in top market-aligned candidates."
			if err := a.db.UpsertAsteroidValuation(v); err != nil {
				log.Printf("[AGENT1] ERROR: DB upsert failed for %s: %v", v.ID, err)
				a.broadcastStatus("error", fmt.Sprintf("DB upsert failed: %v", err))
				return
			}
		}
		totalValuations += len(remainingAsteroids)
		log.Printf("[AGENT1] Fast valuation complete: %d asteroids", len(remainingAsteroids))
	}

	if totalValuations > 0 {
		log.Println("[AGENT1] Fast valuations saved → triggering Agent 3 (ranker) before deep research")
		go a.onComplete()
	}

	// Step 6: Deep research on top candidates (may take minutes via async poll)
	if len(topCandidates) > 0 {
		topAsteroids := make([]engine.Asteroid, len(topCandidates))
		for i, sc := range topCandidates {
			topAsteroids[i] = sc.Asteroid
		}

		log.Printf("[AGENT1] ── Deep Research on %d top candidates ──", len(topAsteroids))
		a.broadcastStatus("active", fmt.Sprintf("Deep Research on top %d market-aligned asteroids...", len(topAsteroids)))

		batchJSON, _ := json.Marshal(topAsteroids)
		pricesJSON, _ := json.Marshal(priceMap)
		scenariosJSON, _ := json.Marshal(scenarios)
		prompt := fmt.Sprintf(
			"Asteroid batch:\n%s\n\nLive prices (USD/kg):\n%s\n\nActive scenarios:\n%s\n\nDate: %s",
			string(batchJSON), string(pricesJSON), string(scenariosJSON),
			time.Now().Format("2006-01-02"),
		)

		log.Printf("[AGENT1] Calling Gemini Deep Research | prompt_len=%d", len(prompt))
		resp, err := a.gemini.Interact(gemini.AgentDeepResearch, systemInstruction, prompt)
		if err != nil {
			log.Printf("[AGENT1] WARN: Gemini Deep Research failed: %v — continuing with fast valuations only", err)
			a.broadcastStatus("active", fmt.Sprintf("Deep research pending: %v. Ranker already has fast valuations.", err))
		} else {

			log.Printf("[AGENT1] Deep Research response len=%d", len(resp.OutputText))
			log.Printf("[AGENT1] Deep Research output:\n%.3000s", resp.OutputText)

			cleaned := stripJSON(resp.OutputText)
			var batchResult []db.AsteroidValuation
			if err := json.Unmarshal([]byte(cleaned), &batchResult); err != nil {
				log.Printf("[AGENT1] WARN: Failed to parse Gemini response: %v", err)
				log.Printf("[AGENT1] Raw response was: %s", cleaned)
				a.broadcastStatus("active", fmt.Sprintf("Deep research parse pending — ranker using fast valuations"))
			} else {
				log.Printf("[AGENT1] Deep Research: parsed %d valuations", len(batchResult))
				for _, v := range batchResult {
					netVal := 0.0
					if v.Valuation != nil {
						if nv, ok := v.Valuation["net_value_usd"]; ok {
							netVal, _ = nv.(float64)
						}
					}
					log.Printf("[AGENT1]   [DEEP] %-20s spec=%-2s val=$%.2e conf=%.2f impact=%.1f%%",
						v.Name, v.SpecType, netVal,
						safeFloat(v.Risk, "composition_confidence"), v.ScenarioImpact)
				}
				for _, v := range batchResult {
					if err := a.db.UpsertAsteroidValuation(v); err != nil {
						log.Printf("[AGENT1] ERROR: DB upsert failed for %s: %v", v.ID, err)
						a.broadcastStatus("error", fmt.Sprintf("DB upsert failed: %v", err))
						return
					}
				}
				totalValuations += len(batchResult)
			}
		}
	}

	// Step 7: broadcast completion
	elapsed := time.Since(start)
	log.Printf("[AGENT1] ══════════════════════════════════════════════════════════════")
	log.Printf("[AGENT1] Run complete: %d total valuations in %s", totalValuations, elapsed.Round(time.Second))
	log.Printf("[AGENT1]   - Deep research: %d asteroids", len(topCandidates))
	log.Printf("[AGENT1]   - Fast fallback: %d asteroids", len(remainingAsteroids))
	log.Printf("[AGENT1] ══════════════════════════════════════════════════════════════")

	a.hub.BroadcastJSON(map[string]interface{}{
		"type":                 "agent1_complete",
		"valuations_count":     totalValuations,
		"deep_research_count":  len(topCandidates),
		"fast_valuation_count": len(remainingAsteroids),
		"elapsed_seconds":      elapsed.Seconds(),
		"timestamp":            time.Now().Format(time.RFC3339),
	})
	a.broadcastStatus("idle", fmt.Sprintf("Valued %d asteroids (%d deep research) in %s. Signalling ranker...",
		totalValuations, len(topCandidates), elapsed.Round(time.Second)))

	// Step 8: signal Agent 3
	log.Println("[AGENT1] Signalling Agent 3 to run")
	go a.onComplete()
}

// ScoredAsteroid holds an asteroid with its heuristic market alignment score
type ScoredAsteroid struct {
	Asteroid     engine.Asteroid
	Score        float64
	UrgencyScore float64
	DeltaV       float64
	EstValue     float64
	Reason       string
}

// scoreAsteroidsForMarket scores all asteroids based on how well they align with market demand
func scoreAsteroidsForMarket(asteroids []engine.Asteroid, prices map[string]float64, urgency map[string]float64) []ScoredAsteroid {
	scored := make([]ScoredAsteroid, len(asteroids))

	for i, ast := range asteroids {
		sc := ScoredAsteroid{
			Asteroid: ast,
			DeltaV:   ast.Orbital.MoidAu * 10, // rough delta-v proxy from MOID
			EstValue: ast.ValueUSD,
		}

		// Find the asteroid's top mineral and its market urgency
		topMineral := ""
		topFrac := 0.0
		totalUrgencyWeight := 0.0
		for mineral, fraction := range ast.Composition {
			if fraction > topFrac {
				topFrac = fraction
				topMineral = mineral
			}
			// Weight by both composition fraction and market urgency
			if u, ok := urgency[mineral]; ok {
				totalUrgencyWeight += (fraction / 100.0) * u
			}
		}
		sc.UrgencyScore = totalUrgencyWeight

		// Accessibility score: lower delta-v is better (0.0 to 1.0)
		deltaVProxy := math.Max(1.0, ast.Orbital.MoidAu*10)
		if deltaVProxy <= 0 {
			deltaVProxy = 6.0 // default
		}
		accessibilityScore := 1.0 / (1.0 + deltaVProxy/10.0)

		// Value score: normalize by log scale
		valueScore := 0.0
		if ast.ValueUSD > 0 {
			valueScore = math.Log10(ast.ValueUSD) / 20.0 // normalize to ~0-1 range
		}

		// Combined heuristic score
		// - 50% weight on urgency alignment with market
		// - 30% weight on accessibility
		// - 20% weight on raw value
		sc.Score = (sc.UrgencyScore * 0.5) + (accessibilityScore * 0.3) + (valueScore * 0.2)

		// Build reasoning string
		sc.Reason = fmt.Sprintf("top=%s(%.0f%%) urg=%.2f acc=%.2f val=%.2f",
			topMineral, topFrac, sc.UrgencyScore, accessibilityScore, valueScore)

		scored[i] = sc
	}

	// Sort by score descending
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].Score > scored[j].Score
	})

	return scored
}

func (a *Agent) broadcastStatus(status, message string) {
	a.hub.BroadcastJSON(map[string]interface{}{
		"type":    "agent_status",
		"agent":   "valuation",
		"status":  status,
		"message": message,
	})
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
