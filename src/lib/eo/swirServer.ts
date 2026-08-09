/**
 * S2 EO pack loader — STAC (Planetary Computer) + Phase A/B/C product URLs.
 * Phase C images are rendered via /api/eo/change-image (dual-scene differencing).
 */

import { changeImageApiUrl } from "@/lib/eo/changeRender";
import { getFocusNode } from "@/lib/seismic/focus-nodes";
import type { FocusNodeId } from "@/lib/seismic/types";
import {
  SWIR_PHASE_C,
  SWIR_PRODUCT_META,
  SWIR_PRODUCT_ORDER,
  copernicusBrowserUrl,
  emptySwirPack,
  swirBboxForNode,
  type SwirPack,
  type SwirProduct,
  type SwirProductId,
  type SwirScenePair,
} from "@/lib/eo/swir";

const PC_STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
const PC_DATA = "https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CLOUD = 45;
const MIN_PAIR_DAYS = 2.5;
const UA = "SunEarthSentinel-CF-Monitor/1.0 (Phase-A/B/C EO)";
const CACHE_VER = "eo-abc-v1";

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

function propCloud(p: Record<string, unknown> | undefined): number {
  const c = p?.["eo:cloud_cover"];
  if (typeof c === "number") return c;
  if (typeof c === "string") return Number(c) || 99;
  return 99;
}

function propTime(p: Record<string, unknown> | undefined): string | null {
  return typeof p?.datetime === "string" ? p.datetime : null;
}

function propTile(p: Record<string, unknown> | undefined): string | null {
  const t = p?.["s2:mgrs_tile"];
  if (typeof t === "string") return t;
  if (typeof t === "number") return String(t);
  return null;
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

function productImageUrl(
  itemId: string,
  product: SwirProductId,
  bbox: [number, number, number, number],
  pair: SwirScenePair | null,
  nodeId: FocusNodeId,
): string {
  // Phase C → our change renderer
  if (SWIR_PHASE_C.includes(product)) {
    if (!pair) return "";
    return changeImageApiUrl(
      nodeId,
      product as "dnbr" | "rdnbr" | "dndvi" | "dndmi",
      pair.preId,
      pair.postId,
    );
  }

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
  postId: string,
  bbox: [number, number, number, number],
  pair: SwirScenePair | null,
  nodeId: FocusNodeId,
): SwirProduct[] {
  return SWIR_PRODUCT_ORDER.map((id) => {
    const meta = SWIR_PRODUCT_META[id];
    const imageUrl = productImageUrl(postId, id, bbox, pair, nodeId);
    return {
      id,
      phase: meta.phase,
      label: meta.label,
      blurb: meta.blurb,
      bands: meta.bands,
      formula: meta.formula,
      imageUrl,
    };
  }).filter((p) => p.imageUrl.length > 0);
}

async function searchFeatures(
  bbox: [number, number, number, number],
  limit = 20,
): Promise<PcFeature[]> {
  const body = {
    collections: ["sentinel-2-l2a"],
    bbox,
    query: { "eo:cloud_cover": { lt: MAX_CLOUD } },
    sortby: [{ field: "datetime", direction: "desc" as const }],
    limit,
  };

  const res = await fetch(PC_STAC, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/geo+json, application/json",
      "User-Agent": UA,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`STAC search ${res.status}`);
  const json = (await res.json()) as { features?: PcFeature[] };
  return json.features ?? [];
}

/**
 * Post = lowest cloud among newest few.
 * Pre = earlier clear scene ≥ MIN_PAIR_DAYS before post (prefer same MGRS tile).
 */
function pickPair(features: PcFeature[]): {
  post: PcFeature;
  pre: PcFeature | null;
} | null {
  if (features.length === 0) return null;
  const top = features.slice(0, 4);
  top.sort((a, b) => propCloud(a.properties) - propCloud(b.properties));
  const post = top[0]!;
  const postT = Date.parse(propTime(post.properties) ?? "");
  if (!Number.isFinite(postT)) return { post, pre: null };

  const postTile = propTile(post.properties);
  const minPre = postT - MIN_PAIR_DAYS * 86_400_000;

  const candidates = features.filter((f) => {
    if (f.id === post.id) return false;
    const t = Date.parse(propTime(f.properties) ?? "");
    return Number.isFinite(t) && t <= minPre;
  });

  if (candidates.length === 0) return { post, pre: null };

  // Prefer same tile, then lowest cloud, then nearest in time to ~10–20 d gap
  const targetGap = 12 * 86_400_000;
  candidates.sort((a, b) => {
    const ta = propTile(a.properties) === postTile ? 0 : 1;
    const tb = propTile(b.properties) === postTile ? 0 : 1;
    if (ta !== tb) return ta - tb;
    const ca = propCloud(a.properties);
    const cb = propCloud(b.properties);
    if (ca !== cb) return ca - cb;
    const da = Math.abs(postT - Date.parse(propTime(a.properties)!) - targetGap);
    const db = Math.abs(postT - Date.parse(propTime(b.properties)!) - targetGap);
    return da - db;
  });

  return { post, pre: candidates[0] ?? null };
}

function toPair(post: PcFeature, pre: PcFeature): SwirScenePair {
  const postTime = propTime(post.properties);
  const preTime = propTime(pre.properties);
  let daysBetween: number | null = null;
  if (postTime && preTime) {
    const dt = Date.parse(postTime) - Date.parse(preTime);
    if (Number.isFinite(dt)) daysBetween = dt / 86_400_000;
  }
  return {
    postId: post.id,
    postTime,
    postCloud: propCloud(post.properties),
    preId: pre.id,
    preTime,
    preCloud: propCloud(pre.properties),
    daysBetween,
    tile: propTile(post.properties) ?? propTile(pre.properties),
  };
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
    const features = await searchFeatures(bbox, 20);
    const picked = pickPair(features);
    if (!picked) {
      const empty = emptySwirPack(
        nodeId,
        `No Sentinel-2 L2A scene with cloud < ${MAX_CLOUD}% in STAC search`,
      );
      cache.set(key, { pack: empty, expires: Date.now() + 30 * 60_000 });
      return empty;
    }

    const { post, pre } = picked;
    const pair = pre ? toPair(post, pre) : null;
    const props = post.properties ?? {};
    const sceneTime = propTime(props);
    const cloud = propCloud(props);
    const tile = propTile(props);

    let ageDays: number | null = null;
    if (sceneTime) {
      const t = Date.parse(sceneTime);
      if (Number.isFinite(t)) ageDays = (Date.now() - t) / 86_400_000;
    }

    const node = getFocusNode(nodeId);
    const stacSelf =
      post.links?.find((l) => l.rel === "self")?.href ??
      `https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/${post.id}`;
    const explorer =
      post.links?.find((l) => l.rel === "preview")?.href ??
      `https://planetarycomputer.microsoft.com/api/data/v1/item/map?collection=sentinel-2-l2a&item=${encodeURIComponent(post.id)}`;

    const pack: SwirPack = {
      nodeId,
      ok: true,
      sceneTime,
      sceneId: post.id,
      cloudCoverPct: Number.isFinite(cloud) ? cloud : null,
      ageDays,
      tile,
      products: buildProducts(post.id, bbox, pair, nodeId),
      pair,
      dnbrStats: null,
      stacUrl: stacSelf,
      browserUrl: copernicusBrowserUrl(node.center.lat, node.center.lon, 13),
      explorerUrl: explorer,
      attribution:
        "Contains modified Copernicus Sentinel data · Microsoft Planetary Computer",
      note: pair
        ? `Phase A+B+C · post ${pair.postTime?.slice(0, 10) ?? "?"} ← pre ${pair.preTime?.slice(0, 10) ?? "?"} (${pair.daysBetween?.toFixed(0) ?? "?"} d). Change = pre−post (positive ≈ loss/drying). Not an alert.`
        : "Phase A+B only — no clear pre scene for change pair yet.",
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

export function clearSwirCache(nodeId?: FocusNodeId): void {
  if (nodeId) cache.delete(cacheKey(nodeId));
  else cache.clear();
}

export function getCachedPair(nodeId: FocusNodeId): SwirScenePair | null {
  const hit = cache.get(cacheKey(nodeId));
  return hit?.pack.pair ?? null;
}
