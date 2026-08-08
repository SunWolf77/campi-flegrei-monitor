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
  maxMagnitude: number | null;
  eventIds: string[];
  topEvents: SwarmEventChip[];
};

export type SwarmAnalysis = {
  active: SwarmCluster | null;
  clusters: SwarmCluster[];
  rate1h: number;
  rate6h: number;
  rate24h: number;
  meanDepthKm: number;
  maxMagnitude: number | null;
  hourlyBins: { t: number; n: number }[];
};

export type FetchResult = {
  events: QuakeEvent[];
  provider: SeismicProviderId;
  fetchedAt: number;
  sourceUrl: string;
  count: number;
  window: { start: string; end: string };
  nodeId: FocusNodeId;
  authority?: string;
  attempted?: SeismicProviderId[];
};

export type SeismicQuery = {
  node: FocusNode;
  start: Date;
  end: Date;
  minMagnitude?: number;
  limit?: number;
};
