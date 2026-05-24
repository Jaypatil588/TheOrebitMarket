"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Search, BarChart3, Telescope, Rocket } from "lucide-react";
import { AgentStatus } from "@/hooks/useWebSockets";
import { DemoScenarioInput } from "./DemoScenarioInput";
import { DEMO_SCENARIO_PHRASE } from "@/lib/demoScenario";

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
              Awaiting agent logs...
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

const AGENT_DEFS = [
  { key: "market_feed",    icon: <Search size={16} />,    name: "Market Intelligence", role: "Supply Chain Analyst",    accentColor: "#3b82f6" },
  { key: "targeting",     icon: <BarChart3 size={16} />, name: "Strategic Ranker",     role: "Investment Strategist",  accentColor: "#22d3ee" },
  { key: "valuation",     icon: <Telescope size={16} />, name: "Valuation Scout",      role: "NEA Research Analyst",   accentColor: "#a78bfa" },
  { key: "mission_report",icon: <Rocket size={16} />,    name: "Mission Architect",   role: "Mission Design Engineer", accentColor: "#f97316" },
];

// Mock agent logs — remove when WebSocket agent_status streams are live
const MOCK_AGENT_ENTRIES: Record<string, AgentEntry[]> = {
  market_feed: [
    { id: "mock-mf-1", message: "Scraping LME cobalt futures — spot $33,800/t (+2.1% weekly)", timestamp: "12s ago", status: "active" },
    { id: "mock-mf-2", message: "Neodymium export restriction flagged in CN customs data", timestamp: "45s ago", status: "done" },
    { id: "mock-mf-3", message: "Updated 14 mineral price feeds from Bloomberg & USGS", timestamp: "2m ago", status: "done" },
    { id: "mock-mf-4", message: "Platinum urgency elevated to 0.51 — PGM supply tightening", timestamp: "4m ago", status: "done" },
  ],
  targeting: [
    { id: "mock-tg-1", message: "Composite scoring 847 NEA candidates against cobalt urgency", timestamp: "8s ago", status: "active" },
    { id: "mock-tg-2", message: "Δv matrix computed for top 50 accessible targets", timestamp: "1m ago", status: "done" },
    { id: "mock-tg-3", message: "Ranked 16 Psyche #1 — net value $10.2T, Δv 5.82 km/s", timestamp: "3m ago", status: "done" },
    { id: "mock-tg-4", message: "Generating 5 mission route variants across M-type cluster", timestamp: "5m ago", status: "done" },
  ],
  valuation: [
    { id: "mock-vl-1", message: "Deep research complete: Ryugu composition 86% confidence", timestamp: "18s ago", status: "done" },
    { id: "mock-vl-2", message: "Fast valuation pass: 412 asteroids in 12s", timestamp: "2m ago", status: "done" },
    { id: "mock-vl-3", message: "Scenario impact applied: +18% on neodymium-weighted targets", timestamp: "6m ago", status: "done" },
    { id: "mock-vl-4", message: "Valuation cache refreshed — 847 asteroids valued", timestamp: "8m ago", status: "done" },
  ],
  mission_report: [
    { id: "mock-mr-1", message: "Mission profile queued for 16 Psyche (M-type, Co+Ni focus)", timestamp: "30s ago", status: "done" },
    { id: "mock-mr-2", message: "Δv budget analysis: 8.2 km/s round-trip feasible", timestamp: "3m ago", status: "done" },
    { id: "mock-mr-3", message: "Extractable mass estimate: 1.2×10¹⁵ kg iron-nickel", timestamp: "7m ago", status: "done" },
    { id: "mock-mr-4", message: "Awaiting target selection for full mission brief", timestamp: "10m ago", status: "done" },
  ],
};

const MOCK_AGENT_CARD_STATUS: Record<string, "active" | "idle" | "complete"> = {
  market_feed: "active",
  targeting: "active",
  valuation: "complete",
  mission_report: "idle",
};

interface AgentActivityProps {
  agentStatuses?: Record<string, AgentStatus>;
  demoActive?: boolean;
  onDemoTrigger?: () => void;
}

export function AgentActivity({
  agentStatuses,
  demoActive = false,
  onDemoTrigger,
}: AgentActivityProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  // Per-agent message history — accumulated from WS agent_status events
  const [agentHistory, setAgentHistory] = useState<Record<string, AgentEntry[]>>({});

  useEffect(() => {
    if (!demoActive) return;
    setAgentHistory((prev) => ({
      ...prev,
      market_feed: [
        {
          id: `demo-mf-${Date.now()}`,
          message: `ALERT: ${DEMO_SCENARIO_PHRASE} — rare earth urgency spike across ${11} minerals`,
          timestamp: "just now",
          status: "active",
        },
        ...(prev.market_feed ?? []).slice(0, 5),
      ],
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

  const hasLiveMessages =
    Object.values(agentHistory).some((entries) => entries.length > 0) ||
    Object.values(agentStatuses ?? {}).some((s) => Boolean(s.message));

  const isLive = hasLiveMessages;

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
              THE INTELLIGENCE
            </h2>
            <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-2 py-1 rounded"
              style={{
                background: isLive ? "rgba(52,211,153,0.1)" : "rgba(251,191,36,0.1)",
                color: isLive ? "var(--positive)" : "var(--warning)",
              }}>
              <div className={`w-1.5 h-1.5 rounded-full ${isLive ? "pulse-active" : ""}`}
                style={{ background: isLive ? "var(--positive)" : "var(--warning)" }}
              />
              {isLive ? "LIVE" : "SIMULATED"}
            </span>
          </div>
          <p className="text-base" style={{ color: "var(--dust)" }}>
            Four Gemini managed agents working in parallel — scraping markets, valuing asteroids, optimizing routes
          </p>
        </motion.div>

        {/* Agent Grid — 2×2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AGENT_DEFS.map((def, i) => {
            const liveStatus = agentStatuses?.[def.key];
            const liveHistory = agentHistory[def.key];
            const useMock =
              !isLive && !liveStatus?.message && (liveHistory ?? []).length === 0;

            let cardStatus: "active" | "idle" | "complete" = "idle";
            if (useMock) {
              cardStatus = MOCK_AGENT_CARD_STATUS[def.key] ?? "idle";
            } else if (liveStatus?.status === "active" || liveStatus?.status === "researching") {
              cardStatus = "active";
            } else if (liveStatus?.status === "idle" || liveStatus?.status === "complete") {
              cardStatus = "complete";
            }

            if (cardStatus === "active") activeCount++;
            else if (cardStatus === "complete") completeCount++;
            else idleCount++;

            const entries = useMock ? MOCK_AGENT_ENTRIES[def.key] ?? [] : liveHistory ?? [];

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

        {onDemoTrigger && (
          <DemoScenarioInput onTrigger={onDemoTrigger} triggered={demoActive} />
        )}

        {/* Status footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-6 flex items-center gap-4 text-sm"
          style={{ color: "var(--dust-dim)" }}
        >
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isLive ? "pulse-active" : ""}`} style={{ background: "var(--signal)" }} />
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
            {isLive ? "Live Gemini agent activity" : "Simulated agent activity — awaiting WebSocket feed"}
          </span>
        </motion.div>
      </div>
    </section>
  );
}
