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
 * Mirrors the GOSSIP "Localizzazioni Sismiche" presentation:
 * size ∝ magnitude, colour by event age (default) / mag / depth.
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
  const fittedRef = useRef(false);
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

    if (evs.length > 0 && !fittedRef.current) {
      const lats = evs.map((e) => e.latitude);
      const lons = evs.map((e) => e.longitude);
      const pad = 0.012;
      const bounds = L.latLngBounds(
        [Math.min(...lats) - pad, Math.min(...lons) - pad],
        [Math.max(...lats) + pad, Math.max(...lons) + pad],
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: false });
      fittedRef.current = true;
    }
  }

  // Init map once per node
  useEffect(() => {
    let cancelled = false;
    fittedRef.current = false;

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
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · catalog INGV-OV GOSSIP / FDSN',
      }).addTo(map);

      const bounds = L.latLngBounds(
        [node.bbox.minLat, node.bbox.minLon],
        [node.bbox.maxLat, node.bbox.maxLon],
      );
      map.fitBounds(bounds, { padding: [24, 24] });

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

      // Invalidate size after layout (card animation / flex)
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

  const officialUrl =
    node.volcano?.officialMapUrl ?? gossipOfficialMapUrl(new Date().getUTCFullYear());

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-lg", className)}>
      <div ref={containerRef} className="absolute inset-0 z-0 bg-[#d8e0e8]" />

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[210px] rounded-md border border-border/80 bg-card/95 px-2.5 py-2 text-[10px] text-muted-foreground shadow-md backdrop-blur-sm">
        <div className="mb-1 font-medium text-foreground">
          {colorMode === "time"
            ? "Event age (window)"
            : colorMode === "magnitude"
              ? "Magnitude"
              : "Depth"}
        </div>
        {colorMode === "time" ? (
          <div className="flex items-center gap-1">
            <span className="size-2.5 rounded-full" style={{ background: "#e53935" }} />
            <span className="size-2.5 rounded-full" style={{ background: "#fb8c00" }} />
            <span className="size-2.5 rounded-full" style={{ background: "#fdd835" }} />
            <span className="size-2.5 rounded-full" style={{ background: "#9ccc65" }} />
            <span className="size-2.5 rounded-full" style={{ background: "#43a047" }} />
            <span className="ml-1">new → old</span>
          </div>
        ) : colorMode === "magnitude" ? (
          <span>Size ∝ Md · grey = N/D</span>
        ) : (
          <span>Warm = shallow · cool = deeper</span>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-foreground/40" /> ~0
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-foreground/40" /> ~2
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-3.5 rounded-full bg-foreground/40" /> ~4
          </span>
        </div>
      </div>

      <a
        href={officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 right-3 z-10 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-card/95 px-2.5 text-[11px] font-medium text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-muted"
      >
        Open INGV GOSSIP map
      </a>

      <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-md border border-border/80 bg-card/95 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm">
        {events.length.toLocaleString()} events · OSM basemap
      </div>
    </div>
  );
}
