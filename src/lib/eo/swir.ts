/**
 * Sentinel-2 EO pack — types + pure helpers.
 * Live STAC search + product URL build lives in swirServer / API routes.
 *
 * Phase A composites (Sentinel-2 L2A · Planetary Computer data API):
 * - truecolor  B04·B03·B02
 * - geology    B12·B11·B04  (SWIR composite)
 * - heat       B12·B08·B04  (SWIR / NIR heat-accent proxy)
 *
 * Phase B spectral indices (same scene / STAC pipeline):
 * - ndvi  (B08−B04)/(B08+B04)  · greenness
 * - ndmi  (B08−B11)/(B08+B11)  · moisture
 * - nbr   (B08−B12)/(B08+B12)  · burn / bare contrast
 *
 * Not a forecast. Not GOSSIP authority. Copernicus open data.
 */

import type { FocusNodeId } from "@/lib/seismic/types";

export type SwirProductId =
  | "truecolor"
  | "geology"
  | "heat"
  | "ndvi"
  | "ndmi"
  | "nbr";

export type SwirProductPhase = "A" | "B";

export type SwirProduct = {
  id: SwirProductId;
  phase: SwirProductPhase;
  label: string;
  blurb: string;
  /** Browser-displayable PNG (Planetary Computer data API) */
  imageUrl: string;
  bands: string;
  formula?: string;
};

export type SwirPack = {
  nodeId: FocusNodeId;
  ok: boolean;
  /** ISO scene acquisition time */
  sceneTime: string | null;
  sceneId: string | null;
  cloudCoverPct: number | null;
  /** days since acquisition (float) */
  ageDays: number | null;
  tile: string | null;
  products: SwirProduct[];
  /** STAC item page */
  stacUrl: string | null;
  /** Copernicus Browser deep link for interactive EO */
  browserUrl: string | null;
  /** External map explorer for this item */
  explorerUrl: string | null;
  attribution: string;
  note: string;
  error?: string;
  fetchedAt: number;
  cacheTtlSec: number;
};

export const SWIR_PRODUCT_META: Record<
  SwirProductId,
  {
    label: string;
    blurb: string;
    bands: string;
    phase: SwirProductPhase;
    formula?: string;
  }
> = {
  truecolor: {
    phase: "A",
    label: "True color",
    blurb: "Natural colour context over the focus box",
    bands: "B04 · B03 · B02",
  },
  geology: {
    phase: "A",
    label: "Geology SWIR",
    blurb: "B12–B11–B04 · rock / soil / moisture contrast",
    bands: "B12 · B11 · B04",
  },
  heat: {
    phase: "A",
    label: "Heat accent",
    blurb: "SWIR–NIR–Red · high-T / bare / anomaly contrast (not °C)",
    bands: "B12 · B08 · B04",
  },
  ndvi: {
    phase: "B",
    label: "NDVI",
    blurb: "Greenness · healthy veg high; bare rock / towns low",
    bands: "B08 · B04",
    formula: "(B08 − B04) / (B08 + B04)",
  },
  ndmi: {
    phase: "B",
    label: "NDMI",
    blurb: "Moisture · canopy/soil water contrast via NIR–SWIR1",
    bands: "B08 · B11",
    formula: "(B08 − B11) / (B08 + B11)",
  },
  nbr: {
    phase: "B",
    label: "NBR",
    blurb: "Burn / bare contrast via NIR–SWIR2 (single-date; not dNBR)",
    bands: "B08 · B12",
    formula: "(B08 − B12) / (B08 + B12)",
  },
};

/** Display order: Phase A composites then Phase B indices */
export const SWIR_PRODUCT_ORDER: SwirProductId[] = [
  "truecolor",
  "geology",
  "heat",
  "ndvi",
  "ndmi",
  "nbr",
];

export const SWIR_PHASE_A: SwirProductId[] = ["truecolor", "geology", "heat"];
export const SWIR_PHASE_B: SwirProductId[] = ["ndvi", "ndmi", "nbr"];

/** AOI for STAC search + preview bbox (lon/lat). */
export function swirBboxForNode(
  nodeId: FocusNodeId,
): [number, number, number, number] | null {
  if (nodeId === "campi-flegrei") {
    // Caldera + Solfatara / Pisciarelli (slightly wider than mapView for context)
    return [14.08, 40.79, 14.20, 40.86];
  }
  if (nodeId === "vesuvius") {
    return [14.35, 40.785, 14.51, 40.86];
  }
  return null;
}

export function emptySwirPack(
  nodeId: FocusNodeId,
  error?: string,
): SwirPack {
  return {
    nodeId,
    ok: false,
    sceneTime: null,
    sceneId: null,
    cloudCoverPct: null,
    ageDays: null,
    tile: null,
    products: [],
    stacUrl: null,
    browserUrl: null,
    explorerUrl: null,
    attribution:
      "Contains modified Copernicus Sentinel data · rendered via Microsoft Planetary Computer",
    note:
      "Phase A+B EO pack — observational only; indices are single-date, not alerts.",
    error,
    fetchedAt: Date.now(),
    cacheTtlSec: 0,
  };
}

export function copernicusBrowserUrl(
  lat: number,
  lon: number,
  zoom = 13,
): string {
  const u = new URL("https://browser.dataspace.copernicus.eu/");
  u.searchParams.set("zoom", String(zoom));
  u.searchParams.set("lat", lat.toFixed(4));
  u.searchParams.set("lng", lon.toFixed(4));
  u.searchParams.set("themeId", "DEFAULT-THEME");
  u.searchParams.set("datasetId", "SENTINEL-2-L2A");
  return u.toString();
}
