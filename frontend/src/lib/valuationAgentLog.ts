const PREFIX = "[AGENT1]";

export function formatValuationStatusLine(message: string): string {
  const trimmed = message.trim();
  if (trimmed.startsWith(PREFIX)) return trimmed;
  return `${PREFIX} ${trimmed}`;
}

export interface Agent1CompletePayload {
  valuations_count: number;
  deep_research_count?: number;
  fast_valuation_count?: number;
  elapsed_seconds: number;
}

export function buildAgent1CompleteLogLines(payload: Agent1CompletePayload): string[] {
  const deep = payload.deep_research_count ?? 0;
  const fast = payload.fast_valuation_count ?? 0;
  const elapsed = Math.round(payload.elapsed_seconds);

  return [
    `${PREFIX} ══════════════════════════════════════════════════════════════`,
    `${PREFIX} Run complete: ${payload.valuations_count} total valuations in ${elapsed}s`,
    `${PREFIX}   - Deep research: ${deep} asteroids`,
    `${PREFIX}   - Fast fallback: ${fast} asteroids`,
    `${PREFIX} ══════════════════════════════════════════════════════════════`,
    `${PREFIX} Signalling Agent 3 to run`,
  ];
}
