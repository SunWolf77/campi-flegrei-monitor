/**
 * Shared basemap tile config — faster loads + less jank while panning/zooming.
 *
 * - updateWhenIdle: only refresh tiles after pan/zoom settles
 * - keepBuffer: retain adjacent tiles for smoother panning
 * - detectRetina: hi-dpi when available without over-fetching
 * Carto CDN is used as default OSM-style basemap (same OpenStreetMap data,
 * better edge cache than tile.openstreetmap.org for browser clients).
 */

export type BasemapKind = "voyager" | "osm";

export function basemapTileUrl(kind: BasemapKind = "voyager"): string {
  if (kind === "osm") {
    return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  }
  // Voyager — light topographic, good for seismic overlays
  return "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
}

export function basemapAttribution(kind: BasemapKind = "voyager"): string {
  if (kind === "osm") {
    return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  }
  return (
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · ' +
    '&copy; <a href="https://carto.com/attributions">CARTO</a>'
  );
}

/** Leaflet tileLayer options tuned for dashboard maps. */
export function basemapTileOptions(kind: BasemapKind = "voyager"): {
  maxZoom: number;
  maxNativeZoom: number;
  minZoom: number;
  updateWhenIdle: boolean;
  updateWhenZooming: boolean;
  keepBuffer: number;
  detectRetina: boolean;
  crossOrigin: boolean;
  attribution: string;
  subdomains: string;
} {
  return {
    maxZoom: 18,
    maxNativeZoom: 18,
    minZoom: 5,
    // Defer tile requests until interaction ends → less thrash on mobile
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 2,
    detectRetina: true,
    crossOrigin: true,
    attribution: basemapAttribution(kind),
    subdomains: kind === "osm" ? "abc" : "abcd",
  };
}
