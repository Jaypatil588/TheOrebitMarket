import type { MissionRoute } from "@/types/orebit";
import { MOCK_ROUTE } from "@/lib/mockRoutes";
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
const MOCK_ANGLE_OFFSETS: Record<string, number> = {
  "20000016": 0,
  "20000002": 0.55,
  "20000001": 0,
  "20000010": 0.55,
};

export { DEMO_ROUTE_ASTEROID_IDS };

export function isMockRouteOnly(routes?: MissionRoute[]): boolean {
  return !hasLiveRoutes(routes);
}

/** Map/3D preview routes — demo override when phrase triggered; mock only if backend has none. */
export function getDisplayRoutes(
  routes?: MissionRoute[],
  options?: { demoActive?: boolean }
): MissionRoute[] {
  const live = filterLiveRoutes(routes);
  if (options?.demoActive) {
    return [{ ...DEMO_ROUTE, is_default: true }, ...live];
  }
  if (live.length > 0) return live;
  return [MOCK_ROUTE];
}

/** Camera-facing placement for mock or demo routes on the 3D belt */
export function needsRoutePlacement(routes?: MissionRoute[], demoActive?: boolean): boolean {
  if (demoActive) return true;
  return isMockRouteOnly(routes);
}

export function applyMockRouteCameraFacingAngle<T extends { id: string; angle: number }>(
  asteroid: T
): T {
  const offset = MOCK_ANGLE_OFFSETS[asteroid.id];
  if (offset === undefined) return asteroid;
  return { ...asteroid, angle: CAMERA_FACING_ORBIT_ANGLE + offset };
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
