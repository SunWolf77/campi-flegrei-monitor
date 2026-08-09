/**
 * Phase A SWIR pack loader — STAC search (Planetary Computer) + product URLs.
 * Cached in-memory per node (6 h). No API key required for public PC endpoints.
 */

import { getFocusNode } from "@/lib/seismic/focus-nodes";
import type { FocusNodeId } from "@/lib/seismic/types";
import {
  SWIR_PRODUCT_META,
  copernicusBrowserUrl,
  emptySwirPack,
  swirBboxForNode,
  type SwirPack,
  type SwirProduct,
  type SwirProductId,
} from "@/lib/eo/swir";

const PC_STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
const PC_DATA = "https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CLOUD = 45;
const UA = "SunEarthSentinel-CF-Monitor/1.0 (Phase-A SWIR; educational EO)";

type CacheEntry = { pack: SwirPack; expires: number };
const cache = new Map<string, CacheEntry>();

type PcFeature = {
  id: string;
  properties?: Record<string, unknown>;
  bbox?: number[];
  assets?: Record<string, { href?: string }>;
  links?: { rel?: string; href?: string }[];
};

function productImageUrl(
  itemId: string,
  product: SwirProductId,
  bbox: [number, number, number, number],
): string {
  const u = new URL(PC_DATA);
  u.searchParams.set("collection", "sentinel-2-l2a");
  u.searchParams.set("item", itemId);
  u.searchParams.set("format", "png");
  u.searchParams.set("bbox", bbox.join(","));
  u.searchParams.set("width", "640");
  u.searchParams.set("height", "640");

  if (product === "truecolor") {
    u.searchParams.append("assets", "B04");
    u.searchParams.append("assets", "B03");
    u.searchParams.append("assets", "B02");
    u.searchParams.set(
      "color_formula",
      "Gamma RGB 3.2 Saturation 0.8 Sigmoidal RGB 25 0.35",
    );
  } else if (product === "geology") {
    u.searchParams.append("assets", "B12");
    u.searchParams.append("assets", "B11");
    u.searchParams.append("assets", "B04");
    u.searchParams.set(
      "color_formula",
      "Gamma RGB 2.5 Sigmoidal RGB 12 0.35",
    );
  } else {
    // heat accent — SWIR / NIR / Red
    u.searchParams.append("assets", "B12");
    u.searchParams.append("assets", "B08");
    u.searchParams.append("assets", "B04");
    u.searchParams.set(
      "color_formula",
      "Gamma RGB 2.2 Sigmoidal RGB 15 0.4",
    );
  }
  return u.toString();
}

function buildProducts(
  itemId: string,
  bbox: [number, number, number, number],
): SwirProduct[] {
  return (["truecolor", "geology", "heat"] as SwirProductId[]).map((id) => ({
    id,
    label: SWIR_PRODUCT_META[id].label,
    blurb: SWIR_PRODUCT_META[id].blurb,
    bands: SWIR_PRODUCT_META[id].bands,
    imageUrl: productImageUrl(itemId, id, bbox),
  }));
}

async function searchLatestScene(
  bbox: [number, number, number, number],
): Promise<PcFeature | null> {
  const body = {
    collections: ["sentinel-2-l2a"],
    bbox,
    query: { "eo:cloud_cover": { lt: MAX_CLOUD } },
    sortby: [{ field: "datetime", direction: "desc" as const }],
    limit: 5,
  };

  const res = await fetch(PC_STAC, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/geo+json, application/json",
      "User-Agent": UA,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`STAC search ${res.status}`);
  }
  const json = (await res.json()) as { features?: PcFeature[] };
  const features = json.features ?? [];
  if (features.length === 0) return null;

  // Prefer lowest cloud among the latest few
  const ranked = [...features].sort((a, b) => {
    const ca = Number(a.properties?.["eo:cloud_cover"] ?? 99);
    const cb = Number(b.properties?.["eo:cloud_cover"] ?? 99);
    const ta = String(a.properties?.datetime ?? "");
    const tb = String(b.properties?.datetime ?? "");
    // primarily recency (list already desc), then cloud
    if (ta !== tb) return ta < tb ? 1 : -1;
    return ca - cb;
  });
  // first is newest; among top 3 pick lowest cloud
  const top = features.slice(0, 3);
  top.sort(
    (a, b) =>
      Number(a.properties?.["eo:cloud_cover"] ?? 99) -
      Number(b.properties?.["eo:cloud_cover"] ?? 99),
  );
  return top[0] ?? ranked[0] ?? null;
}

export async function loadSwirPack(nodeId: FocusNodeId): Promise<SwirPack> {
  const bbox = swirBboxForNode(nodeId);
  if (!bbox) {
    return emptySwirPack(
      nodeId,
      "SWIR Phase A is enabled for Campi Flegrei and Vesuvius only",
    );
  }

  const hit = cache.get(nodeId);
  if (hit && hit.expires > Date.now()) {
    return hit.pack;
  }

  try {
    const feature = await searchLatestScene(bbox);
    if (!feature) {
      const empty = emptySwirPack(
        nodeId,
        `No Sentinel-2 L2A scene with cloud < ${MAX_CLOUD}% in STAC search`,
      );
      cache.set(nodeId, { pack: empty, expires: Date.now() + 30 * 60_000 });
      return empty;
    }

    const props = feature.properties ?? {};
    const sceneTime =
      typeof props.datetime === "string" ? props.datetime : null;
    const cloud =
      typeof props["eo:cloud_cover"] === "number"
        ? props["eo:cloud_cover"]
        : typeof props["eo:cloud_cover"] === "string"
          ? Number(props["eo:cloud_cover"])
          : null;
    const tile =
      typeof props["s2:mgrs_tile"] === "string"
        ? props["s2:mgrs_tile"]
        : typeof props["s2:mgrs_tile"] === "number"
          ? String(props["s2:mgrs_tile"])
          : null;

    let ageDays: number | null = null;
    if (sceneTime) {
      const t = Date.parse(sceneTime);
      if (Number.isFinite(t)) ageDays = (Date.now() - t) / 86_400_000;
    }

    const node = getFocusNode(nodeId);
    const stacSelf =
      feature.links?.find((l) => l.rel === "self")?.href ??
      `https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/${feature.id}`;
    const explorer =
      feature.links?.find((l) => l.rel === "preview")?.href ??
      `https://planetarycomputer.microsoft.com/api/data/v1/item/map?collection=sentinel-2-l2a&item=${encodeURIComponent(feature.id)}`;

    const pack: SwirPack = {
      nodeId,
      ok: true,
      sceneTime,
      sceneId: feature.id,
      cloudCoverPct:
        cloud != null && Number.isFinite(cloud) ? Number(cloud) : null,
      ageDays,
      tile,
      products: buildProducts(feature.id, bbox),
      stacUrl: stacSelf,
      browserUrl: copernicusBrowserUrl(node.center.lat, node.center.lon, 13),
      explorerUrl: explorer,
      attribution:
        "Contains modified Copernicus Sentinel data · Microsoft Planetary Computer",
      note:
        "Phase A · latest low-cloud S2 L2A over node AOI. Heat accent is SWIR contrast, not calibrated temperature. Not a thermal alert.",
      fetchedAt: Date.now(),
      cacheTtlSec: Math.round(CACHE_TTL_MS / 1000),
    };

    cache.set(nodeId, { pack, expires: Date.now() + CACHE_TTL_MS });
    return pack;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SWIR pack failed";
    const empty = emptySwirPack(nodeId, msg);
    cache.set(nodeId, { pack: empty, expires: Date.now() + 10 * 60_000 });
    return empty;
  }
}

/** Invalidate cache (cron / tests). */
export function clearSwirCache(nodeId?: FocusNodeId): void {
  if (nodeId) cache.delete(nodeId);
  else cache.clear();
}
