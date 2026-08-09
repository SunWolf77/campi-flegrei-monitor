/**
 * Phase C change rendering — dual grayscale index previews → dNBR / RdNBR / dNDVI / dNDMI PNG.
 * Uses Planetary Computer single-item previews + server-side pixel differencing (pngjs).
 */

import { PNG } from "pngjs";
import type { ChangeSeverityStats, SwirProductId } from "@/lib/eo/swir";
import { classifyDnbrSeverity } from "@/lib/eo/swir";

const PC_DATA = "https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png";
const UA = "SunEarthSentinel-CF-Monitor/1.0 (Phase-C change)";
const SIZE = 384;

export type IndexKind = "nbr" | "ndvi" | "ndmi";

const INDEX_RESCALE: Record<IndexKind, [number, number]> = {
  nbr: [-0.5, 0.8],
  ndvi: [-0.2, 0.8],
  ndmi: [-0.5, 0.5],
};

export type ChangeProductId = "dnbr" | "rdnbr" | "dndvi" | "dndmi";

export function isChangeProduct(id: string): id is ChangeProductId {
  return id === "dnbr" || id === "rdnbr" || id === "dndvi" || id === "dndmi";
}

function indexKindFor(product: ChangeProductId): IndexKind {
  if (product === "dndvi") return "ndvi";
  if (product === "dndmi") return "ndmi";
  return "nbr"; // dnbr + rdnbr
}

function grayIndexUrl(
  itemId: string,
  kind: IndexKind,
  bbox: [number, number, number, number],
): string {
  const [lo, hi] = INDEX_RESCALE[kind];
  const u = new URL(PC_DATA);
  u.searchParams.set("collection", "sentinel-2-l2a");
  u.searchParams.set("item", itemId);
  u.searchParams.set("format", "png");
  u.searchParams.set("bbox", bbox.join(","));
  u.searchParams.set("width", String(SIZE));
  u.searchParams.set("height", String(SIZE));
  u.searchParams.set("asset_as_band", "true");
  u.searchParams.set("colormap_name", "gray");
  u.searchParams.set("rescale", `${lo},${hi}`);

  if (kind === "nbr") {
    u.searchParams.append("assets", "B08");
    u.searchParams.append("assets", "B12");
    u.searchParams.set("expression", "(B08-B12)/(B08+B12)");
  } else if (kind === "ndvi") {
    u.searchParams.append("assets", "B08");
    u.searchParams.append("assets", "B04");
    u.searchParams.set("expression", "(B08-B04)/(B08+B04)");
  } else {
    u.searchParams.append("assets", "B08");
    u.searchParams.append("assets", "B11");
    u.searchParams.set("expression", "(B08-B11)/(B08+B11)");
  }
  return u.toString();
}

async function fetchPng(url: string): Promise<PNG> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "image/png" },
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Index preview ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return PNG.sync.read(buf);
}

/** Map gray DN 0–255 → index value given rescale range */
function dnToIndex(dn: number, lo: number, hi: number): number {
  return lo + (dn / 255) * (hi - lo);
}

/**
 * Diverging colormap for change (positive = loss / drying).
 * Blue (gain) → white (stable) → yellow/red (loss).
 */
function colorizeChange(
  v: number,
  /** scale of ±v that maps to full saturation */
  absScale: number,
): [number, number, number] {
  const t = Math.max(-1, Math.min(1, v / absScale));
  if (t >= 0) {
    // white → yellow → red
    const u = t;
    if (u < 0.5) {
      const k = u / 0.5;
      return [
        255,
        Math.round(255 - k * 40),
        Math.round(255 - k * 200),
      ];
    }
    const k = (u - 0.5) / 0.5;
    return [
      255,
      Math.round(215 - k * 180),
      Math.round(55 - k * 40),
    ];
  }
  // white → cyan → blue (greening / moisture gain)
  const u = -t;
  if (u < 0.5) {
    const k = u / 0.5;
    return [
      Math.round(255 - k * 180),
      Math.round(255 - k * 40),
      255,
    ];
  }
  const k = (u - 0.5) / 0.5;
  return [
    Math.round(75 - k * 40),
    Math.round(215 - k * 80),
    255,
  ];
}

export type RenderChangeResult = {
  png: Buffer;
  stats: ChangeSeverityStats;
  width: number;
  height: number;
};

export async function renderChangeProduct(opts: {
  product: ChangeProductId;
  preId: string;
  postId: string;
  bbox: [number, number, number, number];
}): Promise<RenderChangeResult> {
  const kind = indexKindFor(opts.product);
  const [lo, hi] = INDEX_RESCALE[kind];
  const preUrl = grayIndexUrl(opts.preId, kind, opts.bbox);
  const postUrl = grayIndexUrl(opts.postId, kind, opts.bbox);

  const [prePng, postPng] = await Promise.all([
    fetchPng(preUrl),
    fetchPng(postUrl),
  ]);

  const w = Math.min(prePng.width, postPng.width);
  const h = Math.min(prePng.height, postPng.height);
  const out = new PNG({ width: w, height: h });

  const values: number[] = [];
  let sum = 0;
  let nUnb = 0;
  let nLow = 0;
  let nMod = 0;
  let nHigh = 0;

  // RdNBR abs scale typically larger than dNBR
  const absScale =
    opts.product === "rdnbr" ? 1.2 : opts.product === "dndvi" ? 0.45 : 0.55;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) << 2;
      // grayscale RGB equal
      const preDn = prePng.data[i]!;
      const postDn = postPng.data[i]!;
      const preV = dnToIndex(preDn, lo, hi);
      const postV = dnToIndex(postDn, lo, hi);
      let delta = preV - postV; // positive = decrease

      if (opts.product === "rdnbr") {
        const denom = Math.sqrt(Math.max(Math.abs(preV), 0.001));
        delta = delta / denom;
      }

      values.push(delta);
      sum += delta;

      // Severity bins only meaningful for dNBR-like positive loss
      // For RdNBR use slightly different cuts; still illustrative
      const classV =
        opts.product === "rdnbr" ? delta * 0.55 : delta; // rough map RdNBR→dNBR-like
      const cls = classifyDnbrSeverity(classV);
      if (cls === "unburned") nUnb++;
      else if (cls === "low") nLow++;
      else if (cls === "moderate") nMod++;
      else nHigh++;

      const [r, g, b] = colorizeChange(delta, absScale);
      out.data[i] = r;
      out.data[i + 1] = g;
      out.data[i + 2] = b;
      out.data[i + 3] = 255;
    }
  }

  values.sort((a, b) => a - b);
  const n = values.length || 1;
  const p90 = values[Math.min(n - 1, Math.floor(n * 0.9))] ?? 0;

  const stats: ChangeSeverityStats = {
    mean: sum / n,
    p90,
    fracUnburned: nUnb / n,
    fracLow: nLow / n,
    fracModerate: nMod / n,
    fracHigh: nHigh / n,
    samplePixels: n,
  };

  const png = PNG.sync.write(out);
  return { png, stats, width: w, height: h };
}

/** Build change product image URL served by our API */
export function changeImageApiUrl(
  nodeId: string,
  product: ChangeProductId,
  preId: string,
  postId: string,
): string {
  const q = new URLSearchParams({
    node: nodeId,
    product,
    pre: preId,
    post: postId,
  });
  return `/api/eo/change-image?${q.toString()}`;
}

/** Type guard helper for pack product ids */
export function changeProductFromId(
  id: SwirProductId,
): ChangeProductId | null {
  return isChangeProduct(id) ? id : null;
}
