/**
 * Phase A SWIR / Sentinel-2 EO pack — types + pure helpers.
 * Live STAC search + product URL build lives in swirServer / API routes.
 *
 * Products (Sentinel-2 L2A via Microsoft Planetary Computer data API):
 * - truecolor  B04·B03·B02
 * - geology    B12·B11·B04  (SWIR composite)
 * - heat       B12·B08·B04  (SWIR / NIR heat-accent proxy)
 *
 * Not a forecast. Not GOSSIP authority. Copernicus open data.
 */

import type { FocusNodeId } from "@/lib/seismic/types";

export type SwirProductId = "truecolor" | "geology" | "heat";

export type SwirProduct = {
  id: SwirProductId;
  label: string;
  blurb: string;
  /** Browser-displayable PNG (Planetary Computer data API or our proxy) */
  imageUrl: string;
  bands: string;
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
  { label: string; blurb: string; bands: string }
> = {
  truecolor: {
    label: "True color",
    blurb: "Natural colour context over the focus box",
    bands: "B04 · B03 · B02",
  },
  geology: {
    label: "Geology SWIR",
    blurb: "B12–B11–B04 · rock / soil / moisture contrast",
    bands: "B12 · B11 · B04",
  },
  heat: {
    label: "Heat accent",
    blurb: "SWIR–NIR–Red · high-T / bare / anomaly contrast (not °C)",
    bands: "B12 · B08 · B04",
  },
};

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
    note: "Phase A SWIR pack — observational only; not a thermal alert service.",
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
