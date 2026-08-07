/**
 * Seismic station metadata (INGV FDSN Station for Campi Flegrei).
 * https://webservices.ingv.it/fdsnws/station/1/
 */

export type StationRole = "permanent" | "temporary" | "other";

export type SeismicStation = {
  id: string;
  network: string;
  code: string;
  latitude: number;
  longitude: number;
  elevationM: number | null;
  siteName: string;
  startTime: string;
  endTime: string | null;
  active: boolean;
  role: StationRole;
};

export type StationBbox = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

const INGV_STATION =
  "https://webservices.ingv.it/fdsnws/station/1/query";

/** Prefer OV permanent (IV) + TESNET densification (2I). */
const CF_PRIMARY_NETS = new Set(["IV", "2I"]);

export function stationRole(network: string): StationRole {
  if (network === "IV") return "permanent";
  if (network === "2I" || network === "Y4") return "temporary";
  return "other";
}

/** Marker colour by network role / code. */
export function stationColor(s: SeismicStation): string {
  if (s.network === "IV") return "#1565c0"; // OV permanent — blue
  if (s.network === "2I") return "#ef6c00"; // TESNET temp — amber
  if (s.network === "IX") return "#546e7a"; // campus / other
  if (s.network === "Y4") return "#90a4ae"; // ended temps
  return "#607d8b";
}

export function parseFdsnStationText(text: string, now = Date.now()): SeismicStation[] {
  const out: SeismicStation[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 7) continue;
    const [network, code, latS, lonS, elevS, siteName, startTime, endTimeRaw] = parts;
    const latitude = Number(latS);
    const longitude = Number(lonS);
    if (!network || !code || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }
    const elev = elevS === "" || elevS == null ? null : Number(elevS);
    const endTime = endTimeRaw && endTimeRaw.length > 0 ? endTimeRaw : null;
    let active = true;
    if (endTime) {
      const endMs = Date.parse(endTime);
      // Far-future placeholders (2050…) count as open
      if (Number.isFinite(endMs) && endMs < now && !/2050|2099/.test(endTime)) {
        active = false;
      }
    }
    out.push({
      id: `${network}.${code}`,
      network,
      code,
      latitude,
      longitude,
      elevationM: elev != null && Number.isFinite(elev) ? elev : null,
      siteName: siteName || `${network}.${code}`,
      startTime: startTime || "",
      endTime,
      active,
      role: stationRole(network),
    });
  }
  return out;
}

export function buildIngvStationUrl(bbox: StationBbox, pad = 0.02): string {
  const minlat = bbox.minLat - pad;
  const maxlat = bbox.maxLat + pad;
  const minlon = bbox.minLon - pad;
  const maxlon = bbox.maxLon + pad;
  const q = new URLSearchParams({
    minlat: String(minlat),
    maxlat: String(maxlat),
    minlon: String(minlon),
    maxlon: String(maxlon),
    level: "station",
    format: "text",
  });
  return `${INGV_STATION}?${q.toString()}`;
}

/** Active stations useful on the CF board (IV + 2I by default). */
export function filterMapStations(
  stations: SeismicStation[],
  opts?: { includeInactive?: boolean; primaryOnly?: boolean },
): SeismicStation[] {
  const primaryOnly = opts?.primaryOnly ?? true;
  const includeInactive = opts?.includeInactive ?? false;
  return stations.filter((s) => {
    if (!includeInactive && !s.active) return false;
    if (primaryOnly && !CF_PRIMARY_NETS.has(s.network)) return false;
    return true;
  });
}

export async function fetchIngvStations(
  bbox: StationBbox,
  opts?: { signal?: AbortSignal },
): Promise<{ stations: SeismicStation[]; sourceUrl: string; fetchedAt: number }> {
  const sourceUrl = buildIngvStationUrl(bbox);
  const res = await fetch(sourceUrl, {
    signal: opts?.signal,
    headers: { Accept: "text/plain,*/*" },
  });
  if (!res.ok) {
    throw new Error(`INGV station ${res.status}: ${res.statusText}`);
  }
  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    throw new Error("INGV station returned HTML instead of text");
  }
  return {
    stations: parseFdsnStationText(text),
    sourceUrl,
    fetchedAt: Date.now(),
  };
}
