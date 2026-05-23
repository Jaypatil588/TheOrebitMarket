import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines Tailwind classes cleanly, resolving conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats coordinates for 3D telemetry overlay
 */
export function formatCoordinates(x: number, y: number, z: number): string {
  const pad = (n: number) => {
    const sign = n >= 0 ? "+" : "";
    return sign + n.toFixed(4);
  };
  return `X:${pad(x)} Y:${pad(y)} Z:${pad(z)}`;
}

/**
 * Format timestamp in UTC telemetry style
 */
export function formatTelemetryTime(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const hh = pad(date.getUTCHours());
  const mm = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  const ms = date.getUTCMilliseconds().toString().padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms} UTC`;
}

/**
 * Formats number of metric tons or values
 */
export function formatTonnage(tons: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(tons) + " MT";
}

/**
 * Formats asteroid value in USD
 */
export function formatValue(usd: number): string {
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  return `$${usd.toLocaleString()}`;
}
