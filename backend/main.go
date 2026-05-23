package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/Jaypatil588/TheOrebitMarket/backend/agents"
	"github.com/Jaypatil588/TheOrebitMarket/backend/api"
	"github.com/Jaypatil588/TheOrebitMarket/backend/db"
	"github.com/Jaypatil588/TheOrebitMarket/backend/engine"
	"github.com/Jaypatil588/TheOrebitMarket/backend/gemini"
	"github.com/Jaypatil588/TheOrebitMarket/backend/websocket"
	"github.com/joho/godotenv"
)

func main() {
	log.Println("==================================================")
	log.Println(" THE OREBIT MARKET — Backend starting...")
	log.Println("==================================================")

	// Load .env (silently ignore if absent — CI/prod uses env vars directly)
	if err := godotenv.Load(); err != nil {
		log.Println("[MAIN] No .env — using OS environment variables")
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Println("[MAIN] WARNING: GEMINI_API_KEY not set — agents will use deterministic fallback")
	} else {
		log.Printf("[MAIN] Gemini API key loaded (len=%d)", len(apiKey))
	}

	// Core subsystems
	store := db.New()
	log.Println("[MAIN] DB store initialized")

	eng := engine.NewEngine()
	log.Printf("[MAIN] Asteroid engine ready | count=%d", eng.Count())

	geminiClient := gemini.NewClient(apiKey)
	log.Println("[MAIN] Gemini client ready")

	hub := websocket.NewHub()
	go hub.Run()
	log.Println("[MAIN] WebSocket hub running")

	// Wire and start all agents
	orch := agents.NewOrchestrator(geminiClient, store, hub, eng)
	orch.Start()
	log.Println("[MAIN] Orchestrator started — Agent 2 looping, Agent 1 pending first market cycle")

	// HTTP layer
	h := api.NewAPI(orch, store, eng)
	mux := http.NewServeMux()

	// Core endpoints
	mux.HandleFunc("/api/asteroids", h.GetAsteroidsHandler)
	mux.HandleFunc("/api/agents/status", h.GetAgentStatusHandler)
	mux.HandleFunc("/api/agents/report", h.PostMissionReportHandler)
	mux.HandleFunc("/api/refresh", h.PostRefreshHandler)

	// Asteroid detail — strip /api/asteroid/ prefix into query param
	mux.HandleFunc("/api/asteroid/", func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/api/asteroid/")
		q := r.URL.Query()
		q.Set("id", id)
		r.URL.RawQuery = q.Encode()
		h.GetAsteroidDetailHandler(w, r)
	})

	// Scenario injection
	mux.HandleFunc("/api/scenario", h.PostScenarioHandler)
	mux.HandleFunc("/api/scenario/", h.DeleteScenarioHandler)
	mux.HandleFunc("/api/scenarios", h.GetScenariosHandler)

	// Data query endpoints
	mux.HandleFunc("/api/rankings", h.GetRankingsHandler)
	mux.HandleFunc("/api/prices", h.GetPricesHandler)

	// Validation test suite (20 checks)
	mux.HandleFunc("/api/test", h.GetTestHandler)

	// WebSocket live feed
	mux.HandleFunc("/feed", func(w http.ResponseWriter, r *http.Request) {
		websocket.ServeWs(hub, w, r)
	})

	port := ":8080"
	log.Printf("[MAIN] Server ready → http://localhost%s", port)
	log.Printf("[MAIN] WebSocket   → ws://localhost%s/feed", port)
	log.Printf("[MAIN] Test suite  → GET http://localhost%s/api/test", port)

	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatalf("[MAIN] Fatal: %v", err)
	}
}
