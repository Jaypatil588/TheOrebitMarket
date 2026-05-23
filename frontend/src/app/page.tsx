"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { HeroOverlay } from "@/components/sections/HeroOverlay";
import { StrategicRankings } from "@/components/sections/StrategicRankings";
import { AgentActivity } from "@/components/sections/AgentActivity";
import { MarketIntel } from "@/components/sections/MarketIntel";
import { AsteroidData } from "@/components/Map3D/AsteroidBelt";

// Dynamically import OrbitScene (R3F Canvas) with SSR disabled
const OrbitScene = dynamic(() => import("@/components/Map3D/OrbitScene"), {
  ssr: false,
});

export default function Home() {
  const [selectedAsteroid, setSelectedAsteroid] = useState<AsteroidData | null>(null);
  const [hoveredRingIndex, setHoveredRingIndex] = useState<number | null>(null);

  // Esc key unselects the selected asteroid
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedAsteroid(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelectAsteroid = (asteroid: AsteroidData | null) => {
    setSelectedAsteroid(asteroid);
  };

  return (
    <main className="relative bg-black select-none">
      {/* Floating Glassmorphism Back Button */}
      {selectedAsteroid && (
        <button
          onClick={() => setSelectedAsteroid(null)}
          className="fixed top-6 left-6 z-50 flex items-center gap-2 px-4 py-2.5 font-mono text-xs font-semibold tracking-wider text-slate-300 bg-black/50 hover:bg-black/75 border border-slate-700/35 hover:border-slate-500/60 rounded shadow-[0_0_20px_rgba(0,0,0,0.6)] backdrop-blur transition-all duration-300 group cursor-pointer"
        >
          <svg
            className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors transform group-hover:-translate-x-0.5 duration-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>RETURN TO ORBIT SYSTEM</span>
        </button>
      )}

      {/* Section 1: Hero — Full-bleed 3D Earth + Asteroids */}
      <section className="snap-section relative h-screen">
        <OrbitScene
          selectedAsteroid={selectedAsteroid}
          onSelectAsteroid={handleSelectAsteroid}
          hoveredRingIndex={hoveredRingIndex}
          onHoverRing={setHoveredRingIndex}
        />
        <HeroOverlay />
      </section>

      {/* Section 2: Strategic Rankings */}
      <StrategicRankings />

      {/* Section 3: Agent Activity */}
      <AgentActivity />

      {/* Section 4: Market Intelligence */}
      <MarketIntel />
    </main>
  );
}
