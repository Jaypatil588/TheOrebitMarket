"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Scenario } from "@/hooks/useWebSockets";

interface ScenarioInputProps {
  activeScenarios: Scenario[];
  onScenarioInjected?: (sc: Scenario) => void;
  onScenarioRemoved?: (id: string) => void;
}

const PRESETS = [
  {
    label: "China blocks rare earths",
    description: "China blocks all rare earth mineral exports",
    affected_minerals: ["neodymium", "dysprosium", "terbium", "cerium", "praseodymium", "lanthanum", "europium", "gadolinium", "yttrium"],
    severity: 0.95,
    color: "#f59e0b",
  },
  {
    label: "DRC cobalt flooding",
    description: "DRC cobalt mine flooding — 3 mines offline",
    affected_minerals: ["cobalt"],
    severity: 0.88,
    color: "#3b82f6",
  },
  {
    label: "Russia nickel sanctions",
    description: "Russia nickel and palladium export sanctions",
    affected_minerals: ["nickel", "palladium", "platinum"],
    severity: 0.82,
    color: "#94a3b8",
  },
  {
    label: "Taiwan semiconductor crisis",
    description: "Taiwan conflict disrupts gallium and germanium supply",
    affected_minerals: ["gallium", "germanium", "silicon", "tantalum"],
    severity: 0.90,
    color: "#22d3ee",
  },
];

export function ScenarioInput({ activeScenarios, onScenarioInjected, onScenarioRemoved }: ScenarioInputProps) {
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState(0.80);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  async function injectScenario(desc: string, minerals: string[], sev: number) {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8080/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: desc,
          affected_minerals: minerals,
          severity: sev,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Failed to inject scenario");
        return;
      }
      const data = await res.json();
      if (onScenarioInjected) {
        onScenarioInjected({
          id: data.id,
          description: desc,
          affected_minerals: minerals,
          severity: sev,
          active: true,
          created_at: new Date().toISOString(),
        });
      }
      setDescription("");
    } catch (e) {
      setError("Backend unreachable — is the Go server running?");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeScenario(id: string) {
    try {
      await fetch(`http://localhost:8080/api/scenario/${id}`, { method: "DELETE" });
      if (onScenarioRemoved) onScenarioRemoved(id);
    } catch {
      // silent
    }
  }

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Zap size={13} style={{ color: "var(--warning)" }} />
        <h3 className="text-[11px] font-medium uppercase tracking-[0.15em]" style={{ color: "var(--dust-dim)" }}>
          Scenario Injection
        </h3>
        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(251,191,36,0.1)", color: "var(--warning)" }}>
          LIVE CASCADE
        </span>
      </div>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => injectScenario(p.description, p.affected_minerals, p.severity)}
            disabled={submitting}
            className="text-[10px] font-mono px-3 py-1.5 rounded border transition-all duration-200 hover:opacity-90 disabled:opacity-40 cursor-pointer"
            style={{
              borderColor: `${p.color}40`,
              background: `${p.color}10`,
              color: p.color,
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="text-[10px] font-mono px-3 py-1.5 rounded border transition-all duration-200 cursor-pointer"
          style={{ borderColor: "var(--orbit)", color: "var(--dust-dim)" }}
        >
          Custom {showCustom ? <ChevronUp size={10} className="inline" /> : <ChevronDown size={10} className="inline" />}
        </button>
      </div>

      {/* Custom input */}
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-4 mb-4 space-y-3">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && description.trim()) {
                    injectScenario(description.trim(), [], severity);
                  }
                }}
                placeholder='e.g. "Indonesia nickel export ban for 6 months"'
                className="w-full bg-transparent text-[12px] font-mono text-white placeholder-slate-600 outline-none border-b pb-1"
                style={{ borderColor: "var(--orbit)" }}
              />
              <div className="flex items-center gap-3">
                <span className="text-[10px]" style={{ color: "var(--dust-dim)" }}>
                  Severity
                </span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={severity}
                  onChange={(e) => setSeverity(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-[11px] font-mono w-8" style={{ color: "var(--warning)" }}>
                  {(severity * 100).toFixed(0)}%
                </span>
                <button
                  onClick={() => description.trim() && injectScenario(description.trim(), [], severity)}
                  disabled={!description.trim() || submitting}
                  className="text-[10px] font-mono px-3 py-1 rounded border disabled:opacity-40 cursor-pointer transition-all"
                  style={{ borderColor: "var(--warning)", color: "var(--warning)", background: "rgba(251,191,36,0.08)" }}
                >
                  {submitting ? "Injecting..." : "Inject"}
                </button>
              </div>
              {error && (
                <p className="text-[10px] flex items-center gap-1" style={{ color: "var(--danger)" }}>
                  <AlertTriangle size={10} />
                  {error}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active scenarios */}
      <AnimatePresence>
        {activeScenarios.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            <p className="text-[9px] uppercase tracking-wider mb-2" style={{ color: "var(--dust-dim)" }}>
              Active scenarios — cascading through all agents
            </p>
            {activeScenarios.map((sc) => (
              <motion.div
                key={sc.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-3 px-4 py-2.5 rounded"
                style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}
              >
                <div className="w-1.5 h-1.5 rounded-full pulse-active shrink-0" style={{ background: "var(--warning)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white truncate">{sc.description}</p>
                  <p className="text-[9px] font-mono" style={{ color: "var(--dust-dim)" }}>
                    severity {(sc.severity * 100).toFixed(0)}%
                    {sc.affected_minerals?.length > 0 && ` · ${sc.affected_minerals.slice(0, 3).join(", ")}${sc.affected_minerals.length > 3 ? "..." : ""}`}
                  </p>
                </div>
                <button
                  onClick={() => removeScenario(sc.id)}
                  className="shrink-0 opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <X size={12} style={{ color: "var(--dust)" }} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
