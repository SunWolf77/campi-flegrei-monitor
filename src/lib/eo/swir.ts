/**
 * Sentinel-2 EO pack — types + pure helpers.
 *
 * Phase A composites · Phase B single-date indices · Phase C dual-scene change
 * (dNBR · RdNBR · dNDVI · dNDMI) on the same STAC / Planetary Computer pipeline.
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
  | "nbr"
  | "dnbr"
  | "rdnbr"
  | "dndvi"
  | "dndmi";

export type SwirProductPhase = "A" | "B" | "C";

export type SwirProduct = {
  id: SwirProductId;
  phase: SwirProductPhase;
  label: string;
  blurb: string;
  /** Browser-displayable PNG */
  imageUrl: string;
  bands: string;
  formula?: string;
};

/** Dual-scene pair for Phase C change products */
export type SwirScenePair = {
  postId: string;
  postTime: string | null;
  postCloud: number | null;
  preId: string;
  preTime: string | null;
  preCloud: number | null;
  /** calendar days between acquisitions */
  daysBetween: number | null;
  tile: string | null;
};

export type ChangeSeverityStats = {
  /** mean of pre−post index over AOI pixels */
  mean: number;
  p90: number;
  /** fraction of pixels in rough severity bins (dNBR-style, positive = loss) */
  fracUnburned: number;
  fracLow: number;
  fracModerate: number;
  fracHigh: number;
  samplePixels: number;
};

export type SwirPack = {
  nodeId: FocusNodeId;
  ok: boolean;
  /** ISO scene acquisition time (post / latest) */
  sceneTime: string | null;
  sceneId: string | null;
  cloudCoverPct: number | null;
  ageDays: number | null;
  tile: string | null;
  products: SwirProduct[];
  /** Phase C pair metadata when available */
  pair: SwirScenePair | null;
  /** Optional AOI stats for dNBR (filled when change render runs / pack build) */
  dnbrStats: ChangeSeverityStats | null;
  stacUrl: string | null;
  browserUrl: string | null;
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
    blurb: "Burn / bare contrast via NIR–SWIR2 (single-date)",
    bands: "B08 · B12",
    formula: "(B08 − B12) / (B08 + B12)",
  },
  dnbr: {
    phase: "C",
    label: "dNBR",
    blurb: "NBR_pre − NBR_post · positive ≈ canopy/bare loss (not a fire alert)",
    bands: "B08 · B12 ×2",
    formula: "NBR_pre − NBR_post",
  },
  rdnbr: {
    phase: "C",
    label: "RdNBR",
    blurb: "Relative dNBR severity · dNBR / √|NBR_pre| (Miller & Thode style)",
    bands: "B08 · B12 ×2",
    formula: "dNBR / √|NBR_pre|",
  },
  dndvi: {
    phase: "C",
    label: "dNDVI",
    blurb: "NDVI_pre − NDVI_post · positive ≈ greening loss / browning",
    bands: "B08 · B04 ×2",
    formula: "NDVI_pre − NDVI_post",
  },
  dndmi: {
    phase: "C",
    label: "dNDMI",
    blurb: "NDMI_pre − NDMI_post · positive ≈ moisture loss (surface/canopy)",
    bands: "B08 · B11 ×2",
    formula: "NDMI_pre − NDMI_post",
  },
};

export const SWIR_PRODUCT_ORDER: SwirProductId[] = [
  "truecolor",
  "geology",
  "heat",
  "ndvi",
  "ndmi",
  "nbr",
  "dnbr",
  "rdnbr",
  "dndvi",
  "dndmi",
];

export const SWIR_PHASE_A: SwirProductId[] = ["truecolor", "geology", "heat"];
export const SWIR_PHASE_B: SwirProductId[] = ["ndvi", "ndmi", "nbr"];
export const SWIR_PHASE_C: SwirProductId[] = ["dnbr", "rdnbr", "dndvi", "dndmi"];

/** AOI for STAC search + preview bbox (lon/lat). */
export function swirBboxForNode(
  nodeId: FocusNodeId,
): [number, number, number, number] | null {
  if (nodeId === "campi-flegrei") {
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
    pair: null,
    dnbrStats: null,
    stacUrl: null,
    browserUrl: null,
    explorerUrl: null,
    attribution:
      "Contains modified Copernicus Sentinel data · Microsoft Planetary Computer",
    note:
      "Phase A+B+C EO pack — observational only; change products need a clear pre/post pair.",
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

/** Rough dNBR severity bins (USGS-inspired; urban/caldera — illustrative only). */
export function classifyDnbrSeverity(v: number): "unburned" | "low" | "moderate" | "high" {
  if (v < 0.1) return "unburned";
  if (v < 0.27) return "low";
  if (v < 0.44) return "moderate";
  return "high";
}
