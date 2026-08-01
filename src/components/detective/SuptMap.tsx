import { useEffect, useMemo, useRef } from "react";
import type { FocusNode, QuakeEvent } from "@/lib/seismic/types";
import type { FracturePlane, StressNode, Lineament, MigrationStep } from "@/lib/seismic/supt";
import { leafletMagRadius, timeAgeColor, eventAge01 } from "@/lib/seismic/colors";
import { magValue, cn } from "@/lib/utils";

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
};

/**
 * Leaflet map with SUPT overlays: stress heatmap, fracture traces, stress nodes, migration path.
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
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layersRef = useRef<import("leaflet").LayerGroup | null>(null);

  const tRange = useMemo(() => {
    if (!events.length) {
      const n = Date.now();
      return { tMin: n - 864e5, tMax: n };
    }
    const ts = events.map((e) => e.time);
    return { tMin: Math.min(...ts), tMax: Math.max(...ts) };
  }, [events]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        zoomControl: true,
        preferCanvas: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap · SUPT overlay SES",
      }).addTo(map);

      map.fitBounds(
        L.latLngBounds(
          [node.bbox.minLat, node.bbox.minLon],
          [node.bbox.maxLat, node.bbox.maxLon],
        ),
        { padding: [20, 20] },
      );

      layersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      window.setTimeout(() => {
        map.invalidateSize();
        void draw();
      }, 80);
    }

    async function draw() {
      const L = await import("leaflet");
      const map = mapRef.current;
      const group = layersRef.current;
      if (!map || !group) return;
      group.clearLayers();

      // Stress field as circle heat points
      for (const cell of stressField) {
        if (cell.intensity < 0.12) continue;
        L.circleMarker([cell.lat, cell.lon], {
          radius: 6 + cell.intensity * 14,
          stroke: false,
          fillColor: intensityColor(cell.intensity),
          fillOpacity: 0.12 + cell.intensity * 0.35,
        }).addTo(group);
      }

      // Lineaments
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

      // Fracture plane traces
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

        // centroid tick
        L.circleMarker([pl.centroid.lat, pl.centroid.lon], {
          radius: 4,
          color: "#b71c1c",
          fillColor: "#ef5350",
          fillOpacity: 0.9,
          weight: 1,
        }).addTo(group);
      }

      // Migration path
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

      // Events (subtle)
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

      // Stress nodes (on top)
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

        // rank label
        L.marker([sn.location.lat, sn.location.lon], {
          icon: L.divIcon({
            className: "supt-node-label",
            html: `<div style="font:700 10px/1 ui-monospace,monospace;color:#1a1a1a;background:rgba(255,255,255,.85);border-radius:4px;padding:1px 4px;border:1px solid rgba(0,0,0,.2)">${sn.rank}</div>`,
            iconSize: [18, 14],
            iconAnchor: [-6, 20],
          }),
        }).addTo(group);
      });

      // Fit to stress nodes + planes if available
      const pts: [number, number][] = [];
      stressNodes.forEach((s) => pts.push([s.location.lat, s.location.lon]));
      planes.forEach((p) => {
        pts.push([p.trace[0].lat, p.trace[0].lon]);
        pts.push([p.trace[1].lat, p.trace[1].lon]);
      });
      if (pts.length >= 2) {
        map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 14 });
      }
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
    async function redraw() {
      if (!mapRef.current || !layersRef.current) return;
      // re-run draw by re-importing and clearing — call internal via effect re-init is heavy
      // simplest: trigger full redraw by reusing map
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
          { color: "#5c6bc0", weight: 1.5 + lin.weight * 2, dashArray: "6 4", opacity: 0.7 },
        ).addTo(group);
      }
      for (const pl of planes) {
        L.polyline(
          [
            [pl.trace[0].lat, pl.trace[0].lon],
            [pl.trace[1].lat, pl.trace[1].lon],
          ],
          { color: "#c62828", weight: 2.5 + pl.confidence * 2, opacity: 0.85 },
        )
          .bindTooltip(`${pl.label} · conf ${(pl.confidence * 100).toFixed(0)}%`)
          .addTo(group);
      }
      if (migration.length >= 2) {
        L.polyline(
          migration.map((m) => [m.centroid.lat, m.centroid.lon] as [number, number]),
          { color: "#00838f", weight: 2, opacity: 0.85 },
        ).addTo(group);
      }
      for (const ev of events) {
        const age = eventAge01(ev.time, tRange.tMin, tRange.tMax);
        L.circleMarker([ev.latitude, ev.longitude], {
          radius: Math.max(2, leafletMagRadius(ev.magnitude) * 0.55),
          color: "rgba(0,0,0,0.2)",
          weight: 0.5,
          fillColor: timeAgeColor(age),
          fillOpacity: 0.4,
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
        marker.bindTooltip(`Node #${sn.rank} · score ${sn.score}`);
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectNode?.(sn.id);
        });
        marker.addTo(group);
        L.marker([sn.location.lat, sn.location.lon], {
          icon: L.divIcon({
            className: "supt-node-label",
            html: `<div style="font:700 10px/1 ui-monospace,monospace;color:#1a1a1a;background:rgba(255,255,255,.9);border-radius:4px;padding:1px 4px">${sn.rank}</div>`,
            iconSize: [16, 14],
            iconAnchor: [-6, 18],
          }),
        }).addTo(group);
      });
    }
    void redraw();
  }, [
    events,
    planes,
    stressNodes,
    lineaments,
    migration,
    stressField,
    selectedNodeId,
    tRange,
    onSelectNode,
  ]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-lg", className)}>
      <div ref={containerRef} className="absolute inset-0 bg-[#d8e0e8]" />
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-border bg-card/95 px-2.5 py-2 text-[10px] text-muted-foreground shadow-md backdrop-blur-sm">
        <div className="mb-1 font-medium text-foreground">SUPT layers</div>
        <div className="flex flex-col gap-0.5">
          <span>
            <span className="mr-1 inline-block size-2 rounded-full bg-[#d84315]" /> Stress nodes
          </span>
          <span>
            <span className="mr-1 inline-block h-0.5 w-3 bg-[#c62828] align-middle" /> Fracture traces
          </span>
          <span>
            <span className="mr-1 inline-block h-0.5 w-3 bg-[#5c6bc0] align-middle" style={{ borderTop: "1px dashed" }} /> Lineaments
          </span>
          <span>
            <span className="mr-1 inline-block h-0.5 w-3 bg-[#00838f] align-middle" /> Migration path
          </span>
          <span>
            <span className="mr-1 inline-block size-2 rounded-full bg-[#ff7043]/40" /> Stress field
          </span>
        </div>
      </div>
    </div>
  );
}

function intensityColor(t: number): string {
  // cool → hot
  if (t > 0.75) return "#d84315";
  if (t > 0.5) return "#fb8c00";
  if (t > 0.3) return "#fdd835";
  return "#80cbc4";
}
