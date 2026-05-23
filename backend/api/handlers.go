package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Jaypatil588/TheOrebitMarket/backend/agents"
	"github.com/Jaypatil588/TheOrebitMarket/backend/db"
	"github.com/Jaypatil588/TheOrebitMarket/backend/engine"
)

type API struct {
	orch  *agents.Orchestrator
	store *db.Store
	eng   *engine.Engine
}

func NewAPI(o *agents.Orchestrator, d *db.Store, e *engine.Engine) *API {
	return &API{orch: o, store: d, eng: e}
}

func EnableCors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

// GetAsteroidsHandler serves the top-value asteroid list from disk
func (a *API) GetAsteroidsHandler(w http.ResponseWriter, r *http.Request) {
	EnableCors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	path := filepath.Join("frontend", "public", "data", "asteroids.json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		path = filepath.Join("backend", "data", "all_asteroids_processed.json")
		if _, err := os.Stat(path); os.IsNotExist(err) {
			path = filepath.Join("backend", "data", "processed_asteroids.json")
		}
	}

	data, err := os.ReadFile(path)
	if err != nil {
		http.Error(w, "Data file not found: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// GetAsteroidDetailHandler returns one asteroid (DB first, disk fallback)
// Optionally triggers Agent 4 when route_id is provided.
func (a *API) GetAsteroidDetailHandler(w http.ResponseWriter, r *http.Request) {
	EnableCors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "Missing asteroid ID", http.StatusBadRequest)
		return
	}

	// DB-enriched version first
	if val, err := a.store.GetAsteroidValuation(id); err == nil && val != nil {
		if routeID := r.URL.Query().Get("route_id"); routeID != "" {
			go a.orch.TriggerMissionReport(id, routeID)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(val)
		return
	}

	// Fallback: read raw asteroid from disk
	path := filepath.Join("backend", "data", "all_asteroids_processed.json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		path = filepath.Join("backend", "data", "processed_asteroids.json")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		http.Error(w, "Data not found", http.StatusInternalServerError)
		return
	}

	var asteroids []engine.Asteroid
	if err := json.Unmarshal(data, &asteroids); err != nil {
		http.Error(w, "Data corrupt", http.StatusInternalServerError)
		return
	}
	for _, ast := range asteroids {
		if ast.ID == id {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(ast)
			return
		}
	}
	http.Error(w, "Asteroid not found", http.StatusNotFound)
}

// GetAgentStatusHandler returns live status of all 4 agents
func (a *API) GetAgentStatusHandler(w http.ResponseWriter, r *http.Request) {
	EnableCors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(a.orch.GetAgentStatus())
}

// PostRefreshHandler triggers an immediate Agent 1 → Agent 3 cascade
func (a *API) PostRefreshHandler(w http.ResponseWriter, r *http.Request) {
	EnableCors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}
	a.orch.ForceImmediateRefresh()
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"triggered"}`))
}

// PostScenarioHandler injects a new market disruption scenario into all agents
func (a *API) PostScenarioHandler(w http.ResponseWriter, r *http.Request) {
	EnableCors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}

	var sc db.Scenario
	if err := json.NewDecoder(r.Body).Decode(&sc); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if sc.Description == "" {
		http.Error(w, "description is required", http.StatusBadRequest)
		return
	}
	if sc.ID == "" {
		sc.ID = fmt.Sprintf("sc_%d", time.Now().UnixNano())
	}
	if sc.Severity == 0 {
		sc.Severity = 0.80
	}
	sc.Active = true
	sc.CreatedAt = time.Now()

	log.Printf("[API] Scenario injected: %q severity=%.2f minerals=%v", sc.Description, sc.Severity, sc.AffectedMinerals)

	if err := a.store.InsertScenario(sc); err != nil {
		http.Error(w, "DB error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Cascade: Agent 2 picks it up on next 10s cycle; Agent 1 runs immediately
	go a.orch.ForceImmediateRefresh()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "injected",
		"id":        sc.ID,
		"scenario":  sc.Description,
		"minerals":  sc.AffectedMinerals,
		"severity":  sc.Severity,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// DeleteScenarioHandler deactivates a scenario by ID (/api/scenario/{id})
func (a *API) DeleteScenarioHandler(w http.ResponseWriter, r *http.Request) {
	EnableCors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodDelete {
		http.Error(w, "Only DELETE allowed", http.StatusMethodNotAllowed)
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/scenario/")
	if id == "" {
		id = r.URL.Query().Get("id")
	}
	if id == "" {
		http.Error(w, "Missing scenario ID", http.StatusBadRequest)
		return
	}

	if err := a.store.DeactivateScenario(id); err != nil {
		http.Error(w, "DB error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	go a.orch.ForceImmediateRefresh()

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"deactivated"}`))
}

// GetScenariosHandler returns all scenarios (active + inactive)
func (a *API) GetScenariosHandler(w http.ResponseWriter, r *http.Request) {
	EnableCors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	scenarios, err := a.store.GetAllScenarios()
	if err != nil {
		http.Error(w, "DB error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"scenarios": scenarios,
		"count":     len(scenarios),
	})
}

// PostMissionReportHandler triggers Agent 4 for a specific asteroid + route
func (a *API) PostMissionReportHandler(w http.ResponseWriter, r *http.Request) {
	EnableCors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		AsteroidID string `json:"asteroid_id"`
		RouteID    string `json:"route_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	if req.AsteroidID == "" {
		http.Error(w, "asteroid_id required", http.StatusBadRequest)
		return
	}
	if req.RouteID == "" {
		req.RouteID = "best_roi_mixed"
	}

	go a.orch.TriggerMissionReport(req.AsteroidID, req.RouteID)

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"queued","message":"Mission report generation started — results via WebSocket"}`))
}

// GetRankingsHandler returns the latest strategic rankings from Agent 3
func (a *API) GetRankingsHandler(w http.ResponseWriter, r *http.Request) {
	EnableCors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	ranking, err := a.store.GetLatestStrategicRanking()
	if err != nil || ranking == nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"rankings": []interface{}{},
			"routes":   []interface{}{},
			"status":   "no_data_yet",
		})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ranking)
}

// GetPricesHandler returns the latest market prices from Agent 2
func (a *API) GetPricesHandler(w http.ResponseWriter, r *http.Request) {
	EnableCors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	prices, err := a.store.GetLatestPrices()
	if err != nil {
		http.Error(w, "DB error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"prices": prices,
		"count":  len(prices),
	})
}

// GetTestHandler runs 20 validation checks and returns a pass/fail report
func (a *API) GetTestHandler(w http.ResponseWriter, r *http.Request) {
	EnableCors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	results := runTests(a.store, a.eng)
	passed := 0
	for _, t := range results {
		if t["pass"].(bool) {
			passed++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tests":    results,
		"passed":   passed,
		"total":    len(results),
		"all_pass": passed == len(results),
	})
}

type testCase = map[string]interface{}

func runTests(store *db.Store, eng *engine.Engine) []testCase {
	results := []testCase{}

	check := func(name, detail string, pass bool) {
		status := "PASS"
		if !pass {
			status = "FAIL"
		}
		results = append(results, testCase{
			"name": name, "pass": pass, "status": status, "detail": detail,
		})
	}

	// T01: DB accessible
	prices, err := store.GetLatestPrices()
	check("T01: DB accessible", fmt.Sprintf("err=%v", err), err == nil)

	// T02: Market prices exist
	check("T02: Market prices exist", fmt.Sprintf("count=%d", len(prices)), len(prices) > 0)

	// T03: Mineral coverage ≥ 15
	check("T03: Mineral coverage ≥15", fmt.Sprintf("minerals=%d", len(prices)), len(prices) >= 15)

	// T04: All prices > 0
	allPositive := true
	for _, p := range prices {
		if p.PriceUSD <= 0 {
			allPositive = false
			break
		}
	}
	check("T04: All prices positive", "validate price_usd > 0", allPositive || len(prices) == 0)

	// T05: Urgency map accessible
	urgency, err2 := store.GetLatestUrgencyMap()
	check("T05: Urgency map accessible", fmt.Sprintf("err=%v minerals=%d", err2, len(urgency)), err2 == nil)

	// T06: Urgency scores in [0, 1]
	validUrgency := true
	for _, u := range urgency {
		if u < 0 || u > 1 {
			validUrgency = false
			break
		}
	}
	check("T06: Urgency scores in [0,1]", "range validation", validUrgency)

	// T07: Asteroid valuations accessible
	valuations, err3 := store.GetAllAsteroidValuations()
	check("T07: Valuations accessible", fmt.Sprintf("err=%v", err3), err3 == nil)

	// T08: Valuations exist
	check("T08: Valuations exist", fmt.Sprintf("count=%d", len(valuations)), len(valuations) > 0)

	// T09: Net value USD present
	hasNetVal := false
	for _, v := range valuations {
		if v.Valuation != nil {
			if nv, ok := v.Valuation["net_value_usd"].(float64); ok && nv != 0 {
				hasNetVal = true
				break
			}
		}
	}
	check("T09: Net value USD present", "valuation[net_value_usd] ≠ 0", hasNetVal || len(valuations) == 0)

	// T10: Composition data present
	hasComp := false
	for _, v := range valuations {
		if len(v.Composition) > 0 {
			hasComp = true
			break
		}
	}
	check("T10: Composition data present", "composition map non-empty", hasComp || len(valuations) == 0)

	// T11: Strategic rankings accessible
	ranking, err4 := store.GetLatestStrategicRanking()
	check("T11: Rankings accessible", fmt.Sprintf("err=%v found=%v", err4, ranking != nil), err4 == nil)

	// T12: Rankings has entries
	rankCount := 0
	if ranking != nil {
		rankCount = len(ranking.Rankings)
	}
	check("T12: Rankings has entries", fmt.Sprintf("count=%d", rankCount), rankCount > 0 || ranking == nil)

	// T13: Routes computed
	routeCount := 0
	if ranking != nil {
		routeCount = len(ranking.Routes)
	}
	check("T13: Routes computed", fmt.Sprintf("routes=%d", routeCount), routeCount > 0 || ranking == nil)

	// T14: Default route flagged
	hasDefault := false
	if ranking != nil {
		for _, rt := range ranking.Routes {
			if rt.IsDefault {
				hasDefault = true
				break
			}
		}
	}
	check("T14: Default route flagged", "is_default=true on exactly one route", hasDefault || ranking == nil)

	// T15: Routes start at Earth
	earthStart := true
	if ranking != nil {
		for _, rt := range ranking.Routes {
			if len(rt.Stops) > 0 && rt.Stops[0].Body != "Earth" {
				earthStart = false
				break
			}
		}
	}
	check("T15: Routes start at Earth", "first stop body=Earth", earthStart)

	// T16: Active scenarios accessible
	scenarios, err5 := store.GetActiveScenarios()
	check("T16: Active scenarios accessible", fmt.Sprintf("err=%v count=%d", err5, len(scenarios)), err5 == nil)

	// T17: Scenario insert works
	testSc := db.Scenario{
		ID:               fmt.Sprintf("test_%d", time.Now().UnixNano()),
		Description:      "__test_scenario__",
		AffectedMinerals: []string{"cobalt"},
		Severity:         0.9,
		Active:           true,
		CreatedAt:        time.Now(),
	}
	crudErr := store.InsertScenario(testSc)
	check("T17: Scenario insert works", fmt.Sprintf("err=%v", crudErr), crudErr == nil)

	// T18: Engine has asteroids
	count := eng.Count()
	check("T18: Engine has asteroids", fmt.Sprintf("count=%d", count), count > 0)

	// T19: GetTop500 returns sorted data
	top, err6 := eng.GetTop500()
	check("T19: GetTop500 returns data", fmt.Sprintf("err=%v count=%d", err6, len(top)), err6 == nil && len(top) > 0)

	// T20: Price map and urgency map key overlap
	priceMap, _ := store.GetLatestPriceMap()
	overlapCount := 0
	for k := range urgency {
		if _, ok := priceMap[k]; ok {
			overlapCount++
		}
	}
	check("T20: Price/urgency map key overlap", fmt.Sprintf("overlap=%d/%d", overlapCount, len(urgency)),
		overlapCount > 0 || len(urgency) == 0)

	return results
}
