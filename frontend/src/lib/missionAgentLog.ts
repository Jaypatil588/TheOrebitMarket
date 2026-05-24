import type { MissionReportData } from "@/types/orebit";

const PREFIX = "[AGENT4]";

export function formatMissionStatusLine(message: string): string {
  const trimmed = message.trim();
  if (trimmed.startsWith(PREFIX)) return trimmed;
  return `${PREFIX} ${trimmed}`;
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && !Number.isNaN(value) ? value : 0;
}

function imagePresent(report: Record<string, unknown>, key: string): boolean {
  const direct = safeString(report[key]);
  if (direct.length > 0) return true;

  const nested = safeRecord(report.report);
  const images = safeRecord(nested.images);
  const fromImages = safeString(images[key]);
  return fromImages.length > 0;
}

export function buildMissionReportLogLines(data: MissionReportData): string[] {
  const lines: string[] = [];
  const report = safeRecord(data.report);
  const routeId = safeString(report.route_id) || "unknown";
  const nested = safeRecord(report.report);

  lines.push(`${PREFIX} ── RunAsync start (ON-DEMAND for selected asteroid) ──`);
  lines.push(`${PREFIX} Target: asteroid=${data.asteroid_id} route=${routeId}`);

  if (data.cached) {
    lines.push(`${PREFIX} CACHE HIT | asteroid=${data.asteroid_id}`);
  } else {
    lines.push(`${PREFIX} CACHE MISS — starting Deep Research`);
    lines.push(`${PREFIX} Calling Gemini Deep Research | asteroid=${data.asteroid_id}`);
  }

  const feasibility = safeNumber(nested.feasibility_score);
  const goNoGo = safeRecord(nested.go_no_go);
  const recommendation = safeString(goNoGo.recommendation);

  if (feasibility > 0 || recommendation) {
    lines.push(
      `${PREFIX} Report parsed | feasibility=${feasibility}/10 recommendation=${recommendation || "pending"}`
    );
  }

  const hasRender = imagePresent(report, "asteroid_render");
  const hasComp = imagePresent(report, "composition_map");
  const hasRoute = imagePresent(report, "route_map");
  const hasProfile = imagePresent(report, "physical_profile");

  if (hasRender || hasComp || hasRoute || hasProfile) {
    lines.push(
      `${PREFIX} Images: render=${hasRender} comp=${hasComp} route=${hasRoute} profile=${hasProfile}`
    );
  }

  if (!data.cached) {
    lines.push(`${PREFIX} Report cached to DB`);
  }

  lines.push(`${PREFIX} Broadcast sent to frontend | asteroid=${data.asteroid_id}`);
  lines.push(`${PREFIX} ── Complete ──────────────────────────────────────────`);

  return lines;
}
