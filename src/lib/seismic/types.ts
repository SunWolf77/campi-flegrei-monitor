/**
 * Unified quake model — compatible with USGS GeoJSON, INGV FDSN, and INGV-OV GOSSIP.
 * Designed so sun-earth-sentinel focus nodes can share one UI stack regardless of provider.
 *
 * Magnitude conventions:
 *  - USGS: typically mb/ml/mw; null rare
 *  - INGV FDSN: Md/ML; may be missing
 *  - GOSSIP: Md; often N/D for weak events → magnitude null
 * Never coerce missing mag to 0 (that invents energy).
 */

export type SeismicProviderId = "ingv" | "usgs" | "gossip";

export type QuakeEvent = {
  id: string;
  time: number; // epoch ms
  latitude: number;
  longitude: number;
  /** Hypocentral depth in km (positive down). */
  depthKm: number;
  /** Duration/local magnitude; null when GOSSIP/INGV report N/D. */
  magnitude: number | null;
  magType: string;
  place: string;
  eventType: string;
  /** Source agency / catalog author (e.g. SURVEY-INGV-OV, us, ak). */
  author: string;
  /** Provider that supplied this event. */
  provider: SeismicProviderId;
  /** Optional network / catalog labels for multi-node dashboards. */
  catalog?: string;
  contributor?: string;
  /** Never include in SSR/RPC transport. */
  raw?: Record<string, string>;
};

/** Compact chip for swarm UI — not a full QuakeEvent (avoids nested payload bloat). */
export type SwarmEventChip = {
  id: string;
  magnitude: number | null;
  depthKm: number;
  time: number;
  magType: string;
};

export type BBox = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

export type GeoPoint = { lat: number; lon: number };

export type FocusNodeId = "campi-flegrei" | "vesuvius" | "tonga-kermadec";

export type FocusNode = {
  id: FocusNodeId;
  /** Display name */
  name: string;
  /** Short code for badges */
  code: string;
  /** Order in sun-earth-sentinel network (1 = first, 2 = second, …) */
  networkOrder: number;
  network: "sun-earth-sentinel";
  description: string;
  region: string;
  /** Preferred provider for this node — CF uses GOSSIP (dense OV), then INGV FDSN. */
  provider: SeismicProviderId;
  /** Fallback provider when primary fails (same authority family only). */
  fallbackProvider?: SeismicProviderId;
  bbox: BBox;
  /** Optional tighter initial map frame (does not affect catalog query bbox). */
  mapView?: BBox;
  center: GeoPoint;
  /** Map zoom / extent padding in degrees */
  mapPad: number;
  volcano?: {
    name: string;
    type: string;
    /** Static context — live alert comes from operational bulletins when wired. */
    statusNote: string;
    /** Optional outline polygon [lon, lat][] for map overlay */
    outline?: [number, number][];
    officialMapUrl?: string;
  };
  /** Depth colour scale anchors (km) for this node */
  depthRangeKm: { shallow: number; deep: number };
};

export type SwarmCluster = {
  id: string;
  count: number;
  start: number;
  end: number;
  centroid: GeoPoint;
  meanDepthKm: number;
  /** Median depth of events in the cluster (km). */
  medianDepthKm: number;
  /** [min, max] depth km within the cluster. */
  depthRangeKm: [number, number];
  /** Peak magnitude in cluster (0 when all N/D). */
  maxMag: number;
  /** Chip for the peak-magnitude event. */
  maxMagEvent: SwarmEventChip;
  eventIds: string[];
  topEvents: SwarmEventChip[];
  energyProxy: number;
  ratePerHour: number;
  durationHours: number;
  /** True when the cluster end is within the active window (default 6h). */
  isActive: boolean;
};

export type SwarmHourlyBin = {
  t: number;
  count: number;
  maxMag: number;
  meanDepth: number;
};

export type SwarmAnalysis = {
  active: SwarmCluster | null;
  clusters: SwarmCluster[];
  rate1h: number;
  rate6h: number;
  rate24h: number;
  /** Event count in last 7 days (observation only). */
  rate7d: number;
  meanDepthKm: number;
  /** Max magnitude across the full analysis window. */
  maxMagWindow: number;
  /** Fraction of events with depth < 3 km. */
  shallowFraction: number;
  cumulativeEnergy: number;
  hourlyBins: SwarmHourlyBin[];
};

export type FetchResult = {
  events: QuakeEvent[];
  provider: SeismicProviderId;
  fetchedAt: number;
  sourceUrl: string;
  count: number;
  window: { start: string; end: string };
  nodeId: FocusNodeId;
  /** Exclusive catalog family for this fetch (never dual-read). */
  authority?: "ingv-family" | "usgs-family";
  attempted?: SeismicProviderId[];
};

export type SeismicQuery = {
  node: FocusNode;
  start: Date;
  end: Date;
  minMagnitude?: number;
  limit?: number;
};

/**
 * Resolve a swarm cluster's eventIds against a catalog sample.
 * Used by SUPT fabric / detective so cluster analysis works on full QuakeEvent
 * objects without embedding them in the RPC payload.
 */
export function resolveClusterEvents(
  cluster: SwarmCluster | null | undefined,
  sample: QuakeEvent[],
): QuakeEvent[] {
  if (!cluster || !Array.isArray(cluster.eventIds) || cluster.eventIds.length === 0) {
    return [];
  }
  if (!Array.isArray(sample) || sample.length === 0) return [];
  const wanted = new Set(cluster.eventIds);
  return sample.filter((e) => wanted.has(e.id));
}
