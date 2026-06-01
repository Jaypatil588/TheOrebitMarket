import type { MarketPrice, MissionRoute, RankedAsteroid } from "@/types/orebit";
import { DEMO_ROUTE_ID, MOCK_ROUTE_ID, ALL_MOCK_ROUTES } from "@/lib/mockRoutes";

export { DEMO_ROUTE_ID, MOCK_ROUTE_ID };

const ALL_MOCK_IDS = new Set([DEMO_ROUTE_ID, ...ALL_MOCK_ROUTES.map((r) => r.id)]);

export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/** Backend / WebSocket routes only (excludes client mock and demo preview routes). */
export function filterLiveRoutes(routes?: MissionRoute[]): MissionRoute[] {
  return (routes ?? []).filter(
    (r) => !ALL_MOCK_IDS.has(r.id)
  );
}

export function hasLiveRoutes(routes?: MissionRoute[]): boolean {
  return filterLiveRoutes(routes).length > 0;
}

export function hasLivePrices(prices?: MarketPrice[]): boolean {
  return isNonEmptyArray(prices);
}

export function hasLiveRankings(rankings?: RankedAsteroid[]): boolean {
  return isNonEmptyArray(rankings);
}
