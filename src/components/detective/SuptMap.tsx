import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Expand, Home, Minimize2, X } from "lucide-react";
import type { FocusNode, QuakeEvent } from "@/lib/seismic/types";
import type { FracturePlane, StressNode, Lineament, MigrationStep } from "@/lib/seismic/supt";
import { leafletMagRadius, timeAgeColor, eventAge01 } from "@/lib/seismic/colors";
import { magValue, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  node: FocusNode;
  events: QuakeEvent[];
  planes: FracturePlane[];
  stressNodes: StressNode[];
  lineaments: Lineament[];
  migration: MigrationStep[];
  stressField: { lat: number; lon: number; intensity: number }[];
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
  className?: string;
  /** Fill parent; when fullscreen, ignores and uses viewport */
  height?: number | string;
  /** Show home / fullscreen toolbar (default true) */
  showControls?: boolean;
  /** Start in fullscreen */
  defaultFullscreen?: boolean;
  onFullscreenChange?: (fs: boolean) => void;
};

/**
 * Leaflet map with SUPT overlays: stress heatmap, fracture traces, stress nodes, migration path.
 * Fullscreen + home (node focus) + zoom (bottom-right).
 */
export function SuptMap({
  node,
  events,
  planes,
  stressNodes,
  lineaments,
  migration,
  stressField,
  selectedNodeId,
  onSelectNode,
  className,
  height = 420,
  showControls = true,
  defaultFullscreen = false,
  onFullscreenChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layersRef = useRef<import("leaflet").LayerGroup | null>(null);
  const drawRef = useRef<() => Promise<void>>(async () => {});
  const [fullscreen, setFullscreen] = useState(defaultFullscreen);

  const tRange = useMemo(() => {
    if (!events.length) {
      const n = Date.now();
      return { tMin: n - 864e5, tMax: n };
    }
    const ts = events.map((e) => e.time);
    return { tMin: Math.min(...ts), tMax: Math.max(...ts) };
  }, [events]);

  const goHome = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const L = await import("leaflet");
    const view = node.mapView ?? node.bbox;
    const pad = node.mapPad ?? 0.015;
    const bounds = L.latLngBounds(
      [view.minLat - pad, view.minLon - pad],
      [view.maxLat + pad, view.maxLon + pad],
    );
    const maxZoom = node.id === "campi-flegrei" ? 13 : 8;
    map.fitBounds(bounds, { padding: [16, 16], maxZoom, animate: true });
  }, [node]);

  const fitToFabric = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const L = await import("leaflet");
    const pts: [number, number][] = [];
    stressNodes.forEach((s) => pts.push([s.location.lat, s.location.lon]));
    planes.forEach((p) => {
      pts.push([p.trace[0].lat, p.trace[0].lon]);
      pts.push([p.trace[1].lat, p.trace[1].lon]);
    });
    if (pts.length >= 2) {
      map.fitBounds(L.latLngBounds(pts), {
        padding: [40, 40],
        maxZoom: 14,
        animate: true,
      });
    } else {
      await goHome();
    }
  }, [stressNodes, planes, goHome]);

  const setFs = useCallback(
    (fs: boolean) => {
      setFullscreen(fs);
      onFullscreenChange?.(fs);
      // lock body scroll in fullscreen
      if (typeof document !== "undefined") {
        document.body.style.overflow = fs ? "hidden" : "";
      }
      window.setTimeout(() => {
        mapRef.current?.invalidateSize({ animate: false });
      }, 80);
    },
    [onFullscreenChange],
  );

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Escape exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFs(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, setFs]);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      const L = await import("leaflet");
      const map = mapRef.current;
      const group = layersRef.current;
      if (!map || !group) return;
      group.clearLayers();

      for (const cell of stressField) {
        if (cell.intensity < 0.12) continue;
        L.circleMarker([cell.lat, cell.lon], {
          radius: 6 + cell.intensity * 14,
          stroke: false,
          fillColor: intensityColor(cell.intensity),
          fillOpacity: 0.12 + cell.intensity * 0.35,
        }).addTo(group);
      }

      for (const lin of lineaments) {
        L.polyline(
          [
            [lin.endpoints[0].lat, lin.endpoints[0].lon],
            [lin.endpoints[1].lat, lin.endpoints[1].lon],
          ],
          {
            color: "#5c6bc0",
            weight: 1.5 + lin.weight * 2,
            dashArray: "6 4",
            opacity: 0.55 + lin.weight * 0.35,
          },
        )
          .bindTooltip(`Lineament ~${lin.strikeDeg.toFixed(0)}°`, { sticky: true })
          .addTo(group);
      }

      for (const pl of planes) {
        L.polyline(
          [
            [pl.trace[0].lat, pl.trace[0].lon],
            [pl.trace[1].lat, pl.trace[1].lon],
          ],
          {
            color: "#c62828",
            weight: 2.5 + pl.confidence * 2,
            opacity: 0.75 + pl.confidence * 0.2,
          },
        )
          .bindTooltip(
            `${pl.label}<br/>conf ${(pl.confidence * 100).toFixed(0)}% · n=${pl.support} · RMS ${pl.rmsKm.toFixed(2)} km`,
            { sticky: true },
          )
          .addTo(group);

        L.circleMarker([pl.centroid.lat, pl.centroid.lon], {
          radius: 4,
          color: "#b71c1c",
          fillColor: "#ef5350",
          fillOpacity: 0.9,
          weight: 1,
        }).addTo(group);
      }

      if (migration.length >= 2) {
        const latlngs = migration.map(
          (m) => [m.centroid.lat, m.centroid.lon] as [number, number],
        );
        L.polyline(latlngs, {
          color: "#00838f",
          weight: 2,
          opacity: 0.85,
        }).addTo(group);
        migration.forEach((m, i) => {
          L.circleMarker([m.centroid.lat, m.centroid.lon], {
            radius: i === migration.length - 1 ? 6 : 3,
            color: "#006064",
            fillColor: i === migration.length - 1 ? "#26c6da" : "#80deea",
            fillOpacity: 0.95,
            weight: 1,
          })
            .bindTooltip(`Migration step ${i + 1} · n=${m.count}`, { direction: "top" })
            .addTo(group);
        });
      }

      const sorted = [...events].sort(
        (a, b) => magValue(a.magnitude) - magValue(b.magnitude),
      );
      for (const ev of sorted) {
        const age = eventAge01(ev.time, tRange.tMin, tRange.tMax);
        L.circleMarker([ev.latitude, ev.longitude], {
          radius: Math.max(2, leafletMagRadius(ev.magnitude) * 0.55),
          color: "rgba(0,0,0,0.25)",
          weight: 0.5,
          fillColor: timeAgeColor(age),
          fillOpacity: 0.45,
        }).addTo(group);
      }

      stressNodes.forEach((sn) => {
        const sel = sn.id === selectedNodeId;
        const marker = L.circleMarker([sn.location.lat, sn.location.lon], {
          radius: sel ? 12 : 8 + sn.score / 25,
          color: sel ? "#212121" : "#e65100",
          weight: sel ? 3 : 2,
          fillColor: sn.score >= 70 ? "#d84315" : sn.score >= 55 ? "#fb8c00" : "#ffb74d",
          fillOpacity: 0.92,
        });
        marker.bindTooltip(
          `<strong>Stress node #${sn.rank}</strong> · score ${sn.score}<br/>` +
            `${sn.depthKm.toFixed(1)} km · n=${sn.eventCount} · max M${sn.maxMag.toFixed(1)}`,
          { direction: "top" },
        );
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectNode?.(sn.id);
        });
        marker.addTo(group);

        L.marker([sn.location.lat, sn.location.lon], {
          icon: L.divIcon({
            className: "supt-node-label",
            html: `<div style="font:700 10px/1 ui-monospace,monospace;color:#1a1a1a;background:rgba(255,255,255,.85);border-radius:4px;padding:1px 4px;border:1px solid rgba(0,0,0,.2)">${sn.rank}</div>`,
            iconSize: [18, 14],
            iconAnchor: [-6, 20],
          }),
        }).addTo(group);
      });
    }
    drawRef.current = draw;

    async function init() {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        zoomControl: false,
        preferCanvas: true,
        attributionControl: true,
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap · SUPT overlay SES",
      }).addTo(map);

      const view = node.mapView ?? node.bbox;
      const pad = node.mapPad ?? 0.015;
      map.fitBounds(
        L.latLngBounds(
          [view.minLat - pad, view.minLon - pad],
          [view.maxLat + pad, view.maxLon + pad],
        ),
        {
          padding: [16, 16],
          maxZoom: node.id === "campi-flegrei" ? 13 : 8,
        },
      );

      if (node.volcano?.outline && node.volcano.outline.length > 2) {
        const ring = node.volcano.outline.map(
          ([lon, lat]) => [lat, lon] as [number, number],
        );
        L.polygon(ring, {
          color: "#1565c0",
          weight: 1.5,
          dashArray: "5 4",
          fillColor: "#1976d2",
          fillOpacity: 0.05,
        }).addTo(map);
      }

      layersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      window.setTimeout(() => {
        map.invalidateSize();
        void draw();
      }, 80);
    }

    void init();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layersRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  useEffect(() => {
    void drawRef.current();
  }, [events, planes, stressNodes, lineaments, migration, stressField, selectedNodeId, tRange]);

  // After first fabric load, gently frame stress nodes once
  const fittedFabric = useRef(false);
  useEffect(() => {
    if (fittedFabric.current) return;
    if (stressNodes.length < 1) return;
    fittedFabric.current = true;
    void fitToFabric();
  }, [stressNodes, fitToFabric]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize({ animate: false });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullscreen]);

  const shellStyle = fullscreen
    ? undefined
    : typeof height === "number"
      ? { height }
      : { height };

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#d8e0e8]",
        fullscreen
          ? "fixed inset-0 z-[100] rounded-none"
          : "h-full w-full rounded-lg",
        className,
      )}
      style={shellStyle}
    >
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {showControls && (
        <div className="absolute top-2 left-2 z-20 flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1 border border-border bg-card/95 px-2 text-[11px] shadow-md backdrop-blur-sm"
            onClick={() => void goHome()}
            title="Home — focus node caldera / arc"
          >
            <Home className="size-3.5" />
            Home
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1 border border-border bg-card/95 px-2 text-[11px] shadow-md backdrop-blur-sm"
            onClick={() => void fitToFabric()}
            title="Frame stress nodes & fractures"
          >
            Fabric
          </Button>
          <Button
            type="button"
            size="sm"
            variant={fullscreen ? "default" : "secondary"}
            className="h-8 gap-1 border border-border bg-card/95 px-2 text-[11px] shadow-md backdrop-blur-sm"
            onClick={() => setFs(!fullscreen)}
            title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen stress map"}
          >
            {fullscreen ? (
              <>
                <Minimize2 className="size-3.5" />
                Exit
              </>
            ) : (
              <>
                <Expand className="size-3.5" />
                Full
              </>
            )}
          </Button>
          {fullscreen && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 border border-border bg-card/95 px-0 shadow-md"
              onClick={() => setFs(false)}
              title="Close fullscreen"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[160px] rounded-md border border-border/80 bg-card/95 px-2 py-1.5 text-[10px] text-muted-foreground shadow-md backdrop-blur-sm">
        <div className="mb-1 font-medium text-foreground">SUPT layers</div>
        <div className="space-y-0.5">
          <Row color="#e65100" label="Stress nodes" />
          <Row color="#c62828" label="Fracture traces" />
          <Row color="#5c6bc0" label="Lineaments" />
          <Row color="#00838f" label="Migration path" />
          <Row color="#ffcc80" label="Stress field" />
        </div>
      </div>

      {fullscreen && (
        <div className="pointer-events-none absolute top-2 right-2 z-20 rounded-md border border-border/80 bg-card/95 px-2 py-1 font-mono text-[10px] text-muted-foreground shadow-md backdrop-blur-sm">
          {node.code} · stress & fracture · Esc to exit
        </div>
      )}
    </div>
  );
}

function Row({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}

function intensityColor(i: number): string {
  if (i >= 0.75) return "#e65100";
  if (i >= 0.5) return "#fb8c00";
  if (i >= 0.3) return "#ffb74d";
  return "#ffe0b2";
}
