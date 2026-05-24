import type { MarketPrice, MissionRoute, RankedAsteroid } from "@/types/orebit";
import { DEMO_ROUTE_ID, MOCK_ROUTE_ID } from "@/lib/mockRoutes";

export { DEMO_ROUTE_ID, MOCK_ROUTE_ID };

export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/** Backend / WebSocket routes only (excludes client mock and demo preview routes). */
export function filterLiveRoutes(routes?: MissionRoute[]): MissionRoute[] {
  return (routes ?? []).filter(
    (r) => r.id !== MOCK_ROUTE_ID && r.id !== DEMO_ROUTE_ID
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
