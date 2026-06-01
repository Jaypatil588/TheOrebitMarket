import type { MissionRoute } from "@/types/orebit";
import { MOCK_ROUTE, ALL_MOCK_ROUTES } from "@/lib/mockRoutes";
import { DEMO_ROUTE, DEMO_ROUTE_ASTEROID_IDS } from "@/lib/demoScenario";
import { filterLiveRoutes, hasLiveRoutes } from "@/lib/liveData";

/** Earth center — keep in sync with OrbitScene / AsteroidBelt */
const EARTH_X = -6;
const EARTH_Z = 5;

/** Default orbit camera (OrbitScene Canvas + useCameraControls) */
const CAMERA_X = 3;
const CAMERA_Z = 16;

/** Orbit angle (radians) on the xz belt plane that faces the default camera. */
export const CAMERA_FACING_ORBIT_ANGLE = Math.atan2(
  CAMERA_Z - EARTH_Z,
  CAMERA_X - EARTH_X
);

export const MOCK_ROUTE_ASTEROID_IDS = MOCK_ROUTE.stops
  .map((s) => s.asteroid_id)
  .filter((id): id is string => Boolean(id));

/** Spread stops along the near-side arc so the dashed route reads clearly. */
const PLACEMENT_ANGLE_OFFSETS = [0, 0.55] as const;

export { DEMO_ROUTE_ASTEROID_IDS };

export function isMockRouteOnly(routes?: MissionRoute[]): boolean {
  return !hasLiveRoutes(routes);
}

/** Asteroid IDs whose belt positions should face the default camera for the active route. */
export function getRoutePlacementIds(
  routes?: MissionRoute[],
  demoActive?: boolean
): readonly string[] {
  if (demoActive) return DEMO_ROUTE_ASTEROID_IDS;
  if (isMockRouteOnly(routes)) return MOCK_ROUTE_ASTEROID_IDS;
  return [];
}

/** Map/3D preview routes — demo override when phrase triggered; mock fallback when live empty. */
export function getDisplayRoutes(
  routes?: MissionRoute[],
  options?: { demoActive?: boolean }
): MissionRoute[] {
  const live = filterLiveRoutes(routes);
  if (options?.demoActive) {
    return [{ ...DEMO_ROUTE, is_default: true }, ...live];
  }
  if (live.length > 0) return live;
  return ALL_MOCK_ROUTES.map((r, i) => ({ ...r, is_default: i === 0 }));
}

export function needsRoutePlacement(routes?: MissionRoute[], demoActive?: boolean): boolean {
  return getRoutePlacementIds(routes, demoActive).length > 0;
}

export function applyRouteCameraFacingAngle<T extends { id: string; angle: number }>(
  asteroid: T,
  placementIds: readonly string[]
): T {
  const idx = placementIds.indexOf(asteroid.id);
  if (idx === -1) return asteroid;
  const offset = PLACEMENT_ANGLE_OFFSETS[idx] ?? PLACEMENT_ANGLE_OFFSETS[1];
  return { ...asteroid, angle: CAMERA_FACING_ORBIT_ANGLE + offset };
}

/** @deprecated Use applyRouteCameraFacingAngle with getRoutePlacementIds */
export function applyMockRouteCameraFacingAngle<T extends { id: string; angle: number }>(
  asteroid: T
): T {
  const offset = MOCK_ROUTE_ASTEROID_IDS.indexOf(asteroid.id);
  if (offset === -1) {
    const demoIdx = DEMO_ROUTE_ASTEROID_IDS.indexOf(
      asteroid.id as (typeof DEMO_ROUTE_ASTEROID_IDS)[number]
    );
    if (demoIdx === -1) return asteroid;
    return {
      ...asteroid,
      angle: CAMERA_FACING_ORBIT_ANGLE + (PLACEMENT_ANGLE_OFFSETS[demoIdx] ?? 0.55),
    };
  }
  return {
    ...asteroid,
    angle: CAMERA_FACING_ORBIT_ANGLE + (PLACEMENT_ANGLE_OFFSETS[offset] ?? 0.55),
  };
}

/** Asteroid IDs on a mission route (non-Earth stops with known IDs). */
export function getRouteAsteroidIds(route: MissionRoute): string[] {
  return route.stops
    .map((s) => s.asteroid_id)
    .filter((id): id is string => Boolean(id));
}

/** Default Canvas camera — keep in sync with OrbitScene and useCameraControls. */
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [3, 10, 16];
export const DEFAULT_CAMERA_LOOK_AT: [number, number, number] = [2, 1, 2];
