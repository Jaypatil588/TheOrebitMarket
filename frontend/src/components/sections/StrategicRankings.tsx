"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { formatValue } from "@/lib/utils";
import { RankedAsteroid, MissionRoute } from "@/hooks/useWebSockets";
import { hasLiveRoutes } from "@/lib/liveData";
import { applyDemoRankings } from "@/lib/demoScenario";

interface StrategicRankingsProps {
  rankings?: RankedAsteroid[];
  /** Live routes from API/WS (empty until Agent 3 completes). */
  routes?: MissionRoute[];
  /** Routes for UI preview (includes mock when live routes are empty). */
  displayRoutes?: MissionRoute[];
  hasLiveRankings?: boolean;
  hasLiveRoutes?: boolean;
  demoActive?: boolean;
  onRouteClick?: (route: MissionRoute) => void;
}

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === "up") return <ArrowUpRight size={12} className="trend-up" />;
  if (trend === "down") return <ArrowDownRight size={12} className="trend-down" />;
  return <Minus size={12} className="trend-flat" />;
};

function urgencyLabel(mineral: string, urgency: number, boosted: boolean): string {
  if (boosted) return "Scenario boost";
  if (urgency > 0.8) return `${mineral} — critical`;
  if (urgency > 0.6) return `${mineral} — elevated`;
  if (urgency > 0.4) return `${mineral} — stable`;
  return `${mineral} — low`;
}

// Mock rankings — remove when WebSocket/REST rankings are live
const MOCK_RANKINGS: RankedAsteroid[] = [
  { rank: 1, asteroid_id: "16", name: "16 Psyche", spec_type: "M", composite_score: 0.94, net_value_usd: 1.02e13, roi: 2840, top_mineral: "iron", mineral_urgency: 0.82, delta_v_km_s: 5.82, launch_window_year: 2028, confidence: 0.91, scenario_boosted: false, reasoning: "", trend: "up" },
  { rank: 2, asteroid_id: "25143", name: "25143 Itokawa", spec_type: "S", composite_score: 0.87, net_value_usd: 4.2e11, roi: 620, top_mineral: "platinum", mineral_urgency: 0.51, delta_v_km_s: 4.65, launch_window_year: 2029, confidence: 0.88, scenario_boosted: false, reasoning: "", trend: "up" },
  { rank: 3, asteroid_id: "433", name: "433 Eros", spec_type: "S", composite_score: 0.83, net_value_usd: 2.8e11, roi: 410, top_mineral: "cobalt", mineral_urgency: 0.82, delta_v_km_s: 5.21, launch_window_year: 2028, confidence: 0.85, scenario_boosted: true, reasoning: "", trend: "up" },
  { rank: 4, asteroid_id: "162173", name: "162173 Ryugu", spec_type: "C", composite_score: 0.79, net_value_usd: 1.9e11, roi: 380, top_mineral: "water_ice", mineral_urgency: 0.43, delta_v_km_s: 4.98, launch_window_year: 2030, confidence: 0.86, scenario_boosted: false, reasoning: "", trend: "flat" },
  { rank: 5, asteroid_id: "101955", name: "101955 Bennu", spec_type: "B", composite_score: 0.76, net_value_usd: 1.4e11, roi: 290, top_mineral: "neodymium", mineral_urgency: 0.74, delta_v_km_s: 5.45, launch_window_year: 2029, confidence: 0.82, scenario_boosted: false, reasoning: "", trend: "up" },
  { rank: 6, asteroid_id: "4", name: "4 Vesta", spec_type: "V", composite_score: 0.72, net_value_usd: 9.8e10, roi: 210, top_mineral: "nickel", mineral_urgency: 0.45, delta_v_km_s: 6.12, launch_window_year: 2031, confidence: 0.79, scenario_boosted: false, reasoning: "", trend: "flat" },
  { rank: 7, asteroid_id: "1", name: "1 Ceres", spec_type: "C", composite_score: 0.68, net_value_usd: 7.2e10, roi: 165, top_mineral: "water_ice", mineral_urgency: 0.43, delta_v_km_s: 6.85, launch_window_year: 2032, confidence: 0.77, scenario_boosted: false, reasoning: "", trend: "down" },
  { rank: 8, asteroid_id: "99942", name: "99942 Apophis", spec_type: "S", composite_score: 0.65, net_value_usd: 5.1e10, roi: 142, top_mineral: "cobalt", mineral_urgency: 0.82, delta_v_km_s: 5.88, launch_window_year: 2029, confidence: 0.74, scenario_boosted: false, reasoning: "", trend: "up" },
];

export function StrategicRankings({
  rankings,
  routes,
  displayRoutes: displayRoutesProp,
  hasLiveRankings: hasLiveRankingsProp = false,
  hasLiveRoutes: hasLiveRoutesProp = false,
  demoActive = false,
  onRouteClick,
}: StrategicRankingsProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const hasLiveRankings = hasLiveRankingsProp;
  const liveRoutes = demoActive || hasLiveRoutesProp || hasLiveRoutes(routes);
  const baseRankings = hasLiveRankings ? rankings! : MOCK_RANKINGS;
  const displayRankings = demoActive ? applyDemoRankings(baseRankings) : baseRankings;
  const displayRoutes = displayRoutesProp ?? routes ?? [];
  const defaultRoute = displayRoutes.find((r) => r.is_default) ?? displayRoutes[0];

  return (
    <section
      ref={sectionRef}
      className="snap-section relative z-10 flex flex-col items-center justify-center px-8"
      style={{ background: "transparent" }}
    >
      <div className="w-full max-w-[1100px]">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <h2
              className="text-4xl font-light tracking-[0.15em] text-white"
              style={{ fontFamily: "var(--font-inter), var(--font-display)" }}
            >
              THE TARGETS
            </h2>
            {hasLiveRankings ? (
              <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-2 py-1 rounded"
                style={{ background: "rgba(52,211,153,0.1)", color: "var(--positive)" }}>
                <div className="w-1.5 h-1.5 rounded-full pulse-active" style={{ background: "var(--positive)" }} />
                LIVE
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-2 py-1 rounded"
                style={{ background: "rgba(251,191,36,0.1)", color: "var(--warning)" }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--warning)" }} />
                AWAITING DATA
              </span>
            )}
            {!liveRoutes && (
              <span className="text-xs font-mono uppercase tracking-wider px-2 py-1 rounded"
                style={{ background: "rgba(148,163,184,0.12)", color: "var(--dust-dim)" }}>
                ROUTE PREVIEW
              </span>
            )}
          </div>
          <p className="text-base" style={{ color: "var(--dust)" }}>
            Strategic asteroid rankings — live-ranked by AI agents based on value, accessibility, and market conditions
          </p>
        </motion.div>

        {/* Active route badge */}
        {defaultRoute && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded cursor-pointer transition-all hover:scale-[1.01]"
            style={{ background: `${defaultRoute.color_hex}10`, border: `1px solid ${defaultRoute.color_hex}30` }}
            onClick={() => onRouteClick?.(defaultRoute)}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: defaultRoute.color_hex }} />
            <span className="text-sm font-mono" style={{ color: defaultRoute.color_hex }}>
              {liveRoutes ? "Active Route" : "Preview Route"}: {defaultRoute.label}
            </span>
            <span className="text-xs ml-auto" style={{ color: "var(--dust-dim)" }}>
              {defaultRoute.stops.length - 2} stops · Δv {defaultRoute.totals.total_delta_v_km_s?.toFixed(1)} km/s · {defaultRoute.urgency_reason}
            </span>
          </motion.div>
        )}

        {/* Rankings Table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="glass-card overflow-hidden"
        >
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "50px" }}>#</th>
                <th>Name</th>
                <th>Type</th>
                <th>Net Value</th>
                <th>ROI</th>
                <th>Δv (km/s)</th>
                <th style={{ width: "180px" }}>Market Urgency</th>
                <th style={{ width: "40px" }}></th>
              </tr>
            </thead>
            <tbody>
              {displayRankings.map((ast, i) => (
                <motion.tr
                  key={ast.asteroid_id || ast.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.06 }}
                  className="group"
                  style={ast.scenario_boosted ? { background: "rgba(251,191,36,0.03)" } : {}}
                >
                  <td>
                    <span className="text-sm font-medium" style={{ color: "var(--dust-dim)" }}>
                      {String(ast.rank).padStart(2, "0")}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-medium text-lg" style={{ fontFamily: "var(--font-display)" }}>
                        {ast.name}
                      </span>
                      {ast.scenario_boosted && (
                        <span className="text-xs px-1 py-0.5 rounded font-mono"
                          style={{ background: "rgba(251,191,36,0.15)", color: "var(--warning)" }}>
                          ⚡
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        background: ast.spec_type === "M" ? "var(--earth-glow)" : "var(--orbit)",
                        color: ast.spec_type === "M" ? "var(--earth-blue)" : "var(--dust)",
                      }}
                    >
                      {ast.spec_type}-type
                    </span>
                  </td>
                  <td>
                    <span className="text-white font-medium">{formatValue(ast.net_value_usd)}</span>
                  </td>
                  <td>
                    <span className="font-medium" style={{ color: ast.roi > 100 ? "var(--positive)" : "var(--dust)" }}>
                      {ast.roi.toFixed(0)}%
                    </span>
                  </td>
                  <td>
                    <span style={{ color: ast.delta_v_km_s < 6 ? "var(--dust)" : "var(--warning)" }}>
                      {ast.delta_v_km_s.toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1.5">
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${ast.mineral_urgency * 100}%`,
                            background: ast.scenario_boosted ? "var(--warning)"
                              : ast.mineral_urgency > 0.7 ? "var(--earth-blue)"
                              : ast.mineral_urgency > 0.5 ? "var(--dust)"
                              : "var(--dust-dim)",
                          }}
                        />
                      </div>
                      <span className="text-xs capitalize" style={{ color: "var(--dust-dim)" }}>
                        {urgencyLabel(ast.top_mineral, ast.mineral_urgency, ast.scenario_boosted)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <TrendIcon trend={ast.trend} />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Route summary strip */}
        {displayRoutes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="mt-4 flex gap-2 flex-wrap"
          >
            {displayRoutes.map((rt) => (
              <div
                key={rt.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono cursor-pointer transition-all hover:scale-105"
                style={{
                  border: `1px solid ${rt.color_hex}30`,
                  background: `${rt.color_hex}08`,
                  color: rt.is_default ? rt.color_hex : "var(--dust-dim)",
                }}
                onClick={() => onRouteClick?.(rt)}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: rt.color_hex }} />
                {rt.label}
                {rt.scenario_driven && <span style={{ color: "var(--warning)" }}>⚡</span>}
              </div>
            ))}
          </motion.div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 1.0 }}
          className="mt-6 text-sm tracking-wide"
          style={{ color: "var(--dust-dim)" }}
        >
          {hasLiveRankings && liveRoutes
            ? `Live rankings and routes from Strategic Ranker · ${displayRankings.length} targets · ${displayRoutes.length} routes`
            : hasLiveRankings
              ? `Live rankings · ${displayRankings.length} targets — mission routes still computing (Agent 3)`
              : liveRoutes
                ? `${displayRoutes.length} routes ready — rankings pending Agent 3`
                : `Demo table until Agent 3 finishes · map shows route preview until live routes arrive`}
        </motion.p>
      </div>
    </section>
  );
}
