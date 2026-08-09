/**
 * Phase D1 S1 RTC pack — STAC search + amplitude product URLs (Planetary Computer).
 */

import {
  SAR_PRODUCT_META,
  SAR_PRODUCT_ORDER,
  emptySarPack,
  sarBboxForNode,
  sarBrowserUrl,
  type SarPack,
  type SarProduct,
  type SarProductId,
} from "@/lib/eo/sar";
import { getFocusNode } from "@/lib/seismic/focus-nodes";
import type { FocusNodeId } from "@/lib/seismic/types";

const PC_STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
const PC_DATA = "https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const UA = "SunEarthSentinel-CF-Monitor/1.0 (Phase-D1 S1-RTC)";
const CACHE_VER = "sar-d1-v1";

type CacheEntry = { pack: SarPack; expires: number };
const cache = new Map<string, CacheEntry>();

type PcFeature = {
  id: string;
  properties?: Record<string, unknown>;
  assets?: Record<string, { href?: string }>;
  links?: { rel?: string; href?: string }[];
};

function cacheKey(nodeId: FocusNodeId): string {
  return `${CACHE_VER}:${nodeId}`;
}

function productImageUrl(
  itemId: string,
  product: SarProductId,
  bbox: [number, number, number, number],
): string {
  const u = new URL(PC_DATA);
  u.searchParams.set("collection", "sentinel-1-rtc");
  u.searchParams.set("item", itemId);
  u.searchParams.set("format", "png");
  u.searchParams.set("bbox", bbox.join(","));
  u.searchParams.set("width", "640");
  u.searchParams.set("height", "640");

  if (product === "vv") {
    u.searchParams.append("assets", "vv");
    u.searchParams.set("rescale", "0,0.4");
    u.searchParams.set("colormap_name", "gray");
    return u.toString();
  }
  if (product === "vh") {
    u.searchParams.append("assets", "vh");
    u.searchParams.set("rescale", "0,0.08");
    u.searchParams.set("colormap_name", "gray");
    return u.toString();
  }

  // False-color VV+VH composite (PC Living Atlas–style stretch)
  u.searchParams.append("assets", "vv");
  u.searchParams.append("assets", "vh");
  u.searchParams.set("asset_as_band", "true");
  u.searchParams.set(
    "expression",
    "0.03+log(10e-4-log(0.05/(0.02+2*vv)));0.05+exp(0.25*(log(0.01+2*vv)+log(0.02+5*vh)));1-log(0.05/(0.045-0.9*vv))",
  );
  u.searchParams.append("rescale", "0,0.8");
  u.searchParams.append("rescale", "0,1");
  u.searchParams.append("rescale", "0,1");
  return u.toString();
}

function buildProducts(
  itemId: string,
  bbox: [number, number, number, number],
): SarProduct[] {
  return SAR_PRODUCT_ORDER.map((id) => ({
    id,
    label: SAR_PRODUCT_META[id].label,
    blurb: SAR_PRODUCT_META[id].blurb,
    bands: SAR_PRODUCT_META[id].bands,
    imageUrl: productImageUrl(itemId, id, bbox),
  }));
}

async function searchLatestRtc(
  bbox: [number, number, number, number],
): Promise<PcFeature | null> {
  const body = {
    collections: ["sentinel-1-rtc"],
    bbox,
    sortby: [{ field: "datetime", direction: "desc" as const }],
    limit: 8,
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
  if (!res.ok) throw new Error(`S1 STAC ${res.status}`);
  const json = (await res.json()) as { features?: PcFeature[] };
  const features = json.features ?? [];
  if (features.length === 0) return null;

  // Prefer dual-pol VV+VH items with both assets
  const dual = features.find((f) => {
    const a = f.assets ?? {};
    return Boolean(a.vv && a.vh);
  });
  return dual ?? features[0] ?? null;
}

export async function loadSarPack(nodeId: FocusNodeId): Promise<SarPack> {
  const bbox = sarBboxForNode(nodeId);
  if (!bbox) {
    return emptySarPack(
      nodeId,
      "S1 RTC pack is enabled for Campi Flegrei and Vesuvius only",
    );
  }

  const key = cacheKey(nodeId);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.pack;

  try {
    const feature = await searchLatestRtc(bbox);
    if (!feature) {
      const empty = emptySarPack(nodeId, "No Sentinel-1 RTC scene in STAC for this AOI");
      cache.set(key, { pack: empty, expires: Date.now() + 30 * 60_000 });
      return empty;
    }

    const props = feature.properties ?? {};
    const sceneTime =
      typeof props.datetime === "string" ? props.datetime : null;
    let ageDays: number | null = null;
    if (sceneTime) {
      const t = Date.parse(sceneTime);
      if (Number.isFinite(t)) ageDays = (Date.now() - t) / 86_400_000;
    }

    const pol = props["sar:polarizations"];
    const polarizations = Array.isArray(pol)
      ? pol.map(String)
      : typeof pol === "string"
        ? [pol]
        : [];

    const orbitRaw = props["sat:orbit_state"];
    const relOrbit = props["sat:relative_orbit"];
    const platform =
      typeof props.platform === "string" ? props.platform : null;

    const node = getFocusNode(nodeId);
    const stacSelf =
      feature.links?.find((l) => l.rel === "self")?.href ??
      `https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/${feature.id}`;
    const explorer =
      feature.links?.find((l) => l.rel === "preview")?.href ??
      `https://planetarycomputer.microsoft.com/api/data/v1/item/map?collection=sentinel-1-rtc&item=${encodeURIComponent(feature.id)}`;

    const pack: SarPack = {
      nodeId,
      ok: true,
      sceneId: feature.id,
      sceneTime,
      ageDays,
      platform,
      orbitState: typeof orbitRaw === "string" ? orbitRaw : null,
      relativeOrbit:
        typeof relOrbit === "number"
          ? relOrbit
          : typeof relOrbit === "string"
            ? Number(relOrbit) || null
            : null,
      polarizations,
      products: buildProducts(feature.id, bbox),
      stacUrl: stacSelf,
      explorerUrl: explorer,
      browserUrl: sarBrowserUrl(node.center.lat, node.center.lon, 12),
      attribution:
        "Contains modified Copernicus Sentinel-1 data · RTC via Microsoft Planetary Computer",
      note:
        "Phase D1 · latest IW RTC amplitude over node AOI. Speckle is normal. Not LOS displacement / InSAR velocity.",
      fetchedAt: Date.now(),
      cacheTtlSec: Math.round(CACHE_TTL_MS / 1000),
    };

    cache.set(key, { pack, expires: Date.now() + CACHE_TTL_MS });
    return pack;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "S1 pack failed";
    const empty = emptySarPack(nodeId, msg);
    cache.set(key, { pack: empty, expires: Date.now() + 10 * 60_000 });
    return empty;
  }
}

export function clearSarCache(nodeId?: FocusNodeId): void {
  if (nodeId) cache.delete(cacheKey(nodeId));
  else cache.clear();
}
