import { createFileRoute } from "@tanstack/react-router";
import {
  GEONET_VAL_URL,
  emptyGeonet,
  parseGeonetVal,
} from "@/lib/seismic/geonet";
import { getFocusNode } from "@/lib/seismic/focus-nodes";

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
    "X-Ses-Feed": "campi-flegrei-monitor-volcano",
  };
}

async function loadGeonet() {
  try {
    const res = await fetch(GEONET_VAL_URL, {
      headers: { Accept: "application/json", "User-Agent": "campi-flegrei-monitor/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return emptyGeonet(`GeoNet VAL ${res.status}`);
    return parseGeonetVal(await res.json());
  } catch (err) {
    return emptyGeonet(err instanceof Error ? err.message : "VAL failed");
  }
}

export const Route = createFileRoute("/api/ses/volcano")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors() }),
      GET: async () => {
        const cf = getFocusNode("campi-flegrei");
        const snap = await loadGeonet();
        const k = snap.kermadec;
        // CF authority is INGV — static operational note from focus node
        const cfNote = cf.volcano?.statusNote ?? "INGV-OV Campi Flegrei caldera monitoring.";
        const primary = {
          id: "campi-flegrei",
          title: "Campi Flegrei",
          level: 0,
          acc: "Green",
          activity: cfNote,
        };

        const plain =
          "Campi Flegrei is under INGV-OV authority (not GeoNet). This feed pairs CF operational context with GeoNet Kermadec arc VAL for SES network sync. Dense shallow seismicity is the primary unrest metric at CF — treat INGV bulletins as definitive. Not a forecast.";

        return Response.json(
          {
            type: "ses-volcano-status",
            board: "campi-flegrei-monitor",
            networkOrder: 2,
            dragonId: "mediterranean",
            name: "Campi Flegrei",
            ok: true,
            generatedAt: Date.now(),
            authority: "INGV-OV (+ GeoNet arc companion)",
            primary,
            elevatedCount: snap.elevated.length,
            recentChanges: [],
            resonance: {
              severity: snap.elevated.length ? "watch" : "quiet",
              headline: snap.elevated.length
                ? "CF calm on INGV static note · NZ arc has elevated VAL rows"
                : "CF INGV context · GeoNet arc quiet",
              plain,
            },
            href: "https://campi-flegrei-monitor.vercel.app/",
            companion: k
              ? {
                  id: k.id,
                  title: k.title,
                  level: k.level,
                  acc: k.acc,
                  activity: k.activity,
                  source: "geonet",
                }
              : null,
            metadata: {
              note: "Primary CF authority is INGV-OV GOSSIP/seismic. GeoNet VAL included for Pacific lattice sync only.",
              geonetSource: snap.sourceUrl,
              geonetError: snap.error,
            },
          },
          { headers: cors() },
        );
      },
    },
  },
});
