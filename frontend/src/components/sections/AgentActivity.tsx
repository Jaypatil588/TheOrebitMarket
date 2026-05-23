"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Search, BarChart3, Telescope, Rocket } from "lucide-react";
import { AgentStatus } from "@/hooks/useWebSockets";

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
            <div className="text-[13px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
              {name}
            </div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--dust-dim)" }}>
              {role}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] uppercase tracking-wider font-medium"
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
        {entries.map((entry) => (
          <div key={entry.id} className="flex gap-2.5 items-start">
            <div
              className="w-[3px] min-h-[16px] rounded-full mt-1 shrink-0"
              style={{ background: entry.status === "active" ? accentColor : "var(--orbit)" }}
            />
            <div>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--dust)" }}>
                {entry.message}
              </p>
              <span className="text-[9px] font-mono" style={{ color: "var(--dust-dim)" }}>
                {entry.timestamp}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function formatRelative(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 5000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(timestamp).toLocaleTimeString();
}

const AGENT_DEFS = [
  {
    key: "market_feed",
    icon: <Search size={16} />,
    name: "Market Intelligence",
    role: "Supply Chain Analyst",
    accentColor: "#3b82f6",
    fallbackEntries: [
      { id: "m1", message: "Searching: \"cobalt supply disruption 2026\"", timestamp: "2s ago", status: "active" as const },
      { id: "m2", message: "Reading: reuters.com — DRC mine flooding report", timestamp: "8s ago", status: "done" as const },
      { id: "m3", message: "Found: 3 cobalt mines offline, 12% global supply affected", timestamp: "14s ago", status: "done" as const },
      { id: "m4", message: "Updated cobalt urgency: 0.82 → 0.92", timestamp: "18s ago", status: "done" as const },
      { id: "m5", message: "Scanning platinum group metals supply chain...", timestamp: "22s ago", status: "done" as const },
    ],
  },
  {
    key: "targeting",
    icon: <BarChart3 size={16} />,
    name: "Strategic Ranker",
    role: "Investment Strategist",
    accentColor: "#22d3ee",
    fallbackEntries: [
      { id: "r1", message: "5 optimal routes computed successfully", timestamp: "12s ago", status: "done" as const },
      { id: "r2", message: "Evaluating 500 asteroids against market conditions", timestamp: "24s ago", status: "done" as const },
      { id: "r3", message: "Computing pairwise delta-v matrix for top 50", timestamp: "31s ago", status: "done" as const },
      { id: "r4", message: "Best cobalt route: 3 stops, net value $5.2B", timestamp: "38s ago", status: "done" as const },
    ],
  },
  {
    key: "valuation",
    icon: <Telescope size={16} />,
    name: "Valuation Scout",
    role: "NEA Research Analyst",
    accentColor: "#a78bfa",
    fallbackEntries: [
      { id: "v1", message: "Deep research on 50-asteroid batch complete", timestamp: "34s ago", status: "done" as const },
      { id: "v2", message: "Amun (M-type): cobalt 8.5%, platinum 0.05% confirmed", timestamp: "40s ago", status: "done" as const },
      { id: "v3", message: "Net value computed using live prices from Agent 2", timestamp: "48s ago", status: "done" as const },
      { id: "v4", message: "Upserted 50 valuations to DB", timestamp: "52s ago", status: "done" as const },
    ],
  },
  {
    key: "mission_report",
    icon: <Rocket size={16} />,
    name: "Mission Architect",
    role: "Mission Design Engineer",
    accentColor: "#f97316",
    fallbackEntries: [
      { id: "a1", message: "Awaiting asteroid selection from user...", timestamp: "now", status: "active" as const },
      { id: "a2", message: "Last analysis: Amun — Falcon Heavy, robotic extraction", timestamp: "4m ago", status: "done" as const },
      { id: "a3", message: "18-month surface ops, fuel efficiency 94.2%", timestamp: "4m ago", status: "done" as const },
      { id: "a4", message: "Click an asteroid in 3D view to generate mission plan", timestamp: "—", status: "done" as const },
    ],
  },
];

interface AgentActivityProps {
  agentStatuses?: Record<string, AgentStatus>;
}

export function AgentActivity({ agentStatuses }: AgentActivityProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  // Per-agent message history — accumulated from WS agent_status events
  const [agentHistory, setAgentHistory] = useState<Record<string, AgentEntry[]>>({});

  useEffect(() => {
    if (!agentStatuses) return;
    setAgentHistory((prev) => {
      const next = { ...prev };
      for (const [agent, status] of Object.entries(agentStatuses)) {
        if (!status.message) continue;
        const existing = next[agent] ?? [];
        // Deduplicate by message
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

  const isLive = agentStatuses && Object.keys(agentStatuses).length > 0;

  let activeCount = 0;
  let idleCount = 0;
  let completeCount = 0;

  return (
    <section
      ref={sectionRef}
      className="snap-section relative z-10 flex flex-col items-center justify-center px-8"
      style={{ background: "rgba(0, 0, 0, 0.92)" }}
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
              THE INTELLIGENCE
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
            Four Gemini managed agents working in parallel — scraping markets, valuing asteroids, optimizing routes
          </p>
        </motion.div>

        {/* Agent Grid — 2×2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AGENT_DEFS.map((def, i) => {
            const liveStatus = agentStatuses?.[def.key];
            const liveHistory = agentHistory[def.key];

            let cardStatus: "active" | "idle" | "complete" = "idle";
            if (liveStatus?.status === "active" || liveStatus?.status === "researching") {
              cardStatus = "active";
            } else if (liveStatus?.status === "idle" || liveStatus?.status === "complete") {
              cardStatus = "complete";
            }

            if (cardStatus === "active") activeCount++;
            else if (cardStatus === "complete") completeCount++;
            else idleCount++;

            const entries = liveHistory && liveHistory.length > 0 ? liveHistory : def.fallbackEntries;

            return (
              <AgentCard
                key={def.key}
                icon={def.icon}
                name={def.name}
                role={def.role}
                status={cardStatus}
                entries={entries}
                accentColor={def.accentColor}
                delay={0.2 + i * 0.12}
                isInView={isInView}
              />
            );
          })}
        </div>

        {/* Status footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-6 flex items-center gap-4 text-[11px]"
          style={{ color: "var(--dust-dim)" }}
        >
          {isLive ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full pulse-active" style={{ background: "var(--signal)" }} />
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
              <span className="ml-auto tracking-wide">Live Gemini agent activity</span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full pulse-active" style={{ background: "var(--signal)" }} />
                <span>1 active (mock)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--positive)" }} />
                <span>2 complete (mock)</span>
              </div>
              <span className="ml-auto tracking-wide">Start backend for live data</span>
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
