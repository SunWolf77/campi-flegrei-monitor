import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  /** Stress density field — violet haze (≠ amber nodes, ≠ magenta lines) */
  fieldHot: "#7e57c2",
  fieldMid: "#b39ddb",
  fieldCool: "#d1c4e9",
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
  /** Toggle layers — shape + colour in legend for clarity */
  const [layers, setLayers] = useState({
    field: true,
    events: true,
    lineaments: true,
    fractures: true,
    axes: true,
    migration: true,
    nodes: true,
  });
  const layersRefState = useRef(layers);
  layersRefState.current = layers;
  const toggleLayer = (k: keyof typeof layers) =>
    setLayers((prev) => ({ ...prev, [k]: !prev[k] }));

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

      const vis = layersRefState.current;

      // Stress density field (soft purple haze — not amber, not magenta)
      if (vis.field) {
        for (const cell of stressField) {
          if (cell.intensity < 0.12) continue;
          L.circleMarker([cell.lat, cell.lon], {
            radius: 7 + cell.intensity * 16,
            stroke: false,
            fillColor: fieldColor(cell.intensity),
            fillOpacity: 0.08 + cell.intensity * 0.22,
          }).addTo(group);
        }
      }

      // Lineaments — indigo dashed (fabric grain)
      if (vis.lineaments) for (const lin of lineaments) {
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

      // Fracture traces — MAGENTA solid + white halo (line ≠ circle)
      if (vis.fractures) for (const pl of planes) {
        // white underlay for contrast on basemap
        L.polyline(
          [
            [pl.trace[0].lat, pl.trace[0].lon],
            [pl.trace[1].lat, pl.trace[1].lon],
          ],
          {
            color: "#ffffff",
            weight: 6 + pl.confidence * 2.5,
            opacity: 0.85,
            lineCap: "round",
          },
        ).addTo(group);
        L.polyline(
          [
            [pl.trace[0].lat, pl.trace[0].lon],
            [pl.trace[1].lat, pl.trace[1].lon],
          ],
          {
            color: C.fracture,
            weight: 3 + pl.confidence * 2.5,
            opacity: 0.95,
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

        // Principal-axis proxy (optional)
        if (vis.axes) drawStressAxes(L, group, pl, C);
      }

      // Migration — teal arrows-ish path
      if (vis.migration && migration.length >= 2) {
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

      // Events (subtle grey-blue dots — not SUPT targets)
      if (vis.events) {
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
          fillOpacity: 0.35,
        }).addTo(group);
      }
      }

      // Stress nodes — numbered AMBER BADGES (shape ≠ fracture lines)
      if (vis.nodes) stressNodes.forEach((sn) => {
        const sel = sn.id === selectedNodeId;
        const size = sel ? 28 : 22;
        const fill = sn.score >= 70 ? "#ff8f00" : sn.score >= 55 ? C.nodeFill : "#ffe082";
        const ring = sel ? C.nodeSel : "#1a1200";
        const icon = L.divIcon({
          className: "supt-node-badge",
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:${fill};border:2.5px solid ${ring};
            box-shadow:0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,.35);
            display:flex;align-items:center;justify-content:center;
            font:800 11px/1 ui-monospace,monospace;color:#1a1200;
          ">${sn.rank}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        const marker = L.marker([sn.location.lat, sn.location.lon], {
          icon,
          zIndexOffset: 800,
        });
        marker.bindTooltip(
          `<strong style="color:#e65100">● Stress node #${sn.rank}</strong> · score ${sn.score}<br/>` +
            `${sn.depthKm.toFixed(1)} km · n=${sn.eventCount} · max M${sn.maxMag.toFixed(1)}<br/>` +
            `<span style="opacity:.8">Ranked density/energy zone — not a forecast.</span>`,
          { direction: "top" },
        );
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectNode?.(sn.id);
        });
        marker.addTo(group);
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
  }, [events, planes, stressNodes, lineaments, migration, stressField, selectedNodeId, tRange, layers]);

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

      {/* Interactive legend — shape + colour + toggle */}
      <div className="absolute bottom-3 left-3 z-20 w-[200px] rounded-md border border-border bg-card/98 p-2 text-[10px] shadow-lg backdrop-blur-sm">
        <div className="mb-1.5 font-semibold text-foreground">Layers · tap to toggle</div>
        <div className="flex flex-col gap-0.5">
          <LayerToggle
            on={layers.nodes}
            onClick={() => toggleLayer("nodes")}
            glyph={<GlyphNode />}
            label="Stress nodes"
            hint="numbered amber discs"
          />
          <LayerToggle
            on={layers.fractures}
            onClick={() => toggleLayer("fractures")}
            glyph={<GlyphLine color={C.fracture} />}
            label="Fracture planes"
            hint="magenta lines"
          />
          <LayerToggle
            on={layers.axes}
            onClick={() => toggleLayer("axes")}
            glyph={<GlyphAxes />}
            label="σ axes"
            hint="black ∥ · blue ⊥"
          />
          <LayerToggle
            on={layers.lineaments}
            onClick={() => toggleLayer("lineaments")}
            glyph={<GlyphDash color={C.lineament} />}
            label="Lineaments"
            hint="indigo dashed"
          />
          <LayerToggle
            on={layers.migration}
            onClick={() => toggleLayer("migration")}
            glyph={<GlyphLine color={C.migration} thick />}
            label="Migration"
            hint="teal path"
          />
          <LayerToggle
            on={layers.field}
            onClick={() => toggleLayer("field")}
            glyph={<GlyphBlob color={C.fieldMid} />}
            label="Stress field"
            hint="violet haze"
          />
          <LayerToggle
            on={layers.events}
            onClick={() => toggleLayer("events")}
            glyph={<GlyphDot />}
            label="Earthquakes"
            hint="small age dots"
          />
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
            Amber numbered discs = stress nodes. Magenta lines = fracture planes. Tap legend to
            isolate layers. Co-location is observational — not a forecast.
          </p>
        </div>
      )}
    </div>
  );
}

function LayerToggle({
  on,
  onClick,
  glyph,
  label,
  hint,
}: {
  on: boolean;
  onClick: () => void;
  glyph: ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors",
        on ? "bg-secondary/60 text-foreground" : "text-muted-foreground opacity-55 line-through",
      )}
      title={on ? `Hide ${label}` : `Show ${label}`}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">{glyph}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium leading-tight">{label}</span>
        <span className="block text-[9px] leading-tight opacity-70">{hint}</span>
      </span>
      <span className="font-mono text-[9px] opacity-60">{on ? "on" : "off"}</span>
    </button>
  );
}

function GlyphNode() {
  return (
    <span
      className="flex size-4 items-center justify-center rounded-full border-2 border-black bg-[#ffb300] text-[8px] font-bold text-black shadow-[0_0_0_1px_#fff]"
      aria-hidden
    >
      1
    </span>
  );
}

function GlyphLine({ color, thick }: { color: string; thick?: boolean }) {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden>
      <line
        x1="1"
        y1="5"
        x2="17"
        y2="5"
        stroke={color}
        strokeWidth={thick ? 3 : 2.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlyphDash({ color }: { color: string }) {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden>
      <line
        x1="1"
        y1="5"
        x2="17"
        y2="5"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="3 2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlyphAxes() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <line x1="2" y1="8" x2="14" y2="8" stroke="#212121" strokeWidth="2" />
      <line x1="8" y1="2" x2="8" y2="14" stroke="#1565c0" strokeWidth="2" strokeDasharray="2 1" />
    </svg>
  );
}

function GlyphBlob({ color }: { color: string }) {
  return (
    <span
      className="size-4 rounded-full opacity-80"
      style={{ background: color }}
      aria-hidden
    />
  );
}

function GlyphDot() {
  return <span className="size-2 rounded-full bg-neutral-500" aria-hidden />;
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
