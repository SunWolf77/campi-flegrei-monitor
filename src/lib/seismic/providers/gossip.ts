/**
 * INGV–Osservatorio Vesuviano GOSSIP catalog
 * https://terremoti.ov.ingv.it/gossip/
 *
 * Dense local Campania volcano catalogs used by the official
 * "Localizzazioni Sismiche" maps (includes events without magnitude / N/D).
 *
 * Areas:
 *   flegrei  → Campi Flegrei
 *   vesuvio  → Mount Vesuvius
 */

import type { FetchResult, FocusNodeId, QuakeEvent, SeismicQuery } from "../types";
import type { SeismicProvider } from "./base";

const GOSSIP_BASE = "https://terremoti.ov.ingv.it/gossip";

export type GossipArea = "flegrei" | "vesuvio";

/** Map focus node → GOSSIP area path segment. */
export function gossipAreaForNode(nodeId: FocusNodeId | string): GossipArea {
  if (nodeId === "vesuvius") return "vesuvio";
  return "flegrei";
}

export function gossipYearUrl(
  year: number,
  format: "csv" | "json" = "csv",
  area: GossipArea = "flegrei",
): string {
  return `${GOSSIP_BASE}/${area}/${year}/events.${format}`;
}

export function gossipOfficialMapUrl(
  year?: number,
  area: GossipArea = "flegrei",
): string {
  const y = year ?? new Date().getUTCFullYear();
  return `${GOSSIP_BASE}/${area}/${y}/`;
}

function placeLabel(area: string | undefined | null): string {
  const a = (area ?? "").toLowerCase();
  if (a === "vesuvio" || a === "vesuvius") return "Vesuvius";
  if (a === "flegrei" || a === "campi flegrei") return "Campi Flegrei";
  if (a === "ischia") return "Ischia";
  return area || "Campania";
}

function parseNum(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s.toUpperCase() === "N/D" || s === "-" || s === "--") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * CSV header (GOSSIP public export):
 * #EventID,Time,Latitude,Longitude,Depth,MD,MD Error,Area,Type,Level
 */
export function parseGossipCsv(text: string): QuakeEvent[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const events: QuakeEvent[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.toLowerCase().startsWith("eventid")) continue;
    const cols = line.split(",");
    if (cols.length < 8) continue;

    const [
      eventId,
      timeStr,
      latStr,
      lonStr,
      depthStr,
      mdStr,
      mdErrStr,
      area,
      eventType,
      level,
    ] = cols.map((c) => c?.trim());

    const latitude = parseNum(latStr);
    const longitude = parseNum(lonStr);
    // Unlocalized detections have empty lat/lon — skip for map/catalog geometry
    if (latitude == null || longitude == null) continue;
    // Guard against bogus 0,0 (equator) in this regional catalog
    if (Math.abs(latitude) < 0.01 && Math.abs(longitude) < 0.01) continue;

    const depthKm = parseNum(depthStr) ?? 0;
    const magnitude = parseNum(mdStr);

    const iso = (timeStr ?? "").includes("T")
      ? timeStr
      : (timeStr ?? "").replace(" ", "T");
    const time = Date.parse(iso?.endsWith("Z") ? iso : `${iso}Z`);

    if (!eventId || !Number.isFinite(time)) continue;

    events.push({
      id: `gossip-${eventId}`,
      time,
      latitude,
      longitude,
      depthKm,
      magnitude,
      magType: magnitude == null ? "N/D" : "Md",
      place: placeLabel(area),
      eventType: eventType || "earthquake",
      author: "INGV-OV GOSSIP",
      provider: "gossip",
      catalog: "GOSSIP",
      contributor: level || undefined,
      raw: {
        eventId,
        time: timeStr ?? "",
        mdError: mdErrStr ?? "",
        level: level ?? "",
        area: area ?? "",
      },
    });
  }

  return events;
}

function extractMagnitude(r: Record<string, unknown>): number | null {
  const mdRaw = r.md ?? r.MD ?? r.magnitude ?? r.Magnitude;
  if (mdRaw !== null && mdRaw !== undefined && mdRaw !== "" && mdRaw !== "N/D") {
    const n = Number(mdRaw);
    if (Number.isFinite(n)) return n;
  }
  // Newer GOSSIP JSON: magnitudos: [{ value, type: "D", ... }]
  const mags = r.magnitudos;
  if (Array.isArray(mags) && mags.length > 0) {
    for (const m of mags) {
      if (!m || typeof m !== "object") continue;
      const row = m as Record<string, unknown>;
      const v = Number(row.value ?? row.Value ?? row.md);
      if (Number.isFinite(v)) return v;
    }
  }
  return null;
}

function extractCoords(r: Record<string, unknown>): {
  lat: number | null;
  lon: number | null;
  depthKm: number;
} {
  // Nested location object (current GOSSIP JSON shape)
  const loc = r.location;
  if (loc && typeof loc === "object") {
    const L = loc as Record<string, unknown>;
    const lat = parseNum(String(L.latitude ?? L.lat ?? L.Latitude ?? ""));
    const lon = parseNum(String(L.longitude ?? L.lon ?? L.Longitude ?? ""));
    const depthKm =
      parseNum(String(L.depth ?? L.Depth ?? L.depth_km ?? "0")) ?? 0;
    return { lat, lon, depthKm };
  }
  // Flat fallback
  const lat = parseNum(String(r.lat ?? r.latitude ?? r.Latitude ?? ""));
  const lon = parseNum(String(r.lon ?? r.longitude ?? r.Longitude ?? ""));
  const depthKm =
    parseNum(String(r.depth ?? r.Depth ?? r.depth_km ?? "0")) ?? 0;
  return { lat, lon, depthKm };
}

export function parseGossipJson(data: unknown): QuakeEvent[] {
  if (!Array.isArray(data)) return [];
  const events: QuakeEvent[] = [];

  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;

    const eventId = String(r.id ?? r.EventID ?? r.event_id ?? "");
    const { lat, lon, depthKm } = extractCoords(r);
    if (lat == null || lon == null) continue;
    if (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) continue;

    const magnitude = extractMagnitude(r);

    let time: number;
    if (typeof r.epoch === "number") {
      time = r.epoch > 1e12 ? r.epoch : r.epoch * 1000;
    } else {
      const dateStr = String(r.date ?? r.Time ?? r.time ?? r.printdate ?? "");
      const iso = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
      time = Date.parse(iso.endsWith("Z") ? iso : `${iso}Z`);
    }

    if (!eventId || !Number.isFinite(time)) continue;

    const area = String(r.area ?? "flegrei");
    events.push({
      id: `gossip-${eventId}`,
      time,
      latitude: lat,
      longitude: lon,
      depthKm,
      magnitude,
      magType: magnitude == null ? "N/D" : "Md",
      place: placeLabel(area),
      eventType: String(r.type ?? "earthquake"),
      author: "INGV-OV GOSSIP",
      provider: "gossip",
      catalog: "GOSSIP",
      contributor: r.level != null ? String(r.level) : undefined,
      raw: {
        eventId,
        level: r.level != null ? String(r.level) : "",
        quality:
          r.location && typeof r.location === "object"
            ? String((r.location as Record<string, unknown>).quality ?? "")
            : r.quality != null
              ? String(r.quality)
              : "",
        area,
      },
    });
  }

  return events;
}

function yearsSpanned(start: Date, end: Date): number[] {
  const ys: number[] = [];
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) ys.push(y);
  return ys.length ? ys : [new Date().getUTCFullYear()];
}

async function fetchYear(
  year: number,
  area: GossipArea,
): Promise<{ events: QuakeEvent[]; url: string }> {
  const csvUrl = gossipYearUrl(year, "csv", area);
  try {
    const res = await fetch(csvUrl, {
      headers: { Accept: "text/csv,text/plain,*/*" },
      cache: "no-store",
    });
    if (res.ok) {
      const text = await res.text();
      if (text && !text.startsWith("<") && text.includes(",")) {
        return { events: parseGossipCsv(text), url: csvUrl };
      }
    }
  } catch {
    // fall through
  }

  const jsonUrl = gossipYearUrl(year, "json", area);
  const res = await fetch(jsonUrl, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GOSSIP ${res.status}: ${res.statusText} (${jsonUrl})`);
  }
  const data = await res.json();
  return { events: parseGossipJson(data), url: jsonUrl };
}

export const gossipProvider: SeismicProvider = {
  id: "gossip",
  label: "INGV-OV GOSSIP (Campania volcanoes)",
  async fetchEvents(query: SeismicQuery): Promise<FetchResult> {
    const area = gossipAreaForNode(query.node.id);
    const years = yearsSpanned(query.start, query.end);
    const all: QuakeEvent[] = [];
    const urls: string[] = [];

    for (const y of years) {
      const { events, url } = await fetchYear(y, area);
      urls.push(url);
      all.push(...events);
    }

    const startMs = query.start.getTime();
    const endMs = query.end.getTime();
    const minMag = query.minMagnitude;

    // Soft bbox clip so a shared provider does not leak sibling-area events
    const bb = query.node.bbox;
    let filtered = all.filter((e) => {
      if (e.time < startMs || e.time > endMs) return false;
      if (e.latitude < bb.minLat || e.latitude > bb.maxLat) return false;
      if (e.longitude < bb.minLon || e.longitude > bb.maxLon) return false;
      return true;
    });
    if (minMag != null && Number.isFinite(minMag)) {
      filtered = filtered.filter((e) => e.magnitude != null && e.magnitude >= minMag);
    }

    const byId = new Map<string, QuakeEvent>();
    for (const e of filtered) byId.set(e.id, e);
    const events = [...byId.values()].sort((a, b) => b.time - a.time);

    const limit = query.limit ?? 5000;
    const sliced = events.slice(0, limit);

    return {
      events: sliced,
      provider: "gossip",
      fetchedAt: Date.now(),
      sourceUrl: urls.join(" | "),
      count: sliced.length,
      window: { start: query.start.toISOString(), end: query.end.toISOString() },
      nodeId: query.node.id,
    };
  },
};
