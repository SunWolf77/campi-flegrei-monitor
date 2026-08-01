import { createServerFn } from "@tanstack/react-start";
import {
  SCHUMANN_API_URL,
  emptySchumann,
  parseSchumannJson,
  type SchumannSnapshot,
} from "@/lib/supt/schumann";
import {
  GEONET_VAL_URL,
  emptyGeonet,
  parseGeonetVal,
  type GeonetValSnapshot,
} from "@/lib/seismic/geonet";

/** Tomsk-attributed Schumann + composite activity index (ResonanceOne). */
export const fetchSchumann = createServerFn({ method: "GET" }).handler(
  async (): Promise<SchumannSnapshot> => {
    try {
      const res = await fetch(SCHUMANN_API_URL, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) return emptySchumann(`Schumann API ${res.status}`);
      return parseSchumannJson(await res.json());
    } catch (err) {
      return emptySchumann(
        err instanceof Error ? err.message : "Schumann fetch failed",
      );
    }
  },
);

/** GeoNet volcanic alert levels — Kermadec Islands + NZ arc. */
export const fetchGeonetVal = createServerFn({ method: "GET" }).handler(
  async (): Promise<GeonetValSnapshot> => {
    try {
      const res = await fetch(GEONET_VAL_URL, {
        headers: {
          Accept: "application/json",
          "User-Agent": "SunEarthSentinel-CF-Monitor/1.0",
        },
        cache: "no-store",
      });
      if (!res.ok) return emptyGeonet(`GeoNet VAL ${res.status}`);
      return parseGeonetVal(await res.json());
    } catch (err) {
      return emptyGeonet(
        err instanceof Error ? err.message : "GeoNet VAL fetch failed",
      );
    }
  },
);
