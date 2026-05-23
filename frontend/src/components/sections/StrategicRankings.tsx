"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp } from "lucide-react";
import { formatValue } from "@/lib/utils";

interface RankedAsteroid {
  rank: number;
  name: string;
  specType: string;
  value: number;
  roi: number;
  deltaV: number;
  urgency: number; // 0–100
  urgencyLabel: string;
  trend: "up" | "down" | "flat";
}

const MOCK_RANKINGS: RankedAsteroid[] = [
  {
    rank: 1, name: "Amun", specType: "M",
    value: 8.69e11, roi: 413.8, deltaV: 5.37, urgency: 92,
    urgencyLabel: "Cobalt demand surge", trend: "up",
  },
  {
    rank: 2, name: "1986 DA", specType: "M",
    value: 4.3e11, roi: 206.1, deltaV: 4.82, urgency: 78,
    urgencyLabel: "Platinum steady", trend: "flat",
  },
  {
    rank: 3, name: "Psyche-16", specType: "M",
    value: 340.5e9, roi: 12.4, deltaV: 8.14, urgency: 65,
    urgencyLabel: "Nickel disruption", trend: "up",
  },
  {
    rank: 4, name: "Bennu-X", specType: "C",
    value: 4.8e9, roi: 82.1, deltaV: 5.01, urgency: 71,
    urgencyLabel: "Water-ice demand", trend: "up",
  },
  {
    rank: 5, name: "Apophis-Beta", specType: "S",
    value: 9.2e9, roi: 144.3, deltaV: 6.23, urgency: 54,
    urgencyLabel: "Silicon stable", trend: "down",
  },
  {
    rank: 6, name: "Ryugu-Alpha", specType: "C",
    value: 6.4e9, roi: 97.6, deltaV: 5.88, urgency: 48,
    urgencyLabel: "Carbon demand low", trend: "flat",
  },
  {
    rank: 7, name: "Eros-Prime", specType: "S",
    value: 14.6e9, roi: 62.8, deltaV: 6.71, urgency: 42,
    urgencyLabel: "Iron oversupply", trend: "down",
  },
  {
    rank: 8, name: "Ceres-Minor", specType: "C",
    value: 185.2e9, roi: 31.2, deltaV: 9.44, urgency: 38,
    urgencyLabel: "High delta-v", trend: "flat",
  },
];

const TrendIcon = ({ trend }: { trend: "up" | "down" | "flat" }) => {
  if (trend === "up") return <ArrowUpRight size={12} className="trend-up" />;
  if (trend === "down") return <ArrowDownRight size={12} className="trend-down" />;
  return <Minus size={12} className="trend-flat" />;
};

export function StrategicRankings() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section
      ref={sectionRef}
      className="snap-section relative z-10 flex flex-col items-center justify-center px-8"
      style={{ background: "rgba(0, 0, 0, 0.88)" }}
    >
      <div className="w-full max-w-[1100px]">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="mb-10"
        >
          <h2
            className="text-[32px] font-light tracking-[0.15em] text-white mb-2"
            style={{ fontFamily: "var(--font-inter), var(--font-display)" }}
          >
            THE TARGETS
          </h2>
          <p className="text-[13px]" style={{ color: "var(--dust)" }}>
            Strategic asteroid rankings — live-ranked by AI agents based on value, accessibility, and market conditions
          </p>
        </motion.div>

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
              {MOCK_RANKINGS.map((ast, i) => (
                <motion.tr
                  key={ast.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.08 }}
                  className="group"
                >
                  <td>
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: "var(--dust-dim)" }}
                    >
                      {String(ast.rank).padStart(2, "0")}
                    </span>
                  </td>
                  <td>
                    <span className="text-white font-medium text-[14px]" style={{ fontFamily: "var(--font-display)" }}>
                      {ast.name}
                    </span>
                  </td>
                  <td>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-medium"
                      style={{
                        background: ast.specType === "M" ? "var(--earth-glow)" : "var(--orbit)",
                        color: ast.specType === "M" ? "var(--earth-blue)" : "var(--dust)",
                      }}
                    >
                      {ast.specType}-type
                    </span>
                  </td>
                  <td>
                    <span className="text-white font-medium">{formatValue(ast.value)}</span>
                  </td>
                  <td>
                    <span
                      className="font-medium"
                      style={{ color: ast.roi > 100 ? "var(--positive)" : "var(--dust)" }}
                    >
                      {ast.roi.toFixed(0)}%
                    </span>
                  </td>
                  <td>
                    <span style={{ color: ast.deltaV < 6 ? "var(--dust)" : "var(--warning)" }}>
                      {ast.deltaV.toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1.5">
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${ast.urgency}%`,
                            background: ast.urgency > 70
                              ? "var(--earth-blue)"
                              : ast.urgency > 50
                              ? "var(--dust)"
                              : "var(--dust-dim)",
                          }}
                        />
                      </div>
                      <span className="text-[9px]" style={{ color: "var(--dust-dim)" }}>
                        {ast.urgencyLabel}
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

        {/* Footer hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 1 }}
          className="mt-6 text-[11px] tracking-wide"
          style={{ color: "var(--dust-dim)" }}
        >
          Rankings updated by Strategic Ranker agent · Last computed 12s ago
        </motion.p>
      </div>
    </section>
  );
}
