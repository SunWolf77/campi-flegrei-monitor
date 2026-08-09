import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  basemapTileOptions,
  basemapTileUrl,
  defaultBasemapForNode,
  type BasemapKind,
} from "@/lib/map/tiles";
import {
  stationColor,
  type SeismicStation,
} from "@/lib/seismic/stations";
import { getBasemapPref, setBasemapPref } from "@/lib/ui/prefs";

export type MapColorMode = "time" | "magnitude" | "depth";

type Props = {
  node: FocusNode;
  events: QuakeEvent[];
  selectedId?: string | null;
  onSelect?: (ev: QuakeEvent | null) => void;
  colorMode?: MapColorMode;
  className?: string;
  /** INGV-OV (+ TESNET) stations */
  stations?: SeismicStation[];
  showStations?: boolean;
  onToggleStations?: () => void;
};

function catalogAttribution(node: FocusNode): string {
  if (node.id === "tonga-kermadec") {
    return " · catalog USGS FDSN";
  }
  return " · catalog INGV-OV GOSSIP / FDSN · stations FDSN";
}

function officialMapLabel(node: FocusNode): string {
  return node.id === "tonga-kermadec" ? "USGS" : "GOSSIP";
}

function officialMapHref(node: FocusNode): string {
  if (node.id === "tonga-kermadec") {
    return (
      "https://earthquake.usgs.gov/earthquakes/map/?extent=-37,-180&extent=-14,-168" +
      "&range=week&magnitude=all&baseLayer=satellite"
    );
  }
  return node.volcano?.officialMapUrl ?? gossipOfficialMapUrl(new Date().getUTCFullYear());
}

function stationTriangleIcon(
  L: typeof import("leaflet"),
  color: string,
  label: string,
) {
  return L.divIcon({
    className: "cf-station-icon",
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-85%);pointer-events:auto">
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:11px solid ${color};filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))"></div>
      <span style="margin-top:1px;font:600 8px/1 ui-monospace,monospace;color:${color};text-shadow:0 0 2px #fff,0 0 3px #fff;white-space:nowrap">${label}</span>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/** Resolve initial basemap: localStorage preference → hard default (satellite 2D). */
function resolveBasemap(_nodeId: string): BasemapKind {
  return getBasemapPref() ?? defaultBasemapForNode(_nodeId);
}

/**
 * Real basemap + epicenter circles + optional INGV station layer.
 * Opens in satellite 2D by default; Sat / Map / Dark toggle persists via localStorage.
 */
export function OsmEpicenterMap({
  node,
  events,
  selectedId,
  onSelect,
  colorMode = "time",
  className,
  stations = [],
  showStations = false,
  onToggleStations,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const stationLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const tileRef = useRef<import("leaflet").TileLayer | null>(null);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const eventsRef = useRef(events);
  const colorModeRef = useRef(colorMode);
  const nodeRef = useRef(node);
  const stationsRef = useRef(stations);
  const showStationsRef = useRef(showStations);
  selectedRef.current = selectedId;
  onSelectRef.current = onSelect;
  eventsRef.current = events;
  colorModeRef.current = colorMode;
  nodeRef.current = node;
  stationsRef.current = stations;
  showStationsRef.current = showStations;

  const [basemap, setBasemapState] = useState<BasemapKind>(() =>
    resolveBasemap(node.id),
  );
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;

  function selectBasemap(kind: BasemapKind) {
    setBasemapState(kind);
    setBasemapPref(kind);
  }

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
    const bm = basemapRef.current;

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
      const stroke =
        bm === "satellite" || bm === "dark"
          ? isSel
            ? "#ffffff"
            : isBig
              ? "rgba(255,255,255,0.85)"
              : "rgba(255,255,255,0.45)"
          : isSel
            ? "#0a0a0b"
            : isBig
              ? "#1a1a1a"
              : "rgba(0,0,0,0.35)";

      const plotLon =
        n.id === "tonga-kermadec" && ev.longitude > 0
          ? ev.longitude - 360
          : ev.longitude;

      const circle = L.circleMarker([ev.latitude, plotLon], {
        radius: isSel ? r + 2 : r,
        color: stroke,
        weight: isSel ? 2.5 : 1,
        fillColor: fill,
        fillOpacity: isSel ? 0.95 : 0.82,
      });

      const magLabel =
        ev.magnitude == null ? "N/D" : `M${ev.magnitude.toFixed(1)} ${ev.magType}`;
      circle.bindTooltip(
        `<div style="font:12px/1.35 ui-sans-serif,system-ui">
          <strong style="font-family:ui-monospace,monospace">${magLabel}</strong><br/>
          ${formatDepth(ev.depthKm)} · ${formatRelativeTime(ev.time)}</div>`,
        { direction: "top", opacity: 0.95, className: "eq-tooltip" },
      );

      circle.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRef.current?.(ev);
      });

      circle.addTo(group);
    }
  }

  async function redrawStations() {
    const L = await import("leaflet");
    const map = mapRef.current;
    let group = stationLayerRef.current;
    if (!map) return;

    if (!group) {
      group = L.layerGroup().addTo(map);
      stationLayerRef.current = group;
    }
    group.clearLayers();
    if (!showStationsRef.current) return;

    for (const s of stationsRef.current) {
      const color = stationColor(s);
      const marker = L.marker([s.latitude, s.longitude], {
        icon: stationTriangleIcon(L, color, s.code),
        interactive: true,
        keyboard: false,
        zIndexOffset: 200,
      });
      const elev =
        s.elevationM != null ? `${Math.round(s.elevationM)} m` : "—";
      const roleLabel =
        s.role === "permanent"
          ? "OV permanent"
          : s.role === "temporary"
            ? "TESNET / temp"
            : "Other";
      marker.bindTooltip(
        `<div style="font:12px/1.35 ui-sans-serif,system-ui;max-width:220px">
          <strong style="font-family:ui-monospace,monospace">${s.network}.${s.code}</strong>
          <span style="opacity:.7"> · ${roleLabel}</span><br/>
          <span>${s.siteName || "—"}</span><br/>
          <span style="opacity:.75">${s.latitude.toFixed(4)}N ${s.longitude.toFixed(4)}E · elev ${elev}</span>
        </div>`,
        { direction: "top", opacity: 0.95, className: "eq-tooltip" },
      );
      marker.addTo(group);
    }
  }

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
        fadeAnimation: true,
        zoomAnimation: true,
        markerZoomAnimation: false,
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);

      const kind = basemapRef.current;
      const tiles = L.tileLayer(basemapTileUrl(kind), {
        ...basemapTileOptions(kind),
        attribution: basemapTileOptions(kind).attribution + catalogAttribution(node),
      }).addTo(map);
      tileRef.current = tiles;

      const view = node.mapView ?? node.bbox;
      const pad = node.mapPad ?? 0.02;
      const bounds = L.latLngBounds(
        [view.minLat - pad, view.minLon - pad],
        [view.maxLat + pad, view.maxLon + pad],
      );
      const maxZoom = node.id === "campi-flegrei" || node.id === "vesuvius" ? 13 : 7;
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
      stationLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      map.on("click", () => onSelectRef.current?.(null));

      window.setTimeout(() => {
        map.invalidateSize();
        void redrawMarkers();
        void redrawStations();
      }, 80);
    }

    void init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        stationLayerRef.current = null;
        tileRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  useEffect(() => {
    let cancelled = false;
    async function swap() {
      const L = await import("leaflet");
      const map = mapRef.current;
      if (cancelled || !map) return;
      if (tileRef.current) {
        map.removeLayer(tileRef.current);
        tileRef.current = null;
      }
      const tiles = L.tileLayer(basemapTileUrl(basemap), {
        ...basemapTileOptions(basemap),
        attribution:
          basemapTileOptions(basemap).attribution + catalogAttribution(nodeRef.current),
      }).addTo(map);
      tileRef.current = tiles;
      void redrawMarkers();
    }
    void swap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  useEffect(() => {
    void redrawMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, colorMode, tRange, selectedId]);

  useEffect(() => {
    void redrawStations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, showStations]);

  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const ev = events.find((e) => e.id === selectedId);
    if (!ev) return;
    const plotLon =
      node.id === "tonga-kermadec" && ev.longitude > 0
        ? ev.longitude - 360
        : ev.longitude;
    mapRef.current.panTo([ev.latitude, plotLon], { animate: true });
  }, [selectedId, events, node.id]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize({ animate: false });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const officialUrl = officialMapHref(node);
  const officialLabel = officialMapLabel(node);
  const nSta = stations.length;
  const stationToggleAvailable = node.id === "campi-flegrei" || node.id === "vesuvius";

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-lg", className)}>
      <div ref={containerRef} className="absolute inset-0 z-0 bg-[#0e1014]" />

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[220px] rounded-md border border-border/80 bg-card/95 px-2 py-1.5 text-[10px] text-muted-foreground shadow-md backdrop-blur-sm">
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
          <div className="flex flex-wrap items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: "#5a6570" }} />
            <span className="size-2 rounded-full" style={{ background: "#6a9bb0" }} />
            <span className="size-2 rounded-full" style={{ background: "#c9a05a" }} />
            <span className="size-2 rounded-full" style={{ background: "#d4784a" }} />
            <span className="size-2 rounded-full" style={{ background: "#e05555" }} />
            <span className="ml-1">size ∝ M · colour = mag band</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: "#e07060" }} />
            <span className="size-2 rounded-full" style={{ background: "#c9a05a" }} />
            <span className="size-2 rounded-full" style={{ background: "#5a8fbf" }} />
            <span className="ml-1">warm = shallow · cool = deeper</span>
          </div>
        )}
        {showStations && nSta > 0 && (
          <div className="mt-1.5 border-t border-border/60 pt-1">
            <div className="mb-0.5 font-medium text-foreground">Stations</div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block"
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "4px solid transparent",
                    borderRight: "4px solid transparent",
                    borderBottom: "7px solid #1565c0",
                  }}
                />
                IV OV
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block"
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "4px solid transparent",
                    borderRight: "4px solid transparent",
                    borderBottom: "7px solid #ef6c00",
                  }}
                />
                2I TESNET
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
        <div
          className="flex gap-0.5 rounded-md border border-border bg-card/95 p-0.5 shadow-md backdrop-blur-sm"
          role="group"
          aria-label="Map basemap"
        >
          {(
            [
              ["satellite", "Sat"],
              ["voyager", "Map"],
              ["dark", "Dark"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => selectBasemap(k)}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                basemap === k
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={
                k === "satellite"
                  ? "Satellite 2D (Esri)"
                  : k === "voyager"
                    ? "Street map (CARTO Voyager)"
                    : "Dark map (CARTO)"
              }
            >
              {label}
            </button>
          ))}
        </div>
        {stationToggleAvailable && onToggleStations && (
          <button
            type="button"
            onClick={onToggleStations}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-medium shadow-md backdrop-blur-sm transition-colors",
              showStations
                ? "border-accent/50 bg-accent/15 text-accent"
                : "border-border bg-card/95 text-foreground hover:bg-muted",
            )}
            title={
              showStations
                ? `Hide seismic stations (${nSta})`
                : nSta
                  ? `Show INGV-OV stations (${nSta})`
                  : "Show INGV-OV stations"
            }
          >
            Stations
            {nSta > 0 && (
              <span className="font-mono tabular-nums opacity-80">{nSta}</span>
            )}
          </button>
        )}
        <a
          href={officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card/95 px-2 text-[10px] font-medium text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-muted"
        >
          {officialLabel}
        </a>
      </div>
    </div>
  );
}
