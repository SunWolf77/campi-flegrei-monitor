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
  };
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
        const windowKey: WindowKey = [
          "24h",
          "48h",
          "7d",
          "30d",
          "ytd",
        ].includes(windowParam)
          ? (windowParam as WindowKey)
          : "7d";
        const nodeId: FocusNodeId =
          focusNodeFromSesParam(nodeParam) ?? "campi-flegrei";

        try {
          const catalog = await loadCatalogPayload({
            nodeId,
            window: windowKey,
            maxDepthKm: nodeId === "campi-flegrei" ? 8 : undefined,
          });
          const collection = toSesEqCollection(catalog.events ?? [], nodeId);
          return Response.json(
            {
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
                note:
                  nodeId === "campi-flegrei"
                    ? "INGV-OV authority — replace USGS inside CF bbox; never dual-read."
                    : "USGS authority for Tonga–Kermadec.",
              },
            },
            {
              headers: {
                ...cors(),
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control":
                  "public, max-age=60, stale-while-revalidate=120",
                "X-Ses-Feed": "campi-flegrei-monitor",
              },
            },
          );
        } catch (err) {
          return Response.json(
            {
              ok: false,
              error: err instanceof Error ? err.message : "SES catalog failed",
              nodeId,
            },
            { status: 500, headers: { ...cors(), "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
