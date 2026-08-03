import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Expand, HelpCircle, Home, Minimize2, X } from "lucide-react";
import type { FocusNode, QuakeEvent } from "@/lib/seismic/types";
import type { FracturePlane, StressNode, Lineament, MigrationStep } from "@/lib/seismic/supt";
import { leafletMagRadius, timeAgeColor, eventAge01 } from "@/lib/seismic/colors";
import { magValue, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Distinct SUPT layer palette — nodes ≠ fractures */
export const SUPT_LAYER_COLORS = {
  /** Stress nodes — amber core, dark ring */
  nodeFill: "#ffb300",
  nodeStroke: "#1a1200",
  nodeSel: "#ff6f00",
  /** Fracture traces — magenta (not orange) */
  fracture: "#c2185b",
  fractureTick: "#880e4f",
  /** Lineaments — indigo dashed */
  lineament: "#3949ab",
  /** Migration — teal */
  migration: "#00838f",
  migrationEnd: "#26c6da",
  /** Stress density field — soft coral, low opacity */
  fieldHot: "#e64a19",
  fieldMid: "#ff8a65",
  fieldCool: "#ffccbc",
  /** Principal axes */
  sigmaParallel: "#212121",
  sigmaNormal: "#1565c0",
} as const;

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
  height?: number | string;
  showControls?: boolean;
  defaultFullscreen?: boolean;
  onFullscreenChange?: (fs: boolean) => void;
};

/**
 * Leaflet map with SUPT overlays.
 * Colors: amber nodes · magenta fractures · indigo lineaments · teal migration.
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
  const [helpOpen, setHelpOpen] = useState(false);

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

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === "Escape") {
        if (helpOpen) setHelpOpen(false);
        else if (fullscreen) setFs(false);
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "h" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        void goHome();
      } else if (k === "g" && !e.metaKey && !e.ctrlKey) {
        // g = fabric / geometry frame (F is often find)
        e.preventDefault();
        void fitToFabric();
      } else if (k === "f" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setFs(!fullscreen);
      } else if ((k === "+" || k === "=") && mapRef.current) {
        e.preventDefault();
        mapRef.current.zoomIn();
      } else if ((k === "-" || k === "_") && mapRef.current) {
        e.preventDefault();
        mapRef.current.zoomOut();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, helpOpen, setFs, goHome, fitToFabric]);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      const L = await import("leaflet");
      const map = mapRef.current;
      const group = layersRef.current;
      if (!map || !group) return;
      group.clearLayers();
      const C = SUPT_LAYER_COLORS;

      // Stress density field (soft coral — not same as nodes)
      for (const cell of stressField) {
        if (cell.intensity < 0.12) continue;
        L.circleMarker([cell.lat, cell.lon], {
          radius: 6 + cell.intensity * 14,
          stroke: false,
          fillColor: fieldColor(cell.intensity),
          fillOpacity: 0.1 + cell.intensity * 0.28,
        }).addTo(group);
      }

      // Lineaments — indigo dashed (fabric grain)
      for (const lin of lineaments) {
        L.polyline(
          [
            [lin.endpoints[0].lat, lin.endpoints[0].lon],
            [lin.endpoints[1].lat, lin.endpoints[1].lon],
          ],
          {
            color: C.lineament,
            weight: 1.5 + lin.weight * 2,
            dashArray: "7 5",
            opacity: 0.55 + lin.weight * 0.35,
          },
        )
          .bindTooltip(`Lineament ~${lin.strikeDeg.toFixed(0)}° (pairwise fabric)`, {
            sticky: true,
          })
          .addTo(group);
      }

      // Fracture traces — MAGENTA solid (distinct from amber nodes)
      for (const pl of planes) {
        L.polyline(
          [
            [pl.trace[0].lat, pl.trace[0].lon],
            [pl.trace[1].lat, pl.trace[1].lon],
          ],
          {
            color: C.fracture,
            weight: 3 + pl.confidence * 2.5,
            opacity: 0.88,
            lineCap: "round",
          },
        )
          .bindTooltip(
            `<strong style="color:${C.fracture}">Fracture · ${pl.label}</strong><br/>` +
              `strike ${pl.strikeDeg.toFixed(0)}° · dip ${pl.dipDeg.toFixed(0)}°<br/>` +
              `conf ${(pl.confidence * 100).toFixed(0)}% · n=${pl.support} · RMS ${pl.rmsKm.toFixed(2)} km`,
            { sticky: true },
          )
          .addTo(group);

        // Strike tick at centroid (small magenta diamond)
        L.circleMarker([pl.centroid.lat, pl.centroid.lon], {
          radius: 5,
          color: C.fractureTick,
          fillColor: C.fracture,
          fillOpacity: 1,
          weight: 2,
        })
          .bindTooltip(`Plane centroid · strike ${pl.strikeDeg.toFixed(0)}°`)
          .addTo(group);

        // Principal-axis proxy: strike-parallel (σ∥) and map-projected normal (σ⊥)
        drawStressAxes(L, group, pl, C);
      }

      // Migration — teal
      if (migration.length >= 2) {
        const latlngs = migration.map(
          (m) => [m.centroid.lat, m.centroid.lon] as [number, number],
        );
        L.polyline(latlngs, {
          color: C.migration,
          weight: 2.5,
          opacity: 0.9,
        }).addTo(group);
        migration.forEach((m, i) => {
          L.circleMarker([m.centroid.lat, m.centroid.lon], {
            radius: i === migration.length - 1 ? 7 : 3.5,
            color: "#004d40",
            fillColor: i === migration.length - 1 ? C.migrationEnd : C.migration,
            fillOpacity: 0.95,
            weight: 1.5,
          })
            .bindTooltip(`Migration step ${i + 1} · n=${m.count}`, { direction: "top" })
            .addTo(group);
        });
      }

      // Events (subtle)
      const sorted = [...events].sort(
        (a, b) => magValue(a.magnitude) - magValue(b.magnitude),
      );
      for (const ev of sorted) {
        const age = eventAge01(ev.time, tRange.tMin, tRange.tMax);
        L.circleMarker([ev.latitude, ev.longitude], {
          radius: Math.max(2, leafletMagRadius(ev.magnitude) * 0.55),
          color: "rgba(0,0,0,0.2)",
          weight: 0.5,
          fillColor: timeAgeColor(age),
          fillOpacity: 0.4,
        }).addTo(group);
      }

      // Stress nodes — AMBER (not magenta) with dark ring + rank
      stressNodes.forEach((sn) => {
        const sel = sn.id === selectedNodeId;
        const marker = L.circleMarker([sn.location.lat, sn.location.lon], {
          radius: sel ? 13 : 9 + sn.score / 28,
          color: sel ? C.nodeSel : C.nodeStroke,
          weight: sel ? 3.5 : 2.5,
          fillColor: sn.score >= 70 ? "#ff8f00" : sn.score >= 55 ? C.nodeFill : "#ffe082",
          fillOpacity: 0.95,
        });
        marker.bindTooltip(
          `<strong style="color:#e65100">Stress node #${sn.rank}</strong> · score ${sn.score}<br/>` +
            `${sn.depthKm.toFixed(1)} km · n=${sn.eventCount} · max M${sn.maxMag.toFixed(1)}<br/>` +
            `<span style="opacity:.8">Density / energy / shallowness proxy — not a forecast.</span>`,
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
            html: `<div style="font:700 10px/1 ui-monospace,monospace;color:#1a1200;background:#fff8e1;border-radius:4px;padding:1px 4px;border:1.5px solid #ff8f00;box-shadow:0 1px 2px rgba(0,0,0,.2)">${sn.rank}</div>`,
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

  const C = SUPT_LAYER_COLORS;

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
            title="Home (H) — focus caldera"
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
            title="Fabric (G) — frame stress & fractures"
          >
            Fabric
          </Button>
          <Button
            type="button"
            size="sm"
            variant={fullscreen ? "default" : "secondary"}
            className="h-8 gap-1 border border-border bg-card/95 px-2 text-[11px] shadow-md backdrop-blur-sm"
            onClick={() => setFs(!fullscreen)}
            title="Fullscreen (F) · Esc exit"
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
          <Button
            type="button"
            size="sm"
            variant={helpOpen ? "default" : "secondary"}
            className="h-8 w-8 border border-border bg-card/95 px-0 shadow-md"
            onClick={() => setHelpOpen((v) => !v)}
            title="Keys (?)"
          >
            <HelpCircle className="size-3.5" />
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

      {/* Legend — distinct colors */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[190px] rounded-md border border-border/80 bg-card/95 px-2 py-1.5 text-[10px] text-muted-foreground shadow-md backdrop-blur-sm">
        <div className="mb-1 font-medium text-foreground">SUPT layers</div>
        <div className="space-y-0.5">
          <Row color={C.nodeFill} border={C.nodeStroke} label="Stress nodes (amber)" />
          <Row color={C.fracture} label="Fracture traces (magenta)" />
          <Row color={C.lineament} label="Lineaments (indigo)" />
          <Row color={C.migration} label="Migration path (teal)" />
          <Row color={C.fieldMid} label="Stress field (coral)" />
          <Row color={C.sigmaNormal} label="σ⊥ normal (blue tick)" />
        </div>
      </div>

      {fullscreen && (
        <div className="pointer-events-none absolute top-2 right-2 z-20 rounded-md border border-border/80 bg-card/95 px-2 py-1 font-mono text-[10px] text-muted-foreground shadow-md backdrop-blur-sm">
          {node.code} · stress & fracture · Esc exit · ? keys
        </div>
      )}

      {helpOpen && (
        <div className="absolute inset-x-2 bottom-16 z-30 mx-auto max-w-md rounded-lg border border-border bg-card/98 p-3 text-xs shadow-xl backdrop-blur-md sm:inset-x-auto sm:left-3 sm:right-auto">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold">Keyboard · Stress map</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setHelpOpen(false)}
            >
              Close
            </button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
            <dt className="text-accent">H</dt>
            <dd>Home — node caldera / arc frame</dd>
            <dt className="text-accent">G</dt>
            <dd>Fabric — fit stress nodes + fractures</dd>
            <dt className="text-accent">F</dt>
            <dd>Toggle fullscreen</dd>
            <dt className="text-accent">+ / −</dt>
            <dd>Zoom in / out</dd>
            <dt className="text-accent">Esc</dt>
            <dd>Exit fullscreen / close help</dd>
            <dt className="text-accent">?</dt>
            <dd>This help</dd>
          </dl>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Amber = where energy/density piles up. Magenta = PCA fracture geometry. Connecting
            them is observational co-location — not a forecast of the next break.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  color,
  label,
  border,
}: {
  color: string;
  label: string;
  border?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{
          background: color,
          boxShadow: border ? `inset 0 0 0 1.5px ${border}` : undefined,
        }}
      />
      {label}
    </div>
  );
}

function fieldColor(i: number): string {
  if (i >= 0.75) return SUPT_LAYER_COLORS.fieldHot;
  if (i >= 0.5) return SUPT_LAYER_COLORS.fieldMid;
  return SUPT_LAYER_COLORS.fieldCool;
}

/** Map-plane principal axes from fracture strike/dip (geometric proxy, not CMT). */
function drawStressAxes(
  L: typeof import("leaflet"),
  group: import("leaflet").LayerGroup,
  pl: FracturePlane,
  C: typeof SUPT_LAYER_COLORS,
) {
  const lat0 = (pl.centroid.lat * Math.PI) / 180;
  const kmN = 0.9; // half-length of axis ticks (km)
  const strike = (pl.strikeDeg * Math.PI) / 180;
  // Strike direction (along fracture, map horizontal)
  const dLatS = (kmN * Math.cos(strike)) / 110.574;
  const dLonS = (kmN * Math.sin(strike)) / (111.32 * Math.cos(lat0));
  // Normal in map plane (strike + 90°)
  const dLatN = (kmN * Math.cos(strike + Math.PI / 2)) / 110.574;
  const dLonN = (kmN * Math.sin(strike + Math.PI / 2)) / (111.32 * Math.cos(lat0));

  const c = pl.centroid;
  // σ∥ strike-parallel (black)
  L.polyline(
    [
      [c.lat - dLatS, c.lon - dLonS],
      [c.lat + dLatS, c.lon + dLonS],
    ],
    { color: C.sigmaParallel, weight: 2, opacity: 0.85 },
  )
    .bindTooltip(`σ∥ strike-parallel ~${pl.strikeDeg.toFixed(0)}° (fabric proxy)`)
    .addTo(group);

  // σ⊥ map-normal to strike (blue) — opening/compression orientation proxy
  L.polyline(
    [
      [c.lat - dLatN * 0.7, c.lon - dLonN * 0.7],
      [c.lat + dLatN * 0.7, c.lon + dLonN * 0.7],
    ],
    { color: C.sigmaNormal, weight: 2, opacity: 0.9, dashArray: "2 3" },
  )
    .bindTooltip(
      `σ⊥ horizontal normal to strike · dip ${pl.dipDeg.toFixed(0)}° plane (not a full tensor)`,
    )
    .addTo(group);
}
