"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { formatValue } from "@/lib/utils";
import { RankedAsteroid, MissionRoute } from "@/hooks/useWebSockets";

interface StrategicRankingsProps {
  rankings?: RankedAsteroid[];
  routes?: MissionRoute[];
}

// Mock fallback shown before live data arrives
const MOCK_RANKINGS: RankedAsteroid[] = [
  { rank: 1, asteroid_id: "m1", name: "Amun", spec_type: "M", composite_score: 0.91, net_value_usd: 8.69e11, roi: 413.8, top_mineral: "cobalt", mineral_urgency: 0.92, delta_v_km_s: 5.37, launch_window_year: 2028, confidence: 0.7, scenario_boosted: false, reasoning: "Top-ranked M-type with high cobalt urgency.", trend: "up" },
  { rank: 2, asteroid_id: "m2", name: "1986 DA", spec_type: "M", composite_score: 0.84, net_value_usd: 4.3e11, roi: 206.1, top_mineral: "platinum", mineral_urgency: 0.78, delta_v_km_s: 4.82, launch_window_year: 2028, confidence: 0.7, scenario_boosted: false, reasoning: "Strong PGM content, accessible orbit.", trend: "flat" },
  { rank: 3, asteroid_id: "m3", name: "Psyche-16", spec_type: "M", composite_score: 0.72, net_value_usd: 340.5e9, roi: 12.4, top_mineral: "nickel", mineral_urgency: 0.65, delta_v_km_s: 8.14, launch_window_year: 2029, confidence: 0.8, scenario_boosted: false, reasoning: "Massive nickel reserve, higher delta-v penalty.", trend: "up" },
  { rank: 4, asteroid_id: "c1", name: "Bennu-X", spec_type: "C", composite_score: 0.68, net_value_usd: 4.8e9, roi: 82.1, top_mineral: "water_ice", mineral_urgency: 0.71, delta_v_km_s: 5.01, launch_window_year: 2028, confidence: 0.9, scenario_boosted: false, reasoning: "High water-ice fraction for fuel depot.", trend: "up" },
  { rank: 5, asteroid_id: "s1", name: "Apophis-Beta", spec_type: "S", composite_score: 0.61, net_value_usd: 9.2e9, roi: 144.3, top_mineral: "silicon", mineral_urgency: 0.54, delta_v_km_s: 6.23, launch_window_year: 2029, confidence: 0.7, scenario_boosted: false, reasoning: "Silicon-rich, strong semiconductor demand.", trend: "down" },
  { rank: 6, asteroid_id: "c2", name: "Ryugu-Alpha", spec_type: "C", composite_score: 0.55, net_value_usd: 6.4e9, roi: 97.6, top_mineral: "carbon", mineral_urgency: 0.48, delta_v_km_s: 5.88, launch_window_year: 2029, confidence: 0.8, scenario_boosted: false, reasoning: "C-type, decent accessibility.", trend: "flat" },
  { rank: 7, asteroid_id: "s2", name: "Eros-Prime", spec_type: "S", composite_score: 0.49, net_value_usd: 14.6e9, roi: 62.8, top_mineral: "iron", mineral_urgency: 0.42, delta_v_km_s: 6.71, launch_window_year: 2030, confidence: 0.7, scenario_boosted: false, reasoning: "Iron-rich, oversupplied market.", trend: "down" },
  { rank: 8, asteroid_id: "c3", name: "Ceres-Minor", spec_type: "C", composite_score: 0.38, net_value_usd: 185.2e9, roi: 31.2, top_mineral: "water_ice", mineral_urgency: 0.38, delta_v_km_s: 9.44, launch_window_year: 2031, confidence: 0.6, scenario_boosted: false, reasoning: "High delta-v limits near-term viability.", trend: "flat" },
];

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

export function StrategicRankings({ rankings, routes }: StrategicRankingsProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const liveRankings = rankings && rankings.length > 0 ? rankings : MOCK_RANKINGS;
  const isLive = rankings && rankings.length > 0;
  const defaultRoute = routes?.find((r) => r.is_default);

  return (
    <section
      ref={sectionRef}
      className="snap-section relative z-10 flex flex-col items-center justify-center px-8"
      style={{ background: "rgba(0, 0, 0, 0.88)" }}
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
              className="text-[32px] font-light tracking-[0.15em] text-white"
              style={{ fontFamily: "var(--font-inter), var(--font-display)" }}
            >
              THE TARGETS
            </h2>
            {isLive && (
              <span className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider px-2 py-1 rounded"
                style={{ background: "rgba(52,211,153,0.1)", color: "var(--positive)" }}>
                <div className="w-1.5 h-1.5 rounded-full pulse-active" style={{ background: "var(--positive)" }} />
                LIVE
              </span>
            )}
          </div>
          <p className="text-[13px]" style={{ color: "var(--dust)" }}>
            Strategic asteroid rankings — live-ranked by AI agents based on value, accessibility, and market conditions
          </p>
        </motion.div>

        {/* Active route badge */}
        {defaultRoute && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded"
            style={{ background: `${defaultRoute.color_hex}10`, border: `1px solid ${defaultRoute.color_hex}30` }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: defaultRoute.color_hex }} />
            <span className="text-[11px] font-mono" style={{ color: defaultRoute.color_hex }}>
              Active Route: {defaultRoute.label}
            </span>
            <span className="text-[9px] ml-auto" style={{ color: "var(--dust-dim)" }}>
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
              {liveRankings.map((ast, i) => (
                <motion.tr
                  key={ast.asteroid_id || ast.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.06 }}
                  className="group"
                  style={ast.scenario_boosted ? { background: "rgba(251,191,36,0.03)" } : {}}
                >
                  <td>
                    <span className="text-[11px] font-medium" style={{ color: "var(--dust-dim)" }}>
                      {String(ast.rank).padStart(2, "0")}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-medium text-[14px]" style={{ fontFamily: "var(--font-display)" }}>
                        {ast.name}
                      </span>
                      {ast.scenario_boosted && (
                        <span className="text-[8px] px-1 py-0.5 rounded font-mono"
                          style={{ background: "rgba(251,191,36,0.15)", color: "var(--warning)" }}>
                          ⚡
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-medium"
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
                      <span className="text-[9px] capitalize" style={{ color: "var(--dust-dim)" }}>
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
        {routes && routes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="mt-4 flex gap-2 flex-wrap"
          >
            {routes.map((rt) => (
              <div
                key={rt.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-mono"
                style={{
                  border: `1px solid ${rt.color_hex}30`,
                  background: `${rt.color_hex}08`,
                  color: rt.is_default ? rt.color_hex : "var(--dust-dim)",
                }}
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
          className="mt-6 text-[11px] tracking-wide"
          style={{ color: "var(--dust-dim)" }}
        >
          {isLive
            ? `Rankings updated by Strategic Ranker agent · ${liveRankings.length} targets · ${routes?.length ?? 0} routes computed`
            : "Mock data — start Go backend to receive live rankings"}
        </motion.p>
      </div>
    </section>
  );
}
