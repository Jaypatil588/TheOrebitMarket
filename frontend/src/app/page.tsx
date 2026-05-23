"use client";

import { useState } from "react";
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

  const handleSelectAsteroid = (asteroid: AsteroidData | null) => {
    setSelectedAsteroid(asteroid);
  };

  return (
    <main className="relative bg-black select-none">

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
