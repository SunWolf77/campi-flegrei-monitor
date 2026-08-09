import { createFileRoute } from "@tanstack/react-router";
import {
  isChangeProduct,
  renderChangeProduct,
  type ChangeProductId,
} from "@/lib/eo/changeRender";
import { swirBboxForNode } from "@/lib/eo/swir";
import { focusNodeFromSesParam } from "@/lib/seismic/ses-handoff";
import type { FocusNodeId } from "@/lib/seismic/types";

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Expose-Headers": "X-Ses-Eo-Change, X-Ses-Eo-Stats",
  };
}

/** In-memory PNG cache: node|product|pre|post → buffer */
const imgCache = new Map<string, { buf: Buffer; expires: number; statsJson: string }>();
const IMG_TTL_MS = 6 * 60 * 60 * 1000;

export const Route = createFileRoute("/api/eo/change-image")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors() }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const nodeParam = url.searchParams.get("node") ?? "campi-flegrei";
        const nodeId: FocusNodeId =
          focusNodeFromSesParam(nodeParam) ?? "campi-flegrei";
        const productRaw = url.searchParams.get("product") ?? "dnbr";
        const preId = url.searchParams.get("pre") ?? "";
        const postId = url.searchParams.get("post") ?? "";

        if (!isChangeProduct(productRaw)) {
          return Response.json(
            { error: "product must be dnbr|rdnbr|dndvi|dndmi" },
            { status: 400, headers: cors() },
          );
        }
        const product: ChangeProductId = productRaw;
        if (!preId || !postId) {
          return Response.json(
            { error: "pre and post scene ids required" },
            { status: 400, headers: cors() },
          );
        }

        const bbox = swirBboxForNode(nodeId);
        if (!bbox) {
          return Response.json(
            { error: "node not supported for EO change" },
            { status: 400, headers: cors() },
          );
        }

        const key = `${nodeId}|${product}|${preId}|${postId}`;
        const hit = imgCache.get(key);
        if (hit && hit.expires > Date.now()) {
          return new Response(new Uint8Array(hit.buf), {
            status: 200,
            headers: {
              ...cors(),
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=21600, stale-while-revalidate=3600",
              "X-Ses-Eo-Change": product,
              "X-Ses-Eo-Stats": hit.statsJson,
            },
          });
        }

        try {
          const result = await renderChangeProduct({
            product,
            preId,
            postId,
            bbox,
          });
          const statsJson = JSON.stringify(result.stats);
          imgCache.set(key, {
            buf: result.png,
            expires: Date.now() + IMG_TTL_MS,
            statsJson,
          });

          return new Response(new Uint8Array(result.png), {
            status: 200,
            headers: {
              ...cors(),
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=21600, stale-while-revalidate=3600",
              "X-Ses-Eo-Change": product,
              "X-Ses-Eo-Stats": statsJson,
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "change render failed";
          return Response.json(
            { error: msg },
            {
              status: 502,
              headers: { ...cors(), "Cache-Control": "no-store" },
            },
          );
        }
      },
    },
  },
});
