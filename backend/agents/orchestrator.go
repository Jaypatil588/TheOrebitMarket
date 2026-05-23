package agents

import (
	"log"
	"sync"
	"time"

	a1 "github.com/Jaypatil588/TheOrebitMarket/backend/agents/agent1_valuation"
	a2 "github.com/Jaypatil588/TheOrebitMarket/backend/agents/agent2_market"
	a3 "github.com/Jaypatil588/TheOrebitMarket/backend/agents/agent3_targeting"
	a4 "github.com/Jaypatil588/TheOrebitMarket/backend/agents/agent4_mission"
	"github.com/Jaypatil588/TheOrebitMarket/backend/db"
	"github.com/Jaypatil588/TheOrebitMarket/backend/engine"
	"github.com/Jaypatil588/TheOrebitMarket/backend/gemini"
	"github.com/Jaypatil588/TheOrebitMarket/backend/websocket"
)

// Orchestrator wires all 4 agents and manages the data flow lifecycle.
type Orchestrator struct {
	agent1    *a1.Agent
	agent2    *a2.Agent
	agent3    *a3.Agent
	agent4    *a4.Agent
	hub       *websocket.Hub
	store     *db.Store
	mu        sync.RWMutex
	startedAt time.Time
}

// NewOrchestrator wires all 4 agents with cascading callbacks:
// Agent2 price shift → Agent1 valuation → Agent3 targeting
func NewOrchestrator(g *gemini.Client, d *db.Store, h *websocket.Hub, e *engine.Engine) *Orchestrator {
	o := &Orchestrator{hub: h, store: d, startedAt: time.Now()}

	// Agent 3: no outbound callback — triggered by Agent 1
	o.agent3 = a3.New(g, d, h)

	// Agent 1: on complete → trigger Agent 3
	o.agent1 = a1.New(g, d, h, e, func() {
		log.Println("[ORCH] Agent 1 complete → triggering Agent 3 (targeting)")
		go o.agent3.Run()
	})

	// Agent 2: on price shift → trigger Agent 1
	o.agent2 = a2.New(g, d, h, func(shifts []string) {
		log.Printf("[ORCH] Agent 2 price shift detected: %v → triggering Agent 1 (valuation)", shifts)
		go o.agent1.Run()
	})

	// Agent 4: on-demand only, triggered via TriggerMissionReport
	o.agent4 = a4.New(g, d, h)

	return o
}

// Start fires Agent 2 in a goroutine (runs forever), then waits for the first
// market cycle to complete before booting Agent 1.
func (o *Orchestrator) Start() {
	log.Println("[ORCH] Starting — launching Agent 2 (market feed)")
	go o.agent2.RunForever()

	go func() {
		log.Println("[ORCH] Waiting for Agent 2 first market cycle...")
		for !o.agent2.HasFirstRun {
			time.Sleep(500 * time.Millisecond)
		}
		log.Println("[ORCH] Agent 2 ready → booting Agent 1 (valuation deep research)")
		go o.agent1.Run()
	}()
}

// TriggerMissionReport fires Agent 4 asynchronously for a specific asteroid + route.
func (o *Orchestrator) TriggerMissionReport(asteroidID, routeID string) {
	log.Printf("[ORCH] Mission report queued: asteroid=%s route=%s", asteroidID, routeID)
	o.agent4.RunAsync(asteroidID, routeID)
}

// ForceImmediateRefresh immediately re-triggers the Agent 1 → Agent 3 cascade.
// Agent 2 will pick up any new scenarios on its next 10s cycle regardless.
func (o *Orchestrator) ForceImmediateRefresh() {
	log.Println("[ORCH] Force refresh → triggering Agent 1")
	go o.agent1.Run()
}

// GetAgentStatus returns live status of all agents for the REST endpoint.
func (o *Orchestrator) GetAgentStatus() interface{} {
	o.mu.RLock()
	defer o.mu.RUnlock()

	marketStatus := "initializing"
	if o.agent2.HasFirstRun {
		marketStatus = "active"
	}
	valStatus := "idle"
	if o.agent1.IsRunning {
		valStatus = "active"
	}
	rankStatus := "idle"
	if o.agent3.IsRunning {
		rankStatus = "active"
	}

	return map[string]interface{}{
		"agents": []map[string]interface{}{
			{
				"id":     "market_feed",
				"name":   "Market Intelligence",
				"role":   "Live commodity price scraping via managed agents",
				"status": marketStatus,
			},
			{
				"id":     "valuation",
				"name":   "Valuation Scout",
				"role":   "Asteroid composition & value deep research",
				"status": valStatus,
			},
			{
				"id":     "targeting",
				"name":   "Strategic Ranker",
				"role":   "Route optimization & target ranking",
				"status": rankStatus,
			},
			{
				"id":     "mission_report",
				"name":   "Mission Architect",
				"role":   "On-demand deep research mission planner",
				"status": "idle",
			},
		},
		"uptime_seconds": time.Since(o.startedAt).Seconds(),
	}
}
