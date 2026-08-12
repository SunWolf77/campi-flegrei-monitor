import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import type { FocusNode, QuakeEvent } from "@/lib/seismic/types";
import { depthHistogram } from "@/lib/seismic/swarm";
import { magColor } from "@/lib/seismic/colors";
import { formatDateTime, formatMag, magValue } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  events: QuakeEvent[];
  node: FocusNode;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

const SHALLOW_KM = 3;

function CrossSection({
  events,
  axis,
  node,
  selectedId,
  onSelect,
}: {
  events: QuakeEvent[];
  axis: "lon" | "lat";
  node: FocusNode;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const data = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        x: axis === "lon" ? e.longitude : e.latitude,
        depth: e.depthKm,
        // plot size: N/D uses small fixed size, never pretend M0 energy
        mag: e.magnitude != null && Number.isFinite(e.magnitude) ? e.magnitude : 0.4,
        magLabel:
          e.magnitude != null && Number.isFinite(e.magnitude)
            ? e.magnitude
            : null,
        time: e.time,
        place: e.place,
      })),
    [events, axis],
  );

  const maxDepth = useMemo(() => {
    if (events.length === 0) return Math.max(node.depthRangeKm.deep, 5);
    const d = Math.max(...events.map((e) => e.depthKm), 1);
    return Math.max(Math.ceil(d * 1.35 * 2) / 2, 3);
  }, [events, node.depthRangeKm.deep]);

  const xLabel = axis === "lon" ? "Longitude (E)" : "Latitude (N)";
  // Prefer tight mapView for CF caldera depth story when available
  const domain =
    axis === "lon"
      ? [
          node.mapView?.minLon ?? node.bbox.minLon,
          node.mapView?.maxLon ?? node.bbox.maxLon,
        ]
      : [
          node.mapView?.minLat ?? node.bbox.minLat,
          node.mapView?.maxLat ?? node.bbox.maxLat,
        ];

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            domain={domain as [number, number]}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
            tickFormatter={(v: number) => v.toFixed(2)}
            label={{
              value: xLabel,
              position: "insideBottom",
              offset: -2,
              fill: "var(--color-muted-foreground)",
              fontSize: 10,
            }}
          />
          <YAxis
            type="number"
            dataKey="depth"
            name="Depth"
            reversed
            domain={[0, maxDepth]}
            allowDataOverflow
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
            label={{
              value: "Depth (km)",
              angle: -90,
              position: "insideLeft",
              fill: "var(--color-muted-foreground)",
              fontSize: 10,
            }}
          />
          <ZAxis type="number" dataKey="mag" range={[40, 300]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as
                | {
                    magLabel: number | null;
                    depth: number;
                    time: number;
                    place: string;
                    x: number;
                  }
                | undefined;
              if (!p) return null;
              return (
                <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
                  <div className="font-mono font-semibold">
                    {p.magLabel == null ? "M—" : `M${formatMag(p.magLabel)}`}
                  </div>
                  <div className="text-muted-foreground">
                    {p.depth.toFixed(1)} km ·{" "}
                    {axis === "lon" ? `${p.x.toFixed(3)} E` : `${p.x.toFixed(3)} N`}
                  </div>
                  <div className="text-muted-foreground">{formatDateTime(p.time)}</div>
                </div>
              );
            }}
          />
          <Scatter
            data={data}
            onClick={(d) => {
              const id = (d as { id?: string }).id;
              if (id) onSelect?.(id);
            }}
          >
            {data.map((d) => (
              <Cell
                key={d.id}
                fill={magColor(d.magLabel)}
                fillOpacity={selectedId && selectedId !== d.id ? 0.35 : 0.85}
                stroke={selectedId === d.id ? "var(--color-fg)" : "transparent"}
                strokeWidth={selectedId === d.id ? 1.5 : 0}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function MagColorLegend() {
  const stops = [1, 2, 3, 4, 5];
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
      <span>Mag</span>
      {stops.map((m) => (
        <span key={m} className="inline-flex items-center gap-1">
          <span
            className="size-2 rounded-full"
            style={{ background: magColor(m) }}
          />
          M{m}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <span
          className="size-2 rounded-full"
          style={{ background: magColor(null) }}
        />
        N/D
      </span>
    </div>
  );
}

function DepthKpis({ events }: { events: QuakeEvent[] }) {
  const stats = useMemo(() => {
    const now = Date.now();
    const h24 = now - 24 * 3_600_000;
    const priorStart = h24 - 24 * 3_600_000;
    const depths = events.map((e) => e.depthKm).filter(Number.isFinite);
    const sorted = [...depths].sort((a, b) => a - b);
    const median =
      sorted.length === 0
        ? null
        : sorted.length % 2
          ? sorted[(sorted.length - 1) / 2]!
          : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
    const max = sorted.length ? sorted[sorted.length - 1]! : null;
    const shallow = depths.filter((d) => d < SHALLOW_KM).length;
    const shallowFrac = depths.length ? shallow / depths.length : 0;
    const last24 = events.filter((e) => e.time >= h24);
    const prior24 = events.filter((e) => e.time >= priorStart && e.time < h24);
    const mags = events
      .map((e) => e.magnitude)
      .filter((m): m is number => m != null && Number.isFinite(m));
    const maxMag = mags.length ? Math.max(...mags) : null;
    const magNd = events.length - mags.length;
    return {
      n: events.length,
      median,
      max,
      shallowFrac,
      last24: last24.length,
      prior24: prior24.length,
      maxMag,
      magNd,
    };
  }, [events]);

  const delta = stats.last24 - stats.prior24;
  const deltaLabel =
    stats.prior24 === 0 && stats.last24 === 0
      ? "—"
      : `${delta >= 0 ? "+" : ""}${delta} vs prior 24h`;

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi label="Events" value={String(stats.n)} />
      <Kpi
        label="Median Z"
        value={stats.median != null ? `${stats.median.toFixed(1)} km` : "—"}
      />
      <Kpi
        label="Max Z"
        value={stats.max != null ? `${stats.max.toFixed(1)} km` : "—"}
      />
      <Kpi
        label={`Shallow <${SHALLOW_KM} km`}
        value={`${(stats.shallowFrac * 100).toFixed(0)}%`}
        sub={`${Math.round(stats.shallowFrac * stats.n)} events`}
      />
      <Kpi
        label="24h vs prior"
        value={`${stats.last24} / ${stats.prior24}`}
        sub={deltaLabel}
      />
      <Kpi
        label="Largest M"
        value={stats.maxMag != null ? `M${stats.maxMag.toFixed(1)}` : "—"}
        sub={stats.magNd ? `${stats.magNd}× N/D` : "all finite"}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1.5">
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold tabular-nums">{value}</div>
      {sub && (
        <div className="truncate text-[10px] text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}

export function DepthProfile({ events, node, selectedId, onSelect }: Props) {
  const hist = useMemo(() => depthHistogram(events, 0.5), [events]);

  return (
    <div className="grid gap-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Depth analytics</CardTitle>
          <CardDescription>
            Why this board exists: caldera-scale depth story. Shallow = depth under{" "}
            {SHALLOW_KM} km. 24h compare is descriptive only — not an anomaly score.
            N/D magnitudes stay N/D (never treated as M0).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DepthKpis events={events} />
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Depth cross-section — longitude</CardTitle>
            <CardDescription>
              Hypocenters projected E–W. Depth positive down; marker size scales with
              magnitude (N/D = small).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CrossSection
              events={events}
              axis="lon"
              node={node}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Depth cross-section — latitude</CardTitle>
            <CardDescription>
              Hypocenters projected N–S. CF unrest is typically very shallow (under 4 km).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CrossSection
              events={events}
              axis="lat"
              node={node}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Depth distribution</CardTitle>
          <CardDescription>
            Event count by depth bin (0.5 km). Bar colour = mean finite magnitude in
            that bin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <MagColorLegend />
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hist} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  stroke="var(--color-chart-grid)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                />
                <Tooltip
                  content={({ payload }) => {
                    const p = payload?.[0]?.payload as
                      | { label: string; count: number; meanMag: number }
                      | undefined;
                    if (!p) return null;
                    return (
                      <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
                        <div className="font-medium">{p.label} km</div>
                        <div className="text-muted-foreground">
                          {p.count} events · mean M{formatMag(p.meanMag)}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {hist.map((bin, i) => (
                    <Cell key={i} fill={magColor(bin.meanMag)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
