import type { MarketPrice } from "@/types/orebit";

const PREFIX = "[AGENT2]";
const MINERAL_WIDTH = 14;
const SHIFT_THRESHOLD_PCT = 2.0;

function padMineral(name: string): string {
  if (name.length >= MINERAL_WIDTH) return name.slice(0, MINERAL_WIDTH);
  return name.padEnd(MINERAL_WIDTH);
}

function formatPriceUsd(price: number): string {
  return `$${price.toFixed(4)}`.padEnd(13);
}

export function formatMineralPriceLine(p: MarketPrice): string {
  const tag = p.scenario_adjusted ? " ⚡SCENARIO" : "";
  const trend = (p.trend || "stable").padEnd(8);
  return `${PREFIX} ${padMineral(p.mineral)} ${formatPriceUsd(p.price_usd)} trend=${trend} urgency=${p.urgency.toFixed(3)} crit=${p.criticality}${tag}`;
}

export function formatDisruptionLine(disruption: string): string {
  return `${PREFIX}   disruption: ${disruption}`;
}

export function formatShiftLine(
  mineral: string,
  changePct: number,
  scenarioAdjusted: boolean
): string {
  const tag = scenarioAdjusted ? " ⚡SCENARIO" : "";
  return `${PREFIX} SHIFT: ${mineral} changed ${changePct.toFixed(2)}%${tag}`;
}

export function formatDbLine(inserted: number, total: number): string {
  return `${PREFIX} DB: inserted ${inserted}/${total} rows`;
}

export function formatBroadcastLine(count: number): string {
  return `${PREFIX} Broadcast sent to frontend | ${count} prices`;
}

export function formatAgentStatusLine(message: string): string {
  const trimmed = message.trim();
  if (trimmed.startsWith(PREFIX)) return trimmed;
  return `${PREFIX} ${trimmed}`;
}

function shiftChangePct(
  p: MarketPrice,
  prevPrice: number | undefined
): number | null {
  if (prevPrice != null && prevPrice > 0) {
    return Math.abs(((p.price_usd - prevPrice) / prevPrice) * 100);
  }
  if (p.change_pct != null && !Number.isNaN(p.change_pct) && p.change_pct !== 0) {
    return Math.abs(p.change_pct);
  }
  return null;
}

function shouldEmitShift(
  p: MarketPrice,
  changePct: number | null
): changePct is number {
  if (p.scenario_adjusted) return changePct != null;
  return changePct != null && changePct >= SHIFT_THRESHOLD_PCT;
}

export function buildMarketUpdateLogLines(
  prices: MarketPrice[],
  previousPrices: Map<string, number>
): { lines: string[]; nextPrevious: Map<string, number> } {
  const lines: string[] = [];
  const nextPrevious = new Map(previousPrices);

  for (const p of prices) {
    lines.push(formatMineralPriceLine(p));
    if (p.disruption?.trim()) {
      lines.push(formatDisruptionLine(p.disruption.trim()));
    }

    const prev = previousPrices.get(p.mineral);
    const changePct = shiftChangePct(p, prev);
    if (shouldEmitShift(p, changePct)) {
      lines.push(formatShiftLine(p.mineral, changePct, p.scenario_adjusted));
    }

    nextPrevious.set(p.mineral, p.price_usd);
  }

  if (prices.length > 0) {
    lines.push(formatDbLine(prices.length, prices.length));
    lines.push(formatBroadcastLine(prices.length));
  }

  return { lines, nextPrevious };
}
