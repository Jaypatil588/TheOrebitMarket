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
import {
  buildRankingsUpdateLogLines,
  formatRankerStatusLine,
} from "@/lib/rankerAgentLog";
import {
  buildAgent1CompleteLogLines,
  formatValuationStatusLine,
} from "@/lib/valuationAgentLog";
import {
  buildMissionReportLogLines,
  formatMissionStatusLine,
} from "@/lib/missionAgentLog";

const AGENT_FEED_LOG_CAP = 120;
const LIVE_PRICE_POLL_MS = 8000; // 7.5 RPM
const LIVE_RANKING_POLL_MS = 10000; // 6 RPM
const LIVE_VALUATION_POLL_MS = 120000; // 0.5 RPM, DB-backed Agent 1 heartbeat

export function useOrebitWebSocket(url?: string) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [marketFeedLogs, setMarketFeedLogs] = useState<string[]>([]);
  const [rankerFeedLogs, setRankerFeedLogs] = useState<string[]>([]);
  const [valuationFeedLogs, setValuationFeedLogs] = useState<string[]>([]);
  const [missionFeedLogs, setMissionFeedLogs] = useState<string[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const prevMarketPricesRef = useRef<Map<string, number>>(new Map());
  const prevRankerUrgencyRef = useRef<Map<string, number>>(new Map());
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
  const loadBootstrap = useCallback(async (apiKey?: string | null) => {
    const headers = apiKey ? { 'x-gemini-api-key': apiKey } : undefined;
    const [pricesResult, rankingsResult] = await Promise.allSettled([
      fetch(`${BACKEND_URL}/api/prices`, { headers }).then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }),
      fetch(`${BACKEND_URL}/api/rankings`, { headers }).then(async (res) => {
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
      const savedKey =
        typeof window !== "undefined" ? localStorage.getItem("orebit_gemini_api_key") : null;
      if (!savedKey) return;

      const result = await loadBootstrap(savedKey);
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
    setMarketFeedLogs((prev) => [...prev, ...lines].slice(-AGENT_FEED_LOG_CAP));
  }, []);

  const appendRankerFeedLogs = useCallback((lines: string[]) => {
    if (lines.length === 0) return;
    setRankerFeedLogs((prev) => [...prev, ...lines].slice(-AGENT_FEED_LOG_CAP));
  }, []);

  const appendValuationFeedLogs = useCallback((lines: string[]) => {
    if (lines.length === 0) return;
    setValuationFeedLogs((prev) => [...prev, ...lines].slice(-AGENT_FEED_LOG_CAP));
  }, []);

  const appendMissionFeedLogs = useCallback((lines: string[]) => {
    if (lines.length === 0) return;
    setMissionFeedLogs((prev) => [...prev, ...lines].slice(-AGENT_FEED_LOG_CAP));
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

      case "rankings_update": {
        const rankingsPayload = isNonEmptyArray<RankedAsteroid>(data.rankings)
          ? data.rankings
          : null;
        const routesPayload = isNonEmptyArray<MissionRoute>(data.routes)
          ? data.routes
          : null;

        if (rankingsPayload) {
          setRankings(rankingsPayload);
        }
        if (routesPayload) {
          setRoutes(routesPayload);
        }

        if (rankingsPayload && routesPayload) {
          const { lines, nextPrevious } = buildRankingsUpdateLogLines(
            rankingsPayload,
            routesPayload,
            prevRankerUrgencyRef.current
          );
          prevRankerUrgencyRef.current = nextPrevious;
          appendRankerFeedLogs(lines);
        }
        break;
      }

      case "agent1_complete":
        appendValuationFeedLogs(
          buildAgent1CompleteLogLines({
            valuations_count: Number(data.valuations_count ?? 0),
            deep_research_count: Number(data.deep_research_count ?? 0),
            fast_valuation_count: Number(data.fast_valuation_count ?? 0),
            elapsed_seconds: Number(data.elapsed_seconds ?? 0),
          })
        );
        addLog(
          "success",
          "AH-001",
          `Valuation complete — ${data.valuations_count} asteroids valued in ${Math.round(Number(data.elapsed_seconds))}s`
        );
        break;

      case "mission_report": {
        const reportPayload: MissionReportData = {
          asteroid_id: String(data.asteroid_id ?? ""),
          cached: Boolean(data.cached),
          report: (data.report as MissionReportData["report"]) ?? {},
          timestamp: String(data.timestamp ?? ""),
        };
        setMissionReport(reportPayload);
        appendMissionFeedLogs(buildMissionReportLogLines(reportPayload));
        break;
      }

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
        } else if (status.agent === "targeting" && status.message.trim()) {
          appendRankerFeedLogs([formatRankerStatusLine(status.message)]);
        } else if (status.agent === "valuation" && status.message.trim()) {
          appendValuationFeedLogs([formatValuationStatusLine(status.message)]);
        } else if (status.agent === "mission_report" && status.message.trim()) {
          appendMissionFeedLogs([formatMissionStatusLine(status.message)]);
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
  }, [
    addLog,
    appendMarketFeedLogs,
    appendRankerFeedLogs,
    appendValuationFeedLogs,
    appendMissionFeedLogs,
  ]);

  const [continuousResearch, setContinuousResearch] = useState(false);
  const continuousResearchRef = useRef(false);
  useEffect(() => {
    continuousResearchRef.current = continuousResearch;
  }, [continuousResearch]);

  // WebSocket connection + message routing (reconnect if backend starts after UI)
  useEffect(() => {
    if (!url) return;

    let ws: WebSocket | null = null;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let simulationTimer: ReturnType<typeof setInterval> | null = null;

    const startSimulation = () => {
      setConnected(true);
      console.log("[WS] Serverless mode: Starting comprehensive demo simulation");

      // ────────────────────────────────────────────────────────────────
      // DEMO RANKED ASTEROIDS — populate the Targets table immediately
      // ────────────────────────────────────────────────────────────────
      const demoRankings: RankedAsteroid[] = [
        { rank: 1,  asteroid_id: "20000016", name: "16 Psyche",       spec_type: "M", composite_score: 0.94, net_value_usd: 1.02e13,  roi: 1242, top_mineral: "cobalt",    mineral_urgency: 0.88, delta_v_km_s: 5.82, launch_window_year: 2028, confidence: 0.91, scenario_boosted: false, reasoning: "Highest composite — cobalt/nickel M-type body with accessible Δv", trend: "up" },
        { rank: 2,  asteroid_id: "20000002", name: "2 Pallas",        spec_type: "B", composite_score: 0.89, net_value_usd: 4.5e11,   roi: 847,  top_mineral: "nickel",    mineral_urgency: 0.72, delta_v_km_s: 6.14, launch_window_year: 2029, confidence: 0.87, scenario_boosted: false, reasoning: "B-type carbonaceous body with nickel-rich metallic inclusions", trend: "up" },
        { rank: 3,  asteroid_id: "20003554", name: "3554 Amun",       spec_type: "M", composite_score: 0.87, net_value_usd: 6.8e12,   roi: 973,  top_mineral: "platinum",  mineral_urgency: 0.78, delta_v_km_s: 4.91, launch_window_year: 2028, confidence: 0.89, scenario_boosted: false, reasoning: "Near-Earth M-type with high PGM signatures — low Δv extraction target", trend: "up" },
        { rank: 4,  asteroid_id: "20006178", name: "6178 1986 DA",    spec_type: "M", composite_score: 0.85, net_value_usd: 3.2e12,   roi: 756,  top_mineral: "palladium", mineral_urgency: 0.74, delta_v_km_s: 5.23, launch_window_year: 2029, confidence: 0.85, scenario_boosted: false, reasoning: "Confirmed metallic body — radar albedo consistent with iron-nickel-palladium core", trend: "stable" },
        { rank: 5,  asteroid_id: "20000433", name: "433 Eros",        spec_type: "S", composite_score: 0.82, net_value_usd: 1.8e12,   roi: 634,  top_mineral: "platinum",  mineral_urgency: 0.69, delta_v_km_s: 5.58, launch_window_year: 2028, confidence: 0.92, scenario_boosted: false, reasoning: "NEAR-Shoemaker surveyed S-type — well-characterized platinum deposit", trend: "up" },
        { rank: 6,  asteroid_id: "20000024", name: "24 Themis",       spec_type: "C", composite_score: 0.79, net_value_usd: 2.4e11,   roi: 1005, top_mineral: "water_ice", mineral_urgency: 0.62, delta_v_km_s: 3.82, launch_window_year: 2027, confidence: 0.83, scenario_boosted: false, reasoning: "Confirmed surface water ice — propellant depot candidate", trend: "stable" },
        { rank: 7,  asteroid_id: "20000001", name: "1 Ceres",         spec_type: "C", composite_score: 0.78, net_value_usd: 8.4e12,   roi: 523,  top_mineral: "neodymium", mineral_urgency: 0.58, delta_v_km_s: 7.12, launch_window_year: 2029, confidence: 0.88, scenario_boosted: false, reasoning: "Largest main-belt body — rare earth enrichment in clay minerals", trend: "down" },
        { rank: 8,  asteroid_id: "20000010", name: "10 Hygiea",       spec_type: "C", composite_score: 0.76, net_value_usd: 2.1e12,   roi: 481,  top_mineral: "dysprosium",mineral_urgency: 0.54, delta_v_km_s: 6.89, launch_window_year: 2030, confidence: 0.81, scenario_boosted: false, reasoning: "C-type with REE-enriched phyllosilicates — strategic dysprosium source", trend: "stable" },
        { rank: 9,  asteroid_id: "20000216", name: "216 Kleopatra",   spec_type: "M", composite_score: 0.74, net_value_usd: 1.8e12,   roi: 412,  top_mineral: "rhodium",   mineral_urgency: 0.68, delta_v_km_s: 7.45, launch_window_year: 2031, confidence: 0.79, scenario_boosted: false, reasoning: "Dog-bone M-type — confirmed PGM-bearing metallic structure", trend: "up" },
        { rank: 10, asteroid_id: "20000253", name: "253 Mathilde",    spec_type: "C", composite_score: 0.71, net_value_usd: 5.6e11,   roi: 378,  top_mineral: "cobalt",    mineral_urgency: 0.52, delta_v_km_s: 6.21, launch_window_year: 2029, confidence: 0.76, scenario_boosted: false, reasoning: "NEAR flyby target — high-porosity C-type with cobalt clay minerals", trend: "down" },
        { rank: 11, asteroid_id: "20000065", name: "65 Cybele",       spec_type: "C", composite_score: 0.69, net_value_usd: 1.8e11,   roi: 342,  top_mineral: "water_ice", mineral_urgency: 0.48, delta_v_km_s: 4.56, launch_window_year: 2028, confidence: 0.74, scenario_boosted: false, reasoning: "C-type with thermal inertia consistent with sub-surface ice deposits", trend: "stable" },
        { rank: 12, asteroid_id: "20001036", name: "1036 Ganymed",    spec_type: "S", composite_score: 0.67, net_value_usd: 9.2e11,   roi: 298,  top_mineral: "nickel",    mineral_urgency: 0.46, delta_v_km_s: 5.94, launch_window_year: 2028, confidence: 0.82, scenario_boosted: false, reasoning: "Largest NEA — S-type with significant olivine-rich nickel bearing silicates", trend: "up" },
        { rank: 13, asteroid_id: "20000951", name: "951 Gaspra",      spec_type: "S", composite_score: 0.65, net_value_usd: 7.1e11,   roi: 267,  top_mineral: "iron",      mineral_urgency: 0.42, delta_v_km_s: 6.78, launch_window_year: 2030, confidence: 0.80, scenario_boosted: false, reasoning: "Galileo flyby target — well-characterized S-type with high iron fraction", trend: "stable" },
        { rank: 14, asteroid_id: "20000243", name: "243 Ida",         spec_type: "S", composite_score: 0.63, net_value_usd: 5.8e11,   roi: 234,  top_mineral: "iron",      mineral_urgency: 0.38, delta_v_km_s: 7.02, launch_window_year: 2031, confidence: 0.78, scenario_boosted: false, reasoning: "Koronis family S-type — moderate iron/olivine with Dactyl binary system", trend: "down" },
        { rank: 15, asteroid_id: "20000004", name: "4 Vesta",         spec_type: "V", composite_score: 0.61, net_value_usd: 4.2e12,   roi: 198,  top_mineral: "iron",      mineral_urgency: 0.35, delta_v_km_s: 8.15, launch_window_year: 2032, confidence: 0.93, scenario_boosted: false, reasoning: "Dawn mission surveyed — differentiated basaltic body with iron-rich core", trend: "stable" },
      ];
      setRankings(demoRankings);

      // ────────────────────────────────────────────────────────────────
      // DEMO MARKET PRICES — ensure market list is always populated
      // ────────────────────────────────────────────────────────────────
      const demoMarketPrices: MarketPrice[] = [
        { mineral: "cobalt",      price_usd: 33800,  trend: "rising",  change_pct: 3.5,  urgency: 0.82, disruption: "DRC mine flooding — 40% supply disruption",            source_url: "", category: "Battery Metals",  criticality: 5, scenario_adjusted: false, fetched_at: new Date().toISOString() },
        { mineral: "platinum",    price_usd: 31240,  trend: "rising",  change_pct: 2.1,  urgency: 0.78, disruption: "Autocatalyst demand surge — Euro 7 standards",          source_url: "", category: "Platinum Group",  criticality: 4, scenario_adjusted: false, fetched_at: new Date().toISOString() },
        { mineral: "palladium",   price_usd: 42180,  trend: "rising",  change_pct: 1.8,  urgency: 0.74, disruption: "PGM stockpile drawdown below critical threshold",      source_url: "", category: "Platinum Group",  criticality: 4, scenario_adjusted: false, fetched_at: new Date().toISOString() },
        { mineral: "neodymium",   price_usd: 210,    trend: "rising",  change_pct: 5.2,  urgency: 0.72, disruption: "Export controls tightening — allocation reduced 15%",   source_url: "", category: "Rare Earths",     criticality: 5, scenario_adjusted: false, fetched_at: new Date().toISOString() },
        { mineral: "dysprosium",  price_usd: 480,    trend: "rising",  change_pct: 8.1,  urgency: 0.68, disruption: "Defense stockpile below 6-month threshold",             source_url: "", category: "Rare Earths",     criticality: 5, scenario_adjusted: false, fetched_at: new Date().toISOString() },
        { mineral: "rhodium",     price_usd: 145200, trend: "rising",  change_pct: 4.3,  urgency: 0.68, disruption: "",                                                     source_url: "", category: "Platinum Group",  criticality: 4, scenario_adjusted: false, fetched_at: new Date().toISOString() },
        { mineral: "nickel",      price_usd: 16400,  trend: "falling", change_pct: -0.4, urgency: 0.55, disruption: "",                                                     source_url: "", category: "Battery Metals",  criticality: 3, scenario_adjusted: false, fetched_at: new Date().toISOString() },
        { mineral: "lithium",     price_usd: 24500,  trend: "rising",  change_pct: 1.1,  urgency: 0.52, disruption: "",                                                     source_url: "", category: "Battery Metals",  criticality: 4, scenario_adjusted: false, fetched_at: new Date().toISOString() },
        { mineral: "iridium",     price_usd: 156000, trend: "stable",  change_pct: 0.3,  urgency: 0.48, disruption: "",                                                     source_url: "", category: "Platinum Group",  criticality: 3, scenario_adjusted: false, fetched_at: new Date().toISOString() },
        { mineral: "rare_earths", price_usd: 85000,  trend: "rising",  change_pct: 1.2,  urgency: 0.72, disruption: "Export controls",                                      source_url: "", category: "Rare Earths",     criticality: 5, scenario_adjusted: false, fetched_at: new Date().toISOString() },
        { mineral: "water_ice",   price_usd: 500,    trend: "stable",  change_pct: 0.0,  urgency: 0.40, disruption: "",                                                     source_url: "", category: "Propellants",     criticality: 2, scenario_adjusted: false, fetched_at: new Date().toISOString() },
        { mineral: "silicon",     price_usd: 2800,   trend: "falling", change_pct: -0.8, urgency: 0.32, disruption: "",                                                     source_url: "", category: "Industrial",      criticality: 2, scenario_adjusted: false, fetched_at: new Date().toISOString() },
      ];
      setMarketPrices(demoMarketPrices);

      // ────────────────────────────────────────────────────────────────
      // AGENT LOG SIMULATION — Extensive web scraping + processing logs
      // ────────────────────────────────────────────────────────────────

      // AGENT 1: Valuation Scout — NASA data retrieval + spectroscopy
      const valuationLogSequence: string[] = [
        "[AGENT1] ══════════════════════════════════════════════════════════════",
        "[AGENT1] Valuation Scout initializing | batch mode: 500 NEAs",
        "[AGENT1] Loading NASA JPL SBDB API client...",
        "[AGENT1] HTTP GET https://ssd-api.jpl.nasa.gov/sbdb_query.api?fields=spkid,full_name,class,diameter,spec_B,spec_T → 200 OK",
        "[AGENT1] Parsed 1,847 Near-Earth Asteroid records from JPL response",
        "[AGENT1] Filtering: diameter > 0.1 km, MOID < 0.3 AU → 642 candidates",
        "[AGENT1] HTTP GET https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.05&date-min=2026-01-01 → 200 OK",
        "[AGENT1] Cross-referenced 89 close approach windows through 2035",
        "[AGENT1] ── Shoemaker-Helin Pipeline Start ──",
        "[AGENT1] Running spectral classification for 642 bodies...",
        "[AGENT1] M-type signatures confirmed: 47 bodies (metallic core indicators)",
        "[AGENT1] S-type silicate-rich: 198 bodies",
        "[AGENT1] C-type carbonaceous: 312 bodies (water/REE potential)",
        "[AGENT1] B/V/D-type other: 85 bodies",
        "[AGENT1] Computing bulk density estimates via thermal inertia model...",
        "[AGENT1] Deep research: 16 Psyche → density 3,780 kg/m³, metallic fraction 0.89",
        "[AGENT1] Deep research: 3554 Amun → density 5,100 kg/m³, metallic fraction 0.94",
        "[AGENT1] Deep research: 433 Eros → density 2,670 kg/m³, silicate-metal mix 0.42",
        "[AGENT1] Fast valuation: 497 bodies using SMASS-II spectral templates",
        "[AGENT1] HTTP GET https://irsa.ipac.caltech.edu/cgi-bin/Radar/nph-radarObs → 200 OK",
        "[AGENT1] Radar albedo cross-reference: 23 bodies with S/X band observations",
        "[AGENT1] 6178 1986 DA radar albedo=0.15 → confirmed metallic surface (Pd/Fe/Ni)",
        "[AGENT1] HTTP GET https://ssd.jpl.nasa.gov/?phys_par → 200 OK",
        "[AGENT1] Physical properties table merged for 412/642 candidates",
        "[AGENT1] Mineral composition estimation using Bus-DeMeo taxonomy...",
        "[AGENT1] Composition matrix complete: Ni, Co, Fe, Pt, Pd, H₂O, REE for 500 bodies",
        "[AGENT1] Computing net asset value with damping factor 0.0001 (realistic extraction)...",
        "[AGENT1] Valuation complete: 500 total | deep=47 | fast=453 | elapsed=12.4s",
        "[AGENT1] ══════════════════════════════════════════════════════════════",
        "[AGENT1] DB: 500 valuations cached to strategic_valuations table",
        "[AGENT1] Signalling Agent 3 to run",
      ];

      // AGENT 2: Market Intelligence — Web scraping simulation
      const marketLogSequence: string[] = [
        "[AGENT2] ══════════════════════════════════════════════════════════════",
        "[AGENT2] Market Intelligence agent initializing...",
        "[AGENT2] Loading Gemini web search tools...",
        "[AGENT2] ── Scraping commodity price feeds ──",
        "[AGENT2] HTTP GET https://www.lme.com/api/v1/prices/cobalt → 200 OK",
        "[AGENT2] Parsed: cobalt=$33,800/t | change=+3.5% | trend=RISING",
        "[AGENT2]   disruption: DRC Katanga mine flooding — supply chain halt reported",
        "[AGENT2] HTTP GET https://www.lme.com/api/v1/prices/nickel → 200 OK",
        "[AGENT2] Parsed: nickel=$16,400/t | change=-0.4% | trend=FALLING",
        "[AGENT2] HTTP GET https://www.kitco.com/strategic-metals/platinum → 200 OK",
        "[AGENT2] Parsed: platinum=$31,240/t | change=+2.1% | trend=RISING",
        "[AGENT2] HTTP GET https://www.kitco.com/strategic-metals/palladium → 200 OK",
        "[AGENT2] Parsed: palladium=$42,180/t | change=+1.8% | trend=RISING",
        "[AGENT2] HTTP GET https://www.metal.com/Rare-Earths → 200 OK",
        "[AGENT2] Parsed: neodymium=$210/kg | change=+5.2% | trend=RISING",
        "[AGENT2]   disruption: Export controls tightening — neodymium allocation reduced 15%",
        "[AGENT2] Parsed: dysprosium=$480/kg | change=+8.1% | trend=RISING",
        "[AGENT2]   disruption: Critical defense stockpile drawdown below 6-month threshold",
        "[AGENT2] HTTP GET https://www.rhodium.com/api/spot → 200 OK",
        "[AGENT2] Parsed: rhodium=$145,200/t | change=+4.3% | trend=RISING",
        "[AGENT2] ── Supply chain intelligence scraping ──",
        "[AGENT2] HTTP GET https://www.reuters.com/markets/commodities → 200 OK",
        "[AGENT2] NLP extraction: \"DRC flooding disrupts 40% of global cobalt supply\"",
        "[AGENT2] NLP extraction: \"EV battery demand surge drives nickel futures +12% YTD\"",
        "[AGENT2] HTTP GET https://www.mining.com/news → 200 OK",
        "[AGENT2] NLP extraction: \"Platinum autocatalyst demand up 8% on Euro 7 emission standards\"",
        "[AGENT2] HTTP GET https://www.spglobal.com/commodity-insights → 200 OK",
        "[AGENT2] NLP extraction: \"Water scarcity pricing model: cislunar H₂O at $500/kg by 2030\"",
        "[AGENT2] ── Urgency vector computation ──",
        "[AGENT2] SHIFT: cobalt     urgency 0.720 → 0.820 (+0.100) ⚠ CRITICAL",
        "[AGENT2] SHIFT: neodymium  urgency 0.580 → 0.720 (+0.140) ⚠ ELEVATED",
        "[AGENT2] SHIFT: dysprosium urgency 0.540 → 0.680 (+0.140) ⚠ ELEVATED",
        "[AGENT2] SHIFT: platinum   urgency 0.610 → 0.780 (+0.170) ⚠ CRITICAL",
        "[AGENT2] cobalt     $33,800.0000  trend=rising   urgency=0.820 crit=5",
        "[AGENT2] platinum   $31,240.0000  trend=rising   urgency=0.780 crit=4",
        "[AGENT2] nickel     $16,400.0000  trend=falling  urgency=0.550 crit=3",
        "[AGENT2] neodymium  $210.0000     trend=rising   urgency=0.720 crit=5",
        "[AGENT2] dysprosium $480.0000     trend=rising   urgency=0.680 crit=5",
        "[AGENT2] palladium  $42,180.0000  trend=rising   urgency=0.740 crit=4",
        "[AGENT2] rhodium    $145,200.0000 trend=rising   urgency=0.680 crit=4",
        "[AGENT2] water_ice  $500.0000     trend=stable   urgency=0.400 crit=2",
        "[AGENT2] DB: inserted 8/8 rows → market_prices table",
        "[AGENT2] Broadcast sent to frontend | 8 prices",
        "[AGENT2] ══════════════════════════════════════════════════════════════",
      ];

      // AGENT 3: Strategic Ranker — Route optimization
      const rankerLogSequence: string[] = [
        "[AGENT3] ══════════════════════════════════════════════════════════════",
        "[AGENT3] Strategic Ranker initializing | composite scoring pipeline",
        "[AGENT3] Loading 500 valuations from Agent 1 cache...",
        "[AGENT3] Loading 8 market urgency vectors from Agent 2...",
        "[AGENT3] ── Composite Score Computation ──",
        "[AGENT3] Score formula: 0.5×urgency + 0.3×accessibility + 0.2×value",
        "[AGENT3] Rank #01 16 Psyche              score=0.940 val=$1.02e+13 mineral=cobalt        dv=5.82 boosted=false",
        "[AGENT3] Rank #02 2 Pallas               score=0.890 val=$4.50e+11 mineral=nickel        dv=6.14 boosted=false",
        "[AGENT3] Rank #03 3554 Amun              score=0.870 val=$6.80e+12 mineral=platinum      dv=4.91 boosted=false",
        "[AGENT3] Rank #04 6178 1986 DA           score=0.850 val=$3.20e+12 mineral=palladium     dv=5.23 boosted=false",
        "[AGENT3] Rank #05 433 Eros               score=0.820 val=$1.80e+12 mineral=platinum      dv=5.58 boosted=false",
        "[AGENT3]   HIGH urgency: cobalt        0.820",
        "[AGENT3]   HIGH urgency: platinum      0.780",
        "[AGENT3]   HIGH urgency: palladium     0.740",
        "[AGENT3]   HIGH urgency: neodymium     0.720",
        "[AGENT3] ── Multi-Objective Route Optimization ──",
        "[AGENT3] Running Pareto-optimal mission corridor search (3 routes)...",
        "[AGENT3] Route: Cobalt Urgency Run          urgency=0.82 stops=4 net=$1.06e+13 default=true scenario=false",
        "[AGENT3] Route: Platinum Sweep              urgency=0.74 stops=5 net=$1.17e+13 default=false scenario=false",
        "[AGENT3] Route: Water Depot Run             urgency=0.68 stops=4 net=$3.82e+11 default=false scenario=false",
        "[AGENT3] ── Hohmann transfer orbit validation ──",
        "[AGENT3] Cobalt Run: Earth→Psyche Δv=5.82 (within FH+ion-tug budget ✓)",
        "[AGENT3] Cobalt Run: Psyche→Pallas Δv=2.80 (gravity assist viable ✓)",
        "[AGENT3] Platinum Sweep: Amun→1986DA Δv=1.90 (optimal transfer window 2029 ✓)",
        "[AGENT3] Water Depot: Themis→Cybele Δv=1.60 (low-energy corridor confirmed ✓)",
        "[AGENT3] URGENCY SHIFT: 16 Psyche 0.850 → 0.880 (+0.030)",
        "[AGENT3] URGENCY SHIFT: 3554 Amun 0.740 → 0.780 (+0.040)",
        "[AGENT3] DB: strategic ranking saved | 15 rankings, 3 routes",
        "[AGENT3] Broadcast sent to frontend | 15 rankings, 3 routes",
        "[AGENT3] ══════════════════════════════════════════════════════════════",
      ];

      // AGENT 4: Mission Architect — Deep dive analysis
      const missionLogSequence: string[] = [
        "[AGENT4] ══════════════════════════════════════════════════════════════",
        "[AGENT4] Mission Architect initializing | orbital mechanics engine",
        "[AGENT4] Standing by for asteroid selection from Targets panel...",
        "[AGENT4] ── Pre-computing feasibility for top 5 targets ──",
        "[AGENT4] Target: 16 Psyche (rank #1)",
        "[AGENT4] HTTP GET https://ssd.jpl.nasa.gov/horizons_batch.cgi?COMMAND=2000016 → 200 OK",
        "[AGENT4] Ephemeris loaded: 2026-2035 trajectory vectors (J2000 ecliptic)",
        "[AGENT4] Computing optimal launch windows...",
        "[AGENT4]   Window 1: 2028-Q2 → arrival 2029-Q4 | Δv=5.82 km/s | type=Hohmann+plane-change",
        "[AGENT4]   Window 2: 2030-Q1 → arrival 2031-Q3 | Δv=6.14 km/s | type=low-thrust spiral",
        "[AGENT4] Mining method evaluation:",
        "[AGENT4]   Magnetic rake + thermal fragmentation → TRL 6 (M-type optimal)",
        "[AGENT4]   Electromagnetic scoop → TRL 4 (backup for regolith surface ops)",
        "[AGENT4] Launch vehicle trade study:",
        "[AGENT4]   Falcon Heavy + Orebit Ion Tug → Δv budget 7.2 km/s ✓",
        "[AGENT4]   SLS Block 2 → Δv budget 9.8 km/s ✓ (contingency option)",
        "[AGENT4] Mission timeline: transit 420d + surface ops 240d + return 240d = 900d total",
        "[AGENT4] Report parsed | feasibility=9/10 recommendation=GO",
        "[AGENT4] ── Pre-computing: 3554 Amun (rank #3) ──",
        "[AGENT4] HTTP GET https://ssd.jpl.nasa.gov/horizons_batch.cgi?COMMAND=2003554 → 200 OK",
        "[AGENT4] Window 1: 2028-Q3 → arrival 2029-Q1 | Δv=4.91 km/s | NEA low-energy",
        "[AGENT4] Report parsed | feasibility=8/10 recommendation=GO",
        "[AGENT4] ── Pre-computing: 24 Themis (rank #6) ──",
        "[AGENT4] HTTP GET https://ssd.jpl.nasa.gov/horizons_batch.cgi?COMMAND=2000024 → 200 OK",
        "[AGENT4] Window 1: 2027-Q4 → arrival 2028-Q3 | Δv=3.82 km/s | propellant depot",
        "[AGENT4] Mining method: sublimation + cold-trap collection → TRL 5 (ice extraction)",
        "[AGENT4] Report parsed | feasibility=7/10 recommendation=GO",
        "[AGENT4] Images: render=true comp=true route=true profile=true",
        "[AGENT4] Report cached to DB | 3 mission briefs pre-computed",
        "[AGENT4] Broadcast sent to frontend | pre-computed mission data ready",
        "[AGENT4] ══════════════════════════════════════════════════════════════",
        "[AGENT4] Standing by for user target selection | click any asteroid in THE TARGETS",
      ];

      // ────────────────────────────────────────────────────────────────
      // SEQUENTIAL STREAMING — simulate progressive agent log output
      // ────────────────────────────────────────────────────────────────
      let logIndex = { market: 0, valuation: 0, ranker: 0, mission: 0 };
      let phase = 0; // 0=market, 1=valuation, 2=ranker, 3=mission
      let cascadeCompleted = false;

      // Stream 2-3 lines at a time every tick for realism
      const LINES_PER_TICK = 3;

      simulationTimer = setInterval(() => {
        if (cancelled) return;

        // If continuous research is disabled and we completed the first cascade, stand by
        if (!continuousResearchRef.current && cascadeCompleted) {
          return;
        }

        // Phase 0: Market Intelligence scraping
        if (phase === 0) {
          const end = Math.min(logIndex.market + LINES_PER_TICK, marketLogSequence.length);
          const lines = marketLogSequence.slice(logIndex.market, end);
          if (lines.length > 0) {
            appendMarketFeedLogs(lines);
            if (logIndex.market === 0) {
              addLog("info", "AH-002", "Market Intelligence agent active — scraping commodity feeds");
            }
          }
          logIndex.market = end;
          if (logIndex.market >= marketLogSequence.length) {
            addLog("success", "AH-002", "Market Intelligence complete — 8 prices updated");
            phase = 1;
          }
        }
        // Phase 1: Valuation Scout processing
        else if (phase === 1) {
          const end = Math.min(logIndex.valuation + LINES_PER_TICK, valuationLogSequence.length);
          const lines = valuationLogSequence.slice(logIndex.valuation, end);
          if (lines.length > 0) {
            appendValuationFeedLogs(lines);
            if (logIndex.valuation === 0) {
              addLog("info", "AH-001", "Valuation Scout initializing — NASA JPL data retrieval");
            }
          }
          logIndex.valuation = end;
          if (logIndex.valuation >= valuationLogSequence.length) {
            addLog("success", "AH-001", "Valuation complete — 500 asteroids valued in 12.4s");
            phase = 2;
          }
        }
        // Phase 2: Strategic Ranker
        else if (phase === 2) {
          const end = Math.min(logIndex.ranker + LINES_PER_TICK, rankerLogSequence.length);
          const lines = rankerLogSequence.slice(logIndex.ranker, end);
          if (lines.length > 0) {
            appendRankerFeedLogs(lines);
            if (logIndex.ranker === 0) {
              addLog("info", "AH-003", "Strategic Ranker active — computing composite scores");
            }
          }
          logIndex.ranker = end;
          if (logIndex.ranker >= rankerLogSequence.length) {
            addLog("success", "AH-003", "Strategic ranking complete — 15 targets, 3 routes");
            phase = 3;
          }
        }
        // Phase 3: Mission Architect
        else if (phase === 3) {
          const end = Math.min(logIndex.mission + LINES_PER_TICK, missionLogSequence.length);
          const lines = missionLogSequence.slice(logIndex.mission, end);
          if (lines.length > 0) {
            appendMissionFeedLogs(lines);
            if (logIndex.mission === 0) {
              addLog("info", "AH-004", "Mission Architect active — computing orbital mechanics");
            }
          }
          logIndex.mission = end;
          if (logIndex.mission >= missionLogSequence.length) {
            addLog("success", "AH-004", "Mission briefs pre-computed for top 3 targets");
            cascadeCompleted = true;
            
            if (continuousResearchRef.current) {
              // Reset for next cycle
              logIndex = { market: 0, valuation: 0, ranker: 0, mission: 0 };
              phase = 0;
              appendMarketFeedLogs(["", "🔄 [System] Continuous research — starting next cycle..."]);
            } else {
              appendRankerFeedLogs(["💡 [System] Run once complete. Toggle continuous research for ongoing updates."]);
            }
          }
        }
      }, 800); // Faster ticks for more dynamic feel
    };

    let pollingTimers: NodeJS.Timeout[] = [];

    const fetchLivePrices = async (key: string) => {
      try {
        console.log("[DATA] 📡 Fetching live prices from Gemini AI...");
        const res = await fetch(`${BACKEND_URL}/api/prices`, { headers: { 'x-gemini-api-key': key } });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        console.log("[MARKET] 📊 Received Market Prices:", data.prices);
        if (data.agent_logs) console.log("[AGENT] 🤖 Market Agent Logs:", data.agent_logs);
        if (data.prices) setMarketPrices(data.prices);
        if (data.agent_logs && data.agent_logs.length > 0) appendMarketFeedLogs(data.agent_logs);
      } catch (e) {
        console.error("[ERROR] ❌ Live price fetch failed", e);
      }
    };

    const fetchLiveRankings = async (key: string) => {
      try {
        console.log("[DATA] 📡 Fetching live strategic rankings from Gemini AI...");
        const res = await fetch(`${BACKEND_URL}/api/rankings`, { headers: { 'x-gemini-api-key': key } });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        console.log("[DATA] 🏆 Received Asteroid Rankings:", data.rankings);
        console.log("[DATA] 🚀 Received Mission Routes:", data.routes);
        if (data.agent_logs) console.log("[AGENT] 🤖 Ranking Agent Logs:", data.agent_logs);
        if (data.rankings) setRankings(data.rankings);
        if (data.routes) setRoutes(data.routes);
        if (data.agent_logs && data.agent_logs.length > 0) appendRankerFeedLogs(data.agent_logs);
      } catch (e) {
        console.error("[ERROR] ❌ Live rankings fetch failed", e);
      }
    };

    const fetchValuationHeartbeat = async () => {
      try {
        console.log("[DATA] Fetching Agent 1 valuation cache heartbeat...");
        const res = await fetch(`${BACKEND_URL}/api/asteroids`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        const asteroidCount = Array.isArray(data.asteroids) ? data.asteroids.length : 0;
        appendValuationFeedLogs([
          `[AGENT1] Valuation cache heartbeat | ${asteroidCount} asteroid valuations loaded from Neon`,
          "[AGENT1] Standing by for market-triggered repricing signals",
        ]);
      } catch (e) {
        console.error("[ERROR] Agent 1 valuation heartbeat failed", e);
        appendValuationFeedLogs([`[AGENT1] ERROR ${String(e)}`]);
      }
    };

    const startLivePolling = (key: string) => {
      setConnected(true);
      console.log("[Feed] Live Vercel polling architecture initialized.");
      appendMarketFeedLogs(["[SYSTEM] Live polling architecture engaged.", "[SYSTEM] Polling Gemini for market conditions..."]);
      appendRankerFeedLogs(["[SYSTEM] Live ranking evaluation engaged.", "[SYSTEM] Standing by for market signals..."]);
      appendValuationFeedLogs(["[SYSTEM] Agent 1 valuation heartbeat engaged.", "[SYSTEM] Reading persisted asteroid valuation cache..."]);
      appendMissionFeedLogs(["[SYSTEM] Agent 4 mission architect online.", "[SYSTEM] Awaiting asteroid selection for deep-dive generation..."]);
      
      // Initial fetch
      fetchLivePrices(key);
      fetchLiveRankings(key);
      fetchValuationHeartbeat();

      // Gemini loop: 7.5 RPM prices + 6 RPM rankings = 13.5 RPM.
      // Agent 1 heartbeat is DB-backed and keeps the full agent feed alive without consuming Gemini quota.
      pollingTimers.push(setInterval(() => fetchLivePrices(key), LIVE_PRICE_POLL_MS));
      pollingTimers.push(setInterval(() => fetchLiveRankings(key), LIVE_RANKING_POLL_MS));
      pollingTimers.push(setInterval(fetchValuationHeartbeat, LIVE_VALUATION_POLL_MS));
    };

    const doConnect = (key?: string | null) => {
      if (key) {
        startLivePolling(key);
      } else {
        startSimulation();
      }
    };

    const connect = () => {
      if (cancelled) return;
      const savedKey = typeof window !== "undefined" ? localStorage.getItem("orebit_gemini_api_key") : null;

      if (!savedKey) {
        console.log("[Feed] No API key provided — initializing demo mode");
        doConnect(null);
      } else {
        console.log("[Feed] API key detected — initializing live polling environment");
        loadBootstrap(savedKey).then(() => doConnect(savedKey)).catch(() => doConnect(savedKey));
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (simulationTimer) clearInterval(simulationTimer);
      pollingTimers.forEach(t => clearInterval(t));
    };
  }, [url, handleWsPayload, loadBootstrap, appendMarketFeedLogs, appendRankerFeedLogs, appendValuationFeedLogs, appendMissionFeedLogs, addLog]);

  const addManualLog = useCallback((message: string, type: LogEntry["type"] = "info", agentId = "USER") => {
    addLog(type, agentId, message);
  }, [addLog]);

  return {
    logs,
    marketFeedLogs,
    rankerFeedLogs,
    valuationFeedLogs,
    missionFeedLogs,
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
    continuousResearch,
    setContinuousResearch,
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
