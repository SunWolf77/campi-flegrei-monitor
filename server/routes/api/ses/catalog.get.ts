/**
 * Nitro production — SES merge feed (GeoJSON).
 * GET /api/ses/catalog?window=7d&node=mediterranean
 */
import { defineEventHandler, getQuery, setHeader } from "h3";
import { loadCatalogPayload } from "../../../../src/lib/seismic/server";
import { toSesEqCollection } from "../../../../src/lib/seismic/ses-bridge";
import {
  focusNodeFromSesParam,
  sesDragonId,
} from "../../../../src/lib/seismic/ses-handoff";
import type { FocusNodeId } from "../../../../src/lib/seismic/types";
import type { WindowKey } from "../../../../src/lib/seismic/catalog";

function mapWindow(raw: string): WindowKey {
  if (raw === "1d" || raw === "24h") return "24h";
  if (raw === "48h") return "48h";
  if (raw === "7d") return "7d";
  if (raw === "30d") return "30d";
  if (raw === "ytd") return "ytd";
  return "7d";
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const nodeParam =
    (typeof q.node === "string" && q.node) ||
    (typeof q.sesNode === "string" && q.sesNode) ||
    "";
  const windowParam = typeof q.window === "string" ? q.window : "7d";
  const windowKey = mapWindow(windowParam);
  const nodeId: FocusNodeId = focusNodeFromSesParam(nodeParam) ?? "campi-flegrei";

  try {
    const catalog = await loadCatalogPayload({
      nodeId,
      window: windowKey,
      maxDepthKm:
        nodeId === "campi-flegrei" || nodeId === "vesuvius" ? 8 : undefined,
    });

    const collection = toSesEqCollection(catalog.events ?? [], nodeId);
    const degraded = Boolean(catalog.degraded);

    setHeader(event, "content-type", "application/json; charset=utf-8");
    setHeader(event, "access-control-allow-origin", "*");
    setHeader(event, "access-control-allow-methods", "GET, OPTIONS");
    setHeader(
      event,
      "access-control-expose-headers",
      "X-Ses-Feed, X-Catalog-Degraded, ETag, Cache-Control",
    );
    setHeader(
      event,
      "cache-control",
      "public, max-age=60, stale-while-revalidate=120",
    );
    setHeader(event, "x-ses-feed", "campi-flegrei-monitor");
    setHeader(event, "x-catalog-degraded", degraded ? "1" : "0");
    setHeader(
      event,
      "etag",
      `"${nodeId}-${windowKey}-${catalog.fetchedAt}-${catalog.count}"`,
    );

    return {
      ...collection,
      metadata: {
        ...collection.metadata,
        generated: Date.now(),
        count: catalog.count,
        title: `SES focus feed · ${sesDragonId(nodeId)}`,
        authority: catalog.authority,
        nodeId,
        dragonId: sesDragonId(nodeId),
        window: windowKey,
        provider: catalog.provider,
        sourceUrl: catalog.sourceUrl,
        board: "campi-flegrei-monitor",
        degraded,
        error: catalog.error,
        note:
          nodeId === "campi-flegrei"
            ? "INGV-OV authority — replace USGS inside CF bbox; never dual-read."
            : nodeId === "vesuvius"
              ? "INGV-OV GOSSIP vesuvio authority — exclusive INGV-family; never dual-read."
              : "USGS authority for Tonga–Kermadec.",
      },
    };
  } catch (err) {
    setHeader(event, "content-type", "application/json; charset=utf-8");
    setHeader(event, "access-control-allow-origin", "*");
    setHeader(event, "x-ses-feed", "campi-flegrei-monitor");
    setHeader(event, "x-catalog-degraded", "1");
    setHeader(event, "cache-control", "no-store");
    return {
      type: "FeatureCollection",
      features: [],
      metadata: {
        generated: Date.now(),
        count: 0,
        degraded: true,
        error: err instanceof Error ? err.message : "SES catalog failed",
        nodeId,
        board: "campi-flegrei-monitor",
      },
    };
  }
});
