/**
 * S2 EO pack loader — STAC search (Planetary Computer) + Phase A/B product URLs.
 * Cached in-memory per node (6 h). No API key required for public PC endpoints.
 */

import { getFocusNode } from "@/lib/seismic/focus-nodes";
import type { FocusNodeId } from "@/lib/seismic/types";
import {
  SWIR_PRODUCT_META,
  SWIR_PRODUCT_ORDER,
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
const UA = "SunEarthSentinel-CF-Monitor/1.0 (Phase-A/B EO; educational)";
/** Bump when product set changes so stale Phase-A-only packs refresh */
const CACHE_VER = "eo-ab-v1";

type CacheEntry = { pack: SwirPack; expires: number };
const cache = new Map<string, CacheEntry>();

type PcFeature = {
  id: string;
  properties?: Record<string, unknown>;
  bbox?: number[];
  assets?: Record<string, { href?: string }>;
  links?: { rel?: string; href?: string }[];
};

function cacheKey(nodeId: FocusNodeId): string {
  return `${CACHE_VER}:${nodeId}`;
}

function basePreviewUrl(
  itemId: string,
  bbox: [number, number, number, number],
): URL {
  const u = new URL(PC_DATA);
  u.searchParams.set("collection", "sentinel-2-l2a");
  u.searchParams.set("item", itemId);
  u.searchParams.set("format", "png");
  u.searchParams.set("bbox", bbox.join(","));
  u.searchParams.set("width", "640");
  u.searchParams.set("height", "640");
  return u;
}

/**
 * Build Planetary Computer preview URL for a product.
 * Phase A = multi-band RGB + color_formula.
 * Phase B = asset_as_band expression + colormap (titiler-style).
 */
function productImageUrl(
  itemId: string,
  product: SwirProductId,
  bbox: [number, number, number, number],
): string {
  const u = basePreviewUrl(itemId, bbox);

  if (product === "truecolor") {
    u.searchParams.append("assets", "B04");
    u.searchParams.append("assets", "B03");
    u.searchParams.append("assets", "B02");
    u.searchParams.set(
      "color_formula",
      "Gamma RGB 3.2 Saturation 0.8 Sigmoidal RGB 25 0.35",
    );
    return u.toString();
  }
  if (product === "geology") {
    u.searchParams.append("assets", "B12");
    u.searchParams.append("assets", "B11");
    u.searchParams.append("assets", "B04");
    u.searchParams.set(
      "color_formula",
      "Gamma RGB 2.5 Sigmoidal RGB 12 0.35",
    );
    return u.toString();
  }
  if (product === "heat") {
    u.searchParams.append("assets", "B12");
    u.searchParams.append("assets", "B08");
    u.searchParams.append("assets", "B04");
    u.searchParams.set(
      "color_formula",
      "Gamma RGB 2.2 Sigmoidal RGB 15 0.4",
    );
    return u.toString();
  }

  // Phase B indices — require asset_as_band=true so expression sees band names
  u.searchParams.set("asset_as_band", "true");
  if (product === "ndvi") {
    u.searchParams.append("assets", "B08");
    u.searchParams.append("assets", "B04");
    u.searchParams.set("expression", "(B08-B04)/(B08+B04)");
    u.searchParams.set("rescale", "-0.2,0.8");
    u.searchParams.set("colormap_name", "rdylgn");
  } else if (product === "ndmi") {
    u.searchParams.append("assets", "B08");
    u.searchParams.append("assets", "B11");
    u.searchParams.set("expression", "(B08-B11)/(B08+B11)");
    u.searchParams.set("rescale", "-0.5,0.5");
    u.searchParams.set("colormap_name", "brbg");
  } else {
    // nbr
    u.searchParams.append("assets", "B08");
    u.searchParams.append("assets", "B12");
    u.searchParams.set("expression", "(B08-B12)/(B08+B12)");
    u.searchParams.set("rescale", "-0.5,0.8");
    u.searchParams.set("colormap_name", "rdylgn");
  }
  return u.toString();
}

function buildProducts(
  itemId: string,
  bbox: [number, number, number, number],
): SwirProduct[] {
  return SWIR_PRODUCT_ORDER.map((id) => {
    const meta = SWIR_PRODUCT_META[id];
    return {
      id,
      phase: meta.phase,
      label: meta.label,
      blurb: meta.blurb,
      bands: meta.bands,
      formula: meta.formula,
      imageUrl: productImageUrl(itemId, id, bbox),
    };
  });
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
  const top = features.slice(0, 3);
  top.sort(
    (a, b) =>
      Number(a.properties?.["eo:cloud_cover"] ?? 99) -
      Number(b.properties?.["eo:cloud_cover"] ?? 99),
  );
  return top[0] ?? null;
}

export async function loadSwirPack(nodeId: FocusNodeId): Promise<SwirPack> {
  const bbox = swirBboxForNode(nodeId);
  if (!bbox) {
    return emptySwirPack(
      nodeId,
      "S2 EO pack is enabled for Campi Flegrei and Vesuvius only",
    );
  }

  const key = cacheKey(nodeId);
  const hit = cache.get(key);
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
      cache.set(key, { pack: empty, expires: Date.now() + 30 * 60_000 });
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
        "Phase A+B · same latest low-cloud S2 L2A scene. Indices are single-date (not dNBR change). Not a thermal or fire alert.",
      fetchedAt: Date.now(),
      cacheTtlSec: Math.round(CACHE_TTL_MS / 1000),
    };

    cache.set(key, { pack, expires: Date.now() + CACHE_TTL_MS });
    return pack;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "EO pack failed";
    const empty = emptySwirPack(nodeId, msg);
    cache.set(key, { pack: empty, expires: Date.now() + 10 * 60_000 });
    return empty;
  }
}

/** Invalidate cache (cron / tests). */
export function clearSwirCache(nodeId?: FocusNodeId): void {
  if (nodeId) cache.delete(cacheKey(nodeId));
  else cache.clear();
}
