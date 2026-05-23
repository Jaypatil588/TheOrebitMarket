# AstroHedge — System Architecture

## One-liner
A real-time asteroid intelligence radar that tracks NEAs, values them against live markets, plans missions, and tells you which ones matter most right now.

---

## HIGH-LEVEL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND                             │
│            Next.js + React Three Fiber                   │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐              │
│  │  3D Map   │  │  Detail  │  │  Agent    │              │
│  │  (orbit   │  │  Panel   │  │  Activity │              │
│  │  viz)     │  │  (click  │  │  Feed     │              │
│  │          │  │  asteroid)│  │  (live)   │              │
│  └──────────┘  └──────────┘  └───────────┘              │
│  ┌──────────────────────────────────────────┐            │
│  │         Strategic Rankings Dashboard      │            │
│  └──────────────────────────────────────────┘            │
└──────────────────┬──────────────────────────────────────┘
                   │ REST API / WebSocket (streaming)
                   ▼
┌─────────────────────────────────────────────────────────┐
│                    BACKEND                               │
│               Python (FastAPI)                           │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │          DETERMINISTIC ENGINE               │          │
│  │  • Valuation calculator (mass × comp × $)  │          │
│  │  • Delta-v (Shoemaker-Helin)               │          │
│  │  • Market damping factor                    │          │
│  │  • Hohmann transfer math                    │          │
│  │  • Launch window computation                │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │          AGENT ORCHESTRATOR                 │          │
│  │  • Fires managed agents in parallel         │          │
│  │  • Collects agent outputs                   │          │
│  │  • Merges with deterministic results        │          │
│  │  • Pushes updates to frontend via WS        │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │          DATA LAYER                         │          │
│  │  • Asteroid cache (from NASA/Asterank)      │          │
│  │  • Commodity price cache (refreshes)        │          │
│  │  • Agent output store                       │          │
│  └────────────────────────────────────────────┘          │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────┐    ┌──────────────────────────┐
│  EXTERNAL    │    │  GEMINI 3.5 FLASH        │
│  APIS        │    │  MANAGED AGENTS          │
│              │    │                          │
│ • NASA JPL   │    │  Agent 1: Market Intel   │
│   SBDB       │    │  Agent 2: Mission Arch   │
│ • Asterank   │    │  Agent 3: Strategic Rank │
│ • Commodity  │    │  Agent 4: Discovery Scout│
│   prices     │    │                          │
│ • MPC        │    │  Each in isolated sandbox│
│              │    │  with SKILL.md + code    │
└──────────────┘    └──────────────────────────┘
```

---

## DATA FLOW

### On App Load (agents already working):

```
1. Backend starts → fetches asteroid data from NASA SBDB + Asterank
2. Backend fetches live commodity prices
3. Deterministic engine calculates ALL asteroid valuations
4. Agent Orchestrator fires agents IN PARALLEL:
   ├── Market Intel Agent → searches web for supply chain news
   ├── Discovery Scout Agent → searches for new NEA announcements
5. When Market Intel returns → Strategic Ranker Agent fires
   (reads market intel output + deterministic valuations)
6. Rankings pushed to frontend via WebSocket
7. User opens app → everything is already populated
```

### On Asteroid Click:

```
1. Frontend sends asteroid_id to backend
2. Backend returns cached deterministic data (instant)
3. Backend fires Mission Architect Agent for that specific asteroid
4. Agent streams response → frontend shows reasoning appearing live
5. Mission plan appears in detail panel
```

---

## DETERMINISTIC ENGINE (no AI, pure math)

### Valuation Pipeline:

```python
# 1. Mass estimation (when diameter known)
mass_kg = (4/3) * pi * (diameter/2)^3 * density_by_type[spec_type]

# 2. Composition from spectral type
COMPOSITION_MAP = {
    "M": {"iron": 0.88, "nickel": 0.10, "cobalt": 0.005, "platinum_group": 0.005},
    "S": {"iron": 0.25, "nickel": 0.02, "silicon": 0.20, "magnesium": 0.15},
    "C": {"water": 0.10, "carbon": 0.05, "iron": 0.05, "clay_minerals": 0.20},
    # ... full Bus-DeMeo taxonomy mapping
}

# 3. Raw value
raw_value = sum(mass * fraction * live_price[mineral] for each mineral)

# 4. Market damping (Orbital Assets' key insight — steal this)
# If you mine more than X% of global annual production, price crashes
damping = min(1.0, global_annual_production[mineral] / extractable_amount)
damped_value = raw_value * damping

# 5. Delta-v (Shoemaker-Helin approximation)
delta_v = 0.5 + 0.3 * abs(sin(i)) + 0.8 * e + 0.5 * abs(a - 1.0)  # simplified

# 6. Mission cost model
fuel_mass = payload * (exp(delta_v / (Isp * g0)) - 1)
launch_cost = fuel_mass * $/kg_to_LEO  # ~$2,700/kg Falcon Heavy
ops_cost = mission_duration_days * daily_ops_rate
mission_cost = launch_cost + ops_cost + spacecraft_cost

# 7. Net value
net_value = damped_value - mission_cost
roi = net_value / mission_cost
```

### Parameters stored per asteroid:

```json
{
    "id": "3554",
    "name": "Amun",
    "spec_type": "M",
    "diameter_km": 2.48,
    "mass_kg": 5.36e13,
    "orbital": {
        "a": 0.974,
        "e": 0.281,
        "i": 23.36,
        "delta_v_km_s": 5.37,
        "period_days": 351,
        "moid_au": 0.09
    },
    "valuation": {
        "raw_value_usd": 2.34e13,
        "damped_value_usd": 8.71e11,
        "mission_cost_usd": 2.1e9,
        "net_value_usd": 8.69e11,
        "roi": 413.8,
        "top_mineral": "iron",
        "composition": {"iron": 0.88, "nickel": 0.10, ...},
        "prices_timestamp": "2026-05-23T10:30:00Z"
    },
    "risk": {
        "composition_confidence": 0.65,
        "orbital_uncertainty": "U=0",
        "data_completeness": 0.72
    }
}
```

---

## MANAGED AGENTS ARCHITECTURE

### Agent 1: Market Intelligence

```
AGENTS.md:
  "You are a mineral supply chain analyst. You search for 
   current events affecting mineral supply and demand. You 
   focus on actionable intelligence, not background knowledge."

SKILL.md:
  "Output format: JSON with fields:
   - disruptions: [{mineral, event, severity, source_url}]
   - price_trends: [{mineral, direction, magnitude, driver}]
   - priority_minerals: [ranked list with reasoning]"

Tools: Google Search, URL Context
Trigger: On app startup, then every refresh cycle
Input: List of minerals relevant to asteroid mining
Output: market_intel.json
```

### Agent 2: Mission Architect

```
AGENTS.md:
  "You are a space mission design engineer. You receive 
   pre-computed orbital data and valuations. You reason about
   mission design choices that math alone cannot determine:
   launch vehicle selection, mining method, operational timeline,
   risk factors."

SKILL.md:
  "You NEVER compute delta-v or valuations — those are provided.
   You reason about:
   - Which launch vehicle fits this delta-v budget
   - Which mining method suits this asteroid type
   - Operational timeline and crew/robotic tradeoffs
   - Key risks specific to this target
   Output: mission_plan.json"

Tools: Code Execution (for timeline/logistics modeling), Google Search
Trigger: On user click of specific asteroid
Input: Asteroid deterministic data JSON
Output: mission_plan.json
```

### Agent 3: Strategic Ranker

```
AGENTS.md:
  "You are a strategic investment advisor for asteroid mining.
   You combine market intelligence with asteroid data to rank
   targets. You explain WHY, not just WHAT."

SKILL.md:
  "Input: market_intel.json + all asteroid valuations
   Score each asteroid on:
   - net_value (from deterministic engine)
   - market_urgency (from market intel — is this mineral scarce?)
   - accessibility (delta-v + next launch window)
   - data_confidence (how sure are we about composition?)
   - multi_mineral_coverage (solves multiple shortages?)
   
   Output: strategic_rankings.json with top 20 ranked asteroids,
   each with a reasoning field explaining the ranking."

Tools: Code Execution (for scoring algorithm)
Trigger: After Market Intelligence completes
Input: market_intel.json + asteroid_valuations.json
Output: strategic_rankings.json
```

### Agent 4: Discovery Scout

```
AGENTS.md:
  "You monitor for newly discovered near-Earth asteroids.
   You assess whether new discoveries are potentially valuable
   for mining based on limited available data."

SKILL.md:
  "Search for recently announced NEA discoveries.
   For each new find, estimate:
   - Likely spectral type (from any available data)
   - Rough value range
   - Whether it's worth flagging as high-priority
   Output: new_discoveries.json"

Tools: Google Search, URL Context
Trigger: On app startup
Input: Current date, list of already-known asteroid IDs
Output: new_discoveries.json
```

---

## AGENT ORCHESTRATION

```python
# orchestrator.py

async def run_startup_agents():
    """Fire independent agents in parallel on app load"""
    
    # Phase 1: Independent agents (parallel)
    market_task = fire_agent("market-intelligence", market_skill)
    scout_task = fire_agent("discovery-scout", scout_skill)
    
    market_result, scout_result = await asyncio.gather(
        market_task, scout_task
    )
    
    # Phase 2: Dependent agent (needs Phase 1 output)
    ranker_result = await fire_agent(
        "strategic-ranker", 
        ranker_skill,
        input_files={
            "market_intel.json": market_result,
            "asteroid_valuations.json": get_all_valuations()
        }
    )
    
    # Push to frontend
    await websocket_broadcast(ranker_result)


async def run_asteroid_detail(asteroid_id: str):
    """Fire on user click — single asteroid deep dive"""
    
    asteroid_data = get_asteroid_data(asteroid_id)
    
    mission_result = await fire_agent(
        "mission-architect",
        mission_skill,
        input_data=asteroid_data
    )
    
    return mission_result


async def fire_agent(agent_name, skill, input_data=None, input_files=None):
    """Wrapper around Gemini Managed Agents API"""
    
    interaction = client.interactions.create(
        agent="antigravity-preview-05-2026",
        input=build_prompt(agent_name, input_data),
        environment="remote",
        # Mount skill files into sandbox
        system_instruction=load_agents_md(agent_name),
    )
    
    return parse_structured_output(interaction.output_text)
```

---

## FRONTEND ARCHITECTURE

```
src/
├── app/
│   ├── page.tsx                    # Main dashboard
│   ├── api/
│   │   ├── asteroids/route.ts      # GET all asteroids + valuations
│   │   ├── asteroid/[id]/route.ts  # GET single asteroid detail
│   │   ├── agents/status/route.ts  # GET agent activity
│   │   └── refresh/route.ts        # POST trigger agent refresh
│   └── layout.tsx
├── components/
│   ├── OrbitMap/                    # 3D visualization
│   │   ├── Scene.tsx               # React Three Fiber canvas
│   │   ├── AsteroidDot.tsx         # Clickable asteroid (color = value)
│   │   ├── OrbitLine.tsx           # Orbit path rendering
│   │   └── Earth.tsx               # Earth model
│   ├── DetailPanel/                # Right panel on asteroid click
│   │   ├── Overview.tsx            # Name, type, value, composition
│   │   ├── MissionPlan.tsx         # Agent-generated mission plan
│   │   └── RiskBadge.tsx           # Data confidence indicator
│   ├── Dashboard/
│   │   ├── Rankings.tsx            # Strategic rankings table
│   │   ├── PriceTicker.tsx         # Live commodity prices
│   │   ├── AgentFeed.tsx           # Agent activity log
│   │   └── NewDiscoveries.tsx      # Flagged new asteroids
│   └── common/
│       ├── StreamingText.tsx       # Renders agent output as it streams
│       └── ReasoningChain.tsx      # Shows agent's step-by-step logic
├── lib/
│   ├── asterank.ts                 # Asterank API client
│   ├── nasa.ts                     # NASA SBDB API client
│   ├── prices.ts                   # Commodity price API client
│   └── websocket.ts               # WS connection for live updates
└── hooks/
    ├── useAsteroids.ts             # Asteroid data state
    ├── useAgentStream.ts           # Stream agent responses
    └── usePrices.ts                # Live price updates
```

---

## 3D MAP DESIGN

### Asteroid Rendering
```
Asteroid dots on orbit paths around the Sun:
- SIZE = proportional to log(diameter)
- COLOR = value heat map
  - Red = highest net value
  - Orange = high value
  - Yellow = moderate
  - Blue = low value
  - Gray = negative ROI (costs more than it's worth)
- GLOW = market urgency (pulsing = supply chain disruption makes this urgent)
- ORBIT LINE = faded white, brightens on hover

On hover: tooltip with name + net value
On click: orbit highlights, detail panel slides in, Mission Architect agent fires

Camera: 
- Default view: top-down solar system
- Click asteroid → camera flies to it
- Earth always visible as reference point
```

### LIVE ROUTE OVERLAY (the demo killer)

```
When app loads, the Strategic Ranker agent doesn't just rank asteroids — 
it also computes the OPTIMAL MULTI-ASTEROID ROUTE.

The route renders as an animated line on the 3D map:

  Earth ──→ Asteroid A ──→ Asteroid B ──→ Asteroid C ──→ Earth
   🚀         💎              💎              💎          🏠

Visual treatment:
- Animated dashed line (moving dots along path like a spaceship traveling)
- Color-coded by commodity:
  - Cobalt route = blue path
  - Platinum route = silver path
  - Rare earth route = gold path
  - Multi-mineral route = gradient path
- Each stop shows a floating label:
  ┌─────────────────────────┐
  │ STOP 1: Asteroid Amun   │
  │ 🟡 Cobalt: $2.1B        │
  │ ⚡ Δv: 4.2 km/s         │
  │ 📅 Window: Mar 2028     │
  └─────────────────────────┘

- Total mission value floats at end of route:
  ┌─────────────────────────────────┐
  │ 🚀 OPTIMAL ROUTE               │
  │ 3 stops · 4.2 years            │
  │ Total value: $8.7B             │
  │ Mission cost: $3.1B            │
  │ NET RETURN: $5.6B (180% ROI)   │
  │ Minerals: Co, Pt, Ni           │
  └─────────────────────────────────┘

Multiple routes shown simultaneously:
- "Best ROI Route" — highest return per dollar spent
- "Best Cobalt Route" — if you specifically need cobalt
- "Fastest Route" — nearest asteroids, shortest mission
- User toggles between them via route selector

Route updates LIVE:
- Agent recomputes when commodity prices change
- New route animates into place, old one fades
- Shows "ROUTE UPDATED" flash when prices shift a ranking

Route computation:
- Deterministic engine pre-computes pairwise delta-v 
  between top 50 candidate asteroids
- Strategic Ranker agent receives the delta-v matrix + 
  valuations + market intel
- Agent runs optimization code in sandbox:
  "Given these 50 asteroids, their values, and the 
   delta-v cost between each pair, find the route that 
   visits 3-5 asteroids and maximizes (total_value - 
   total_mission_cost) while covering the highest-demand 
   minerals identified in market intelligence."
- Outputs: ordered list of stops with reasoning
```

### Route Data Structure
```json
{
  "route_id": "optimal_roi_2026_05_23",
  "route_type": "best_roi",
  "stops": [
    {
      "order": 0,
      "body": "Earth",
      "departure": "2027-09-15",
      "delta_v_to_next": 3.8
    },
    {
      "order": 1,
      "asteroid_id": "3554",
      "name": "Amun",
      "mineral_target": "cobalt",
      "extractable_value": 2100000000,
      "stay_duration_days": 180,
      "delta_v_to_next": 1.2
    },
    {
      "order": 2,
      "asteroid_id": "6178",
      "name": "1986 DA",
      "mineral_target": "platinum",
      "extractable_value": 4300000000,
      "stay_duration_days": 240,
      "delta_v_to_next": 2.1
    },
    {
      "order": 3,
      "body": "Earth",
      "arrival": "2031-11-20"
    }
  ],
  "totals": {
    "total_value": 6400000000,
    "total_cost": 3100000000,
    "net_return": 3300000000,
    "roi_percent": 106.4,
    "duration_years": 4.2,
    "minerals_covered": ["cobalt", "platinum", "nickel"],
    "total_delta_v": 7.1
  },
  "reasoning": "Cobalt prioritized due to supply disruption in DRC...",
  "last_updated": "2026-05-23T10:45:00Z"
}
```

### Map Legend (persistent, bottom-left corner)
```
🔴 High value    🔵 Low value    ⚫ Negative ROI
── Best ROI route    ── Best mineral route    ── Fastest route
💫 Pulsing = market urgency    🆕 = discovered today
```

---

## TECH STACK

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React Three Fiber, Three.js, Tailwind |
| 3D | React Three Fiber + @react-three/drei |
| Backend | Python FastAPI |
| Agents | Gemini 3.5 Flash Managed Agents (Interactions API) |
| Data | NASA JPL SBDB API, Asterank API, commodity price API |
| Real-time | WebSocket for agent updates to frontend |
| Hosting | Vercel (frontend) + Railway/Fly.io (backend) |
| State | In-memory cache (Redis if needed) |

---

## DEMO SCRIPT (3 minutes)

```
0:00 - Open app. 3D map fills the screen. Asteroids orbiting.
       Animated route line already drawn: Earth → Asteroid A → B → C → Earth.
       Floating label shows: "OPTIMAL ROUTE · $5.6B net · Co, Pt, Ni · 4.2 yrs"
       "Our agents have already computed the most valuable 
       multi-asteroid mission based on today's markets."

0:25 - Point at the route. "This line is a real mission plan. 
       Three stops. Three minerals. Each one chosen because 
       our Market Intelligence agent found supply pressure 
       on these specific commodities today."

0:45 - Toggle route selector: switch from "Best ROI" to "Best Cobalt."
       Route animates — new path draws across the map, different asteroids.
       New floating label: "COBALT ROUTE · $2.1B net · 2 stops · 3.1 yrs"
       "Different objective, different route. Computed live."

1:05 - Click an asteroid on the route. Camera flies to it.
       Detail panel slides in with pre-computed valuation.
       Mission Architect agent fires — reasoning streams live.
       "Our agent is now analyzing the specific mission design..."

1:35 - Mission plan appears: vehicle, mining method, timeline, risks.
       "Falcon Heavy launch, robotic extraction, 18-month surface ops."

1:50 - Show agent activity feed. "Four managed agents produced 
       everything you see. Market Intelligence searched the web.
       Strategic Ranker ran optimization code in its sandbox 
       to compute these routes. Discovery Scout flagged 2 new 
       asteroids found today."

2:15 - Point at pulsing asteroid on map. "See that glow? 
       That asteroid is pulsing because our agent detected a 
       supply disruption in the nickel market this morning. 
       Its priority just jumped."

2:30 - Show the $$$ on the route summary. "This isn't hypothetical.
       These are today's commodity prices. Tomorrow if platinum 
       spikes, a different route lights up automatically."

2:50 - Closing: "Orbital Assets valued one asteroid at a time. 
       We built the mission control that plans the optimal route 
       across ALL of them — live, updated by managed agents, 
       showing you the money on the map."

3:00 - Done.
```

---

## WHAT MAKES THIS WIN

| Criteria | Score driver |
|----------|-------------|
| Live Demo (45%) | Animated route on 3D map showing $$$ is instantly understood. Toggle routes live. Agent streams reasoning on click. Route updates when prices change. Judges SEE the money on the map. |
| Creativity (35%) | Nobody has built a live multi-asteroid route planner that optimizes across market conditions. Orbital Assets valued one rock. You plan the whole mission across multiple rocks with live economics. |
| Impact (20%) | AstroForge launched 2025. TransAstra is funded. The space mining industry needs this exact tool — mission planning that responds to Earth markets. |
| Managed Agents ($5K) | 4 agents in parallel: Market Intel web-searches supply chain news. Strategic Ranker runs optimization code in sandbox to compute routes. Mission Architect reasons about vehicle/method per asteroid. Discovery Scout flags new finds. Agent outputs feed into each other. |

---

## UPDATED SCREEN LAYOUT

```
┌──────────────────────────────────────────────────────────────┐
│  COMMODITY TICKER (scrolling)  BTC-style live prices         │
│  ◆ Platinum $31,240 ▲2.1%  ◆ Cobalt $33,800 ▼0.4%  ◆ ...  │
├───────────┬──────────────────────────────┬───────────────────┤
│           │                              │                   │
│  LEFT     │                              │  RIGHT SIDE       │
│  PANEL    │     3D SPACE SCENE           │                   │
│           │                              │  ┌─────────────┐  │
│ COMMODITY │     Earth rotating slowly    │  │ AGENT FEED  │  │
│ RANKINGS  │     Asteroid swarm           │  │ (live)      │  │
│           │     Routes auto-drawing      │  │             │  │
│ 1. Co ▲   │                              │  │ 🔍 Searching│  │
│ 2. Pt ─   │     You are floating,        │  │ cobalt news │  │
│ 3. Li ▲   │     watching                 │  │             │  │
│ 4. Ni ▼   │                              │  │ 📊 Running  │  │
│ 5. Nd ▲   │                              │  │ route optim │  │
│           │                              │  │             │  │
│ Based on: │                              │  │ ✅ Found 2  │  │
│ scarcity  │                              │  │ new NEAs    │  │
│ demand    │                              │  │             │  │
│ supply    │                              │  │ [live scroll│  │
│ risk      │                              │  │  of agent   │  │
│           │                              │  │  actions]   │  │
│           │                              │  └─────────────┘  │
│           │                              │                   │
├───────────┴──────────────────────────────┴───────────────────┤
│  ROUTE LEGEND (auto-visible when route in view)              │
│  ── Cobalt Route $5.2B  ── Platinum Route $3.8B  ── Mixed   │
│                                          Refresh in: 3:47 ⟳ │
└──────────────────────────────────────────────────────────────┘
```

---

## FEATURE 1: REFRESH COUNTDOWN (bottom-right)

```
Small, subtle, monospace. Always visible. Breathes.

┌──────────────────────┐
│  ⟳ Next refresh 3:47 │
│  Last run: 12s ago   │
│  Agents: 3/4 idle    │
└──────────────────────┘

- Counts down in real-time (every second)
- When it hits 0:00 → flash, agents fire, counter resets
- "Last run" counter ticks UP every second
- Agent status: "3/4 idle" or "2/4 active" with pulsing dots
- Clicking ⟳ forces immediate refresh
- During refresh: countdown replaces with "Agents working..." 
  + spinning indicator
```

---

## FEATURE 2: AUTO-DRAW ROUTES

### The system maintains 5 pre-computed routes at all times:

```
ROUTE 1: "Cobalt Priority" 
  → Best 2-3 asteroids for cobalt specifically
  → Blue route line

ROUTE 2: "Platinum Priority"
  → Best 2-3 asteroids for platinum group metals
  → Silver route line

ROUTE 3: "Rare Earth Priority"
  → Best 2-3 for neodymium, yttrium, lanthanum
  → Gold route line

ROUTE 4: "Water/Fuel Priority"
  → Best C-type asteroids for water-ice (in-space fuel)
  → Teal route line

ROUTE 5: "Best ROI Mixed"
  → Highest overall return regardless of mineral
  → White/gradient route line
```

### Route selection driven by market data:

```
Each route has a "urgency score" computed from:
- Current scarcity level of that commodity
- Price trend (rising = more urgent)
- Supply disruption signals from Market Intel agent
- Demand forecast (EV production → lithium/cobalt demand)

Routes are RANKED by urgency. The most urgent route 
draws itself FIRST and BRIGHTEST when its asteroids 
come into view.
```

### Auto-draw behavior:

```
As Earth slowly rotates and your viewpoint drifts, 
different asteroids enter your field of view.

When an asteroid that belongs to an active route 
enters the visible frustum:

1. The asteroid dot brightens (0.5s fade in)
2. A thin line begins drawing FROM Earth TO the asteroid
   (meshline dashOffset animation — looks like the line 
   is extending outward from Earth in real-time)
3. If next stop in route is also visible, line continues
   drawing to next stop
4. Route label fades in at the midpoint of the line:
   "Cobalt Route · $5.2B · 3 stops"
5. Each stop gets a floating label:
   "STOP 1: Amun · Co · $2.1B"

When asteroids leave the view:
- Route line fades out gracefully (0.5s)
- Labels dissolve

Multiple routes can be visible simultaneously.
Color-coding prevents confusion.
```

### Route data structure (updated):

```json
{
  "routes": [
    {
      "id": "cobalt_priority",
      "label": "Cobalt Route",
      "color": "#3b82f6",
      "urgency_score": 0.87,
      "urgency_reason": "DRC mine flooding + EV demand surge",
      "mineral_focus": ["cobalt"],
      "stops": [...],
      "totals": {
        "value": 5200000000,
        "cost": 2100000000,
        "net": 3100000000,
        "duration_years": 3.8
      }
    },
    {
      "id": "platinum_priority",
      "label": "Platinum Route",
      "color": "#94a3b8",
      "urgency_score": 0.64,
      "urgency_reason": "Catalytic converter demand steady",
      "mineral_focus": ["platinum", "palladium", "rhodium"],
      "stops": [...],
      "totals": {...}
    },
    // ... 5 routes total
  ]
}
```

---

## FEATURE 3: AMBIENT MOTION (integrated into scene)

```
Everything moves. Nothing is distracting.

3D Scene:
- Earth rotation: 0.0003 rad/frame
- Cloud layer: 0.0004 rad/frame (slightly faster)
- Asteroid swarm: each on its own orbital velocity
- Camera: 0.00005 rad/frame lazy drift
- Star parallax: mouse-position * 0.001 offset
- Route dash animation: continuous

UI Panels:
- Panel borders: slow gradient shift (CSS animation, 20s loop)
- Active numbers: last digit flickers
- Agent feed: auto-scrolls with new entries
- Commodity arrows: pulse on change
- Refresh countdown: number changes have micro-fade transition
- Cursor proximity: nearby elements brighten 5%
```

---

## FEATURE 4: COMMODITY RANKINGS (left panel)

```
Real-time ranked list of minerals by "mining urgency score"

┌─────────────────────────────┐
│ COMMODITY RANKINGS          │
│ Updated 12s ago             │
├─────────────────────────────┤
│                             │
│ 1. ▲ Cobalt      $33,800   │
│    Scarcity: ████████░░ 82% │
│    Demand:   ███████░░░ 71% │
│    Supply risk: HIGH 🔴     │
│    "DRC flooding, 3 mines   │
│     offline since Tuesday"  │
│                             │
│ 2. ▲ Neodymium   $210/kg   │
│    Scarcity: ███████░░░ 74% │
│    Demand:   ████████░░ 85% │
│    Supply risk: HIGH 🔴     │
│    "China export controls    │
│     tightening"             │
│                             │
│ 3. ─ Platinum   $31,240     │
│    Scarcity: █████░░░░░ 51% │
│    Demand:   ██████░░░░ 62% │
│    Supply risk: MED 🟡      │
│                             │
│ 4. ▼ Lithium    $12.80/kg  │
│    Scarcity: ████░░░░░░ 43% │
│    Demand:   █████████░ 91% │
│    Supply risk: LOW 🟢      │
│    "Australia production     │
│     ramping"                │
│                             │
│ 5. ▲ Nickel     $16,420    │
│    ...                      │
└─────────────────────────────┘

Each ranking entry includes:
- Live price (ticking)
- Scarcity bar (inverse of known reserves vs demand)
- Demand bar (industrial consumption trend)
- Supply risk badge (from Market Intel agent)
- One-line context (from Market Intel agent's web search)

When ranking order changes:
- Rows animate position swap (framer-motion layout)
- Arrow indicator flashes
- Corresponding routes on 3D map adjust brightness 
  (higher ranked mineral = brighter route)

Hovering a commodity:
- All asteroids containing that mineral PULSE on the 3D map
- The corresponding route brightens to full opacity
- Other routes dim
```

---

## FEATURE 5: AGENT LIVE FEED (right panel, beside globe)

```
Not a log dump. A curated, styled activity stream.

┌─────────────────────────────┐
│ AGENT ACTIVITY              │
│ ●●●○ 3 of 4 active         │
├─────────────────────────────┤
│                             │
│ 🔍 Market Intel        NOW │
│ ┊ Searching: "cobalt supply │
│ ┊ disruption 2026"          │
│ ┊ Reading: reuters.com/...  │
│ ┊ Found: DRC mine flooding  │
│ ┊ affects 12% global supply │
│ ┊ ✅ Updated cobalt urgency │
│                             │
│ 📊 Strategic Ranker    12s │
│ ┊ Running route optimizer   │
│ ┊ Evaluating 847 asteroids  │
│ ┊ Computing pairwise Δv...  │
│ ┊ Best cobalt route: 3 stops│
│ ┊ Total value: $5.2B        │
│ ┊ ✅ 5 routes computed      │
│                             │
│ 🔭 Discovery Scout    34s  │
│ ┊ Checked MPC latest data   │
│ ┊ 2 new NEAs found today    │
│ ┊ 2024 YR14: possibly M-type│
│ ┊ Estimated value: $340M    │
│ ┊ ✅ Flagged as interesting │
│                             │
│ 🚀 Mission Architect  IDLE │
│ ┊ Waiting for asteroid      │
│ ┊ selection...              │
│                             │
│         ── older ──         │
│                             │
│ 📊 Strategic Ranker   4m   │
│ ┊ Previous run completed    │
│ ┊ Top pick changed:         │
│ ┊ Amun → 1986 DA            │
│ ┊ Reason: platinum spike    │
│                             │
└─────────────────────────────┘

Design details:
- Each agent has a unique icon + color
- Active agents have a pulsing dot
- New entries slide in from top with fade
- Timestamp shows relative time ("12s", "4m")
- Indented sub-steps show with a thin vertical 
  line connector (┊) — feels like a git log
- Links to sources are clickable but subtle
- Auto-scrolls but pauses on hover
- Max 20 entries visible, older ones fade out

When an agent completes a major action:
- Brief flash/highlight on the entry
- If it changes rankings or routes, a subtle 
  connecting animation links the feed entry 
  to the affected element on screen
  (e.g., line from "✅ 5 routes computed" to 
  the route legend at bottom)

The feed is NOT a terminal. It's styled like 
a modern activity feed — clean typography, 
generous spacing, muted colors with bright 
accents on key findings.
```

---

## UPDATED FULL LAYOUT (final)

```
┌──────────────────────────────────────────────────────────────────┐
│ ◆ Pt $31,240 ▲2.1%  ◆ Co $33,800 ▼0.4%  ◆ Nd $210 ▲1.8%  ... │
├────────────┬─────────────────────────────┬───────────────────────┤
│            │                             │                       │
│ COMMODITY  │                             │  AGENT LIVE FEED      │
│ RANKINGS   │                             │                       │
│            │     [3D SPACE SCENE]        │  🔍 Market Intel  NOW │
│ 1. ▲ Co   │                             │  ┊ Searching cobalt   │
│    82% ██  │  Earth rotating slowly      │  ┊ supply chain...    │
│    HIGH 🔴 │  Asteroids drifting         │                       │
│            │  Routes auto-drawing        │  📊 Ranker       12s │
│ 2. ▲ Nd   │  when visible               │  ┊ 5 routes computed  │
│    74% ██  │                             │  ┊ Top: Cobalt $5.2B  │
│    HIGH 🔴 │  You are still.             │                       │
│            │  Space moves around you.    │  🔭 Scout        34s │
│ 3. ─ Pt   │                             │  ┊ 2 new NEAs found   │
│    51% ██  │                             │                       │
│    MED 🟡  │                             │  🚀 Architect   IDLE │
│            │                             │  ┊ Waiting...         │
│ 4. ▼ Li   │                             │                       │
│    43% ██  │                             │                       │
│    LOW 🟢  │                             │                       │
│            │                             │                       │
├────────────┴─────────────────────────────┴───────────────────────┤
│ ── Co Route $5.2B ── Pt Route $3.8B ── Mixed $8.7B    ⟳ 3:47  │
└──────────────────────────────────────────────────────────────────┘
```
