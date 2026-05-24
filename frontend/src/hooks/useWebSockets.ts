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
import {
  buildMarketUpdateLogLines,
  formatAgentStatusLine,
} from "@/lib/marketAgentLog";

const MARKET_FEED_LOG_CAP = 120;

export function useOrebitWebSocket(url?: string) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [marketFeedLogs, setMarketFeedLogs] = useState<string[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const prevMarketPricesRef = useRef<Map<string, number>>(new Map());
  const [rankings, setRankings] = useState<RankedAsteroid[]>([]);
  const [routes, setRoutes] = useState<MissionRoute[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [missionReport, setMissionReport] = useState<MissionReportData | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  // Initial telemetry logs start empty

  const applyBootstrapPayload = useCallback(
    (pricesPayload: unknown, rankingsPayload: unknown) => {
      const prices = (pricesPayload as { prices?: MarketPrice[] })?.prices;
      if (isNonEmptyArray<MarketPrice>(prices)) {
        setMarketPrices(prices);
      }

      const rankingsData = rankingsPayload as {
        rankings?: RankedAsteroid[];
        routes?: MissionRoute[];
      };
      if (isNonEmptyArray<RankedAsteroid>(rankingsData?.rankings)) {
        setRankings(rankingsData.rankings);
      }
      if (isNonEmptyArray<MissionRoute>(rankingsData?.routes)) {
        setRoutes(rankingsData.routes);
      }
    },
    []
  );

  /** Load cached NeonDB data via REST — safe to call on mount and after WS reconnect. */
  const loadBootstrap = useCallback(async () => {
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

    if (pricesResult.status === "fulfilled") {
      applyBootstrapPayload(pricesResult.value, null);
    } else {
      console.warn("[REST] Failed to fetch prices:", pricesResult.reason);
    }

    if (rankingsResult.status === "fulfilled") {
      applyBootstrapPayload(null, rankingsResult.value);
    } else {
      console.warn("[REST] Failed to fetch rankings:", rankingsResult.reason);
    }

    return {
      gotPrices:
        pricesResult.status === "fulfilled" &&
        isNonEmptyArray<MarketPrice>(pricesResult.value?.prices),
      gotRankings:
        rankingsResult.status === "fulfilled" &&
        isNonEmptyArray<RankedAsteroid>(rankingsResult.value?.rankings),
    };
  }, [applyBootstrapPayload]);

  // REST bootstrap on mount (retries until backend is up or cap reached)
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      if (cancelled) return;
      const result = await loadBootstrap();
      if (cancelled) return;
      if (result.gotPrices && result.gotRankings) return;

      attempt += 1;
      if (attempt >= 8) return;
      const delay = Math.min(1000 * 2 ** attempt, 15000);
      timer = setTimeout(run, delay);
    };

    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [loadBootstrap]);

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

  const appendMarketFeedLogs = useCallback((lines: string[]) => {
    if (lines.length === 0) return;
    setMarketFeedLogs((prev) => [...prev, ...lines].slice(-MARKET_FEED_LOG_CAP));
  }, []);

  const handleWsPayload = useCallback((data: Record<string, unknown>) => {
    switch (data.type) {
      case "market_update":
        if (isNonEmptyArray<MarketPrice>(data.prices)) {
          const prices = data.prices;
          const { lines, nextPrevious } = buildMarketUpdateLogLines(
            prices,
            prevMarketPricesRef.current
          );
          prevMarketPricesRef.current = nextPrevious;
          appendMarketFeedLogs(lines);
          setMarketPrices(prices);
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
        addLog(
          "success",
          "AH-001",
          `Valuation complete — ${data.valuations_count} asteroids valued in ${Math.round(Number(data.elapsed_seconds))}s`
        );
        break;

      case "mission_report":
        setMissionReport({
          asteroid_id: String(data.asteroid_id ?? ""),
          cached: Boolean(data.cached),
          report: (data.report as MissionReportData["report"]) ?? {},
          timestamp: String(data.timestamp ?? ""),
        });
        break;

      case "agent_status": {
        const status: AgentStatus = {
          agent: String(data.agent ?? ""),
          status: String(data.status ?? ""),
          message: String(data.message ?? ""),
          asteroid_id: data.asteroid_id != null ? String(data.asteroid_id) : undefined,
        };
        setAgentStatuses((prev) => ({ ...prev, [status.agent]: status }));
        if (status.agent === "market_feed" && status.message.trim()) {
          appendMarketFeedLogs([formatAgentStatusLine(status.message)]);
        }
        const logType =
          status.status === "error" ? "error" : status.status === "active" ? "info" : "success";
        addLog(logType, agentIdFor(status.agent), status.message);
        break;
      }

      default: {
        const logType = String(data.type || "info");
        const safeType: LogEntry["type"] =
          logType === "success" ||
          logType === "warning" ||
          logType === "error" ||
          logType === "telemetry" ||
          logType === "discovery"
            ? logType
            : "info";
        addLog(
          safeType,
          String(data.agentId || data.agent || "SYSTEM"),
          String(data.message || JSON.stringify(data))
        );
      }
    }
  }, [addLog, appendMarketFeedLogs]);

  // WebSocket connection + message routing (reconnect if backend starts after UI)
  useEffect(() => {
    if (!url) return;

    let ws: WebSocket | null = null;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (cancelled) return;
      try {
        ws = new WebSocket(url);
        socketRef.current = ws;
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
        console.log("[WS] Connected to", url);
        void loadBootstrap();
      };

      ws.onclose = () => {
        setConnected(false);
        socketRef.current = null;
        if (!cancelled) scheduleReconnect();
      };

      ws.onerror = () => {
        console.warn("[WS] Connection error");
      };

      ws.onmessage = (event) => {
        for (const data of parseWsFrames(event.data)) {
          try {
            handleWsPayload(data);
          } catch (e) {
            console.error("[WS] Handler error:", e);
          }
        }
      };
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      const delay = Math.min(1000 * 2 ** attempt, 15000);
      attempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
      socketRef.current = null;
    };
  }, [url, handleWsPayload, loadBootstrap]);

  const addManualLog = useCallback((message: string, type: LogEntry["type"] = "info", agentId = "USER") => {
    addLog(type, agentId, message);
  }, [addLog]);

  return {
    logs,
    marketFeedLogs,
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

/** Parse one WS payload — NDJSON, or multiple JSON objects in one frame. */
export function parseWsFrames(raw: unknown): Record<string, unknown>[] {
  const text = typeof raw === "string" ? raw : String(raw ?? "");
  const trimmed = text.trim();
  if (!trimmed) return [];

  const frames: Record<string, unknown>[] = [];
  for (const chunk of splitJsonChunks(trimmed)) {
    try {
      frames.push(JSON.parse(chunk) as Record<string, unknown>);
    } catch (e) {
      console.error("[WS] Parse error:", e, chunk.slice(0, 120));
    }
  }
  return frames;
}

/** Split NDJSON or back-to-back JSON objects (`{}{}`) into parseable chunks. */
function splitJsonChunks(text: string): string[] {
  if (text.includes("\n")) {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  try {
    JSON.parse(text);
    return [text];
  } catch {
    // Fall through — multiple objects concatenated without newlines
  }

  const chunks: string[] = [];
  let depth = 0;
  let start = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const slice = text.slice(start, i + 1).trim();
        if (slice) chunks.push(slice);
        start = i + 1;
      }
    }
  }

  return chunks.length > 0 ? chunks : [text];
}

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
