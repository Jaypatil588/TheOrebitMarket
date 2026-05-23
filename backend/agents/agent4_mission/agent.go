package agent4_mission

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/Jaypatil588/TheOrebitMarket/backend/db"
	"github.com/Jaypatil588/TheOrebitMarket/backend/gemini"
	"github.com/Jaypatil588/TheOrebitMarket/backend/websocket"
)

const systemInstruction = `
You are a mission intelligence officer producing a full mission brief for ONE specific asteroid.
You receive: asteroid data, its mining route context, live prices, and active market scenarios.

## RESEARCH — Execute in this order:

1. Search "[asteroid_name] spectral type composition observations"
2. Search "[primary_mineral] supply chain disruption [current_year]"
3. Search "[primary_mineral] demand forecast [current_year]"
4. Search "launch vehicle [delta_v] km/s deep space mission [current_year]"
5. Search "asteroid [spec_type]-type mining method TRL [current_year]"

## GENERATE 4 IMAGES — Python code in your sandbox:

### Image 1: asteroid_render.png (800×600)
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
fig, ax = plt.subplots(1, 1, figsize=(8, 6), facecolor='#0a0a0f')
ax.set_facecolor('#0a0a0f')
# Star field
np.random.seed(42)
stars_x, stars_y = np.random.rand(200), np.random.rand(200)
ax.scatter(stars_x, stars_y, s=np.random.rand(200)*2+0.2, c='white', alpha=0.6, transform=ax.transAxes)
# Asteroid sphere using scatter with noise
theta = np.linspace(0, 2*np.pi, 1000)
r = 0.35 + 0.03*np.random.randn(1000)
x_ast = 0.5 + r*np.cos(theta)
y_ast = 0.5 + r*np.sin(theta)
# Color by spec_type: M=silver, S=brown, C=dark_grey, D=reddish
color_map = {'M':'#C0C0C0','S':'#8B6914','C':'#404040','D':'#8B4513','V':'#708090'}
ast_color = color_map.get(spec_type, '#808080')
ax.fill(x_ast, y_ast, color=ast_color, alpha=0.85, transform=ax.transAxes)
# Shading/lighting effect
circle = plt.Circle((0.38, 0.58), 0.33, color='black', alpha=0.4, transform=ax.transAxes)
ax.add_patch(circle)
ax.text(0.05, 0.08, f"{asteroid_name}  |  {diameter_km:.2f} km  |  {spec_type}-type",
        transform=ax.transAxes, color='white', fontsize=10, fontfamily='monospace')
ax.axis('off')
plt.tight_layout(pad=0)
plt.savefig('asteroid_render.png', dpi=100, bbox_inches='tight', facecolor='#0a0a0f')
import base64, io
buf = io.BytesIO()
plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', facecolor='#0a0a0f')
buf.seek(0)
asteroid_render_b64 = base64.b64encode(buf.read()).decode()

### Image 2: composition_map.png (700×700)
import matplotlib.pyplot as plt
minerals = list(composition.keys())
values = list(composition.values())
colors = {'iron':'#8B8B8B','nickel':'#B8860B','cobalt':'#4169E1','platinum_group':'#E5E4E2',
          'silicon':'#DEB887','water_ice':'#87CEEB','neodymium':'#9370DB','carbon':'#2F2F2F',
          'magnesium':'#98FB98','stonyMatrix':'#A0522D','clayMinerals':'#8FBC8F','platinumGroup':'#E5E4E2'}
fig, ax = plt.subplots(figsize=(7,7), facecolor='#0a0a0f')
ax.set_facecolor('#0a0a0f')
wedge_colors = [colors.get(m, '#666666') for m in minerals]
wedges, texts, autotexts = ax.pie(values, labels=minerals, colors=wedge_colors,
    autopct='%1.1f%%', pctdistance=0.75, startangle=90,
    wedgeprops={'edgecolor':'#0a0a0f','linewidth':2})
for t in texts: t.set_color('white'); t.set_fontsize(9)
for t in autotexts: t.set_color('white'); t.set_fontsize(8)
ax.set_title(f"{asteroid_name} — Mineral Composition", color='white', fontsize=12, pad=20)
plt.tight_layout()
import base64, io
buf = io.BytesIO()
plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', facecolor='#0a0a0f')
buf.seek(0)
composition_map_b64 = base64.b64encode(buf.read()).decode()

### Image 3: route_map.png (900×900)
import matplotlib.pyplot as plt, matplotlib.patches as mpatches, numpy as np
fig, ax = plt.subplots(figsize=(9,9), facecolor='#0a0a0f')
ax.set_facecolor('#0a0a0f')
ax.set_xlim(-3,3); ax.set_ylim(-3,3)
# Sun
ax.scatter([0],[0],s=500,c='#FFD700',zorder=5)
ax.text(0.05,0.05,'☀',fontsize=14,color='#FFD700',ha='center')
# Orbits
for r,c,lbl in [(1.0,'#4169E1','Earth'),(1.52,'#CD853F','Mars')]:
    circle = plt.Circle((0,0),r,fill=False,color=c,alpha=0.3,linestyle='--',linewidth=1)
    ax.add_patch(circle)
    ax.text(r+0.05,0.05,lbl,color=c,fontsize=8,alpha=0.7)
# Earth marker
ax.scatter([1],[0],s=100,c='#4169E1',zorder=5)
# Asteroid position
import math
a_val = float(orbital.get('a', 1.5))
angle = float(orbital.get('angle', 45)) * math.pi / 180
ax_pos = a_val * math.cos(angle); ay_pos = a_val * math.sin(angle)
ax.scatter([ax_pos],[ay_pos],s=200,c='#FF4500',zorder=6)
ax.text(ax_pos+0.1,ay_pos+0.1,asteroid_name,color='#FF4500',fontsize=9)
# Route line
ax.annotate('', xy=(ax_pos,ay_pos), xytext=(1,0),
    arrowprops={'arrowstyle':'->','color':'#00FF88','lw':1.5,'linestyle':'dashed'})
ax.set_title(f"Mission Route — {asteroid_name}", color='white', fontsize=12)
ax.tick_params(colors='#555'); ax.spines['bottom'].set_color('#333'); ax.spines['left'].set_color('#333')
ax.spines['top'].set_color('#0a0a0f'); ax.spines['right'].set_color('#0a0a0f')
ax.set_xlabel('AU', color='#888'); ax.set_ylabel('AU', color='#888')
import base64, io
buf = io.BytesIO()
plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', facecolor='#0a0a0f')
buf.seek(0)
route_map_b64 = base64.b64encode(buf.read()).decode()

### Image 4: physical_profile.png (800×500)
import matplotlib.pyplot as plt, numpy as np
fig, ax = plt.subplots(figsize=(8,5), facecolor='#0a0a0f')
ax.set_facecolor('#0a0a0f')
metrics = ['Diameter (km)','Delta-v (km/s)','Density (g/cm³)','Conf. Score','Data Complete','MOID (AU)']
values_raw = [diameter_km, delta_v, density, composition_confidence, data_completeness, moid]
benchmarks = [0.5, 6.0, 3.5, 0.7, 0.7, 0.1]
norm_vals = [min(v/max(b,0.001),2.0) for v,b in zip(values_raw,benchmarks)]
colors_bar = ['#00FF88' if n <= 1 else '#FFA500' if n <= 1.5 else '#FF4444' for n in norm_vals]
y_pos = np.arange(len(metrics))
bars = ax.barh(y_pos, norm_vals, color=colors_bar, alpha=0.8, height=0.6)
ax.axvline(x=1.0, color='#555', linestyle='--', alpha=0.7, label='Benchmark')
ax.set_yticks(y_pos); ax.set_yticklabels(metrics, color='white', fontsize=10)
for i, (val, raw) in enumerate(zip(norm_vals, values_raw)):
    ax.text(val+0.03, i, f'{raw:.3g}', va='center', color='white', fontsize=9)
ax.set_title(f"{asteroid_name} — Physical Profile", color='white', fontsize=12)
ax.set_xlabel('Relative to Benchmark', color='#888')
ax.tick_params(colors='#555')
for spine in ax.spines.values(): spine.set_color('#333')
plt.tight_layout()
import base64, io
buf = io.BytesIO()
plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', facecolor='#0a0a0f')
buf.seek(0)
physical_profile_b64 = base64.b64encode(buf.read()).decode()

## OUTPUT — JSON ONLY
{
  "feasibility_score": 8,
  "composition": {
    "spec_type": "M", "spec_confidence": 0.7,
    "minerals": [{"name":"iron","fraction":0.85,"mass_kg":1e12,"value_usd":1e11,"current_price_per_kg":0.12,"scenario_impact":false}],
    "density_kg_m3": 5300, "surface_gravity_m_s2": 0.001, "research_notes": "string"
  },
  "valuation": {"raw_value_usd":0,"damped_value_usd":0,"mission_cost_usd":0,"net_value_usd":0,"roi_pct":0,"scenario_impact_pct":0},
  "risk": {"overall_risk":"MED","factors":[{"category":"string","severity":"MED","description":"string","mitigation":"string","source":"string"}],"data_gaps":[]},
  "mission": {"launch_vehicle":"Falcon Heavy","launch_vehicle_reason":"string","mining_method":"string","mining_method_trl":5,"transit_days":365,"surface_ops_days":180,"total_mission_days":900,"total_mission_years":2.5,"next_launch_window":"2028-Q3","distance_current_au":0.5,"delta_v_km_s":5.4},
  "market": {"primary_mineral":"cobalt","current_price_usd_kg":33.8,"price_trend":"rising","urgency_score":0.87,"demand_outlook":"string","supply_chain_event":{"found":true,"event":"string","severity":"HIGH","date":"string","source_url":"string"},"scenario_active":false},
  "route_context": {"route_id":"string","route_label":"string","stop_number":1,"total_stops":3,"route_net_value_usd":0,"route_total_delta_v":0,"other_stops":[]},
  "images": {
    "asteroid_render": "<base64_png>",
    "composition_map": "<base64_png>",
    "route_map": "<base64_png>",
    "physical_profile": "<base64_png>"
  },
  "go_no_go": {"recommendation":"GO","primary_reason_go":"string","primary_reason_no_go":"string","conditions_to_flip":"string","comparable_targets":[]},
  "sources": ["[Name](url)"]
}
`

// Agent is the on-demand mission report agent.
// IMPORTANT: This agent ONLY runs when explicitly triggered via RunAsync() for a
// specific asteroid+route. It does NOT process all asteroids proactively.
// Trigger points:
//   - POST /api/mission-report with asteroid_id (via PostMissionReportHandler)
//   - GET /api/asteroid?id=X&route_id=Y (when route_id is provided)
type Agent struct {
	gemini *gemini.Client
	db     *db.Store
	hub    *websocket.Hub
}

// New creates Agent 4
func New(g *gemini.Client, d *db.Store, h *websocket.Hub) *Agent {
	return &Agent{gemini: g, db: d, hub: h}
}

// RunAsync fires Agent 4 in a goroutine for a SINGLE asteroid, checks cache first.
// This is the ONLY entry point — Agent 4 never runs proactively on all asteroids.
func (a *Agent) RunAsync(asteroidID, routeID string) {
	go func() {
		log.Printf("[AGENT4] ── RunAsync start (ON-DEMAND for selected asteroid) ──")
		log.Printf("[AGENT4] Target: asteroid=%s route=%s", asteroidID, routeID)
		start := time.Now()

		a.broadcastStatus(asteroidID, "researching", "Deep Research initializing mission brief...")

		// Step 1: check cache
		log.Printf("[AGENT4] Checking cache: asteroid=%s route=%s", asteroidID, routeID)
		cached, err := a.db.GetMissionReport(asteroidID, routeID)
		if err == nil && cached != nil {
			log.Printf("[AGENT4] CACHE HIT | age=%s", time.Since(cached.GeneratedAt).Round(time.Second))
			a.hub.BroadcastJSON(map[string]interface{}{
				"type":        "mission_report",
				"asteroid_id": asteroidID,
				"cached":      true,
				"report":      cached,
				"timestamp":   time.Now().Format(time.RFC3339),
			})
			return
		}
		log.Printf("[AGENT4] CACHE MISS — starting Deep Research")

		// Step 2: load asteroid
		asteroid, err := a.db.GetAsteroidValuation(asteroidID)
		if err != nil || asteroid == nil {
			log.Printf("[AGENT4] ERROR: Asteroid not found: %v", err)
			a.broadcastStatus(asteroidID, "error", "Asteroid not found in database")
			return
		}
		log.Printf("[AGENT4] Asteroid loaded: name=%s spec=%s val=$%.2e",
			asteroid.Name, asteroid.SpecType, safeFloat(asteroid.Valuation, "net_value_usd"))

		// Step 3: load route context
		ranking, _ := a.db.GetLatestStrategicRanking()
		var routeContext *db.MissionRoute
		if ranking != nil {
			for i := range ranking.Routes {
				if ranking.Routes[i].ID == routeID {
					rc := ranking.Routes[i]
					routeContext = &rc
					break
				}
			}
		}
		log.Printf("[AGENT4] Route context found: %v", routeContext != nil)

		// Step 4: load prices + scenarios
		prices, _ := a.db.GetLatestPriceMap()
		scenarios, _ := a.db.GetActiveScenarios()
		log.Printf("[AGENT4] Prices: %d minerals | Scenarios: %d", len(prices), len(scenarios))

		// Step 5: build prompt
		astJSON, _ := json.Marshal(asteroid)
		routeJSON, _ := json.Marshal(routeContext)
		priceJSON, _ := json.Marshal(prices)
		scenarioJSON, _ := json.Marshal(scenarios)

		prompt := fmt.Sprintf(
			"Asteroid:\n%s\n\nRoute context:\n%s\n\nLive prices:\n%s\n\nActive scenarios:\n%s\n\nDate: %s",
			string(astJSON), string(routeJSON), string(priceJSON),
			string(scenarioJSON), time.Now().Format("2006-01-02"),
		)
		log.Printf("[AGENT4] Prompt built | len=%d chars", len(prompt))
		a.broadcastStatus(asteroidID, "researching",
			fmt.Sprintf("Deep Research analyzing %s — supply chain, mission design, images...", asteroid.Name))

		// Step 6: call Gemini Deep Research
		log.Printf("[AGENT4] Calling Gemini Deep Research | asteroid=%s", asteroid.Name)
		resp, err := a.gemini.Interact(gemini.AgentDeepResearch, systemInstruction, prompt)
		if err != nil {
			log.Printf("[AGENT4] ERROR: Gemini failed: %v", err)
			a.broadcastStatus(asteroidID, "error", fmt.Sprintf("Deep Research error: %v", err))
			return
		}

		log.Printf("[AGENT4] Response received | len=%d chars", len(resp.OutputText))
		log.Printf("[AGENT4] Full raw output:\n%.3000s", resp.OutputText)

		// Step 7: parse
		cleaned := stripJSON(resp.OutputText)
		var reportData map[string]interface{}
		if err := json.Unmarshal([]byte(cleaned), &reportData); err != nil {
			log.Printf("[AGENT4] ERROR: Parse failed: %v", err)
			a.broadcastStatus(asteroidID, "error", "Failed to parse mission report")
			return
		}

		// extract images
		images := map[string]string{}
		if imgs, ok := reportData["images"].(map[string]interface{}); ok {
			for k, v := range imgs {
				if s, ok := v.(string); ok {
					images[k] = s
					log.Printf("[AGENT4] Image %s: %d bytes (base64)", k, len(s))
				}
			}
		}

		feasibility := 0
		if f, ok := reportData["feasibility_score"].(float64); ok {
			feasibility = int(f)
		}
		recommendation := ""
		if gng, ok := reportData["go_no_go"].(map[string]interface{}); ok {
			recommendation, _ = gng["recommendation"].(string)
		}
		log.Printf("[AGENT4] Report parsed | feasibility=%d/10 recommendation=%s", feasibility, recommendation)
		log.Printf("[AGENT4] Images: render=%v comp=%v route=%v profile=%v",
			len(images["asteroid_render"]) > 0,
			len(images["composition_map"]) > 0,
			len(images["route_map"]) > 0,
			len(images["physical_profile"]) > 0)

		// Step 8: cache to DB
		report := db.MissionReport{
			AsteroidID:      asteroidID,
			RouteID:         routeID,
			Report:          reportData,
			AsteroidRender:  images["asteroid_render"],
			CompositionMap:  images["composition_map"],
			RouteMap:        images["route_map"],
			PhysicalProfile: images["physical_profile"],
		}
		if err := a.db.UpsertMissionReport(report); err != nil {
			log.Printf("[AGENT4] DB upsert error: %v", err)
		} else {
			log.Printf("[AGENT4] Report cached to DB")
		}

		// Step 9: push to frontend
		a.hub.BroadcastJSON(map[string]interface{}{
			"type":        "mission_report",
			"asteroid_id": asteroidID,
			"cached":      false,
			"report":      report,
			"timestamp":   time.Now().Format(time.RFC3339),
		})

		log.Printf("[AGENT4] ── Complete in %s ──────────────────────────────────────────",
			time.Since(start).Round(time.Second))
		a.broadcastStatus(asteroidID, "complete",
			fmt.Sprintf("Mission brief for %s ready (%s)", asteroid.Name, time.Since(start).Round(time.Second)))
	}()
}

func (a *Agent) broadcastStatus(asteroidID, status, message string) {
	a.hub.BroadcastJSON(map[string]interface{}{
		"type":        "agent_status",
		"agent":       "mission_report",
		"status":      status,
		"asteroid_id": asteroidID,
		"message":     message,
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
