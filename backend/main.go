package main

import (
	"log"
	"net/http"
	"strings"

	"github.com/Jaypatil588/TheOrebitMarket/backend/agents"
	"github.com/Jaypatil588/TheOrebitMarket/backend/api"
	"github.com/Jaypatil588/TheOrebitMarket/backend/websocket"
)

func main() {
	log.Println("==================================================")
	log.Println(" AstroHedge Go Backend starting up...")
	log.Println("==================================================")

	// 1. Create WebSocket Hub & Orchestrator
	hub := websocket.NewHub()
	go hub.Run()
	log.Println("WebSocket Hub initialized and running.")

	orch := agents.NewOrchestrator(hub)
	orch.StartRuns()
	log.Println("Agent Orchestrator background schedules started.")

	// 2. Initialize HTTP Handler layer
	apiInstance := api.NewAPI(orch)

	// 3. Setup HTTP Routing
	mux := http.NewServeMux()

	// REST API Routes
	mux.HandleFunc("/api/asteroids", apiInstance.GetAsteroidsHandler)
	mux.HandleFunc("/api/agents/status", apiInstance.GetAgentStatusHandler)
	mux.HandleFunc("/api/refresh", apiInstance.PostRefreshHandler)
	
	// Detail route handler with path parsing fallback
	mux.HandleFunc("/api/asteroid/", func(w http.ResponseWriter, r *http.Request) {
		// Strip /api/asteroid/ prefix to extract SPKID
		id := strings.TrimPrefix(r.URL.Path, "/api/asteroid/")
		// Set it in query params so handler can find it
		q := r.URL.Query()
		q.Set("id", id)
		r.URL.RawQuery = q.Encode()
		
		apiInstance.GetAsteroidDetailHandler(w, r)
	})

	// WebSocket handler endpoint
	mux.HandleFunc("/feed", func(w http.ResponseWriter, r *http.Request) {
		websocket.ServeWs(hub, w, r)
	})

	// 4. Start HTTP Server on port 8080
	port := ":8080"
	log.Printf("Server listening on http://localhost%s\n", port)
	log.Printf("WebSocket endpoint listening on ws://localhost%s/feed\n", port)
	
	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatalf("Critical Server Error: %v\n", err)
	}
}
