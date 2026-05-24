import type { AsteroidData } from "@/components/Map3D/AsteroidBelt";
import type { RankedAsteroid } from "@/types/orebit";

/** Minimal AsteroidData for HUD detail when selecting from rankings (no 3D belt position). */
export function rankedToAsteroidData(rank: RankedAsteroid): AsteroidData {
  return {
    id: rank.asteroid_id,
    name: rank.name,
    ringIndex: 0,
    angle: 0,
    orbitSpeed: 0,
    size: 1,
    mass: 0,
    composition: {},
    valueUSD: rank.net_value_usd,
    spec_type: rank.spec_type,
    x: 0,
    y: 0,
    z: 0,
  };
}

/** Normalize base64 or data-URL image payloads from Agent 4 / route-images. */
export function toImageSrc(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:") || trimmed.startsWith("http")) return trimmed;
  return `data:image/png;base64,${trimmed}`;
}
