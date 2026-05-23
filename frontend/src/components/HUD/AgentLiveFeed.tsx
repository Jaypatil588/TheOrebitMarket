"use client";

import { useEffect, useState } from "react";
import { LogEntry } from "@/hooks/useWebSockets";

interface AgentLiveFeedProps {
  logs: LogEntry[];
  onManualTriggerPing: () => void;
}

export function AgentLiveFeed({ logs, onManualTriggerPing }: AgentLiveFeedProps) {
  const [currentVal, setCurrentVal] = useState("8:28");
  const [telemetryPercent, setTelemetryPercent] = useState(0);

  // Dynamic values update to make the interface feel alive
  useEffect(() => {
    const timeInterval = setInterval(() => {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, "0");
      const mm = now.getMinutes().toString().padStart(2, "0");
      setCurrentVal(`${hh}:${mm}`);
    }, 1000);

    const telemetryInterval = setInterval(() => {
      setTelemetryPercent((prev) => {
        if (prev >= 100) return 0;
        return prev + 1;
      });
    }, 2400);

    return () => {
      clearInterval(timeInterval);
      clearInterval(telemetryInterval);
    };
  }, []);

  return (
    <div className="absolute right-8 top-1/2 -translate-y-1/2 w-[280px] h-[480px] rounded border border-green-500/30 bg-black/85 p-6 font-mono text-green-400 select-none z-10 text-[12px] leading-relaxed shadow-2xl flex flex-col justify-between">
      
      {/* Title Header */}
      <div className="text-green-500 font-bold uppercase tracking-wider text-[13px] pb-3 border-b border-green-500/20">
        AGENT LIVE FEED
      </div>

      {/* Outer container of lists with relative connector line */}
      <div className="flex-1 py-4 relative flex flex-col justify-between">
        
        {/* Left vertical green connecting line */}
        <div className="absolute left-[7px] top-[14px] bottom-[14px] w-[1px] bg-green-500/30 pointer-events-none" />

        {/* 1. STATUS SECTION */}
        <div className="flex gap-4 items-start pl-[2px]">
          {/* LED Bullet Node (Solid glowing green circle) */}
          <div className="w-[11px] h-[11px] rounded-full bg-green-500 ring-4 ring-green-500/20 shrink-0 mt-[4px] z-10" />
          <div className="space-y-0.5">
            <div className="flex justify-between w-[190px]">
              <span className="text-green-500 font-semibold tracking-wide">STATUS</span>
              <span className="text-green-400 font-bold">ON</span>
            </div>
            <div className="text-[10px] text-green-500/70 pl-1 space-y-0.5">
              <div className="flex justify-between w-[180px]">
                <span>PLANS URG:</span>
                <span>+100%</span>
              </div>
              <div className="flex justify-between w-[180px]">
                <span>AGENT DRONES:</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. TELEMETRY STATUS SECTION */}
        <div className="flex gap-4 items-start pl-[2px]">
          {/* Hollow circle bullet node */}
          <div className="w-[11px] h-[11px] rounded-full border border-green-500/60 bg-black shrink-0 mt-[4px] z-10" />
          <div className="space-y-0.5">
            <div className="text-green-500 font-semibold tracking-wide">TELEMETRY STATUS</div>
            <div className="text-[10px] text-green-500/70 pl-1 space-y-0.5">
              <div>2085.35 ODS</div>
              <div>OORB&amp;T: 8.0GHz</div>
            </div>
          </div>
        </div>

        {/* 3. CURRENT SECTION */}
        <div className="flex gap-4 items-start pl-[2px]">
          <div className="w-[11px] h-[11px] rounded-full border border-green-500/60 bg-black shrink-0 mt-[4px] z-10" />
          <div className="space-y-0.5">
            <div className="text-green-500 font-semibold tracking-wide">CURRENT</div>
            <div className="text-[11px] text-green-400/90 pl-1 font-bold">
              {currentVal}
            </div>
          </div>
        </div>

        {/* 4. VELDNTY (Spelled as VELDNTY to match the exact DOM screenshot layout) */}
        <div className="flex gap-4 items-start pl-[2px]">
          <div className="w-[11px] h-[11px] rounded-full border border-green-500/60 bg-black shrink-0 mt-[4px] z-10" />
          <div className="space-y-0.5">
            <div className="text-green-500 font-semibold tracking-wide">VELDNTY</div>
            <div className="text-[11px] text-green-400/90 pl-1 font-bold">
              3.0 NM/s
            </div>
          </div>
        </div>

        {/* 5. TELEMETRY SECTION */}
        <div className="flex gap-4 items-start pl-[2px]">
          <div className="w-[11px] h-[11px] rounded-full border border-green-500/60 bg-black shrink-0 mt-[4px] z-10" />
          <div className="space-y-0.5">
            <div className="flex justify-between w-[190px]">
              <span className="text-green-500 font-semibold tracking-wide">TELEMETRY</span>
              <span className="text-green-400 font-bold">{telemetryPercent}%</span>
            </div>
          </div>
        </div>

      </div>

      {/* Radar Sweeping Trigger Button (Styled matching terminal theme) */}
      <button
        onClick={onManualTriggerPing}
        className="mt-2 py-1 border border-green-500/25 bg-green-500/5 hover:bg-green-500/10 active:bg-green-500/20 text-green-500 text-[10px] rounded tracking-widest text-center uppercase font-bold transition-all"
      >
        FORCE SATELLITE swept
      </button>

    </div>
  );
}
