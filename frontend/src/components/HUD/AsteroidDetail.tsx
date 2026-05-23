"use client";

import { motion } from "framer-motion";
import { AsteroidData } from "../Map3D/AsteroidBelt";
import { formatCoordinates, formatTonnage, formatValue } from "@/lib/utils";
import { X, ShieldAlert, CircleDot, Activity, DollarSign } from "lucide-react";

interface AsteroidDetailProps {
  selectedAsteroid: AsteroidData | null;
  onClose: () => void;
}

export function AsteroidDetail({ selectedAsteroid, onClose }: AsteroidDetailProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -300 }}
      animate={{
        opacity: selectedAsteroid ? 1 : 0,
        x: selectedAsteroid ? 0 : -350,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{ pointerEvents: selectedAsteroid ? "auto" : "none" }}
      className="absolute left-6 bottom-6 w-[360px] glass-panel rounded z-10 select-none overflow-hidden"
    >
      {selectedAsteroid && (
        <div className="flex flex-col">
          {/* HEADER */}
          <div className="p-4 border-b border-amber-500/10 bg-black/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CircleDot size={13} className="text-amber-500 animate-pulse" />
              <span className="font-mono text-xs font-semibold tracking-wider text-slate-200">
                TELEMETRY: {selectedAsteroid.name}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
            >
              <X size={14} />
            </button>
          </div>

          {/* TELEMETRY BODY */}
          <div className="p-4 space-y-4 font-mono text-[11px]">
            {/* Coordinates */}
            <div className="space-y-1 bg-black/30 p-2 border border-slate-900 rounded">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest block">
                INTERCEPT POSITION Vector
              </span>
              <span className="text-amber-400 font-bold block">
                {formatCoordinates(selectedAsteroid.x, selectedAsteroid.y, selectedAsteroid.z)}
              </span>
            </div>

            {/* General metrics */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-0.5">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Mass</span>
                <span className="text-slate-200 font-bold text-xs">
                  {formatTonnage(selectedAsteroid.mass)}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Velocity</span>
                <span className="text-slate-200 font-bold text-xs">
                  {(Math.abs(selectedAsteroid.orbitSpeed) * 12.4).toFixed(2)} km/s
                </span>
              </div>
            </div>

            {/* Estimated Value */}
            <div className="flex items-center gap-2 bg-amber-500/5 p-2.5 border border-amber-500/10 rounded">
              <div className="w-5 h-5 rounded bg-amber-500/10 flex items-center justify-center text-amber-500">
                <DollarSign size={11} />
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase block">ESTIMATED ASSET YIELD</span>
                <span className="text-amber-500 font-bold text-xs">
                  {formatValue(selectedAsteroid.valueUSD)} USD
                </span>
              </div>
            </div>

            {/* COMPOSITION PROGRESS BARS */}
            <div className="space-y-2.5">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest block">
                Mineral Composition
              </span>

              {Object.entries(selectedAsteroid.composition).map(([mineral, percentage]) => {
                // Map keys to readable titles (e.g. platinumGroup -> Platinum Group, waterIce -> Water Ice)
                const label = mineral
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (str) => str.toUpperCase());

                // Assign progress bar colors dynamically
                let barColor = "bg-slate-500"; // default stony matrix / clay minerals
                let isPrecious = false;

                if (mineral.toLowerCase().includes("platinum") || mineral.toLowerCase().includes("gold")) {
                  barColor = "bg-amber-500";
                  isPrecious = true;
                } else if (mineral.toLowerCase().includes("water") || mineral.toLowerCase().includes("ice")) {
                  barColor = "bg-blue-500";
                } else if (mineral.toLowerCase().includes("iron") || mineral.toLowerCase().includes("nickel") || mineral.toLowerCase().includes("cobalt")) {
                  barColor = "bg-amber-600";
                } else if (mineral.toLowerCase().includes("silicon") || mineral.toLowerCase().includes("magnesium") || mineral.toLowerCase().includes("silicates")) {
                  barColor = "bg-slate-700";
                } else if (mineral.toLowerCase().includes("carbon")) {
                  barColor = "bg-slate-400";
                }

                return (
                  <div key={mineral} className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">{label}</span>
                      <span className={isPrecious ? "text-amber-400 font-bold animate-pulse" : "text-slate-200"}>
                        {percentage}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* WARNING TELEMETRY */}
          <div className="px-4 py-3 bg-red-950/10 border-t border-amber-500/5 flex items-center gap-2 text-[10px] text-slate-500 font-mono">
            <Activity size={10} className="text-slate-600" />
            <span>Telemetry streams refreshed in real-time.</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
export type UseAsteroidDetailReturn = ReturnType<typeof AsteroidDetail>;
