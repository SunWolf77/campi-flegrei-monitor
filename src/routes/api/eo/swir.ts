import { createFileRoute } from "@tanstack/react-router";
import { clearSwirCache, loadSwirPack } from "@/lib/eo/swirServer";
import { focusNodeFromSesParam } from "@/lib/seismic/ses-handoff";
import type { FocusNodeId } from "@/lib/seismic/types";

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export const Route = createFileRoute("/api/eo/swir")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors() }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const nodeParam =
          url.searchParams.get("node") ||
          url.searchParams.get("sesNode") ||
          "campi-flegrei";
        const nodeId: FocusNodeId =
          focusNodeFromSesParam(nodeParam) ?? "campi-flegrei";

        if (
          url.searchParams.get("refresh") === "1" ||
          url.searchParams.get("refresh") === "true"
        ) {
          clearSwirCache(nodeId);
        }

        const pack = await loadSwirPack(nodeId);
        const maxAge = pack.ok ? Math.min(pack.cacheTtlSec || 3600, 21_600) : 120;

        return Response.json(pack, {
          status: pack.ok ? 200 : pack.error?.includes("only") ? 400 : 502,
          headers: {
            ...cors(),
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=600`,
            "X-Ses-Eo": "swir-phase-a-b-c",
          },
        });
      },
    },
  },
});
