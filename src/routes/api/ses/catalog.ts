import { createFileRoute } from "@tanstack/react-router";
import { loadCatalogPayload } from "@/lib/seismic/server";
import { toSesEqCollection } from "@/lib/seismic/ses-bridge";
import {
  focusNodeFromSesParam,
  sesDragonId,
} from "@/lib/seismic/ses-handoff";
import type { FocusNodeId } from "@/lib/seismic/types";
import type { WindowKey } from "@/lib/seismic/catalog";

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Expose-Headers":
      "X-Ses-Feed, X-Catalog-Degraded, ETag, Cache-Control",
  };
}

function mapWindow(raw: string): WindowKey {
  if (raw === "1d" || raw === "24h") return "24h";
  if (raw === "48h") return "48h";
  if (raw === "7d") return "7d";
  if (raw === "30d") return "30d";
  if (raw === "ytd") return "ytd";
  return "7d";
}

export const Route = createFileRoute("/api/ses/catalog")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors() }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const nodeParam =
          url.searchParams.get("node") ||
          url.searchParams.get("sesNode") ||
          "";
        const windowParam = url.searchParams.get("window") ?? "7d";
        const windowKey = mapWindow(windowParam);
        const nodeId: FocusNodeId =
          focusNodeFromSesParam(nodeParam) ?? "campi-flegrei";

        try {
          const catalog = await loadCatalogPayload({
            nodeId,
            window: windowKey,
            maxDepthKm:
              nodeId === "campi-flegrei" || nodeId === "vesuvius" ? 8 : undefined,
          });
          const collection = toSesEqCollection(catalog.events ?? [], nodeId);
          const degraded = Boolean(catalog.degraded);
          const etag = `"${nodeId}-${windowKey}-${catalog.fetchedAt}-${catalog.count}"`;

          // Soft-empty with last-good still returns features when degraded
          const body = {
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

          return Response.json(body, {
            status: 200,
            headers: {
              ...cors(),
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control":
                "public, max-age=60, stale-while-revalidate=120",
              "X-Ses-Feed": "campi-flegrei-monitor",
              "X-Catalog-Degraded": degraded ? "1" : "0",
              ETag: etag,
            },
          });
        } catch (err) {
          return Response.json(
            {
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
            },
            {
              status: 200,
              headers: {
                ...cors(),
                "Cache-Control": "no-store",
                "X-Ses-Feed": "campi-flegrei-monitor",
                "X-Catalog-Degraded": "1",
              },
            },
          );
        }
      },
    },
  },
});
