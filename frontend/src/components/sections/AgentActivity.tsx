"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Search, BarChart3, Telescope, Rocket } from "lucide-react";
import { AgentStatus } from "@/hooks/useWebSockets";
import { DemoScenarioInput } from "./DemoScenarioInput";

interface AgentEntry {
  id: string;
  message: string;
  timestamp: string;
  status: "active" | "done";
}

interface AgentCardProps {
  icon: React.ReactNode;
  name: string;
  role: string;
  status: "active" | "idle" | "complete";
  entries: AgentEntry[];
  accentColor: string;
  delay: number;
  isInView: boolean;
}

function AgentCard({ icon, name, role, status, entries, accentColor, delay, isInView }: AgentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
      className="glass-card glass-card-hover flex flex-col h-[320px]"
    >
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--orbit)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{ background: `${accentColor}15`, color: accentColor }}
          >
            {icon}
          </div>
          <div>
            <div className="text-base font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
              {name}
            </div>
            <div className="text-xs uppercase tracking-wider" style={{ color: "var(--dust-dim)" }}>
              {role}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs uppercase tracking-wider font-medium"
            style={{
              color: status === "active" ? "var(--signal)"
                : status === "complete" ? "var(--positive)"
                : "var(--dust-dim)",
            }}
          >
            {status}
          </span>
          <div
            className={`w-2 h-2 rounded-full ${status === "active" ? "pulse-active" : ""}`}
            style={{
              background: status === "active" ? "var(--signal)"
                : status === "complete" ? "var(--positive)"
                : "var(--dust-dim)",
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5" style={{ scrollbarWidth: "thin" }}>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-40">
            <span className="text-xs font-mono" style={{ color: "var(--dust-dim)" }}>
              Syncing agent telemetry…
            </span>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex gap-2.5 items-start">
              <div
                className="w-[3px] min-h-[16px] rounded-full mt-1 shrink-0"
                style={{ background: entry.status === "active" ? accentColor : "var(--orbit)" }}
              />
              <div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--dust)" }}>
                  {entry.message}
                </p>
                <span className="text-xs font-mono" style={{ color: "var(--dust-dim)" }}>
                  {entry.timestamp}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

function marketLogLineColor(line: string): string {
  if (line.includes("⚡SCENARIO")) return "#fbbf24";
  if (line.includes("SHIFT:")) return "var(--signal)";
  if (line.includes("disruption:")) return "var(--dust-dim)";
  if (line.includes("DB:") || line.includes("Broadcast")) return "var(--positive)";
  if (line.includes("ERROR") || line.toLowerCase().includes("error")) return "#f87171";
  return "#94a3b8";
}

interface MarketIntelAgentCardProps {
  icon: React.ReactNode;
  name: string;
  role: string;
  status: "active" | "idle" | "complete";
  logLines: string[];
  accentColor: string;
  delay: number;
  isInView: boolean;
}

function MarketIntelAgentCard({
  icon,
  name,
  role,
  status,
  logLines,
  accentColor,
  delay,
  isInView,
}: MarketIntelAgentCardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logLines.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
      className="glass-card glass-card-hover flex flex-col h-[320px]"
    >
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--orbit)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{ background: `${accentColor}15`, color: accentColor }}
          >
            {icon}
          </div>
          <div>
            <div className="text-base font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
              {name}
            </div>
            <div className="text-xs uppercase tracking-wider" style={{ color: "var(--dust-dim)" }}>
              {role}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs uppercase tracking-wider font-medium"
            style={{
              color: status === "active" ? "var(--signal)"
                : status === "complete" ? "var(--positive)"
                : "var(--dust-dim)",
            }}
          >
            {status}
          </span>
          <div
            className={`w-2 h-2 rounded-full ${status === "active" ? "pulse-active" : ""}`}
            style={{
              background: status === "active" ? "var(--signal)"
                : status === "complete" ? "var(--positive)"
                : "var(--dust-dim)",
            }}
          />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto mx-3 my-3 rounded border px-3 py-2 font-mono text-[10px] leading-[1.45] tracking-tight"
        style={{
          scrollbarWidth: "thin",
          borderColor: "rgba(59, 130, 246, 0.2)",
          background: "rgba(2, 6, 23, 0.75)",
          boxShadow: "inset 0 0 24px rgba(59, 130, 246, 0.04)",
        }}
      >
        {logLines.length === 0 ? (
          <div className="flex items-center justify-center h-full opacity-50">
            <span style={{ color: "var(--dust-dim)" }}>[AGENT2] awaiting market feed…</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {logLines.map((line, i) => (
              <div
                key={`${i}-${line.slice(0, 32)}`}
                className="whitespace-pre-wrap break-all"
                style={{ color: marketLogLineColor(line) }}
              >
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

const AGENT_DEFS = [
  { key: "market_feed",    icon: <Search size={16} />,    name: "Market Intelligence", role: "Supply Chain Analyst",    accentColor: "#3b82f6" },
  { key: "targeting",     icon: <BarChart3 size={16} />, name: "Strategic Ranker",     role: "Investment Strategist",  accentColor: "#22d3ee" },
  { key: "valuation",     icon: <Telescope size={16} />, name: "Valuation Scout",      role: "NEA Research Analyst",   accentColor: "#a78bfa" },
  { key: "mission_report",icon: <Rocket size={16} />,    name: "Mission Architect",   role: "Mission Design Engineer", accentColor: "#f97316" },
];

interface AgentActivityProps {
  agentStatuses?: Record<string, AgentStatus>;
  marketFeedLogs?: string[];
  demoActive?: boolean;
  onDemoTrigger?: () => void;
}

export function AgentActivity({
  agentStatuses,
  marketFeedLogs = [],
  demoActive = false,
  onDemoTrigger,
}: AgentActivityProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const [agentHistory, setAgentHistory] = useState<Record<string, AgentEntry[]>>({});

  useEffect(() => {
    if (!demoActive) return;
    setAgentHistory((prev) => ({
      ...prev,
      targeting: [
        {
          id: `demo-tg-${Date.now()}`,
          message: "Rare Earth Priority route computed — Ceres → Hygiea, Δv 10.7 km/s",
          timestamp: "just now",
          status: "active",
        },
        ...(prev.targeting ?? []).slice(0, 5),
      ],
    }));
  }, [demoActive]);

  useEffect(() => {
    if (!agentStatuses) return;
    setAgentHistory((prev) => {
      const next = { ...prev };
      for (const [agent, status] of Object.entries(agentStatuses)) {
        if (agent === "market_feed") continue;
        if (!status.message) continue;
        const existing = next[agent] ?? [];
        if (existing.length > 0 && existing[0].message === status.message) continue;
        next[agent] = [
          {
            id: `${agent}-${Date.now()}`,
            message: status.message,
            timestamp: "just now",
            status: status.status === "active" ? "active" : "done",
          },
          ...existing.slice(0, 6),
        ];
      }
      return next;
    });
  }, [agentStatuses]);

  let activeCount = 0;
  let idleCount = 0;
  let completeCount = 0;

  return (
    <section
      ref={sectionRef}
      className="snap-section relative z-10 flex flex-col items-center justify-center px-8"
      style={{ background: "transparent" }}
    >
      <div className="w-full max-w-[1100px]">
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
              THE INTELLIGENCE
            </h2>
            <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-2 py-1 rounded"
              style={{ background: "rgba(52,211,153,0.1)", color: "var(--positive)" }}>
              <div className="w-1.5 h-1.5 rounded-full pulse-active" style={{ background: "var(--positive)" }} />
              LIVE
            </span>
          </div>
          <p className="text-base" style={{ color: "var(--dust)" }}>
            Four Gemini managed agents working in parallel — scraping markets, valuing asteroids, optimizing routes
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AGENT_DEFS.map((def, i) => {
            const liveStatus = agentStatuses?.[def.key];
            const liveHistory = agentHistory[def.key] ?? [];

            let cardStatus: "active" | "idle" | "complete" = "idle";

            if (def.key === "market_feed") {
              if (
                liveStatus?.status === "active" ||
                liveStatus?.status === "starting" ||
                liveStatus?.status === "researching"
              ) {
                cardStatus = "active";
              } else if (liveStatus?.status === "error") {
                cardStatus = "idle";
              } else if (marketFeedLogs.length > 0 || liveStatus?.status === "idle") {
                cardStatus = "complete";
              }
            } else if (liveStatus?.status === "active" || liveStatus?.status === "researching") {
              cardStatus = "active";
            } else if (
              liveStatus?.status === "complete" ||
              (liveHistory.length > 0 && liveStatus?.status !== "idle")
            ) {
              cardStatus = "complete";
            } else if (liveHistory.length > 0) {
              cardStatus = liveHistory[0].status === "active" ? "active" : "complete";
            }

            if (cardStatus === "active") activeCount++;
            else if (cardStatus === "complete") completeCount++;
            else idleCount++;

            if (def.key === "market_feed") {
              return (
                <MarketIntelAgentCard
                  key={def.key}
                  icon={def.icon}
                  name={def.name}
                  role={def.role}
                  status={cardStatus}
                  logLines={marketFeedLogs}
                  accentColor={def.accentColor}
                  delay={0.2 + i * 0.12}
                  isInView={isInView}
                />
              );
            }

            return (
              <AgentCard
                key={def.key}
                icon={def.icon}
                name={def.name}
                role={def.role}
                status={cardStatus}
                entries={liveHistory}
                accentColor={def.accentColor}
                delay={0.2 + i * 0.12}
                isInView={isInView}
              />
            );
          })}
        </div>

        {onDemoTrigger && (
          <DemoScenarioInput onTrigger={onDemoTrigger} triggered={demoActive} />
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-6 flex items-center gap-4 text-sm"
          style={{ color: "var(--dust-dim)" }}
        >
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${activeCount > 0 ? "pulse-active" : ""}`} style={{ background: "var(--signal)" }} />
            <span>{activeCount} active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--positive)" }} />
            <span>{completeCount} complete</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--dust-dim)" }} />
            <span>{idleCount} idle</span>
          </div>
          <span className="ml-auto tracking-wide">
            Live Gemini agent activity — parallel market, valuation, routing, and mission agents
          </span>
        </motion.div>
      </div>
    </section>
  );
}
