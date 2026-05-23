"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";

interface Commodity {
  name: string;
  symbol: string;
  price: string;
  unit: string;
  change: number;
  scarcity: number;
  demand: number;
}

interface Alert {
  severity: "high" | "medium" | "low";
  mineral: string;
  message: string;
  source: string;
}

const COMMODITIES: Commodity[] = [
  { name: "Platinum", symbol: "Pt", price: "31,240", unit: "$/oz", change: 2.1, scarcity: 51, demand: 62 },
  { name: "Cobalt", symbol: "Co", price: "33,800", unit: "$/t", change: -0.4, scarcity: 82, demand: 71 },
  { name: "Nickel", symbol: "Ni", price: "16,420", unit: "$/t", change: 0.8, scarcity: 45, demand: 58 },
  { name: "Neodymium", symbol: "Nd", price: "210", unit: "$/kg", change: 1.8, scarcity: 74, demand: 85 },
  { name: "Lithium", symbol: "Li", price: "12.80", unit: "$/kg", change: -1.2, scarcity: 43, demand: 91 },
  { name: "Iron", symbol: "Fe", price: "124", unit: "$/t", change: 0.1, scarcity: 12, demand: 34 },
];

const ALERTS: Alert[] = [
  {
    severity: "high",
    mineral: "Cobalt",
    message: "DRC flooding — 3 mines offline since Tuesday. 12% of global supply affected.",
    source: "Reuters",
  },
  {
    severity: "high",
    mineral: "Neodymium",
    message: "China tightening rare earth export controls. New quotas expected Q3 2026.",
    source: "Bloomberg",
  },
  {
    severity: "medium",
    mineral: "Nickel",
    message: "Indonesia smelter delays push delivery timelines to Q4.",
    source: "Mining Weekly",
  },
  {
    severity: "low",
    mineral: "Lithium",
    message: "Australia production ramping — Pilbara Minerals reports 18% output increase.",
    source: "AFR",
  },
];

function TrendBadge({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="flex items-center gap-1 text-[12px] font-medium font-mono" style={{ color: "var(--positive)" }}>
        <TrendingUp size={12} />
        +{change.toFixed(1)}%
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="flex items-center gap-1 text-[12px] font-medium font-mono" style={{ color: "var(--danger)" }}>
        <TrendingDown size={12} />
        {change.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[12px] font-medium font-mono" style={{ color: "var(--dust-dim)" }}>
      <Minus size={12} />
      0.0%
    </span>
  );
}

function SeverityIcon({ severity }: { severity: "high" | "medium" | "low" }) {
  if (severity === "high") return <AlertTriangle size={13} style={{ color: "var(--danger)" }} />;
  if (severity === "medium") return <AlertCircle size={13} style={{ color: "var(--warning)" }} />;
  return <CheckCircle size={13} style={{ color: "var(--positive)" }} />;
}

export function MarketIntel() {
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
            THE MARKETS
          </h2>
          <p className="text-[13px]" style={{ color: "var(--dust)" }}>
            Live commodity intelligence driving asteroid valuations — sourced by Market Intel agent
          </p>
        </motion.div>

        {/* Commodity Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {COMMODITIES.map((commodity, i) => (
            <motion.div
              key={commodity.symbol}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.08 }}
              className="glass-card glass-card-hover p-4 flex flex-col gap-3"
            >
              {/* Symbol + Name */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: "var(--dust-dim)" }}
                >
                  {commodity.name}
                </span>
                <span
                  className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "var(--orbit)", color: "var(--dust)" }}
                >
                  {commodity.symbol}
                </span>
              </div>

              {/* Price */}
              <div>
                <span className="text-[20px] font-mono font-semibold text-white">
                  ${commodity.price}
                </span>
                <span className="text-[9px] ml-1" style={{ color: "var(--dust-dim)" }}>
                  {commodity.unit}
                </span>
              </div>

              {/* Trend */}
              <TrendBadge change={commodity.change} />

              {/* Scarcity Bar */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[9px] uppercase tracking-wider" style={{ color: "var(--dust-dim)" }}>
                    Scarcity
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: "var(--dust)" }}>
                    {commodity.scarcity}%
                  </span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${commodity.scarcity}%`,
                      background: commodity.scarcity > 70
                        ? "var(--earth-blue)"
                        : commodity.scarcity > 40
                        ? "var(--dust)"
                        : "var(--dust-dim)",
                    }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Supply Chain Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <h3
            className="text-[11px] font-medium uppercase tracking-[0.15em] mb-4"
            style={{ color: "var(--dust-dim)" }}
          >
            Supply Chain Alerts
          </h3>
          <div className="glass-card divide-y" style={{ borderColor: "var(--orbit)" }}>
            {ALERTS.map((alert, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.8 + i * 0.1 }}
                className="px-5 py-3.5 flex items-start gap-3"
                style={{ borderColor: "var(--orbit)" }}
              >
                <SeverityIcon severity={alert.severity} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[12px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                      {alert.mineral}
                    </span>
                    <span
                      className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: alert.severity === "high"
                          ? "rgba(239,68,68,0.1)"
                          : alert.severity === "medium"
                          ? "rgba(251,191,36,0.1)"
                          : "rgba(52,211,153,0.1)",
                        color: alert.severity === "high"
                          ? "var(--danger)"
                          : alert.severity === "medium"
                          ? "var(--warning)"
                          : "var(--positive)",
                      }}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: "var(--dust)" }}>
                    {alert.message}
                  </p>
                </div>
                <span className="text-[9px] font-mono shrink-0 mt-1" style={{ color: "var(--dust-dim)" }}>
                  {alert.source}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 1.2 }}
          className="mt-6 text-[11px] tracking-wide"
          style={{ color: "var(--dust-dim)" }}
        >
          Market data sourced by Market Intelligence agent · Prices refresh every 5 minutes
        </motion.p>
      </div>
    </section>
  );
}
