package agent3_targeting

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/Jaypatil588/TheOrebitMarket/backend/db"
	"github.com/Jaypatil588/TheOrebitMarket/backend/gemini"
	"github.com/Jaypatil588/TheOrebitMarket/backend/websocket"
)

const systemInstruction = `
You are a strategic asteroid mining investment advisor.
You receive asteroid valuations, live market urgency scores, a delta-v matrix, and active scenarios.

## STEP 1 — SCORE ALL ASTEROIDS
Execute this scoring in your sandbox (Python code execution):

import json, math
valuations = <provided>
urgency = <provided>

def score(ast, urgency):
    val = ast.get("valuation", {})
    risk = ast.get("risk", {})
    orb = ast.get("orbital", {})
    net = float(val.get("net_value_usd", 0) or 0)
    roi = float(val.get("roi", 0) or 0)
    top_mineral = val.get("top_mineral", "iron")
    dv = float(orb.get("delta_v_km_s", 8) or 8)
    conf = float(risk.get("composition_confidence", 0.5) or 0.5)
    completeness = float(risk.get("data_completeness", 0.5) or 0.5)
    scenario_impact = float(ast.get("scenario_impact", 0) or 0)

    value_score = math.log10(max(net, 1)) / 18.0
    market_score = urgency.get(top_mineral, 0.1)
    comp = ast.get("composition", {})
    multi_score = min(1.0, sum(urgency.get(k, 0) * float(v or 0) for k, v in comp.items()))
    access_score = max(0, 1.0 - (dv / 12.0))
    confidence_score = (conf + completeness) / 2.0
    scenario_boost = min(0.3, scenario_impact / 100.0)

    return (0.30 * value_score + 0.25 * market_score + 0.15 * multi_score
          + 0.15 * access_score + 0.10 * confidence_score + 0.05 * scenario_boost)

scored = [(score(a, urgency), a) for a in valuations]
scored.sort(key=lambda x: x[0], reverse=True)
top20 = scored[:20]

## STEP 2 — RANK TOP 20
For each of the top 20, write a reasoning field (2-4 sentences) citing actual numbers.
Mark scenario_boosted=true if scenario_impact > 0.

## STEP 3 — COMPUTE 5 ROUTES
Using the dv_matrix (top 50 asteroids + Earth), run TSP-style optimization in sandbox:
Routes to compute:
1. cobalt_priority (blue #3b82f6, budget 9km/s) — maximize cobalt+nickel value × urgency
2. platinum_priority (silver #94a3b8, budget 9km/s) — maximize PGM value × urgency
3. rare_earth_priority (gold #f59e0b, budget 9km/s) — maximize REE value × urgency
4. water_fuel_priority (teal #14b8a6, budget 7km/s) — C-type asteroids, maximize water_ice fraction
5. best_roi_mixed (white #f8fafc, budget 10km/s) — maximize total net_value regardless of mineral

Each route: Earth → 2-4 stops → Earth. Must start and end at Earth.
For each route write route_reasoning (3-5 sentences with actual numbers).
Mark scenario_driven=true if scenario changed mineral priorities.
Set is_default=true for the route with highest urgency_score.

## OUTPUT — JSON ONLY
{
  "rankings": [...],
  "routes": [...],
  "urgency_map": {...}
}
`

// Agent is the strategic targeting agent
type Agent struct {
	gemini    *gemini.Client
	db        *db.Store
	hub       *websocket.Hub
	IsRunning bool
}

// New creates Agent 3
func New(g *gemini.Client, d *db.Store, h *websocket.Hub) *Agent {
	return &Agent{gemini: g, db: d, hub: h}
}

// Run reads all valuations + urgency, ranks asteroids, computes routes
func (a *Agent) Run() {
	if a.IsRunning {
		log.Println("[AGENT3] Already running — skipping")
		return
	}
	a.IsRunning = true
	defer func() { a.IsRunning = false }()

	log.Println("[AGENT3] ── Run start ──────────────────────────────────────────────")
	start := time.Now()
	a.broadcastStatus("active", "Loading asteroid valuations for strategic ranking...")

	// Step 1: load valuations
	valuations, err := a.db.GetAllAsteroidValuations()
	if err != nil || len(valuations) == 0 {
		log.Printf("[AGENT3] ERROR: No valuations available: %v", err)
		a.broadcastStatus("error", "No valuations available. Waiting for Agent 1.")
		return
	}
	log.Printf("[AGENT3] Loaded %d asteroid valuations", len(valuations))

	// Step 2: load urgency
	urgencyMap, err := a.db.GetLatestUrgencyMap()
	if err != nil || len(urgencyMap) == 0 {
		log.Printf("[AGENT3] WARN: No urgency data, using defaults")
		urgencyMap = map[string]float64{"cobalt": 0.5, "platinum": 0.4, "iron": 0.1}
	}
	log.Printf("[AGENT3] Urgency map: %d minerals", len(urgencyMap))
	for mineral, u := range urgencyMap {
		if u > 0.5 {
			log.Printf("[AGENT3]   HIGH urgency: %-14s %.3f", mineral, u)
		}
	}

	// Step 3: scenarios
	scenarios, _ := a.db.GetActiveScenarios()
	log.Printf("[AGENT3] Active scenarios: %d", len(scenarios))

	// Step 4: build dv_matrix for top 50
	top50 := valuations
	if len(top50) > 50 {
		top50 = top50[:50]
	}
	dvMatrix := buildDVMatrix(top50)
	log.Printf("[AGENT3] DV matrix built: %d×%d", len(dvMatrix), len(dvMatrix))

	// Step 5: build prompt (top 500 for ranking, top 50 for routes)
	top500 := valuations
	if len(top500) > 500 {
		top500 = top500[:500]
	}

	val500JSON, _ := json.Marshal(top500)
	urgencyJSON, _ := json.Marshal(urgencyMap)
	dvJSON, _ := json.Marshal(dvMatrix)
	scenariosJSON, _ := json.Marshal(scenarios)

	prompt := fmt.Sprintf(
		"Valuations (top %d):\n%s\n\nUrgency map:\n%s\n\nDV matrix (top 50):\n%s\n\nActive scenarios:\n%s\n\nDate: %s",
		len(top500), string(val500JSON), string(urgencyJSON),
		string(dvJSON), string(scenariosJSON), time.Now().Format("2006-01-02"),
	)
	log.Printf("[AGENT3] Prompt built | len=%d chars", len(prompt))
	a.broadcastStatus("active", fmt.Sprintf("Running strategic scoring on %d asteroids + route optimization...", len(top500)))

	// Step 6: call Gemini
	log.Println("[AGENT3] Calling Gemini Antigravity managed agent")
	resp, err := a.gemini.Interact(gemini.AgentAntigravity, systemInstruction, prompt)
	if err != nil {
		log.Printf("[AGENT3] ERROR: Gemini failed: %v — using deterministic fallback", err)
		result := a.deterministicFallback(top500, urgencyMap, dvMatrix, scenarios)
		a.saveAndBroadcast(result, start)
		return
	}

	log.Printf("[AGENT3] Response received | len=%d chars", len(resp.OutputText))
	log.Printf("[AGENT3] Full raw output:\n%.3000s", resp.OutputText)

	cleaned := stripJSON(resp.OutputText)
	var result db.StrategicRanking
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		log.Printf("[AGENT3] ERROR: Parse failed: %v — using fallback", err)
		result = a.deterministicFallback(top500, urgencyMap, dvMatrix, scenarios)
	}

	a.saveAndBroadcast(result, start)
}

func (a *Agent) saveAndBroadcast(result db.StrategicRanking, start time.Time) {
	log.Printf("[AGENT3] Results: %d rankings, %d routes", len(result.Rankings), len(result.Routes))
	for i, r := range result.Rankings {
		if i >= 10 {
			break
		}
		log.Printf("[AGENT3] Rank #%-2d %-20s score=%.3f val=$%.2e mineral=%-12s dv=%.2f boosted=%v",
			r.Rank, r.Name, r.CompositeScore, r.NetValueUSD,
			r.TopMineral, r.DeltaVKmS, r.ScenarioBoosted)
	}
	for _, route := range result.Routes {
		log.Printf("[AGENT3] Route: %-25s urgency=%.2f stops=%d net=$%.2e default=%v scenario=%v",
			route.Label, route.UrgencyScore, len(route.Stops),
			route.Totals.NetReturnUSD, route.IsDefault, route.ScenarioDriven)
	}

	if err := a.db.InsertStrategicRanking(result); err != nil {
		log.Printf("[AGENT3] ERROR: DB insert failed: %v", err)
	}

	a.hub.BroadcastJSON(map[string]interface{}{
		"type":      "rankings_update",
		"rankings":  result.Rankings,
		"routes":    result.Routes,
		"timestamp": time.Now().Format(time.RFC3339),
	})

	elapsed := time.Since(start)
	log.Printf("[AGENT3] ── Run complete in %s ──────────────────────────────────────",
		elapsed.Round(time.Second))
	a.broadcastStatus("idle", fmt.Sprintf("Ranked %d asteroids, computed 5 routes in %s.",
		len(result.Rankings), elapsed.Round(time.Second)))
}

// deterministicFallback ranks purely by net_value when Gemini is down
func (a *Agent) deterministicFallback(
	valuations []db.AsteroidValuation,
	urgencyMap map[string]float64,
	dvMatrix map[string]map[string]float64,
	scenarios []db.Scenario,
) db.StrategicRanking {
	log.Println("[AGENT3] Using deterministic fallback ranking")

	// score
	type scored struct {
		score float64
		v     db.AsteroidValuation
	}
	var scoredList []scored
	for _, v := range valuations {
		netVal := safeFloat(v.Valuation, "net_value_usd")
		topMineral := safeStr(v.Valuation, "top_mineral")
		dv := safeFloat(v.Orbital, "delta_v_km_s")
		if dv == 0 {
			dv = 8
		}
		conf := safeFloat(v.Risk, "composition_confidence")
		urgency := urgencyMap[topMineral]
		s := (math.Log10(math.Max(netVal, 1)) / 18.0 * 0.35) +
			(urgency * 0.25) +
			(math.Max(0, 1.0-dv/12.0) * 0.15) +
			(conf * 0.10)
		scoredList = append(scoredList, scored{s, v})
	}
	sort.Slice(scoredList, func(i, j int) bool {
		return scoredList[i].score > scoredList[j].score
	})

	rankings := []db.RankedAsteroid{}
	for i, sv := range scoredList {
		if i >= 20 {
			break
		}
		topMineral := safeStr(sv.v.Valuation, "top_mineral")
		rankings = append(rankings, db.RankedAsteroid{
			Rank: i + 1, AsteroidID: sv.v.ID, Name: sv.v.Name,
			SpecType: sv.v.SpecType, CompositeScore: sv.score,
			NetValueUSD: safeFloat(sv.v.Valuation, "net_value_usd"),
			ROI:         safeFloat(sv.v.Valuation, "roi"),
			TopMineral:  topMineral, MineralUrgency: urgencyMap[topMineral],
			DeltaVKmS:       safeFloat(sv.v.Orbital, "delta_v_km_s"),
			LaunchWindowYear: 2028,
			Confidence:       safeFloat(sv.v.Risk, "composition_confidence"),
			ScenarioBoosted:  sv.v.ScenarioImpact > 0,
			Reasoning:        fmt.Sprintf("Ranked #%d by composite score %.3f. Net value $%.2e.", i+1, sv.score, safeFloat(sv.v.Valuation, "net_value_usd")),
			Trend:            "flat",
		})
	}

	// build 5 simple routes
	routes := buildFallbackRoutes(scoredList, urgencyMap, dvMatrix)

	return db.StrategicRanking{
		Rankings: rankings, Routes: routes, UrgencyMap: urgencyMap, GeneratedAt: time.Now(),
	}
}

func buildDVMatrix(asteroids []db.AsteroidValuation) map[string]map[string]float64 {
	matrix := map[string]map[string]float64{"Earth": {}}
	for _, a := range asteroids {
		dv := safeFloat(a.Orbital, "delta_v_km_s")
		if dv == 0 {
			dv = 6.0
		}
		matrix["Earth"][a.ID] = dv
		matrix[a.ID] = map[string]float64{"Earth": dv + 1.5}
		for _, b := range asteroids {
			if a.ID != b.ID {
				dvA := safeFloat(a.Orbital, "delta_v_km_s")
				dvB := safeFloat(b.Orbital, "delta_v_km_s")
				if dvA == 0 {
					dvA = 6
				}
				if dvB == 0 {
					dvB = 6
				}
				matrix[a.ID][b.ID] = math.Abs(dvA-dvB) + 1.0
			}
		}
	}
	return matrix
}

func buildFallbackRoutes(
	scoredList []struct {
		score float64
		v     db.AsteroidValuation
	},
	urgencyMap map[string]float64,
	dvMatrix map[string]map[string]float64,
) []db.MissionRoute {
	routeDefs := []struct {
		id, label, color string
		urgencyBoost     float64
		mineral          string
	}{
		{"cobalt_priority", "Cobalt Route", "#3b82f6", 0.0, "cobalt"},
		{"platinum_priority", "Platinum Route", "#94a3b8", 0.0, "platinum"},
		{"rare_earth_priority", "Rare Earth Route", "#f59e0b", 0.0, "neodymium"},
		{"water_fuel_priority", "Water/Fuel Route", "#14b8a6", 0.0, "water_ice"},
		{"best_roi_mixed", "Best ROI Mixed", "#f8fafc", 0.0, ""},
	}

	routes := []db.MissionRoute{}
	maxUrgency := 0.0
	defaultIdx := 0

	for ri, rd := range routeDefs {
		// pick top 3 asteroids for this route's mineral focus
		stops := []db.RouteStop{{Order: 0, Body: "Earth", DepartureYear: 2027}}
		totalDV := 0.0
		totalVal := 0.0

		added := 0
		for _, sv := range scoredList {
			if added >= 3 {
				break
			}
			topMineral := safeStr(sv.v.Valuation, "top_mineral")
			if rd.mineral != "" && topMineral != rd.mineral {
				continue
			}
			dv := safeFloat(sv.v.Orbital, "delta_v_km_s")
			if dv == 0 {
				dv = 6
			}
			val := safeFloat(sv.v.Valuation, "net_value_usd")
			stops = append(stops, db.RouteStop{
				Order: added + 1, AsteroidID: sv.v.ID, Body: sv.v.Name,
				MineralTarget: topMineral, ExtractableValueUSD: val,
				StayDurationDays: 180, DeltaVToNextKmS: dv,
			})
			totalDV += dv
			totalVal += val
			added++
		}
		stops = append(stops, db.RouteStop{Order: len(stops), Body: "Earth", DeltaVToNextKmS: 3.5})
		totalDV += 3.5

		urgency := urgencyMap[rd.mineral]
		if urgency > maxUrgency {
			maxUrgency = urgency
			defaultIdx = ri
		}

		routes = append(routes, db.MissionRoute{
			ID: rd.id, Label: rd.label, ColorHex: rd.color,
			UrgencyScore: urgency, UrgencyReason: fmt.Sprintf("Based on %s market urgency %.2f", rd.mineral, urgency),
			MineralFocus: []string{rd.mineral}, Stops: stops,
			Totals: db.RouteTotals{
				TotalValueUSD: totalVal, NetReturnUSD: totalVal * 0.6,
				TotalDeltaVKmS: totalDV, DurationYears: float64(len(stops)-2) * 1.5,
			},
			RouteReasoning: fmt.Sprintf("Fallback route for %s. %d stops, Δv=%.1f km/s.", rd.label, len(stops)-2, totalDV),
		})
	}

	if len(routes) > 0 {
		routes[defaultIdx].IsDefault = true
	}
	return routes
}

func (a *Agent) broadcastStatus(status, message string) {
	a.hub.BroadcastJSON(map[string]interface{}{
		"type":    "agent_status",
		"agent":   "targeting",
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

func safeStr(m map[string]interface{}, key string) string {
	if m == nil {
		return ""
	}
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
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
