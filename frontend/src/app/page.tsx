"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { HeroOverlay } from "@/components/sections/HeroOverlay";
import { StrategicRankings } from "@/components/sections/StrategicRankings";
import { AgentActivity } from "@/components/sections/AgentActivity";
import { MarketIntel } from "@/components/sections/MarketIntel";
import { AsteroidDetail } from "@/components/HUD/AsteroidDetail";
import { RouteDetailPopup } from "@/components/HUD/RouteDetailPopup";
import { AsteroidData } from "@/components/Map3D/AsteroidBelt";
import { useOrebitWebSocket, Scenario, MissionRoute } from "@/hooks/useWebSockets";
import { BACKEND_URL, WS_URL } from "@/lib/config";

const OrbitScene = dynamic(() => import("@/components/Map3D/OrbitScene"), {
  ssr: false,
});

export default function Home() {
  const [selectedAsteroid, setSelectedAsteroid] = useState<AsteroidData | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<MissionRoute | null>(null);
  const [hoveredRingIndex, setHoveredRingIndex] = useState<number | null>(null);
  const [activeScenarios, setActiveScenarios] = useState<Scenario[]>([]);

  const { marketPrices, rankings, routes, agentStatuses } = useOrebitWebSocket(`${WS_URL}/feed`);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/scenarios`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.scenarios)) {
          setActiveScenarios(data.scenarios.filter((s: Scenario) => s.active));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedRoute) setSelectedRoute(null);
        else setSelectedAsteroid(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRoute]);

  return (
    <main className="relative bg-black select-none">
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

      {/* Fixed 3D scene as background layer */}
      <div className="fixed inset-0 z-0">
        <OrbitScene
          selectedAsteroid={selectedAsteroid}
          onSelectAsteroid={setSelectedAsteroid}
          hoveredRingIndex={hoveredRingIndex}
          onHoverRing={setHoveredRingIndex}
          routes={routes}
        />
      </div>

      {/* Hero section with transparent overlay */}
      <section className="snap-section relative h-screen z-10">
        <HeroOverlay />
        <AsteroidDetail
          selectedAsteroid={selectedAsteroid}
          onClose={() => setSelectedAsteroid(null)}
        />
      </section>

      {/* Content sections scroll over the 3D scene */}
      <StrategicRankings rankings={rankings} routes={routes} onRouteClick={setSelectedRoute} />
      <AgentActivity agentStatuses={agentStatuses} />
      <MarketIntel
        prices={marketPrices}
        activeScenarios={activeScenarios}
        onScenarioInjected={(sc) => setActiveScenarios((p) => [sc, ...p])}
        onScenarioRemoved={(id) => setActiveScenarios((p) => p.filter((s) => s.id !== id))}
      />

      {/* Route Detail Popup */}
      <RouteDetailPopup route={selectedRoute} onClose={() => setSelectedRoute(null)} />
    </main>
  );
}
