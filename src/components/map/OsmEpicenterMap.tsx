import { useEffect, useMemo, useRef } from "react";
import type { FocusNode, QuakeEvent } from "@/lib/seismic/types";
import {
  depthColor,
  eventAge01,
  leafletMagRadius,
  magColor,
  timeAgeColor,
} from "@/lib/seismic/colors";
import {
  formatDateTime,
  formatDepth,
  formatRelativeTime,
  magValue,
  cn,
} from "@/lib/utils";
import { gossipOfficialMapUrl } from "@/lib/seismic/providers/gossip";
import { basemapTileOptions, basemapTileUrl } from "@/lib/map/tiles";

export type MapColorMode = "time" | "magnitude" | "depth";

type Props = {
  node: FocusNode;
  events: QuakeEvent[];
  selectedId?: string | null;
  onSelect?: (ev: QuakeEvent | null) => void;
  colorMode?: MapColorMode;
  className?: string;
};

/**
 * Real basemap (OpenStreetMap) + INGV-style epicenter circles.
 * Viewport locks to focus-node bbox (not outlier events) so CF stays caldera-tight.
 */
export function OsmEpicenterMap({
  node,
  events,
  selectedId,
  onSelect,
  colorMode = "time",
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const eventsRef = useRef(events);
  const colorModeRef = useRef(colorMode);
  const nodeRef = useRef(node);
  selectedRef.current = selectedId;
  onSelectRef.current = onSelect;
  eventsRef.current = events;
  colorModeRef.current = colorMode;
  nodeRef.current = node;

  const tRange = useMemo(() => {
    if (events.length === 0) {
      const now = Date.now();
      return { tMin: now - 86_400_000, tMax: now };
    }
    const times = events.map((e) => e.time);
    return { tMin: Math.min(...times), tMax: Math.max(...times) };
  }, [events]);
  const tRangeRef = useRef(tRange);
  tRangeRef.current = tRange;

  async function redrawMarkers() {
    const L = await import("leaflet");
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;

    const evs = eventsRef.current;
    const mode = colorModeRef.current;
    const n = nodeRef.current;
    const { tMin, tMax } = tRangeRef.current;

    group.clearLayers();

    const sorted = [...evs].sort(
      (a, b) => magValue(a.magnitude, 0) - magValue(b.magnitude, 0),
    );

    for (const ev of sorted) {
      const age = eventAge01(ev.time, tMin, tMax);
      const fill =
        mode === "time"
          ? timeAgeColor(age)
          : mode === "depth"
            ? depthColor(ev.depthKm, n.depthRangeKm.shallow, n.depthRangeKm.deep)
            : magColor(ev.magnitude);

      const r = leafletMagRadius(ev.magnitude);
      const isSel = ev.id === selectedRef.current;
      const isBig = magValue(ev.magnitude, 0) >= 4;

      const circle = L.circleMarker([ev.latitude, ev.longitude], {
        radius: isSel ? r + 2 : r,
        color: isSel ? "#0a0a0b" : isBig ? "#1a1a1a" : "rgba(0,0,0,0.35)",
        weight: isSel ? 2.5 : 1,
        fillColor: fill,
        fillOpacity: isSel ? 0.95 : 0.78,
      });

      const magLabel =
        ev.magnitude == null ? "N/D" : `M${ev.magnitude.toFixed(1)} ${ev.magType}`;
      circle.bindTooltip(
        `<div style="font:12px/1.35 ui-sans-serif,system-ui">
          <strong style="font-family:ui-monospace,monospace">${magLabel}</strong><br/>
          ${formatDepth(ev.depthKm)} · ${formatRelativeTime(ev.time)}<br/>
          <span style="opacity:.75">${ev.latitude.toFixed(4)}N ${ev.longitude.toFixed(4)}E</span><br/>
          <span style="opacity:.7">${formatDateTime(ev.time)}</span>
        </div>`,
        { direction: "top", opacity: 0.95, className: "eq-tooltip" },
      );

      circle.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRef.current?.(ev);
      });

      circle.addTo(group);
    }
    // Viewport stays on node bbox — do not fitBounds to outliers
  }

  // Init map once per node
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true,
        // smoother pan: don't re-layout markers every frame mid-gesture
        fadeAnimation: true,
        zoomAnimation: true,
        markerZoomAnimation: false,
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer(basemapTileUrl("voyager"), {
        ...basemapTileOptions("voyager"),
        attribution:
          basemapTileOptions("voyager").attribution +
          " · catalog INGV-OV GOSSIP / FDSN",
      }).addTo(map);

      // Focus-node viewport — prefer mapView (tight CF caldera); never fit to outliers
      const view = node.mapView ?? node.bbox;
      const pad = node.mapPad ?? 0.02;
      const bounds = L.latLngBounds(
        [view.minLat - pad, view.minLon - pad],
        [view.maxLat + pad, view.maxLon + pad],
      );
      // CF: caldera fills frame; TK needs more room
      const maxZoom = node.id === "campi-flegrei" ? 13 : 8;
      map.fitBounds(bounds, {
        padding: [8, 8],
        maxZoom,
        animate: false,
      });

      if (node.volcano?.outline && node.volcano.outline.length > 2) {
        const ring = node.volcano.outline.map(
          ([lon, lat]) => [lat, lon] as [number, number],
        );
        L.polygon(ring, {
          color: "#1565c0",
          weight: 1.5,
          dashArray: "5 4",
          fillColor: "#1976d2",
          fillOpacity: 0.06,
        }).addTo(map);
      }

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      map.on("click", () => onSelectRef.current?.(null));

      window.setTimeout(() => {
        map.invalidateSize();
        void redrawMarkers();
      }, 80);
    }

    void init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  useEffect(() => {
    void redrawMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, colorMode, tRange, selectedId]);

  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const ev = events.find((e) => e.id === selectedId);
    if (!ev) return;
    mapRef.current.panTo([ev.latitude, ev.longitude], { animate: true });
  }, [selectedId, events]);

  // Keep map sized when parent flex/height changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize({ animate: false });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const officialUrl =
    node.volcano?.officialMapUrl ?? gossipOfficialMapUrl(new Date().getUTCFullYear());

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-lg", className)}>
      <div ref={containerRef} className="absolute inset-0 z-0 bg-[#d8e0e8]" />

      {/* Legend — bottom-left, clear of zoom (bottom-right) */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[200px] rounded-md border border-border/80 bg-card/95 px-2 py-1.5 text-[10px] text-muted-foreground shadow-md backdrop-blur-sm">
        <div className="mb-0.5 font-medium text-foreground">
          {colorMode === "time"
            ? "Event age"
            : colorMode === "magnitude"
              ? "Magnitude"
              : "Depth"}
        </div>
        {colorMode === "time" ? (
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: "#e53935" }} />
            <span className="size-2 rounded-full" style={{ background: "#fb8c00" }} />
            <span className="size-2 rounded-full" style={{ background: "#fdd835" }} />
            <span className="size-2 rounded-full" style={{ background: "#9ccc65" }} />
            <span className="size-2 rounded-full" style={{ background: "#43a047" }} />
            <span className="ml-1">new → old</span>
          </div>
        ) : colorMode === "magnitude" ? (
          <span>Size ∝ Md · grey = N/D</span>
        ) : (
          <span>Warm = shallow · cool = deeper</span>
        )}
      </div>

      {/* Top-right: official map only (event count lives in card chrome) */}
      <div className="absolute top-2 right-2 z-10">
        <a
          href={officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card/95 px-2 text-[10px] font-medium text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-muted"
        >
          GOSSIP
        </a>
      </div>
    </div>
  );
}
