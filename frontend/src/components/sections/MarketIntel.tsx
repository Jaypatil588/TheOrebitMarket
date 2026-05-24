"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { MarketPrice, Scenario } from "@/hooks/useWebSockets";
import { ScenarioInput } from "./ScenarioInput";

interface MarketIntelProps {
  prices?: MarketPrice[];
  activeScenarios?: Scenario[];
  onScenarioInjected?: (sc: Scenario) => void;
  onScenarioRemoved?: (id: string) => void;
}

// Mock fallback data shown before live data arrives
const MOCK_PRICES: MarketPrice[] = [
  { mineral: "platinum", price_usd: 31240, trend: "rising", change_pct: 2.1, urgency: 0.51, disruption: "", source_url: "", category: "pgm", criticality: 1, scenario_adjusted: false, fetched_at: "" },
  { mineral: "cobalt", price_usd: 33800, trend: "falling", change_pct: -0.4, urgency: 0.82, disruption: "DRC flooding", source_url: "", category: "battery", criticality: 1, scenario_adjusted: false, fetched_at: "" },
  { mineral: "nickel", price_usd: 16420, trend: "rising", change_pct: 0.8, urgency: 0.45, disruption: "", source_url: "", category: "battery", criticality: 1, scenario_adjusted: false, fetched_at: "" },
  { mineral: "neodymium", price_usd: 210, trend: "rising", change_pct: 1.8, urgency: 0.74, disruption: "China export restrictions", source_url: "", category: "rare_earth", criticality: 1, scenario_adjusted: false, fetched_at: "" },
  { mineral: "lithium", price_usd: 12.8, trend: "falling", change_pct: -1.2, urgency: 0.43, disruption: "", source_url: "", category: "battery", criticality: 2, scenario_adjusted: false, fetched_at: "" },
  { mineral: "iron", price_usd: 0.124, trend: "stable", change_pct: 0.1, urgency: 0.12, disruption: "", source_url: "", category: "industrial", criticality: 3, scenario_adjusted: false, fetched_at: "" },
];

const DISPLAY_SYMBOLS: Record<string, string> = {
  platinum: "Pt", cobalt: "Co", nickel: "Ni", neodymium: "Nd",
  lithium: "Li", iron: "Fe", palladium: "Pd", rhodium: "Rh",
  iridium: "Ir", dysprosium: "Dy", terbium: "Tb", gallium: "Ga",
  germanium: "Ge", tungsten: "W", cobalt_blue: "Co", water_ice: "H₂O",
  silicon: "Si", magnesium: "Mg",
};

function symbolFor(mineral: string): string {
  return DISPLAY_SYMBOLS[mineral] ?? mineral.slice(0, 2).toUpperCase();
}

function formatPrice(price: number): string {
  if (price >= 1000000) return `${(price / 1000000).toFixed(2)}M`;
  if (price >= 1000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}

function unitFor(price: number): string {
  return price >= 50 ? "$/t" : "$/kg";
}

function TrendBadge({ change, trend }: { change: number; trend: string }) {
  const isUp = trend === "rising" || change > 0;
  const isDown = trend === "falling" || change < 0;
  if (isUp) return (
    <span className="flex items-center gap-1 text-sm font-medium font-mono" style={{ color: "var(--positive)" }}>
      <TrendingUp size={13} />+{Math.abs(change).toFixed(1)}%
    </span>
  );
  if (isDown) return (
    <span className="flex items-center gap-1 text-sm font-medium font-mono" style={{ color: "var(--danger)" }}>
      <TrendingDown size={13} />-{Math.abs(change).toFixed(1)}%
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-sm font-medium font-mono" style={{ color: "var(--dust-dim)" }}>
      <Minus size={13} />0.0%
    </span>
  );
}

function SeverityIcon({ urgency, scenario }: { urgency: number; scenario: boolean }) {
  if (scenario) return <Zap size={13} style={{ color: "var(--warning)" }} />;
  if (urgency > 0.7) return <AlertTriangle size={13} style={{ color: "var(--danger)" }} />;
  if (urgency > 0.4) return <AlertCircle size={13} style={{ color: "var(--warning)" }} />;
  return <CheckCircle size={13} style={{ color: "var(--positive)" }} />;
}

export function MarketIntel({
  prices,
  activeScenarios = [],
  onScenarioInjected,
  onScenarioRemoved,
}: MarketIntelProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const hasData = prices && prices.length > 0;
  const activePrices = hasData ? prices : MOCK_PRICES;

  const isLive = true;

  // Show top 6 by urgency for the grid cards
  const displayPrices = [...activePrices]
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 6);

  // Show disruptions for the alerts panel
  const alerts = activePrices
    .filter((p) => p.disruption || p.scenario_adjusted)
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 5);

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
              THE MARKETS
            </h2>
            {isLive && (
              <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-2 py-1 rounded"
                style={{ background: hasData ? "rgba(52,211,153,0.1)" : "rgba(251,191,36,0.1)", color: hasData ? "var(--positive)" : "var(--warning)" }}>
                <div className="w-1.5 h-1.5 rounded-full pulse-active" style={{ background: hasData ? "var(--positive)" : "var(--warning)" }} />
                {hasData ? "LIVE" : "SIMULATED"}
              </span>
            )}
          </div>
          <p className="text-base" style={{ color: "var(--dust)" }}>
            Live commodity intelligence driving asteroid valuations — sourced by Market Intelligence agent
          </p>
        </motion.div>

        {/* Commodity Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {displayPrices.map((p, i) => (
            <motion.div
              key={p.mineral}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.08 }}
              className="glass-card glass-card-hover p-4 flex flex-col gap-3"
              style={p.scenario_adjusted ? { borderColor: "rgba(251,191,36,0.3)" } : {}}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--dust-dim)" }}>
                  {p.mineral.replace(/_/g, " ")}
                </span>
                <span className="text-sm font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{ background: p.scenario_adjusted ? "rgba(251,191,36,0.15)" : "var(--orbit)", color: p.scenario_adjusted ? "var(--warning)" : "var(--dust)" }}>
                  {symbolFor(p.mineral)}
                </span>
              </div>

              <div>
                <span className="text-2xl font-mono font-semibold text-white">
                  ${formatPrice(p.price_usd)}
                </span>
                <span className="text-xs ml-1" style={{ color: "var(--dust-dim)" }}>
                  {unitFor(p.price_usd)}
                </span>
              </div>

              <TrendBadge change={p.change_pct} trend={p.trend} />

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs uppercase tracking-wider" style={{ color: "var(--dust-dim)" }}>
                    Urgency
                  </span>
                  <span className="text-xs font-mono" style={{ color: "var(--dust)" }}>
                    {(p.urgency * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${p.urgency * 100}%`,
                      background: p.urgency > 0.7 ? "var(--earth-blue)"
                        : p.urgency > 0.4 ? "var(--dust)"
                        : "var(--dust-dim)",
                    }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Supply Chain Alerts */}
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            <h3 className="text-sm font-medium uppercase tracking-[0.15em] mb-4" style={{ color: "var(--dust-dim)" }}>
              Supply Chain Alerts
            </h3>
            <div className="glass-card divide-y" style={{ borderColor: "var(--orbit)" }}>
              {alerts.map((alert, i) => (
                <motion.div
                  key={alert.mineral}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.8 + i * 0.1 }}
                  className="px-5 py-3.5 flex items-start gap-3"
                  style={{ borderColor: "var(--orbit)" }}
                >
                  <SeverityIcon urgency={alert.urgency} scenario={alert.scenario_adjusted} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base font-semibold text-white capitalize"
                        style={{ fontFamily: "var(--font-display)" }}>
                        {alert.mineral.replace(/_/g, " ")}
                      </span>
                      <span
                        className="text-xs uppercase tracking-wider px-1.5 py-0.5 rounded font-medium"
                        style={{
                          background: alert.scenario_adjusted ? "rgba(251,191,36,0.1)"
                            : alert.urgency > 0.7 ? "rgba(239,68,68,0.1)"
                            : "rgba(251,191,36,0.1)",
                          color: alert.scenario_adjusted ? "var(--warning)"
                            : alert.urgency > 0.7 ? "var(--danger)"
                            : "var(--warning)",
                        }}
                      >
                        {alert.scenario_adjusted ? "scenario" : alert.urgency > 0.7 ? "high" : "medium"}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--dust)" }}>
                      {alert.disruption || "Market conditions elevated — monitor closely."}
                    </p>
                  </div>
                  <span className="text-xs font-mono shrink-0 mt-1" style={{ color: "var(--dust-dim)" }}>
                    urgency {(alert.urgency * 100).toFixed(0)}%
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Scenario Injection Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 1.0 }}
        >
          <ScenarioInput
            activeScenarios={activeScenarios}
            onScenarioInjected={onScenarioInjected}
            onScenarioRemoved={onScenarioRemoved}
          />
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 1.3 }}
          className="mt-6 text-sm tracking-wide"
          style={{ color: "var(--dust-dim)" }}
        >
          {isLive
            ? `${hasData ? "Live" : "Simulated"} data — ${activePrices.length} minerals tracked · Refreshes every 10s via Agent 2`
            : null}
        </motion.p>
      </div>
    </section>
  );
}
