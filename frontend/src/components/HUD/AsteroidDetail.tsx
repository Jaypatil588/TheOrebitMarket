"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AsteroidData } from "../Map3D/AsteroidBelt";
import { formatValue } from "@/lib/utils";
import { BACKEND_URL } from "@/lib/config";
import { toImageSrc } from "@/lib/asteroidSelection";
import type { MissionReportData } from "@/types/orebit";
import {
  X,
  CircleDot,
  DollarSign,
  TrendingUp,
  Atom,
  Globe,
  ShieldCheck,
  FlaskConical,
  Clock,
  Zap,
  AlertTriangle,
  Loader,
  Sparkles,
  ImageIcon,
} from "lucide-react";

// Shape returned when Agent 1 has enriched the asteroid
interface EnrichedPayload {
  id: string;
  name?: string;
  full_name?: string;
  spec_type?: string;
  diameter_km?: number;
  mass_kg?: number;
  composition?: Record<string, number>;
  valuation?: {
    net_value_usd?: number;
    raw_value_usd?: number;
    mission_cost_usd?: number;
    roi?: number;
    top_mineral?: string;
  };
  orbital?: {
    a?: number;
    e?: number;
    i?: number;
    moid_au?: number;
  };
  risk?: {
    composition_confidence?: number;
    data_completeness?: number;
  };
  research_summary?: string;
  prices_snapshot?: Record<string, number>;
  scenario_impact?: number;
  computed_at?: string;
  // raw engine fallback fields
  valueUSD?: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs text-slate-500 uppercase tracking-widest block mb-0.5">
      {children}
    </span>
  );
}

function Val({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={`font-mono text-sm font-bold ${accent ? "text-amber-400" : "text-slate-200"}`}>
      {children}
    </span>
  );
}

function Row({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500 font-mono shrink-0">{label}</span>
      <span className={`font-mono text-xs font-semibold text-right ${accent ? "text-amber-400" : "text-slate-200"}`}>
        {value}
      </span>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 pb-1 border-b border-slate-800/80">
        <span className="text-slate-500">{icon}</span>
        <span className="text-xs font-mono font-semibold tracking-widest text-slate-400 uppercase">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function ConfidenceBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  const textColor = pct >= 70 ? "text-emerald-400" : pct >= 40 ? "text-amber-400" : "text-red-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-slate-400">{label}</span>
        <span className={textColor}>{pct}%</span>
      </div>
      <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${color} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

const MINERAL_COLORS: [string, string][] = [
  ["platinum", "bg-amber-400"],
  ["platinumGroup", "bg-amber-400"],
  ["gold", "bg-yellow-500"],
  ["palladium", "bg-amber-300"],
  ["rhodium", "bg-amber-300"],
  ["iridium", "bg-amber-300"],
  ["nickel", "bg-orange-400"],
  ["cobalt", "bg-blue-400"],
  ["water", "bg-blue-500"],
  ["waterIce", "bg-blue-400"],
  ["water_ice", "bg-blue-400"],
  ["iron", "bg-orange-600"],
  ["carbon", "bg-slate-400"],
  ["silicates", "bg-slate-500"],
  ["clayMinerals", "bg-stone-400"],
  ["stonyMatrix", "bg-stone-500"],
  ["silicon", "bg-slate-600"],
  ["magnesium", "bg-slate-500"],
];

function mineralColor(key: string): string {
  const k = key.toLowerCase();
  for (const [pattern, color] of MINERAL_COLORS) {
    if (k.includes(pattern.toLowerCase())) return color;
  }
  return "bg-indigo-500";
}

function mineralLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function ImageTile({ label, src }: { label: string; src: string }) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      <div className="aspect-square rounded overflow-hidden border border-white/[0.06] bg-slate-900/50">
        <img src={src} alt={label} className="w-full h-full object-cover" />
      </div>
    </div>
  );
}

const SPEC_BADGE: Record<string, { label: string; color: string }> = {
  C: { label: "Carbonaceous", color: "text-slate-300 bg-slate-700/60 border-slate-600/40" },
  S: { label: "Silicaceous", color: "text-amber-300 bg-amber-900/30 border-amber-700/40" },
  M: { label: "Metallic", color: "text-orange-300 bg-orange-900/30 border-orange-700/40" },
  X: { label: "Unknown", color: "text-slate-400 bg-slate-800/40 border-slate-700/30" },
};

// ─── main component ───────────────────────────────────────────────────────────

interface RouteImagesState {
  heatmap_url?: string;
  surface_url?: string;
  loading: boolean;
  error: boolean;
}

interface AsteroidDetailProps {
  selectedAsteroid: AsteroidData | null;
  routeId?: string;
  missionReport?: MissionReportData | null;
  /** Instant client-side demo report — skips Agent 4 / route-image fetches. */
  precompiledReport?: boolean;
  onClose: () => void;
}

function missionReportForAsteroid(
  missionReport: MissionReportData | null | undefined,
  asteroidId: string
): Record<string, unknown> | null {
  if (!missionReport || missionReport.asteroid_id !== asteroidId) return null;
  const r = missionReport.report;
  if (!r || typeof r !== "object") return null;
  return r as Record<string, unknown>;
}

export function AsteroidDetail({
  selectedAsteroid,
  routeId,
  missionReport,
  precompiledReport = false,
  onClose,
}: AsteroidDetailProps) {
  const [api, setApi] = useState<EnrichedPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [routeImages, setRouteImages] = useState<RouteImagesState>({
    loading: false,
    error: false,
  });
  const [reportGenerating, setReportGenerating] = useState(false);

  useEffect(() => {
    if (!selectedAsteroid) {
      setApi(null);
      setRouteImages({ loading: false, error: false });
      setReportGenerating(false);
      return;
    }
    setLoading(true);
    setError(false);
    setApi(null);
    setReportGenerating(!!routeId && !precompiledReport);

    const detailUrl = routeId
      ? `${BACKEND_URL}/api/asteroid/${selectedAsteroid.id}?route_id=${encodeURIComponent(routeId)}`
      : `${BACKEND_URL}/api/asteroid/${selectedAsteroid.id}`;

    const geminiKey = typeof window !== "undefined" ? localStorage.getItem("orebit_gemini_api_key") : null;
    const headers: Record<string, string> = {};
    if (geminiKey) {
      headers["x-gemini-api-key"] = geminiKey;
    }

    console.log(`[DATA] 📡 Fetching Asteroid Profile from Gemini AI:`, detailUrl);

    fetch(detailUrl, { headers })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: EnrichedPayload) => {
        console.log(`[DATA] 🪨 Received Asteroid Data for ${selectedAsteroid.id}:`, data);
        if ((data as any).agent_logs) console.log(`[AGENT] 🤖 Architect Logs for ${selectedAsteroid.id}:`, (data as any).agent_logs);
        setApi(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      })
      .finally(() => {
        if (!routeId) setReportGenerating(false);
      });
  }, [selectedAsteroid?.id, routeId, precompiledReport]);

  useEffect(() => {
    if (precompiledReport) {
      setReportGenerating(false);
    }
  }, [precompiledReport, selectedAsteroid?.id]);

  useEffect(() => {
    if (!reportGenerating) return;
    const t = setTimeout(() => setReportGenerating(false), 90_000);
    return () => clearTimeout(t);
  }, [reportGenerating, selectedAsteroid?.id]);

  useEffect(() => {
    if (precompiledReport || !selectedAsteroid || !routeId) {
      if (precompiledReport) {
        setRouteImages({ loading: false, error: false });
      } else if (!selectedAsteroid || !routeId) {
        setRouteImages({ loading: false, error: false });
      }
      return;
    }

    setRouteImages({ loading: true, error: false });
    fetch(`${BACKEND_URL}/api/route-images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route_id: routeId,
        asteroid_ids: [selectedAsteroid.id],
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setRouteImages({
          heatmap_url: data.heatmap_url,
          surface_url: data.surface_url,
          loading: false,
          error: false,
        });
      })
      .catch(() => {
        setRouteImages({ loading: false, error: true });
      });
  }, [selectedAsteroid?.id, routeId, precompiledReport]);

  useEffect(() => {
    if (
      missionReport &&
      missionReport.asteroid_id === selectedAsteroid?.id &&
      missionReport.report
    ) {
      setReportGenerating(false);
    }
  }, [missionReport, selectedAsteroid?.id]);

  if (!selectedAsteroid) return null;

  const reportPayload = missionReportForAsteroid(missionReport, selectedAsteroid.id);
  const precompiledComposition =
    precompiledReport &&
    reportPayload?.composition &&
    typeof reportPayload.composition === "object" &&
    typeof (reportPayload.composition as Record<string, unknown>).mineral_fractions === "object"
      ? ((reportPayload.composition as Record<string, unknown>).mineral_fractions as Record<string, number>)
      : null;
  const precompiledSpecType =
    precompiledReport &&
    reportPayload?.composition &&
    typeof reportPayload.composition === "object" &&
    typeof (reportPayload.composition as Record<string, unknown>).spec_type === "string"
      ? String((reportPayload.composition as Record<string, unknown>).spec_type)
      : null;

  // ── resolve display values: API data wins, scene data is fallback ──
  const specType =
    api?.spec_type || precompiledSpecType || selectedAsteroid.spec_type || selectedAsteroid.specType || "C";
  const specInfo = SPEC_BADGE[specType] ?? SPEC_BADGE["X"];

  const displayName =
    api?.name || api?.full_name || selectedAsteroid.name || `AST-${selectedAsteroid.id}`;

  const diameterKm = api?.diameter_km ?? selectedAsteroid.diameter_km ?? null;
  const massKg = api?.mass_kg ?? selectedAsteroid.mass ?? null;

  // Composition — API fractions (0–1) or raw percentages (0–100); scene is always 0–100
  const rawComp = api?.composition ?? precompiledComposition ?? selectedAsteroid.composition ?? {};
  const compEntries = Object.entries(rawComp)
    .map(([k, v]) => [k, v <= 1 ? v * 100 : v] as [string, number])
    .sort((a, b) => b[1] - a[1]);

  // Valuation — enriched agent data or raw estimate
  const val = api?.valuation;
  const netValue = val?.net_value_usd ?? api?.valueUSD ?? selectedAsteroid.valueUSD;
  const reportMarket =
    reportPayload?.market && typeof reportPayload.market === "object"
      ? (reportPayload.market as Record<string, unknown>)
      : null;
  const topMineral =
    val?.top_mineral ??
    (typeof reportMarket?.primary_mineral === "string" ? reportMarket.primary_mineral : undefined);
  const isEnriched = !!val;

  // Top 6 market prices from snapshot
  const topPrices = api?.prices_snapshot
    ? Object.entries(api.prices_snapshot).sort((a, b) => b[1] - a[1]).slice(0, 6)
    : [];

  const computedAt = api?.computed_at
    ? new Date(api.computed_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  const missionImages = reportPayload
    ? {
        render: toImageSrc(String(reportPayload.asteroid_render ?? "")),
        composition: toImageSrc(String(reportPayload.composition_map ?? "")),
        route: toImageSrc(String(reportPayload.route_map ?? "")),
        profile: toImageSrc(String(reportPayload.physical_profile ?? "")),
      }
    : null;
  const hasMissionImages =
    missionImages &&
    (missionImages.render ||
      missionImages.composition ||
      missionImages.route ||
      missionImages.profile);
  const missionImagesLoading = reportGenerating && !hasMissionImages;

  const executiveSummary =
    typeof reportPayload?.executive_summary === "string" ? reportPayload.executive_summary : null;
  const routeRationale =
    typeof reportPayload?.route_rationale === "string" ? reportPayload.route_rationale : null;
  const feasibilityScore =
    typeof reportPayload?.feasibility_score === "number" ? reportPayload.feasibility_score : null;
  const goNoGo =
    reportPayload?.go_no_go && typeof reportPayload.go_no_go === "object"
      ? (reportPayload.go_no_go as Record<string, string>)
      : null;
  const missionBrief =
    reportPayload?.mission && typeof reportPayload.mission === "object"
      ? (reportPayload.mission as Record<string, unknown>)
      : null;
  const compositionNotes =
    reportPayload?.composition &&
    typeof reportPayload.composition === "object" &&
    typeof (reportPayload.composition as Record<string, unknown>).research_notes === "string"
      ? String((reportPayload.composition as Record<string, unknown>).research_notes)
      : null;
  const marketBrief =
    reportPayload?.market && typeof reportPayload.market === "object"
      ? (reportPayload.market as Record<string, unknown>)
      : null;
  const briefValuation =
    reportPayload?.valuation && typeof reportPayload.valuation === "object"
      ? (reportPayload.valuation as Record<string, number>)
      : null;
  const hasMissionBrief = Boolean(
    executiveSummary || routeRationale || goNoGo?.primary_reason_go || missionBrief
  );

  return (
    <AnimatePresence>
      <motion.div
        key={selectedAsteroid.id}
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -40 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="absolute left-6 bottom-6 w-[360px] z-10 select-none flex flex-col pointer-events-auto"
        style={{ maxHeight: "calc(100vh - 6rem)" }}
      >
        <div className="flex flex-col rounded-lg overflow-hidden border border-white/[0.06] bg-black/75 backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.7)]">

          {/* ── HEADER ── */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/50 border-b border-white/[0.05] shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <CircleDot size={13} className="text-amber-500 animate-pulse shrink-0" />
              <span className="font-mono text-sm font-semibold tracking-wider text-slate-200 truncate">
                {displayName}
              </span>
              <span className={`shrink-0 text-xs font-mono px-1.5 py-0.5 rounded border ${specInfo.color}`}>
                {specInfo.label}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          {/* ── BODY ── */}
          <div
            className="overflow-y-auto flex-1 p-4 space-y-4 font-mono text-sm"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#334155 transparent" }}
          >
            {/* status rows */}
            {loading && (
              <div className="flex items-center gap-2 text-slate-500 text-xs py-1">
                <Loader size={12} className="animate-spin text-amber-500/70" />
                Fetching agent data…
              </div>
            )}
            {error && !loading && (
              <div className="flex items-center gap-2 text-red-400/80 text-xs">
                <AlertTriangle size={12} />
                Agent data unavailable — showing base telemetry.
              </div>
            )}

            {/* ── VALUATION ── */}
            <Section icon={<DollarSign size={13} />} title="Valuation">
              <div className="bg-amber-500/5 border border-amber-500/10 rounded p-2.5 space-y-1.5">
                <Row label="Net Asset Value" value={formatValue(netValue)} accent />
                {val?.raw_value_usd != null && (
                  <Row label="Raw Mineral Value" value={formatValue(val.raw_value_usd)} />
                )}
                {val?.mission_cost_usd != null && (
                  <Row label="Est. Mission Cost" value={formatValue(val.mission_cost_usd)} />
                )}
                {val?.roi != null && (
                  <Row label="ROI" value={`${(val.roi / 1e6).toFixed(1)}M×`} accent />
                )}
                {!val?.roi && briefValuation?.roi_pct != null && (
                  <Row label="ROI" value={`${briefValuation.roi_pct.toFixed(0)}%`} accent />
                )}
                {briefValuation?.mission_cost_usd != null && val?.mission_cost_usd == null && (
                  <Row label="Est. Mission Cost" value={formatValue(briefValuation.mission_cost_usd)} />
                )}
                {topMineral && (
                  <Row label="Primary Target" value={mineralLabel(topMineral)} accent />
                )}
              </div>
              {api?.scenario_impact != null && api.scenario_impact !== 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/10 rounded px-2.5 py-1.5">
                  <Zap size={11} />
                  Scenario impact: {api.scenario_impact > 0 ? "+" : ""}{api.scenario_impact.toFixed(1)}%
                </div>
              )}
              {!isEnriched && !loading && (
                <p className="text-xs text-slate-600">
                  Enriched valuation pending Agent 1 analysis.
                </p>
              )}
            </Section>

            {/* ── PHYSICAL PROPERTIES ── */}
            <Section icon={<Atom size={13} />} title="Physical Properties">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {diameterKm != null && (
                  <div>
                    <Label>Diameter</Label>
                    <Val>{diameterKm.toFixed(1)} km</Val>
                  </div>
                )}
                {massKg != null && (
                  <div>
                    <Label>Mass</Label>
                    <Val>{massKg.toExponential(2)} kg</Val>
                  </div>
                )}
                <div>
                  <Label>Spec Type</Label>
                  <Val>{specType}</Val>
                </div>
                <div>
                  <Label>ID</Label>
                  <Val>{selectedAsteroid.id}</Val>
                </div>
              </div>
            </Section>

            {/* ── ORBITAL MECHANICS ── */}
            {api?.orbital && (
              <Section icon={<Globe size={13} />} title="Orbital Mechanics">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {api.orbital.a != null && (
                    <div>
                      <Label>Semi-major axis</Label>
                      <Val>{api.orbital.a.toFixed(3)} AU</Val>
                    </div>
                  )}
                  {api.orbital.e != null && (
                    <div>
                      <Label>Eccentricity</Label>
                      <Val>{api.orbital.e.toFixed(4)}</Val>
                    </div>
                  )}
                  {api.orbital.i != null && (
                    <div>
                      <Label>Inclination</Label>
                      <Val>{api.orbital.i.toFixed(2)}°</Val>
                    </div>
                  )}
                  {api.orbital.moid_au != null && (
                    <div>
                      <Label>MOID</Label>
                      <Val accent={api.orbital.moid_au > 0 && api.orbital.moid_au < 0.05}>
                        {api.orbital.moid_au > 0 ? `${api.orbital.moid_au.toFixed(4)} AU` : "—"}
                      </Val>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* ── COMPOSITION ── */}
            {compEntries.length > 0 && (
              <Section icon={<FlaskConical size={13} />} title="Mineral Composition">
                <div className="space-y-2">
                  {compEntries.map(([key, pct]) => {
                    const isPrimary = key === topMineral;
                    return (
                      <div key={key} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className={isPrimary ? "text-amber-300 font-semibold" : "text-slate-400"}>
                            {mineralLabel(key)}{isPrimary && " ★"}
                          </span>
                          <span className={isPrimary ? "text-amber-400 font-bold" : "text-slate-300"}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full ${mineralColor(key)} rounded-full`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(pct, 100)}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* ── AGENT CONFIDENCE ── */}
            {api?.risk && (
              <Section icon={<ShieldCheck size={13} />} title="Agent Confidence">
                <div className="space-y-2">
                  {api.risk.composition_confidence != null && (
                    <ConfidenceBar label="Composition Confidence" value={api.risk.composition_confidence} />
                  )}
                  {api.risk.data_completeness != null && (
                    <ConfidenceBar label="Data Completeness" value={api.risk.data_completeness} />
                  )}
                </div>
              </Section>
            )}

            {/* ── RESEARCH SUMMARY ── */}
            {api?.research_summary && (
              <Section icon={<TrendingUp size={13} />} title="Agent Research">
                <p className="text-xs text-slate-400 leading-relaxed">
                  {api.research_summary}
                </p>
              </Section>
            )}

            {/* ── MISSION BRIEF (Agent 4 / precompiled demo) ── */}
            {hasMissionBrief && (
              <Section icon={<Sparkles size={13} />} title="Mission Brief">
                {precompiledReport && (
                  <p className="text-xs text-emerald-500/80 font-mono">Analysis complete — intelligence report ready</p>
                )}
                {feasibilityScore != null && (
                  <Row label="Feasibility" value={`${feasibilityScore}/10`} accent />
                )}
                {goNoGo?.recommendation && (
                  <motion.div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Recommendation</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded ${
                        goNoGo.recommendation === "GO"
                          ? "text-emerald-400 bg-emerald-500/10"
                          : "text-amber-400 bg-amber-500/10"
                      }`}
                    >
                      {goNoGo.recommendation}
                    </span>
                  </motion.div>
                )}
                {executiveSummary && (
                  <p className="text-xs text-slate-400 leading-relaxed">{executiveSummary}</p>
                )}
                {routeRationale && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Route Rationale</span>
                    <p className="text-xs text-slate-400 leading-relaxed">{routeRationale}</p>
                  </div>
                )}
                {compositionNotes && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Composition Analysis</span>
                    <p className="text-xs text-slate-400 leading-relaxed">{compositionNotes}</p>
                  </div>
                )}
                {missionBrief && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-1">
                    {typeof missionBrief.launch_vehicle === "string" && (
                      <div>
                        <Label>Launch Vehicle</Label>
                        <Val>{missionBrief.launch_vehicle}</Val>
                      </div>
                    )}
                    {typeof missionBrief.mining_method === "string" && (
                      <div>
                        <Label>Mining Method</Label>
                        <Val>{missionBrief.mining_method}</Val>
                      </div>
                    )}
                    {typeof missionBrief.next_launch_window === "string" && (
                      <div>
                        <Label>Launch Window</Label>
                        <Val accent>{missionBrief.next_launch_window}</Val>
                      </div>
                    )}
                    {typeof missionBrief.delta_v_km_s === "number" && (
                      <div>
                        <Label>Mission Δv</Label>
                        <Val>{missionBrief.delta_v_km_s.toFixed(2)} km/s</Val>
                      </div>
                    )}
                  </div>
                )}
                {goNoGo?.primary_reason_go && (
                  <p className="text-xs text-emerald-400/90 leading-relaxed">{goNoGo.primary_reason_go}</p>
                )}
                {marketBrief && typeof marketBrief.demand_outlook === "string" && (
                  <p className="text-xs text-slate-500 leading-relaxed">{marketBrief.demand_outlook}</p>
                )}
              </Section>
            )}

            {/* ── MISSION REPORT IMAGES (Agent 4 + route scaffold) ── */}
            {(routeId || precompiledReport || hasMissionImages || routeImages.heatmap_url || routeImages.surface_url) && (
              <Section icon={<Sparkles size={13} />} title="Mission Visuals">
                {(missionImagesLoading || routeImages.loading) && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
                    <Loader size={12} className="animate-spin text-amber-500/70" />
                    {missionImagesLoading
                      ? "Agent 4 generating mission brief & renders…"
                      : "Loading route visualizations…"}
                  </div>
                )}

                {missionReport?.cached && hasMissionImages && !precompiledReport && (
                  <p className="text-xs text-emerald-500/80 font-mono">Cached mission report</p>
                )}
                {precompiledReport && hasMissionImages && (
                  <p className="text-xs text-emerald-500/80 font-mono">Mission visuals ready</p>
                )}

                {hasMissionImages && (
                  <div className="grid grid-cols-2 gap-2">
                    {missionImages.render && (
                      <ImageTile label="Asteroid Render" src={missionImages.render} />
                    )}
                    {missionImages.composition && (
                      <ImageTile label="Composition Map" src={missionImages.composition} />
                    )}
                    {missionImages.route && (
                      <ImageTile label="Route Map" src={missionImages.route} />
                    )}
                    {missionImages.profile && (
                      <ImageTile label="Physical Profile" src={missionImages.profile} />
                    )}
                  </div>
                )}

                {!routeImages.loading && (routeImages.heatmap_url || routeImages.surface_url) && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {routeImages.heatmap_url && (
                      <ImageTile label="Route Heatmap" src={routeImages.heatmap_url} />
                    )}
                    {routeImages.surface_url && (
                      <ImageTile label="Surface Scan" src={routeImages.surface_url} />
                    )}
                  </div>
                )}

                {routeImages.error && !hasMissionImages && !routeImages.loading && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <AlertTriangle size={12} className="text-amber-500/80" />
                    Route visuals unavailable
                  </div>
                )}

                {!missionImagesLoading && !routeImages.loading && !hasMissionImages && !routeImages.heatmap_url && !routeImages.surface_url && !routeImages.error && routeId && (
                  <div className="flex items-center gap-2 text-slate-600 text-xs">
                    <ImageIcon size={12} />
                    Images will appear when Agent 4 completes
                  </div>
                )}
              </Section>
            )}

            {/* ── MARKET SNAPSHOT ── */}
            {topPrices.length > 0 && (
              <Section icon={<TrendingUp size={13} />} title="Market Snapshot ($/t)">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {topPrices.map(([mineral, price]) => (
                    <Row key={mineral} label={mineralLabel(mineral)} value={`$${price.toLocaleString()}`} />
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* ── FOOTER ── */}
          <div className="px-4 py-2 bg-black/40 border-t border-white/[0.04] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
              <CircleDot size={10} className="text-emerald-600 animate-pulse" />
              {isEnriched ? "Agent-enriched telemetry" : "Base telemetry"}
            </div>
            {computedAt && (
              <div className="flex items-center gap-1 text-xs text-slate-600 font-mono">
                <Clock size={10} />
                {computedAt}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
