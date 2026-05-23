package agents

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/Jaypatil588/TheOrebitMarket/backend/websocket"
)

var (
	AgentsList  = []string{"AH-089", "AH-042", "AH-077", "AH-012"}
	SectorsList = []string{"Alpha-4", "Beta-9", "Delta-1", "Gamma-6", "Epsilon-3"}
	NamesList   = []string{"Bennu-X", "Apophis-Beta", "Psyche-16-Min", "Eros-Prime", "Ceres-Minor", "Ryugu-Alpha", "Itokawa-9"}
	
	MessagesList = []struct {
		Type    string
		Message string
	}{
		{"info", "Radar ping dispatched to Sector %s."},
		{"telemetry", "Concentric orbit synchronization locked. Pitch 45.0°."},
		{"discovery", "Asteroid '%s' identified in Orbit Ring %d."},
		{"success", "Basalt rock composition analyzed: %s."},
		{"info", "Drone %s starting spectral scanning sequence."},
		{"warning", "Orbit Ring %d showing minor gravitational deviation (+0.04m/s²)."},
		{"telemetry", "Position updated: %s."},
		{"success", "Mining route computed. Fuel efficiency factor: 94.2%."},
		{"info", "Downloading raw laser reflectometry profiles..."},
		{"warning", "Solar wind interference detected. Adjusting filter bandwidth."},
	}
)

type Orchestrator struct {
	hub            *websocket.Hub
	activeAgents   map[string]bool
	mu             sync.RWMutex
	lastRun        time.Time
	refreshCounter int
}

func NewOrchestrator(h *websocket.Hub) *Orchestrator {
	return &Orchestrator{
		hub:          h,
		activeAgents: make(map[string]bool),
		lastRun:      time.Now(),
	}
}

// StartRuns starts background orchestration loops
func (o *Orchestrator) StartRuns() {
	go o.simulateTelemetryLogs()
	go o.countdownLoop()
}

// simulateTelemetryLogs periodically streams authentic-looking telemetry logs
func (o *Orchestrator) simulateTelemetryLogs() {
	ticker := time.NewTicker(4500 * time.Millisecond)
	for range ticker.C {
		o.TriggerSimulatedTelemetry()
	}
}

func (o *Orchestrator) TriggerSimulatedTelemetry() {
	agent := AgentsList[rand.Intn(len(AgentsList))]
	sector := SectorsList[rand.Intn(len(SectorsList))]
	ring := rand.Intn(4) + 1
	name := NamesList[rand.Intn(len(NamesList))]
	msgTemplate := MessagesList[rand.Intn(len(MessagesList))]

	var formattedMsg string
	switch msgTemplate.Type {
	case "info":
		if rand.Intn(2) == 0 {
			formattedMsg = fmt.Sprintf(msgTemplate.Message, sector)
		} else {
			drone := fmt.Sprintf("AH-D%d", rand.Intn(9)+1)
			formattedMsg = fmt.Sprintf("Drone %s starting spectral scanning sequence.", drone)
		}
	case "discovery":
		formattedMsg = fmt.Sprintf(msgTemplate.Message, name, ring)
	case "success":
		if rand.Intn(2) == 0 {
			compVal := fmt.Sprintf("%.1f%% basalt, %.1f%% magnetite, %.2f%% platinum group metals", 80.0+rand.Float64()*15, 2.0+rand.Float64()*8, 0.1+rand.Float64()*1.5)
			formattedMsg = fmt.Sprintf(msgTemplate.Message, compVal)
		} else {
			formattedMsg = msgTemplate.Message
		}
	case "warning":
		if rand.Intn(2) == 0 {
			formattedMsg = fmt.Sprintf(msgTemplate.Message, ring)
		} else {
			formattedMsg = msgTemplate.Message
		}
	case "telemetry":
		if rand.Intn(2) == 0 {
			coordsVal := fmt.Sprintf("X:+%.4f Y:-1.2000 Z:%.4f", rand.Float64()*4-2.0, rand.Float64()*6-3.0)
			formattedMsg = fmt.Sprintf(msgTemplate.Message, coordsVal)
		} else {
			formattedMsg = msgTemplate.Message
		}
	default:
		formattedMsg = msgTemplate.Message
	}

	logEntry := LogEntry{
		ID:        GenerateRandomID(),
		Timestamp: FormatTime(time.Now()),
		Type:      msgTemplate.Type,
		AgentID:   agent,
		Message:   formattedMsg,
	}

	o.hub.BroadcastJSON(logEntry)
}

// countdownLoop manages agent cycle states
func (o *Orchestrator) countdownLoop() {
	o.refreshCounter = 227 // Starts at 3:47 (227 seconds)
	ticker := time.NewTicker(1 * time.Second)
	for range ticker.C {
		o.mu.Lock()
		o.refreshCounter--
		if o.refreshCounter <= 0 {
			o.refreshCounter = 240 // Reset to 4:00
			o.mu.Unlock()
			go o.RunFullAgentCycle()
		} else {
			o.mu.Unlock()
		}
	}
}

// RunFullAgentCycle simulates the orchestrator executing Market Intelligence, Discovery Scout, and Strategic Ranker in phases
func (o *Orchestrator) RunFullAgentCycle() {
	o.mu.Lock()
	o.activeAgents["Market Intel"] = true
	o.activeAgents["Discovery Scout"] = true
	o.mu.Unlock()
	
	// Phase 1: Fire Independent Agents
	o.hub.BroadcastJSON(LogEntry{
		ID:        GenerateRandomID(),
		Timestamp: FormatTime(time.Now()),
		Type:      "info",
		AgentID:   "AH-089",
		Message:   "Agent Orchestrator firing Phase 1 Agents (Market Intel & Discovery Scout) in parallel sandboxes...",
	})

	time.Sleep(3 * time.Second)
	
	o.hub.BroadcastJSON(LogEntry{
		ID:        GenerateRandomID(),
		Timestamp: FormatTime(time.Now()),
		Type:      "success",
		AgentID:   "AH-089",
		Message:   "Market Intelligence Agent: Analyzed nickel supply disruptions in DRC. High scarcity detected.",
	})
	
	o.hub.BroadcastJSON(LogEntry{
		ID:        GenerateRandomID(),
		Timestamp: FormatTime(time.Now()),
		Type:      "success",
		AgentID:   "AH-012",
		Message:   "Discovery Scout Agent: Identified 2 new NEOs. Estimated sizes: 120m and 340m. Adding to tracking roster.",
	})

	o.mu.Lock()
	o.activeAgents["Market Intel"] = false
	o.activeAgents["Discovery Scout"] = false
	o.activeAgents["Strategic Ranker"] = true
	o.mu.Unlock()

	time.Sleep(2 * time.Second)

	// Phase 2: Fire Strategic Ranker
	o.hub.BroadcastJSON(LogEntry{
		ID:        GenerateRandomID(),
		Timestamp: FormatTime(time.Now()),
		Type:      "info",
		AgentID:   "AH-077",
		Message:   "Strategic Ranker Agent: Starting multi-variable mining target optimization...",
	})

	time.Sleep(3 * time.Second)

	o.hub.BroadcastJSON(LogEntry{
		ID:        GenerateRandomID(),
		Timestamp: FormatTime(time.Now()),
		Type:      "success",
		AgentID:   "AH-077",
		Message:   "Strategic Ranker Agent: Recomputed all global routes. Top target: 1036 Ganymed ($6.76e+18 USD value).",
	})

	o.mu.Lock()
	o.activeAgents["Strategic Ranker"] = false
	o.lastRun = time.Now()
	o.mu.Unlock()
}

// TriggerMissionArchitect simulates launching the mission architect agent for a specific asteroid deep dive
func (o *Orchestrator) TriggerMissionArchitect(asteroidID string, asteroidName string) {
	o.mu.Lock()
	o.activeAgents["Mission Architect"] = true
	o.mu.Unlock()

	go func() {
		o.hub.BroadcastJSON(LogEntry{
			ID:        GenerateRandomID(),
			Timestamp: FormatTime(time.Now()),
			Type:      "info",
			AgentID:   "AH-042",
			Message:   fmt.Sprintf("Mission Architect Agent: Initializing mission plan profile for Asteroid %s (ID %s)...", asteroidName, asteroidID),
		})

		time.Sleep(2 * time.Second)

		o.hub.BroadcastJSON(LogEntry{
			ID:        GenerateRandomID(),
			Timestamp: FormatTime(time.Now()),
			Type:      "telemetry",
			AgentID:   "AH-042",
			Message:   "Mission Architect Agent: Computing Falcon Heavy launch vector, delta-v payloads, and fuel mass requirements...",
		})

		time.Sleep(2 * time.Second)

		o.hub.BroadcastJSON(LogEntry{
			ID:        GenerateRandomID(),
			Timestamp: FormatTime(time.Now()),
			Type:      "success",
			AgentID:   "AH-042",
			Message:   fmt.Sprintf("Mission Architect Agent: Completed. Recommended method: Robotic core magnetic separation. Surface duration: 18 months."),
		})

		o.mu.Lock()
		o.activeAgents["Mission Architect"] = false
		o.mu.Unlock()
	}()
}

// GetAgentStatus Returns status structure for the UI
func (o *Orchestrator) GetAgentStatus() interface{} {
	o.mu.RLock()
	defer o.mu.RUnlock()

	active := []string{}
	idle := []string{"Market Intel", "Mission Architect", "Strategic Ranker", "Discovery Scout"}

	for ag, act := range o.activeAgents {
		if act {
			active = append(active, ag)
			// Remove from idle
			for i, v := range idle {
				if v == ag {
					idle = append(idle[:i], idle[i+1:]...)
					break
				}
			}
		}
	}

	return map[string]interface{}{
		"active_agents":        active,
		"idle_agents":          idle,
		"last_refresh":         FormatTime(o.lastRun),
		"next_refresh_seconds": o.refreshCounter,
	}
}

// ForceImmediateRefresh triggers a reload
func (o *Orchestrator) ForceImmediateRefresh() {
	o.mu.Lock()
	o.refreshCounter = 240
	o.mu.Unlock()
	go o.RunFullAgentCycle()
}
