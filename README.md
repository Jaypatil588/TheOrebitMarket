# 🪐 The Orebit Market

> **Real-time asteroid intelligence radar.** Track near-Earth asteroids, value them against live commodity markets, plan multi-stop mining missions, and let AI agents tell you which rocks matter most — right now.

**[→ Live on Vercel](https://the-orebit-market.vercel.app)**

---

## What it does

The Orebit Market combines orbital mechanics, live commodity pricing, and Gemini AI agents to answer one question: **which asteroid is most worth mining today?**

- **3D orbit map** — every tracked near-Earth asteroid rendered in real time, colour-coded by net mining value
- **Live valuation engine** — mass × spectral composition × today's spot prices, with market-damping so flooding supply doesn't overcount value
- **Multi-asteroid route planner** — animated mission routes drawn across the map (Cobalt Route, Platinum Route, Best ROI, etc.), updated whenever markets move
- **AI agent feed** — four Gemini agents run in parallel on startup: Market Intelligence, Discovery Scout, Strategic Ranker, and Mission Architect stream their reasoning live into the UI
- **Click any asteroid** → camera flies to it, Mission Architect agent fires, a full mission plan (vehicle, mining method, timeline, risks) streams into the detail panel

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React Three Fiber, Three.js, Framer Motion, Tailwind CSS |
| Backend | Go (net/http, gorilla/websocket) |
| AI Agents | Google Gemini API — 4 managed agents orchestrated in parallel |
| Real-time | WebSocket live feed (`/feed`) pushing agent updates to the UI |
| Data | NASA JPL SBDB, Asterank API, live commodity price feeds |
| Hosting | Vercel (frontend) + self-hosted Go backend |

---

## Running locally

### Prerequisites
- Node.js 18+
- Go 1.21+
- A Gemini API key

### 1. Clone & configure

```bash
git clone https://github.com/Jaypatil588/TheOrebitMarket.git
cd TheOrebitMarket
cp .env.example .env
# fill in GEMINI_API_KEY and any other required vars
```

### 2. Start the backend

```bash
cd backend
go run main.go
# → listening on :8080
# → WebSocket at ws://localhost:8080/feed
```

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

Open `http://localhost:3000`. The agents fire on load — give them ~10 seconds and the map will populate with routes, rankings, and live agent activity.

---

## How to use it

1. **Watch the map load** — asteroid dots appear, mission routes draw themselves across the solar system
2. **Read the left panel** — commodity rankings tell you which minerals have the most market urgency right now
3. **Toggle routes** — switch between Cobalt, Platinum, Rare Earth, Water/Fuel, and Best ROI routes via the route selector
4. **Click an asteroid** — the camera flies to it, a detail panel slides in with valuation breakdown, and the Mission Architect agent streams a full mission plan
5. **Watch the agent feed** — the right panel shows every agent action live: searches, optimisations, new NEA discoveries
6. **Hit refresh** — forces a new agent cycle; routes re-optimise against current prices

---

## Architecture overview

```
Frontend (Next.js / R3F)
  ↕ REST + WebSocket
Backend (Go)
  ├── Deterministic engine  — orbital math, valuation, delta-v
  ├── Agent orchestrator    — fires 4 Gemini agents in parallel
  └── WebSocket hub         — pushes updates to all clients

Gemini Agents
  ├── Market Intelligence   — searches web for commodity supply news
  ├── Discovery Scout       — flags newly announced NEAs
  ├── Strategic Ranker      — runs route optimisation in code sandbox
  └── Mission Architect     — designs per-asteroid mission on click
```

---

Built for the Google Gemini Managed Agents hackathon.
