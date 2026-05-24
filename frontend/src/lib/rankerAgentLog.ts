import type { MissionRoute, RankedAsteroid } from "@/types/orebit";

const PREFIX = "[AGENT3]";
const NAME_WIDTH = 20;
const MINERAL_WIDTH = 12;
const ROUTE_LABEL_WIDTH = 25;
const URGENCY_SHIFT_THRESHOLD = 0.05;

function padEnd(str: string, width: number): string {
  if (str.length >= width) return str.slice(0, width);
  return str.padEnd(width);
}

function formatUsd(value: number): string {
  return `$${value.toExponential(2)}`;
}

export function formatRankerStatusLine(message: string): string {
  const trimmed = message.trim();
  if (trimmed.startsWith(PREFIX)) return trimmed;
  return `${PREFIX} ${trimmed}`;
}

function formatRankLine(r: RankedAsteroid): string {
  return `${PREFIX} Rank #${String(r.rank).padStart(2)} ${padEnd(r.name, NAME_WIDTH)} score=${r.composite_score.toFixed(3)} val=${formatUsd(r.net_value_usd)} mineral=${padEnd(r.top_mineral, MINERAL_WIDTH)} dv=${r.delta_v_km_s.toFixed(2)} boosted=${r.scenario_boosted}`;
}

function formatRouteLine(route: MissionRoute): string {
  return `${PREFIX} Route: ${padEnd(route.label, ROUTE_LABEL_WIDTH)} urgency=${route.urgency_score.toFixed(2)} stops=${route.stops.length} net=${formatUsd(route.totals.net_return_usd)} default=${route.is_default} scenario=${route.scenario_driven}`;
}

function formatUrgencyShiftLine(name: string, prev: number, next: number): string {
  const delta = next - prev;
  const sign = delta >= 0 ? "+" : "";
  return `${PREFIX} URGENCY SHIFT: ${name} ${prev.toFixed(3)} → ${next.toFixed(3)} (${sign}${delta.toFixed(3)})`;
}

function formatHighUrgencyLine(mineral: string, urgency: number): string {
  return `${PREFIX}   HIGH urgency: ${padEnd(mineral, MINERAL_WIDTH)} ${urgency.toFixed(3)}`;
}

export function buildRankingsUpdateLogLines(
  rankings: RankedAsteroid[],
  routes: MissionRoute[],
  previousUrgency: Map<string, number>
): { lines: string[]; nextPrevious: Map<string, number> } {
  const lines: string[] = [];
  const nextPrevious = new Map(previousUrgency);

  lines.push(`${PREFIX} Results: ${rankings.length} rankings, ${routes.length} routes`);

  const highUrgencyMinerals = new Set<string>();
  for (let i = 0; i < Math.min(10, rankings.length); i++) {
    const r = rankings[i];
    lines.push(formatRankLine(r));

    const prev = previousUrgency.get(r.asteroid_id);
    if (prev != null && Math.abs(r.mineral_urgency - prev) >= URGENCY_SHIFT_THRESHOLD) {
      lines.push(formatUrgencyShiftLine(r.name, prev, r.mineral_urgency));
    }
    nextPrevious.set(r.asteroid_id, r.mineral_urgency);

    if (r.mineral_urgency > 0.5) {
      highUrgencyMinerals.add(r.top_mineral);
    }
  }

  for (const mineral of Array.from(highUrgencyMinerals)) {
    const sample = rankings.find((r) => r.top_mineral === mineral);
    if (sample) {
      lines.push(formatHighUrgencyLine(mineral, sample.mineral_urgency));
    }
  }

  for (const route of routes) {
    lines.push(formatRouteLine(route));
  }

  if (rankings.length > 0) {
    lines.push(`${PREFIX} DB: strategic ranking saved`);
    lines.push(
      `${PREFIX} Broadcast sent to frontend | ${rankings.length} rankings, ${routes.length} routes`
    );
  }

  return { lines, nextPrevious };
}
