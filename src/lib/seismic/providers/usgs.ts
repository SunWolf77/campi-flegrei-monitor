import type { FetchResult, QuakeEvent, SeismicQuery } from "../types";
import type { SeismicProvider } from "./base";
import { clampLimit, isoUtc } from "./base";

const USGS_BASE = "https://earthquake.usgs.gov/fdsnws/event/1/query";

/**
 * USGS GeoJSON FDSN — authority for Tonga–Kermadec / sun-earth-sentinel global.
 * Schema aligned with SES `EqFeature` (mag may be null; depth from coordinates[2]).
 *
 * Do NOT use as a co-source for Campi Flegrei — authority routing blocks it.
 *
 * Tonga–Kermadec spans the antimeridian. USGS FDSN requires minlongitude < maxlongitude,
 * so TK uses two parallel strips (west + east of dateline) merged by event id.
 */
export function parseUsgsGeoJson(data: unknown): QuakeEvent[] {
  if (!data || typeof data !== "object") return [];
  const features = (data as { features?: unknown[] }).features;
  if (!Array.isArray(features)) return [];

  const events: QuakeEvent[] = [];
  for (const f of features) {
    if (!f || typeof f !== "object") continue;
    const feat = f as {
      id?: string;
      properties?: Record<string, unknown>;
      geometry?: { coordinates?: number[] };
    };
    const props = feat.properties ?? {};
    const coords = feat.geometry?.coordinates ?? [];
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    const depthRaw = coords[2];
    const depthKm =
      typeof depthRaw === "number" && Number.isFinite(depthRaw)
        ? Math.abs(depthRaw)
        : 0;
    const time = Number(props.time);

    // Preserve null mag (SES style) — do not coerce to 0
    let magnitude: number | null = null;
    if (props.mag != null && props.mag !== "") {
      const m = Number(props.mag);
      magnitude = Number.isFinite(m) ? m : null;
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(time)) continue;

    const usgsId = feat.id != null ? String(feat.id) : `${time}-${lat}-${lon}`;
    events.push({
      id: usgsId.startsWith("usgs-") ? usgsId : `usgs-${usgsId}`,
      time,
      latitude: lat,
      longitude: lon,
      depthKm,
      magnitude,
      magType: String(props.magType ?? "ml"),
      place: String(props.place ?? "Unknown"),
      eventType: String(props.type ?? "earthquake"),
      author: String(props.net ?? "USGS"),
      provider: "usgs",
      catalog: String(props.net ?? "us"),
    });
  }
  return events;
}

type LonStrip = { minLon: number; maxLon: number };

function buildUsgsUrlForStrip(
  query: SeismicQuery,
  strip: LonStrip,
): string {
  const { node, start, end, minMagnitude, limit } = query;
  const params = new URLSearchParams({
    format: "geojson",
    starttime: isoUtc(start),
    endtime: isoUtc(end),
    minlatitude: String(node.bbox.minLat),
    maxlatitude: String(node.bbox.maxLat),
    minlongitude: String(strip.minLon),
    maxlongitude: String(strip.maxLon),
    orderby: "time",
    limit: String(clampLimit(limit, 500, 2000)),
  });
  if (minMagnitude != null && Number.isFinite(minMagnitude)) {
    params.set("minmagnitude", String(minMagnitude));
  }
  return `${USGS_BASE}?${params.toString()}`;
}

/** Single-strip URL (non-TK nodes, or west strip default). */
export function buildUsgsUrl(query: SeismicQuery): string {
  return buildUsgsUrlForStrip(query, {
    minLon: query.node.bbox.minLon,
    maxLon: query.node.bbox.maxLon,
  });
}

/**
 * TK arc corridor lon strips. USGS forbids minlon > maxlon (no single
 * antimeridian-crossing box), so we query both sides and merge.
 * West: −180 → −168 · East: 168 → 180 (covers ± near 180° trench axis).
 */
const TK_LON_STRIPS: LonStrip[] = [
  { minLon: -180, maxLon: -168 },
  { minLon: 168, maxLon: 180 },
];

async function fetchUsgsStrip(
  query: SeismicQuery,
  strip: LonStrip,
): Promise<{ events: QuakeEvent[]; sourceUrl: string }> {
  const sourceUrl = buildUsgsUrlForStrip(query, strip);
  let res: Response;
  try {
    res = await fetch(sourceUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(
      `USGS network error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (res.status === 204) {
    return { events: [], sourceUrl };
  }
  if (!res.ok) {
    throw new Error(`USGS FDSN ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  return { events: parseUsgsGeoJson(data), sourceUrl };
}

function mergeById(batches: QuakeEvent[][]): QuakeEvent[] {
  const seen = new Map<string, QuakeEvent>();
  for (const batch of batches) {
    for (const ev of batch) {
      if (!seen.has(ev.id)) seen.set(ev.id, ev);
    }
  }
  return [...seen.values()].sort((a, b) => b.time - a.time);
}

export const usgsProvider: SeismicProvider = {
  id: "usgs",
  label: "USGS FDSN Event",
  async fetchEvents(query: SeismicQuery): Promise<FetchResult> {
    const isTk = query.node.id === "tonga-kermadec";
    const strips = isTk
      ? TK_LON_STRIPS
      : [{ minLon: query.node.bbox.minLon, maxLon: query.node.bbox.maxLon }];

    const results = await Promise.all(
      strips.map((s) => fetchUsgsStrip(query, s)),
    );
    const events = mergeById(results.map((r) => r.events));
    const sourceUrl = results.map((r) => r.sourceUrl).join(" | ");

    return {
      events,
      provider: "usgs",
      fetchedAt: Date.now(),
      sourceUrl,
      count: events.length,
      window: {
        start: query.start.toISOString(),
        end: query.end.toISOString(),
      },
      nodeId: query.node.id,
      authority: "usgs-family",
    };
  },
};
