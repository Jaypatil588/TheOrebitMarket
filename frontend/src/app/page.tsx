"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useWebSockets } from "@/hooks/useWebSockets";
import { AgentLiveFeed } from "@/components/HUD/AgentLiveFeed";
import { AsteroidDetail } from "@/components/HUD/AsteroidDetail";
import { AsteroidData } from "@/components/Map3D/AsteroidBelt"; // Note: we exported AsteroidData in AsteroidBelt.tsx

// Dynamically import OrbitScene (R3F Canvas) with SSR disabled to prevent hydration failures on Canvas context
const OrbitScene = dynamic(() => import("@/components/Map3D/OrbitScene"), {
  ssr: false,
});

export default function Home() {
  const [selectedAsteroid, setSelectedAsteroid] = useState<any | null>(null);
  const [hoveredRingIndex, setHoveredRingIndex] = useState<number | null>(null);

  // Initialize live telemetry feed stream
  const { logs, addManualLog } = useWebSockets();

  const handleSelectAsteroid = (asteroid: any | null) => {
    setSelectedAsteroid(asteroid);
    if (asteroid) {
      addManualLog(
        `TARGET DETECTED: Intercept vector secured for '${asteroid.name}' on Orbit Ring ${asteroid.ringIndex + 1}.`,
        "discovery",
        "AH-089"
      );
      addManualLog(
        `TELEMETRY SYNC: Initializing close-range visual mapping. Core composition: ${asteroid.composition.basalt}% basalt rock.`,
        "telemetry",
        "AH-089"
      );
    } else {
      addManualLog("TELEMETRY RESET: Disengaging target focus. Returning to global overview.", "info", "AH-089");
    }
  };

  const handleForceSatellitePing = () => {
    const sectors = ["Sector Alpha-4", "Sector Beta-9", "Sector Delta-1", "Sector Gamma-6"];
    const chosenSector = sectors[Math.floor(Math.random() * sectors.length)];
    
    addManualLog(
      `MANUAL OVERRIDE: Radar sweep requested. Dispatching high-freq microwave ping to ${chosenSector}.`,
      "warning",
      "USER"
    );
    
    // Inject success log slightly delayed to feel authentic
    setTimeout(() => {
      addManualLog(
        `LINK SECURED: ${chosenSector} signal return confirmed. Orbit drift deviation within 0.002%.`,
        "success",
        "SYS"
      );
    }, 1200);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black select-none">
      
      {/* 1. 3D WebGL Canvas Layer */}
      <OrbitScene
        selectedAsteroid={selectedAsteroid}
        onSelectAsteroid={handleSelectAsteroid}
        hoveredRingIndex={hoveredRingIndex}
        onHoverRing={setHoveredRingIndex}
      />

      {/* 2. Sleek CRT Scanline Decorative Effect Overlay */}
      <div className="scanlines" />

      {/* 3. Floating HUD: Absolute Left (Asteroid Data) */}
      <AsteroidDetail
        selectedAsteroid={selectedAsteroid}
        onClose={() => handleSelectAsteroid(null)}
      />

      {/* 4. Floating HUD: Absolute Right (Agent Live Feed) */}
      <AgentLiveFeed
        logs={logs}
        onManualTriggerPing={handleForceSatellitePing}
      />

      {/* 5. Minimal Decorative Top HUD Header */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none font-mono text-[9px] text-slate-500 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-amber-500 font-bold">▲</span>
          <span className="tracking-widest text-slate-400 font-semibold">ASTROHEDGE NETWORK v1.0.4</span>
        </div>
        <div className="tracking-wide">
          SYSTEM LATENCY: <span className="text-emerald-400">14ms</span> {"//"} LINK STABILITY: <span className="text-emerald-400">99.87%</span>
        </div>
      </div>
    </main>
  );
}
