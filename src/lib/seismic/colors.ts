import { magValue } from "../utils";

/** Magnitude → fill color (restrained seismic palette). */
export function magColor(mag: number | null | undefined): string {
  if (mag == null || Number.isNaN(mag)) return "var(--color-mag-nd)";
  if (mag >= 4.5) return "var(--color-mag-critical)";
  if (mag >= 3.5) return "var(--color-mag-high)";
  if (mag >= 2.5) return "var(--color-mag-mid)";
  if (mag >= 1.5) return "var(--color-mag-low)";
  return "var(--color-mag-micro)";
}

/** Depth → fill color (shallow = warm, deeper = cool — CF is shallow-dominated). */
export function depthColor(depthKm: number, shallow = 1.5, deep = 5): string {
  if (depthKm <= shallow) return "var(--color-depth-shallow)";
  if (depthKm >= deep) return "var(--color-depth-deep)";
  return "var(--color-depth-mid)";
}

/**
 * Time-age color matching INGV GOSSIP Localizzazioni legend style:
 * recent = red, mid = yellow/orange, older = green.
 * `age01` is 0 (newest) → 1 (oldest in the current window).
 */
export function timeAgeColor(age01: number): string {
  const t = Math.max(0, Math.min(1, age01));
  if (t < 0.15) return "#e53935"; // recent red
  if (t < 0.35) return "#fb8c00"; // orange
  if (t < 0.55) return "#fdd835"; // yellow
  if (t < 0.75) return "#9ccc65"; // lime
  return "#43a047"; // green older
}

export function eventAge01(time: number, tMin: number, tMax: number): number {
  if (tMax <= tMin) return 0;
  return (tMax - time) / (tMax - tMin);
}

/** Marker radius — floor high enough that micro-events stay visible on the map. */
export function magRadius(mag: number | null | undefined, min = 5, max = 22): number {
  const m = magValue(mag, 0.3);
  const t = Math.max(0, Math.min(1, (m - 0.3) / 4.5));
  return min + t * t * (max - min);
}

/** Pixel radius for Leaflet circle markers (slightly larger for basemap context). */
export function leafletMagRadius(mag: number | null | undefined): number {
  return magRadius(mag, 4, 18);
}
