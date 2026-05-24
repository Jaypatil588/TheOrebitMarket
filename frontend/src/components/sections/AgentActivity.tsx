"use client";

import { useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Search, BarChart3, Telescope, Rocket } from "lucide-react";
import { AgentStatus } from "@/hooks/useWebSockets";
import { DemoScenarioInput } from "./DemoScenarioInput";

function agentLogLineColor(agentKey: string, line: string): string {
  if (line.includes("⚡SCENARIO")) return "#fbbf24";
  if (line.includes("ERROR") || line.toLowerCase().includes("error")) return "#f87171";
  if (line.includes("SHIFT:") || line.includes("URGENCY SHIFT:")) return "var(--signal)";
  if (line.includes("DB:") || line.includes("Broadcast") || line.includes("Complete")) {
    return "var(--positive)";
  }
  if (line.includes("CACHE HIT")) return "var(--positive)";
  if (line.includes("CACHE MISS")) return "var(--signal)";
  if (line.includes("disruption:")) return "var(--dust-dim)";
  if (line.includes("Route:") || line.includes("Rank #")) {
    return agentKey === "targeting" ? "#22d3ee" : "#94a3b8";
  }
  if (line.includes("[DEEP]")) return "#a78bfa";
  if (line.includes("Images:")) return "#f97316";
  return "#94a3b8";
}

interface TerminalAgentCardProps {
  icon: React.ReactNode;
  name: string;
  role: string;
  agentKey: string;
  status: "active" | "idle" | "complete";
  logLines: string[];
  emptyMessage: string;
  accentColor: string;
  delay: number;
  isInView: boolean;
}

function TerminalAgentCard({
  icon,
  name,
  role,
  agentKey,
  status,
  logLines,
  emptyMessage,
  accentColor,
  delay,
  isInView,
}: TerminalAgentCardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logLines.length]);

  const borderColor = `${accentColor}33`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
      className="glass-card glass-card-hover flex flex-col h-[380px]"
    >
      <div
        className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "var(--orbit)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded flex items-center justify-center"
            style={{ background: `${accentColor}15`, color: accentColor }}
          >
            {icon}
          </div>
          <div>
            <div className="text-lg font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
              {name}
            </div>
            <div className="text-sm uppercase tracking-wider" style={{ color: "var(--dust-dim)" }}>
              {role}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-sm uppercase tracking-wider font-medium"
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
        className="flex-1 overflow-y-auto mx-3 my-3 rounded border px-3 py-2.5 font-mono text-base leading-relaxed tracking-normal"
        style={{
          scrollbarWidth: "thin",
          borderColor,
          background: "rgba(2, 6, 23, 0.75)",
          boxShadow: `inset 0 0 24px ${accentColor}0a`,
        }}
      >
        {logLines.length === 0 ? (
          <div className="flex items-center justify-center h-full opacity-50">
            <span style={{ color: "var(--dust-dim)" }}>{emptyMessage}</span>
          </div>
        ) : (
          <div className="space-y-1">
            {logLines.map((line, i) => (
              <div
                key={`${i}-${line.slice(0, 32)}`}
                className="whitespace-pre-wrap break-all"
                style={{ color: agentLogLineColor(agentKey, line) }}
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
  {
    key: "market_feed",
    icon: <Search size={18} />,
    name: "Market Intelligence",
    role: "Supply Chain Analyst",
    accentColor: "#3b82f6",
    emptyMessage: "[AGENT2] awaiting market feed…",
  },
  {
    key: "targeting",
    icon: <BarChart3 size={18} />,
    name: "Strategic Ranker",
    role: "Investment Strategist",
    accentColor: "#22d3ee",
    emptyMessage: "[AGENT3] awaiting rankings feed…",
  },
  {
    key: "valuation",
    icon: <Telescope size={18} />,
    name: "Valuation Scout",
    role: "NEA Research Analyst",
    accentColor: "#a78bfa",
    emptyMessage: "[AGENT1] awaiting valuation feed…",
  },
  {
    key: "mission_report",
    icon: <Rocket size={18} />,
    name: "Mission Architect",
    role: "Mission Design Engineer",
    accentColor: "#f97316",
    emptyMessage: "[AGENT4] awaiting mission brief trigger…",
  },
] as const;

interface AgentActivityProps {
  agentStatuses?: Record<string, AgentStatus>;
  marketFeedLogs?: string[];
  rankerFeedLogs?: string[];
  valuationFeedLogs?: string[];
  missionFeedLogs?: string[];
  demoActive?: boolean;
  onDemoTrigger?: () => void;
}

function feedLogsForAgent(
  key: string,
  feeds: {
    marketFeedLogs: string[];
    rankerFeedLogs: string[];
    valuationFeedLogs: string[];
    missionFeedLogs: string[];
  }
): string[] {
  switch (key) {
    case "market_feed":
      return feeds.marketFeedLogs;
    case "targeting":
      return feeds.rankerFeedLogs;
    case "valuation":
      return feeds.valuationFeedLogs;
    case "mission_report":
      return feeds.missionFeedLogs;
    default:
      return [];
  }
}

function cardStatusForAgent(
  liveStatus: AgentStatus | undefined,
  logLines: string[]
): "active" | "idle" | "complete" {
  if (
    liveStatus?.status === "active" ||
    liveStatus?.status === "starting" ||
    liveStatus?.status === "researching"
  ) {
    return "active";
  }
  if (liveStatus?.status === "error") {
    return logLines.length > 0 ? "complete" : "idle";
  }
  if (liveStatus?.status === "complete" || liveStatus?.status === "idle") {
    return logLines.length > 0 ? "complete" : "idle";
  }
  if (logLines.length > 0) {
    return "complete";
  }
  return "idle";
}

export function AgentActivity({
  agentStatuses,
  marketFeedLogs = [],
  rankerFeedLogs = [],
  valuationFeedLogs = [],
  missionFeedLogs = [],
  demoActive = false,
  onDemoTrigger,
}: AgentActivityProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const feeds = {
    marketFeedLogs,
    rankerFeedLogs,
    valuationFeedLogs,
    missionFeedLogs,
  };

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
            <span
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-2 py-1 rounded"
              style={{ background: "rgba(52,211,153,0.1)", color: "var(--positive)" }}
            >
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
            const logLines = feedLogsForAgent(def.key, feeds);
            const cardStatus = cardStatusForAgent(liveStatus, logLines);

            if (cardStatus === "active") activeCount++;
            else if (cardStatus === "complete") completeCount++;
            else idleCount++;

            return (
              <TerminalAgentCard
                key={def.key}
                icon={def.icon}
                name={def.name}
                role={def.role}
                agentKey={def.key}
                status={cardStatus}
                logLines={logLines}
                emptyMessage={def.emptyMessage}
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
          className="mt-6 flex items-center gap-4 text-base"
          style={{ color: "var(--dust-dim)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${activeCount > 0 ? "pulse-active" : ""}`}
              style={{ background: "var(--signal)" }}
            />
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
