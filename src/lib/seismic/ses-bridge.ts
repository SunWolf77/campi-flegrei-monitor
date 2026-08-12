/**
 * Bridge to sun-earth-sentinel (https://github.com/SunWolf77/sun-earth-sentinel).
 *
 * SES uses USGS EqFeature GeoJSON globally and filters by dragon-node bounds.
 * Campi Flegrei is the "mediterranean" dragon node — USGS is blind there, so this
 * monitor owns the dense INGV-OV catalog and can emit SES-compatible features
 * for merge WITHOUT re-querying USGS for the same box.
 *
 * Merge contract for SES:
 *  1. Global map: keep USGS summary feeds.
 *  2. When focus = mediterranean / campi-flegrei: REPLACE in-bounds USGS
 *     features with `toSesEqFeatures(events)` from this node (INGV authority).
 *  3. Never call both USGS FDSN and INGV for the same CF bbox in one tick.
 *
 * Mag N/D policy (GOSSIP Md often N/D):
 *  - Default densify: keep events with explicit mag: null (never invent 0).
 *  - Title uses "M—" so hub can render without treating as M0.
 *  - Min-mag filters must treat null as non-matching (not as 0).
 *  - Optional requireMag=true drops unmaged for stats-only consumers.
 */

import type { FocusNodeId, QuakeEvent, SeismicProviderId } from "./types";
import { getAuthority } from "./authority";

/** Subset of SES `EqFeature` — enough for map/list/SUPT merge. */
export type SesEqFeature = {
  type: "Feature";
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number | null;
    updated?: number;
    url?: string;
    detail?: string;
    title?: string;
    type?: string;
    status?: string;
    magType?: string | null;
    net?: string;
    sources?: string;
    /** True when GOSSIP/INGV published magnitude as N/D */
    magNd?: boolean;
    /** SES extension: which catalog family supplied the feature */
    sesSource?: SeismicProviderId | "ingv-family" | "usgs-family";
    sesNodeId?: FocusNodeId;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number, number?];
  };
};

export type SesEqCollection = {
  type: "FeatureCollection";
  features: SesEqFeature[];
  metadata?: {
    generated?: number;
    count?: number;
    title?: string;
    authority?: string;
    nodeId?: FocusNodeId;
    magNullPolicy?: string;
    magNullCount?: number;
    magFiniteCount?: number;
    requireMag?: boolean;
  };
};

/** Finite hypocentre required for densify; mag may be null. */
export function isSesPublishableEvent(e: QuakeEvent): boolean {
  return (
    Number.isFinite(e.latitude) &&
    Number.isFinite(e.longitude) &&
    Number.isFinite(e.depthKm) &&
    Number.isFinite(e.time) &&
    Boolean(e.id)
  );
}

export function hasFiniteMag(e: QuakeEvent): boolean {
  return e.magnitude != null && Number.isFinite(e.magnitude);
}

export function toSesEqFeature(
  e: QuakeEvent,
  nodeId?: FocusNodeId,
): SesEqFeature {
  const net =
    e.provider === "usgs"
      ? e.author?.slice(0, 2) || "us"
      : e.provider === "gossip"
        ? "ov"
        : "iv";
  const sources =
    e.provider === "usgs"
      ? "USGS"
      : e.provider === "gossip"
        ? "INGV-OV"
        : "INGV";
  const place = e.place || "";
  const magNd = !hasFiniteMag(e);
  // Never invent 0 for N/D — explicit null + M— title for hub rendering
  const mag = magNd ? null : e.magnitude;
  const title = magNd
    ? `M— - ${place || e.id}`
    : `M ${e.magnitude!.toFixed(1)} - ${place}`;
  return {
    type: "Feature",
    id: e.id,
    properties: {
      mag,
      place: place || null,
      time: e.time,
      updated: e.time,
      title,
      type: e.eventType || "earthquake",
      status: "reviewed",
      magType: magNd ? e.magType || "N/D" : e.magType,
      net,
      sources,
      detail: place || undefined,
      magNd,
      sesSource: e.provider,
      sesNodeId: nodeId,
    },
    geometry: {
      type: "Point",
      coordinates: [e.longitude, e.latitude, e.depthKm],
    },
  };
}

export type SesCollectionOpts = {
  /** Drop events without finite magnitude (stats-safe subset). */
  requireMag?: boolean;
};

export function toSesEqCollection(
  events: QuakeEvent[],
  nodeId: FocusNodeId,
  opts: SesCollectionOpts = {},
): SesEqCollection {
  const policy = getAuthority(nodeId);
  const publishable = events.filter(isSesPublishableEvent);
  const selected = opts.requireMag
    ? publishable.filter(hasFiniteMag)
    : publishable;
  const magNullCount = publishable.filter((e) => !hasFiniteMag(e)).length;
  const magFiniteCount = publishable.length - magNullCount;

  return {
    type: "FeatureCollection",
    features: selected.map((e) => toSesEqFeature(e, nodeId)),
    metadata: {
      generated: Date.now(),
      count: selected.length,
      title: `SES focus node · ${policy.label}`,
      authority: policy.authority,
      nodeId,
      magNullPolicy: opts.requireMag
        ? "omit-unmaged"
        : "keep-null-never-zero",
      magNullCount: opts.requireMag ? 0 : magNullCount,
      magFiniteCount,
      requireMag: Boolean(opts.requireMag),
    },
  };
}

/**
 * Merge SES global USGS features with authority-owned node events.
 * Drops any USGS feature that falls inside the node bbox so we never double-plot.
 */
export function mergeSesWithAuthorityNode(opts: {
  globalUsgs: SesEqFeature[];
  nodeEvents: QuakeEvent[];
  nodeId: FocusNodeId;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}): SesEqCollection {
  const policy = getAuthority(opts.nodeId);
  const { minLat, maxLat, minLon, maxLon } = opts.bbox;

  const outside = opts.globalUsgs.filter((f) => {
    const [lon, lat] = f.geometry.coordinates;
    if (lat == null || lon == null) return true;
    const inBox = lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
    // If this node is INGV-authority, strip USGS inside the box
    if (policy.authority === "ingv-family" && inBox) return false;
    return true;
  });

  const local = opts.nodeEvents
    .filter(isSesPublishableEvent)
    .map((e) => toSesEqFeature(e, opts.nodeId));
  const byId = new Map<string, SesEqFeature>();
  for (const f of outside) byId.set(String(f.id), f);
  for (const f of local) byId.set(String(f.id), f);

  const features = [...byId.values()].sort(
    (a, b) => (b.properties.time ?? 0) - (a.properties.time ?? 0),
  );

  const magNullCount = features.filter((f) => f.properties.mag == null).length;

  return {
    type: "FeatureCollection",
    features,
    metadata: {
      generated: Date.now(),
      count: features.length,
      title: `SES merged · ${policy.sesDragonId} authority=${policy.authority}`,
      authority: policy.authority,
      nodeId: opts.nodeId,
      magNullPolicy: "keep-null-never-zero",
      magNullCount,
      magFiniteCount: features.length - magNullCount,
    },
  };
}

/** SES dragon-node id for this focus monitor (for cross-app deep links). */
export function sesDragonIdFor(nodeId: FocusNodeId): string {
  return getAuthority(nodeId).sesDragonId;
}
