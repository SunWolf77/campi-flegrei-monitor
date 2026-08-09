/**
 * Phase D1 — Sentinel-1 RTC amplitude pack (VV · VH · false-color).
 * STAC: Planetary Computer `sentinel-1-rtc`. Not InSAR displacement.
 */

import type { FocusNodeId } from "@/lib/seismic/types";
import { swirBboxForNode } from "@/lib/eo/swir";

export type SarProductId = "vv" | "vh" | "rgb";

export type SarProduct = {
  id: SarProductId;
  label: string;
  blurb: string;
  bands: string;
  imageUrl: string;
};

export type SarPack = {
  nodeId: FocusNodeId;
  ok: boolean;
  sceneId: string | null;
  sceneTime: string | null;
  ageDays: number | null;
  platform: string | null;
  orbitState: string | null;
  relativeOrbit: number | null;
  polarizations: string[];
  products: SarProduct[];
  stacUrl: string | null;
  explorerUrl: string | null;
  browserUrl: string | null;
  attribution: string;
  note: string;
  error?: string;
  fetchedAt: number;
  cacheTtlSec: number;
};

export const SAR_PRODUCT_META: Record<
  SarProductId,
  { label: string; blurb: string; bands: string }
> = {
  vv: {
    label: "VV",
    blurb: "Co-pol amplitude · structure, water, urban roughness",
    bands: "VV γ⁰ (RTC)",
  },
  vh: {
    label: "VH",
    blurb: "Cross-pol amplitude · volume / vegetation sensitivity",
    bands: "VH γ⁰ (RTC)",
  },
  rgb: {
    label: "False color",
    blurb: "VV+VH composite stretch · radar context (not optical RGB)",
    bands: "VV · VH composite",
  },
};

export const SAR_PRODUCT_ORDER: SarProductId[] = ["vv", "vh", "rgb"];

/** Reuse optical AOIs for CF/VE focus boxes. */
export function sarBboxForNode(
  nodeId: FocusNodeId,
): [number, number, number, number] | null {
  return swirBboxForNode(nodeId);
}

export function emptySarPack(nodeId: FocusNodeId, error?: string): SarPack {
  return {
    nodeId,
    ok: false,
    sceneId: null,
    sceneTime: null,
    ageDays: null,
    platform: null,
    orbitState: null,
    relativeOrbit: null,
    polarizations: [],
    products: [],
    stacUrl: null,
    explorerUrl: null,
    browserUrl: null,
    attribution:
      "Contains modified Copernicus Sentinel data · Microsoft Planetary Computer (RTC)",
    note:
      "Phase D1 · S1 RTC amplitude only — not interferometric displacement or a deformation alert.",
    error,
    fetchedAt: Date.now(),
    cacheTtlSec: 0,
  };
}

export function sarBrowserUrl(lat: number, lon: number, zoom = 12): string {
  const u = new URL("https://browser.dataspace.copernicus.eu/");
  u.searchParams.set("zoom", String(zoom));
  u.searchParams.set("lat", lat.toFixed(4));
  u.searchParams.set("lng", lon.toFixed(4));
  u.searchParams.set("themeId", "DEFAULT-THEME");
  u.searchParams.set("datasetId", "SENTINEL-1-GRD");
  return u.toString();
}
