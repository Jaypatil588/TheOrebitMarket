import { useState, useEffect, useRef, useCallback } from "react";
import { formatTelemetryTime } from "@/lib/utils";
import { BACKEND_URL } from "@/lib/config";
import {
  hasLivePrices,
  hasLiveRankings,
  hasLiveRoutes,
  isNonEmptyArray,
} from "@/lib/liveData";

export type {
  LogEntry,
  MarketPrice,
  RankedAsteroid,
  RouteStop,
  RouteTotals,
  MissionRoute,
  AgentStatus,
  MissionReportData,
  Scenario,
} from "@/types/orebit";

import type {
  LogEntry,
  MarketPrice,
  RankedAsteroid,
  MissionRoute,
  AgentStatus,
  MissionReportData,
} from "@/types/orebit";

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

  // REST bootstrap before / alongside WebSocket — only non-empty payloads replace state
  useEffect(() => {
    let cancelled = false;

    const loadBootstrap = async () => {
      const [pricesResult, rankingsResult] = await Promise.allSettled([
        fetch(`${BACKEND_URL}/api/prices`).then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }),
        fetch(`${BACKEND_URL}/api/rankings`).then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }),
      ]);

      if (cancelled) return;

      if (pricesResult.status === "fulfilled") {
        const prices = pricesResult.value?.prices;
        if (isNonEmptyArray<MarketPrice>(prices)) {
          setMarketPrices(prices);
        }
      } else {
        console.warn("[REST] Failed to fetch initial prices:", pricesResult.reason);
      }

      if (rankingsResult.status === "fulfilled") {
        const data = rankingsResult.value;
        if (isNonEmptyArray<RankedAsteroid>(data?.rankings)) {
          setRankings(data.rankings);
        }
        if (isNonEmptyArray<MissionRoute>(data?.routes)) {
          setRoutes(data.routes);
        }
      } else {
        console.warn("[REST] Failed to fetch initial rankings:", rankingsResult.reason);
      }
    };

    void loadBootstrap();
    return () => {
      cancelled = true;
    };
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
            if (isNonEmptyArray<MarketPrice>(data.prices)) {
              setMarketPrices(data.prices);
            }
            break;

          case "rankings_update":
            if (isNonEmptyArray<RankedAsteroid>(data.rankings)) {
              setRankings(data.rankings);
            }
            if (isNonEmptyArray<MissionRoute>(data.routes)) {
              setRoutes(data.routes);
            }
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
    hasLivePrices: hasLivePrices(marketPrices),
    hasLiveRankings: hasLiveRankings(rankings),
    hasLiveRoutes: hasLiveRoutes(routes),
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
