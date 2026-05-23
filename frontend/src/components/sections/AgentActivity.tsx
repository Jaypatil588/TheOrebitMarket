"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Search, BarChart3, Telescope, Rocket } from "lucide-react";

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
      {/* Card Header */}
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
            style={{ color: status === "active" ? "var(--signal)" : status === "complete" ? "var(--positive)" : "var(--dust-dim)" }}
          >
            {status}
          </span>
          <div
            className={`w-2 h-2 rounded-full ${status === "active" ? "pulse-active" : status === "complete" ? "" : "pulse-idle"}`}
            style={{
              background: status === "active" ? "var(--signal)" : status === "complete" ? "var(--positive)" : "var(--dust-dim)",
            }}
          />
        </div>
      </div>

      {/* Activity Stream */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5" style={{ scrollbarWidth: "thin" }}>
        {entries.map((entry) => (
          <div key={entry.id} className="flex gap-2.5 items-start">
            <div
              className="w-[3px] min-h-[16px] rounded-full mt-1 shrink-0"
              style={{
                background: entry.status === "active" ? accentColor : "var(--orbit)",
              }}
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

// Simulated agent data
const AGENTS_DATA = [
  {
    icon: <Search size={16} />,
    name: "Market Intelligence",
    role: "Supply Chain Analyst",
    status: "active" as const,
    accentColor: "#3b82f6",
    entries: [
      { id: "m1", message: "Searching: \"cobalt supply disruption 2026\"", timestamp: "2s ago", status: "active" as const },
      { id: "m2", message: "Reading: reuters.com — DRC mine flooding report", timestamp: "8s ago", status: "done" as const },
      { id: "m3", message: "Found: 3 cobalt mines offline, 12% global supply affected", timestamp: "14s ago", status: "done" as const },
      { id: "m4", message: "Updated cobalt urgency score: 0.82 → 0.92", timestamp: "18s ago", status: "done" as const },
      { id: "m5", message: "Scanning platinum group metals supply chain...", timestamp: "22s ago", status: "done" as const },
    ],
  },
  {
    icon: <BarChart3 size={16} />,
    name: "Strategic Ranker",
    role: "Investment Strategist",
    status: "complete" as const,
    accentColor: "#22d3ee",
    entries: [
      { id: "r1", message: "5 optimal routes computed successfully", timestamp: "12s ago", status: "done" as const },
      { id: "r2", message: "Evaluating 847 asteroids against market conditions", timestamp: "24s ago", status: "done" as const },
      { id: "r3", message: "Computing pairwise delta-v matrix for top 50 targets", timestamp: "31s ago", status: "done" as const },
      { id: "r4", message: "Best cobalt route: 3 stops, net value $5.2B", timestamp: "38s ago", status: "done" as const },
      { id: "r5", message: "Top pick changed: Amun → 1986 DA (platinum spike)", timestamp: "4m ago", status: "done" as const },
    ],
  },
  {
    icon: <Telescope size={16} />,
    name: "Discovery Scout",
    role: "NEA Monitor",
    status: "complete" as const,
    accentColor: "#a78bfa",
    entries: [
      { id: "d1", message: "2 new near-Earth asteroids found today", timestamp: "34s ago", status: "done" as const },
      { id: "d2", message: "2024 YR14: possibly M-type, estimated $340M", timestamp: "40s ago", status: "done" as const },
      { id: "d3", message: "2024 YS03: C-type, low priority (small diameter)", timestamp: "45s ago", status: "done" as const },
      { id: "d4", message: "Checked MPC latest orbital data catalog", timestamp: "52s ago", status: "done" as const },
      { id: "d5", message: "Flagged YR14 as high-priority for ranker review", timestamp: "58s ago", status: "done" as const },
    ],
  },
  {
    icon: <Rocket size={16} />,
    name: "Mission Architect",
    role: "Mission Design Engineer",
    status: "idle" as const,
    accentColor: "#f97316",
    entries: [
      { id: "a1", message: "Awaiting asteroid selection from user...", timestamp: "now", status: "active" as const },
      { id: "a2", message: "Last analysis: Amun — Falcon Heavy, robotic extraction", timestamp: "4m ago", status: "done" as const },
      { id: "a3", message: "18-month surface ops, fuel efficiency 94.2%", timestamp: "4m ago", status: "done" as const },
      { id: "a4", message: "Ready to generate mission plan on click", timestamp: "—", status: "done" as const },
    ],
  },
];

export function AgentActivity() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section
      ref={sectionRef}
      className="snap-section relative z-10 flex flex-col items-center justify-center px-8"
      style={{ background: "rgba(0, 0, 0, 0.92)" }}
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
            THE INTELLIGENCE
          </h2>
          <p className="text-[13px]" style={{ color: "var(--dust)" }}>
            Four AI agents working in parallel — searching the web, computing routes, monitoring discoveries
          </p>
        </motion.div>

        {/* Agent Grid — 2×2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AGENTS_DATA.map((agent, i) => (
            <AgentCard
              key={agent.name}
              {...agent}
              delay={0.2 + i * 0.12}
              isInView={isInView}
            />
          ))}
        </div>

        {/* Status footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-6 flex items-center gap-4 text-[11px]"
          style={{ color: "var(--dust-dim)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full pulse-active" style={{ background: "var(--signal)" }} />
            <span>1 active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--positive)" }} />
            <span>2 complete</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--dust-dim)" }} />
            <span>1 idle</span>
          </div>
          <span className="ml-auto tracking-wide">Next refresh cycle in 3:47</span>
        </motion.div>
      </div>
    </section>
  );
}
