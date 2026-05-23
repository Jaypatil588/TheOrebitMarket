import { useState, useEffect, useRef, useCallback } from "react";
import { formatTelemetryTime } from "@/lib/utils";
import { BACKEND_URL } from "@/lib/config";

// ── Log entries (telemetry feed) ──────────────────────────────────────────────
export interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "telemetry" | "discovery";
  agentId: string;
  message: string;
  meta?: unknown;
}

// ── Live market data from Agent 2 ─────────────────────────────────────────────
export interface MarketPrice {
  mineral: string;
  price_usd: number;
  trend: string;
  change_pct: number;
  urgency: number;
  disruption: string;
  source_url: string;
  category: string;
  criticality: number;
  scenario_adjusted: boolean;
  fetched_at: string;
}

// ── Strategic rankings from Agent 3 ──────────────────────────────────────────
export interface RankedAsteroid {
  rank: number;
  asteroid_id: string;
  name: string;
  spec_type: string;
  composite_score: number;
  net_value_usd: number;
  roi: number;
  top_mineral: string;
  mineral_urgency: number;
  delta_v_km_s: number;
  launch_window_year: number;
  confidence: number;
  scenario_boosted: boolean;
  reasoning: string;
  trend: string;
}

export interface RouteStop {
  order: number;
  body: string;
  asteroid_id?: string;
  mineral_target?: string;
  extractable_value_usd?: number;
  stay_duration_days?: number;
  delta_v_to_next_km_s: number;
  departure_year?: number;
}

export interface RouteTotals {
  total_value_usd: number;
  total_cost_usd: number;
  net_return_usd: number;
  roi_pct: number;
  duration_years: number;
  total_delta_v_km_s: number;
  minerals_covered: string[];
}

export interface MissionRoute {
  id: string;
  label: string;
  color_hex: string;
  urgency_score: number;
  urgency_reason: string;
  mineral_focus: string[];
  is_default: boolean;
  scenario_driven: boolean;
  stops: RouteStop[];
  totals: RouteTotals;
  route_reasoning: string;
}

// ── Agent status from any agent broadcast ────────────────────────────────────
export interface AgentStatus {
  agent: string;
  status: string;
  message: string;
  asteroid_id?: string;
}

// ── Mission report from Agent 4 ───────────────────────────────────────────────
export interface MissionReportData {
  asteroid_id: string;
  cached: boolean;
  report: Record<string, unknown>;
  timestamp: string;
}

// ── Scenario ──────────────────────────────────────────────────────────────────
export interface Scenario {
  id: string;
  description: string;
  affected_minerals: string[];
  severity: number;
  active: boolean;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────

const MOCK_AGENTS = ["AH-089", "AH-042", "AH-077", "AH-012"];
const MOCK_SECTORS = ["Alpha-4", "Beta-9", "Delta-1", "Gamma-6"];
const MOCK_NAMES = ["Bennu-X", "Apophis-Beta", "16-Psyche", "Eros-Prime", "Ryugu-Alpha"];
const MOCK_MSGS = [
  { type: "info", message: "Radar ping dispatched to Sector {sector}." },
  { type: "telemetry", message: "Concentric orbit synchronization locked. Pitch 45.0°." },
  { type: "discovery", message: "Asteroid '{name}' identified in Orbit Ring {ring}." },
  { type: "success", message: "Basalt rock composition analyzed: {comp}." },
  { type: "warning", message: "Solar wind interference detected. Adjusting filter bandwidth." },
  { type: "info", message: "Downloading raw laser reflectometry profiles..." },
];

export function useOrebitWebSocket(url?: string) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [rankings, setRankings] = useState<RankedAsteroid[]>([]);
  const [routes, setRoutes] = useState<MissionRoute[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [missionReport, setMissionReport] = useState<MissionReportData | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  // Initial telemetry logs start empty

  // Fetch initial state from database on mount so we don't wait for WebSocket broadcasts
  useEffect(() => {
    // 1. Fetch prices
    fetch(`${BACKEND_URL}/api/prices`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.prices)) {
          setMarketPrices(data.prices);
        }
      })
      .catch((err) => console.warn("[WS REST] Failed to fetch initial prices:", err));

    // 2. Fetch rankings and routes
    fetch(`${BACKEND_URL}/api/rankings`)
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (Array.isArray(data.rankings)) setRankings(data.rankings);
          if (Array.isArray(data.routes)) setRoutes(data.routes);
        }
      })
      .catch((err) => console.warn("[WS REST] Failed to fetch initial rankings:", err));
  }, []);

  // WebSocket connection + message routing
  useEffect(() => {
    if (!url) return;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
      socketRef.current = ws;
    } catch {
      return;
    }

    ws.onopen = () => {
      setConnected(true);
      console.log("[WS] Connected to", url);
    };

    ws.onclose = () => {
      setConnected(false);
      console.log("[WS] Disconnected");
    };

    ws.onerror = () => {
      console.warn("[WS] Connection error — falling back to mock telemetry");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);

        switch (data.type) {
          case "market_update":
            if (Array.isArray(data.prices)) {
              setMarketPrices(data.prices);
            }
            break;

          case "rankings_update":
            if (Array.isArray(data.rankings)) setRankings(data.rankings);
            if (Array.isArray(data.routes)) setRoutes(data.routes);
            break;

          case "agent1_complete":
            addLog("success", "AH-001",
              `Valuation complete — ${data.valuations_count} asteroids valued in ${Math.round(data.elapsed_seconds)}s`);
            break;

          case "mission_report":
            setMissionReport({
              asteroid_id: data.asteroid_id,
              cached: data.cached,
              report: data.report,
              timestamp: data.timestamp,
            });
            break;

          case "agent_status": {
            const status: AgentStatus = {
              agent: data.agent,
              status: data.status,
              message: data.message,
              asteroid_id: data.asteroid_id,
            };
            setAgentStatuses((prev) => ({ ...prev, [data.agent]: status }));
            // Also surface as a log entry
            const logType = data.status === "error" ? "error"
              : data.status === "active" ? "info"
              : "success";
            addLog(logType, agentIdFor(data.agent), data.message);
            break;
          }

          default:
            // Legacy LogEntry format or unknown — surface as telemetry log
            addLog(data.type || "info", data.agentId || data.agent || "SYSTEM", data.message || JSON.stringify(data));
        }
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    };

    return () => ws.close();
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mock telemetry ticker removed

  const addLog = useCallback((type: LogEntry["type"], agentId: string, message: string) => {
    setLogs((prev) => [
      ...prev.slice(-49),
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: formatTelemetryTime(new Date()),
        type,
        agentId,
        message,
      },
    ]);
  }, []);

  const addManualLog = useCallback((message: string, type: LogEntry["type"] = "info", agentId = "USER") => {
    addLog(type, agentId, message);
  }, [addLog]);

  return {
    logs,
    marketPrices,
    rankings,
    routes,
    agentStatuses,
    missionReport,
    connected,
    addManualLog,
  };
}

// Backward-compat alias — existing callers of useWebSockets still work
export function useWebSockets(url?: string) {
  const { logs, addManualLog } = useOrebitWebSocket(url);
  return { logs, addManualLog };
}

export type UseWebSocketsReturn = ReturnType<typeof useWebSockets>;

// Maps agent ID string to short display ID
function agentIdFor(agent: string): string {
  const map: Record<string, string> = {
    market_feed: "AH-002",
    valuation: "AH-001",
    targeting: "AH-003",
    mission_report: "AH-004",
  };
  return map[agent] ?? "AH-000";
}
