/**
 * Shared basemap tile config — faster loads + less jank while panning/zooming.
 *
 * - updateWhenIdle: only refresh tiles after pan/zoom settles
 * - keepBuffer: retain adjacent tiles for smoother panning
 * - detectRetina: hi-dpi when available without over-fetching
 * Default: Esri World Imagery (satellite 2D) for all nodes.
 * User preference is cached in localStorage via prefs.ts and overrides the default.
 */

export type BasemapKind = "satellite" | "voyager" | "dark" | "osm";

export function basemapTileUrl(kind: BasemapKind = "satellite"): string {
  if (kind === "osm") {
    return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  }
  if (kind === "dark") {
    return "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  }
  if (kind === "voyager") {
    return "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  }
  // Esri World Imagery — free, no key, 2D satellite
  return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
}

export function basemapAttribution(kind: BasemapKind = "satellite"): string {
  if (kind === "osm") {
    return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  }
  if (kind === "satellite") {
    return "Tiles &copy; Esri";
  }
  return (
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · ' +
    '&copy; <a href="https://carto.com/attributions">CARTO</a>'
  );
}

/** Leaflet tileLayer options tuned for dashboard maps. */
export function basemapTileOptions(kind: BasemapKind = "satellite"): {
  maxZoom: number;
  maxNativeZoom: number;
  minZoom: number;
  updateWhenIdle: boolean;
  updateWhenZooming: boolean;
  keepBuffer: number;
  detectRetina: boolean;
  crossOrigin: boolean;
  attribution: string;
  subdomains?: string;
} {
  const base = {
    maxZoom: kind === "satellite" ? 18 : 19,
    maxNativeZoom: kind === "satellite" ? 18 : 19,
    minZoom: 3,
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 2,
    detectRetina: kind !== "satellite",
    crossOrigin: true,
    attribution: basemapAttribution(kind),
  };
  if (kind === "satellite") return base;
  return {
    ...base,
    subdomains: kind === "osm" ? "abc" : "abcd",
  };
}

/**
 * Hard default when no localStorage preference exists.
 * Satellite 2D for every focus node (CF, VE, TK, …).
 */
export function defaultBasemapForNode(_nodeId?: string): BasemapKind {
  return "satellite";
}
