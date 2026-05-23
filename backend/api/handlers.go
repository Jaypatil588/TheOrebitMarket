package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"github.com/Jaypatil588/TheOrebitMarket/backend/agents"
	"github.com/Jaypatil588/TheOrebitMarket/backend/engine"
)

type API struct {
	Orch *agents.Orchestrator
}

func NewAPI(o *agents.Orchestrator) *API {
	return &API{Orch: o}
}

// EnableCors sets necessary headers for cross-origin frontend support
func EnableCors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

// GetAsteroidsHandler serves the top-value processed asteroid list
func (a *API) GetAsteroidsHandler(w http.ResponseWriter, r *http.Request) {
	EnableCors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	path := filepath.Join("frontend", "public", "data", "asteroids.json")
	// Fallback to backend data if not found
	if _, err := os.Stat(path); os.IsNotExist(err) {
		path = filepath.Join("backend", "data", "all_asteroids_processed.json")
		if _, err := os.Stat(path); os.IsNotExist(err) {
			path = filepath.Join("backend", "data", "processed_asteroids.json")
		}
	}

	data, err := os.ReadFile(path)
	if err != nil {
		http.Error(w, "Database file not found: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// GetAsteroidDetailHandler serves a single asteroid by its SPK-ID and triggers the Mission Architect
func (a *API) GetAsteroidDetailHandler(w http.ResponseWriter, r *http.Request) {
	EnableCors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Use path matching
	id := r.PathValue("id")
	if id == "" {
		// Fallback for older go versions (<1.22) if query is used
		id = r.URL.Query().Get("id")
	}
	
	if id == "" {
		http.Error(w, "Missing asteroid ID", http.StatusBadRequest)
		return
	}

	path := filepath.Join("backend", "data", "all_asteroids_processed.json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		path = filepath.Join("backend", "data", "processed_asteroids.json")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		http.Error(w, "Database file not found", http.StatusInternalServerError)
		return
	}

	var asteroids []engine.Asteroid
	if err := json.Unmarshal(data, &asteroids); err != nil {
		http.Error(w, "Database corrupt", http.StatusInternalServerError)
		return
	}

	var target engine.Asteroid
	found := false
	for _, ast := range asteroids {
		if ast.ID == id {
			target = ast
			found = true
			break
		}
	}

	if !found {
		http.Error(w, "Asteroid not found", http.StatusNotFound)
		return
	}

	// Trigger Mission Architect simulation in background for this asteroid
	a.Orch.TriggerMissionArchitect(target.ID, target.Name)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(target)
}

// GetAgentStatusHandler serves statuses of simulated agents
func (a *API) GetAgentStatusHandler(w http.ResponseWriter, r *http.Request) {
	EnableCors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(a.Orch.GetAgentStatus())
}

// PostRefreshHandler triggers an immediate full recalculation cycle
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

	a.Orch.ForceImmediateRefresh()
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"triggered"}`))
}
