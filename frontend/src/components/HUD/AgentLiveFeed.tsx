"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogEntry } from "@/hooks/useWebSockets";
import { Cpu, Terminal, Compass, RefreshCw } from "lucide-react";

interface AgentLiveFeedProps {
  logs: LogEntry[];
  onManualTriggerPing: () => void;
}

export function AgentLiveFeed({ logs, onManualTriggerPing }: AgentLiveFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new logs stream in
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="absolute right-6 top-6 bottom-6 w-[390px] glass-panel rounded flex flex-col justify-between z-10 select-none overflow-hidden">
      
      {/* SECTION 1: Telemetry Core Header */}
      <div className="p-4 border-b border-amber-500/10 bg-black/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Terminal size={14} className="text-amber-500" />
          <span className="font-mono text-xs font-semibold tracking-widest text-slate-200">
            ASTROHEDGE // LIVE FEED
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-led" />
          <span className="font-mono text-[9px] text-emerald-400 tracking-wider font-bold">
            ONLINE
          </span>
        </div>
      </div>

      {/* SECTION 2: Dynamic System Metadata */}
      <div className="px-4 py-2.5 border-b border-amber-500/5 bg-slate-950/20 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-1.5">
          <Cpu size={10} className="text-slate-500" />
          <span>SYS-CORE: <span className="text-slate-300">AH-089</span></span>
        </div>
        <div className="flex items-center gap-1.5 justify-end">
          <Compass size={10} className="text-slate-500" />
          <span>RADAR: <span className="text-slate-300">ACTIVE</span></span>
        </div>
      </div>

      {/* SECTION 3: Scrolling Telemetry Log Stream */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar text-[11px] font-mono relative bg-black/10"
      >
        {/* Continuous Git-log Styled Connective Line */}
        <div className="absolute left-[21px] top-6 bottom-6 w-[1px] bg-slate-900/80 pointer-events-none" />

        <AnimatePresence initial={false}>
          {logs.map((log) => {
            // Determine type-specific text colors and prefix glyphs
            let typeColor = "text-slate-400";
            let dotColor = "bg-slate-800 border-slate-700";
            let prefix = "•";

            if (log.type === "success") {
              typeColor = "text-emerald-400";
              dotColor = "bg-emerald-500/20 border-emerald-500/40";
              prefix = "✓";
            } else if (log.type === "warning") {
              typeColor = "text-amber-400";
              dotColor = "bg-amber-500/20 border-amber-500/40";
              prefix = "!";
            } else if (log.type === "error") {
              typeColor = "text-rose-400";
              dotColor = "bg-rose-500/20 border-rose-500/40";
              prefix = "✗";
            } else if (log.type === "telemetry") {
              typeColor = "text-cyan-400";
              dotColor = "bg-cyan-500/20 border-cyan-500/40";
              prefix = "⌖";
            } else if (log.type === "discovery") {
              typeColor = "text-yellow-400 font-bold";
              dotColor = "bg-yellow-500/30 border-yellow-400/60";
              prefix = "★";
            }

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="flex items-start gap-3 relative"
              >
                {/* Node indicator */}
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[8px] font-bold ${dotColor} z-10 shrink-0 mt-0.5 bg-black`}>
                  <span className={typeColor}>{prefix}</span>
                </div>

                {/* Log Text & Metas */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-slate-500">
                    <span className="tracking-wide text-slate-400">{log.agentId}</span>
                    <span className="font-light">{log.timestamp}</span>
                  </div>
                  <p className={`leading-relaxed text-slate-300 ${typeColor}`}>
                    {log.message}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* SECTION 4: Interactive Commands Panel */}
      <div className="p-3 border-t border-amber-500/10 bg-black/40 flex items-center justify-between gap-2.5">
        <button
          onClick={onManualTriggerPing}
          className="flex-1 py-1.5 rounded border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40 active:bg-amber-500/20 transition-all font-mono text-[10px] text-amber-500 flex items-center justify-center gap-1.5 tracking-wider font-semibold"
        >
          <RefreshCw size={11} className="animate-spin-slow" />
          FORCE SATELLITE INTERCEPT
        </button>
      </div>
    </div>
  );
}
