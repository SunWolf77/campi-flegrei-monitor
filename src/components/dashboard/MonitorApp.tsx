import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  Database,
  Layers,
  Map as MapIcon,
  RefreshCw,
  Satellite,
  Waves,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  ChevronDown,
  ExternalLink,
  Globe2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OsmEpicenterMap, type MapColorMode } from "@/components/map/OsmEpicenterMap";
import { DepthProfile } from "@/components/charts/DepthProfile";
import { TimelineCharts } from "@/components/charts/TimelineCharts";
import { SwarmPanel } from "@/components/swarm/SwarmPanel";
import { ObservationLinks } from "@/components/dashboard/ObservationLinks";
import { PulseStrip } from "@/components/dashboard/PulseStrip";
import { SchumannPanel } from "@/components/feeds/SchumannPanel";
import { GeonetVolcanoPanel } from "@/components/feeds/GeonetVolcanoPanel";
import { NotionFramework } from "@/components/feeds/NotionFramework";
import { PacificNodePanel } from "@/components/feeds/PacificNodePanel";
import { EpochLogPanel } from "@/components/feeds/EpochLogPanel";
import { LaicBrief } from "@/components/feeds/LaicBrief";
import { EventTable } from "@/components/dashboard/EventTable";
import { buildContinuumReport } from "@/lib/supt/continuum";
import { learnFromObservation } from "@/lib/supt/epochLog";
import { fetchSchumann } from "@/lib/supt/earthFeedsServer";
import { fetchSpaceWeather } from "@/lib/supt/kpServer";
import type { SchumannSnapshot } from "@/lib/supt/schumann";
import type { SpaceWeatherSnapshot } from "@/lib/supt/spaceWeather";
import { SuptDetective } from "@/components/detective/SuptDetective";
import { listFocusNodes, getFocusNode } from "@/lib/seismic/focus-nodes";
import type { FocusNodeId, QuakeEvent, SwarmCluster } from "@/lib/seismic/types";
import { fetchCatalog, type CatalogPayload, type WindowKey } from "@/lib/seismic/server";
import { emptyCatalog, normalizeCatalog } from "@/lib/seismic/catalog";
import { getAuthority } from "@/lib/seismic/authority";
import {
  companionBoardLabel,
  companionBoardUrl,
  parseSesHandoff,
  sentinelFocusUrl,
} from "@/lib/seismic/ses-handoff";
import { classifySwarmIntensity } from "@/lib/seismic/intensity";
import {
  getQuietMode,
  setQuietMode,
  getQuietSource,
  isMobileViewport,
  type QuietSource,
} from "@/lib/ui/prefs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn, formatDateTime, formatMag, formatRelativeTime, magValue } from "@/lib/utils";

type TabKey = "map" | "depth" | "timeline" | "swarm" | "detective" | "catalog" | "feeds";

const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: "24h", label: "24h" },
  { key: "48h", label: "48h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "ytd", label: "YTD" },
];

const DEPTH_GATES: { km: number | null; label: string }[] = [
  { km: 8, label: "≤8 km" },
  { km: 5, label: "≤5 km" },
  { km: 3, label: "≤3 km" },
  { km: null, label: "All Z" },
];

const TABS: { key: TabKey; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "map", label: "Map", icon: MapIcon },
  { key: "depth", label: "Depth", icon: Layers },
  { key: "timeline", label: "Time", icon: Activity },
  { key: "swarm", label: "Swarms", icon: Waves },
  { key: "detective", label: "SUPT", icon: Brain },
  { key: "feeds", label: "Feeds", icon: Satellite },
  { key: "catalog", label: "List", icon: Database },
];

type Props = {
  initial?: CatalogPayload | null;
};

export function MonitorApp({ initial }: Props) {
  const safeInitial = useMemo(
    () => normalizeCatalog(initial ?? emptyCatalog()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [data, setData] = useState<CatalogPayload>(safeInitial);
  const handoff = useMemo(() => parseSesHandoff(), []);
  const [fromSes] = useState(handoff.fromSes);
  const [nodeId, setNodeId] = useState<FocusNodeId>(
    handoff.focusFromQuery ?? safeInitial.nodeId ?? "campi-flegrei",
  );
  const [windowKey, setWindowKey] = useState<WindowKey>(safeInitial.window?.key ?? "7d");
  const [minMag, setMinMag] = useState(0);
  const [maxDepthKm, setMaxDepthKm] = useState<number | null>(8);
  const [tab, setTab] = useState<TabKey>("map");
  const [colorMode, setColorMode] = useState<MapColorMode>("time");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastError, setLastError] = useState<string | null>(safeInitial.error ?? null);
  const [newSincePoll, setNewSincePoll] = useState(0);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [sw, setSw] = useState<SpaceWeatherSnapshot | null>(null);
  const [schumann, setSchumann] = useState<SchumannSnapshot | null>(null);
  const [quiet, setQuiet] = useState(() => getQuietMode());
  const [quietSource, setQuietSource] = useState<QuietSource>(() => getQuietSource());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile quiet: auto on first visit; re-apply suggestion if user never chose
  useEffect(() => {
    setIsMobile(isMobileViewport());
    const mq = window.matchMedia("(max-width: 767px)");
    const onMq = () => {
      setIsMobile(mq.matches);
      // If still on auto-mobile source and viewport becomes desktop, leave quiet as stored
    };
    mq.addEventListener("change", onMq);
    // Ensure first-load mobile quiet ran (getQuietMode side effect)
    setQuiet(getQuietMode());
    setQuietSource(getQuietSource());
    return () => mq.removeEventListener("change", onMq);
  }, []);

  const node = useMemo(() => getFocusNode(nodeId), [nodeId]);
  const nodes = useMemo(() => listFocusNodes(), []);
  const authority = useMemo(() => getAuthority(nodeId), [nodeId]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const result = await fetchCatalog({
          data: {
            nodeId,
            window: windowKey,
            minMagnitude: minMag > 0 ? minMag : undefined,
            maxDepthKm:
              nodeId === "campi-flegrei"
                ? maxDepthKm == null
                  ? 0
                  : maxDepthKm
                : undefined,
            forceProvider:
              nodeId === "campi-flegrei"
                ? "gossip"
                : nodeId === "tonga-kermadec"
                  ? "usgs"
                  : undefined,
          },
        });
        const normalized = normalizeCatalog(result);
        const ids = new Set((normalized.events ?? []).map((e) => e.id));
        if (prevIdsRef.current.size > 0) {
          let n = 0;
          for (const id of ids) if (!prevIdsRef.current.has(id)) n++;
          setNewSincePoll(n);
        }
        prevIdsRef.current = ids;
        setData(normalized);
        setLastError(normalized.error ?? null);
      } catch (err) {
        setLastError(err instanceof Error ? err.message : "Catalog load failed");
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [nodeId, windowKey, minMag, maxDepthKm],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void load({ silent: true });
    }, 60_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      void fetchSpaceWeather().then((s) => {
        if (!cancelled) setSw(s);
      });
      void fetchSchumann().then((s) => {
        if (!cancelled) setSchumann(s);
      });
    };
    tick();
    const id = window.setInterval(tick, 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const events = Array.isArray(data?.events) ? data.events : [];
  const swarm = data?.swarm ?? emptyCatalog().swarm;
  const continuum = useMemo(
    () => buildContinuumReport(events, sw, Date.now(), schumann),
    [events, sw, schumann],
  );
  const intensity = useMemo(
    () => classifySwarmIntensity(swarm, events, nodeId),
    [nodeId, events, swarm],
  );

  useEffect(() => {
    if (!events.length && continuum.nEvents === 0) return;
    learnFromObservation({ nodeId, continuum, swarm, schumann });
  }, [nodeId, continuum, swarm, schumann, events.length]);

  const selected = events.find((e) => e.id === selectedId) ?? null;
  const largest = useMemo(
    () =>
      events.length
        ? events.reduce((a, b) =>
            magValue(a.magnitude, -99) >= magValue(b.magnitude, -99) ? a : b,
          )
        : null,
    [events],
  );

  const focusCluster = useCallback((cluster: SwarmCluster) => {
    if (cluster?.maxMagEvent?.id) setSelectedId(cluster.maxMagEvent.id);
    setTab("map");
  }, []);

  const onSelectEvent = useCallback((ev: QuakeEvent | null) => {
    setSelectedId(ev?.id ?? null);
  }, []);

  const toggleQuiet = () => {
    setQuiet((v) => {
      const next = !v;
      setQuietMode(next, "user");
      setQuietSource("user");
      return next;
    });
  };

  /** One-tap mobile field mode: force quiet + close filters */
  const enableMobileQuiet = () => {
    setQuietMode(true, "user");
    setQuiet(true);
    setQuietSource("user");
    setFiltersOpen(false);
  };

  const filterActive =
    minMag > 0 || (nodeId === "campi-flegrei" && maxDepthKm != null && maxDepthKm !== 8);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-3 py-2 sm:px-5 sm:py-2.5">
          {/* R1: identity + actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Satellite className="size-4 shrink-0 text-accent" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
                    {node.name}
                  </h1>
                  <Badge variant="live" className="h-5 px-1.5 text-[10px]">
                    SES #{node.networkOrder}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="hidden h-5 px-1.5 font-mono text-[10px] uppercase sm:inline-flex"
                  >
                    {data?.provider ?? "—"}
                  </Badge>
                  {quiet && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      Quiet
                    </Badge>
                  )}
                </div>
                <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                  {authority.label} · exclusive · no dual-read
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle />
              <Button
                variant={quiet ? "default" : "ghost"}
                size="sm"
                onClick={toggleQuiet}
                className="h-9 px-2.5"
                title={
                  quietSource === "auto-mobile"
                    ? "Quiet (auto on mobile) — click to override"
                    : "Quiet mode — hide library chrome"
                }
              >
                {quiet ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                <span className="hidden sm:inline">
                  {quiet ? (quietSource === "auto-mobile" ? "Quiet·m" : "Quiet") : "Full"}
                </span>
              </Button>
              {isMobile && !quiet && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2 text-[11px] sm:hidden"
                  onClick={enableMobileQuiet}
                  title="Field mode — hide secondary panels"
                >
                  Field
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void load()}
                disabled={loading}
                className="h-9 px-2.5"
              >
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh((v) => !v)}
                className="h-9 min-w-11 px-2 font-mono text-[11px]"
              >
                {autoRefresh ? "60s" : "Off"}
              </Button>
            </div>
          </div>

          {/* R2: node · window · filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex rounded-md border border-border p-0.5">
              {nodes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setNodeId(n.id);
                    if (n.id === "tonga-kermadec") setMaxDepthKm(null);
                    else if (maxDepthKm == null) setMaxDepthKm(8);
                  }}
                  className={cn(
                    "min-h-9 rounded px-2.5 text-xs font-medium transition-colors",
                    nodeId === n.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <span className="font-mono text-[10px] opacity-70">#{n.networkOrder}</span>{" "}
                  {n.code}
                </button>
              ))}
            </div>

            <div className="flex gap-0.5 overflow-x-auto">
              {WINDOWS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => setWindowKey(w.key)}
                  className={cn(
                    "min-h-9 min-w-10 rounded-md px-2 font-mono text-xs tabular-nums transition-colors",
                    windowKey === w.key
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1 rounded-md border px-2.5 text-xs font-medium",
                filtersOpen || filterActive
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <SlidersHorizontal className="size-3.5" />
              Filters
              {filterActive && (
                <span className="font-mono text-[10px]">
                  {minMag > 0 ? `M≥${minMag}` : ""}
                  {nodeId === "campi-flegrei" && maxDepthKm != null && maxDepthKm !== 8
                    ? ` Z≤${maxDepthKm}`
                    : ""}
                </span>
              )}
              <ChevronDown
                className={cn("size-3.5 opacity-70 transition-transform", filtersOpen && "rotate-180")}
              />
            </button>
          </div>

          {filtersOpen && (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-secondary/25 px-2.5 py-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Min M
                </span>
                {[0, 1, 1.5, 2, 2.5, 3].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMinMag(m)}
                    className={cn(
                      "min-h-9 min-w-9 rounded border px-2 font-mono text-xs tabular-nums",
                      minMag === m
                        ? "border-fg/30 bg-muted text-foreground"
                        : "border-border text-muted-foreground hover:bg-card",
                    )}
                  >
                    {m === 0 ? "All" : m.toFixed(1)}
                  </button>
                ))}
              </div>
              {nodeId === "campi-flegrei" && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Depth
                  </span>
                  {DEPTH_GATES.map((g) => (
                    <button
                      key={g.label}
                      type="button"
                      onClick={() => setMaxDepthKm(g.km)}
                      className={cn(
                        "min-h-9 rounded border px-2 font-mono text-xs tabular-nums",
                        maxDepthKm === g.km
                          ? "border-fg/30 bg-muted text-foreground"
                          : "border-border text-muted-foreground hover:bg-card",
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              )}
              {!quiet && (
                <p className="text-[10px] text-muted-foreground sm:ml-auto">
                  dragon {authority.sesDragonId}
                </p>
              )}
            </div>
          )}

          <PulseStrip
            continuum={continuum}
            intensity={intensity}
            newSincePoll={newSincePoll}
            rate6h={swarm.rate6h}
          />
        </div>
      </header>

      {/* SES network handoff — Sentinel ↔ boards */}
      <div className="border-b border-border bg-secondary/30">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-5">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Globe2 className="size-3.5 shrink-0 text-accent" />
            <span className="font-medium text-foreground">
              Sun Earth Sentinel · node #{node.networkOrder}
            </span>
            <span className="hidden sm:inline">· dragon <code className="font-mono text-[10px]">{authority.sesDragonId}</code></span>
            {fromSes && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                From SES
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href={sentinelFocusUrl(nodeId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2.5 text-xs font-semibold text-accent hover:bg-accent/20"
            >
              Open in Sentinel
              <ExternalLink className="size-3" />
            </a>
            <a
              href={companionBoardUrl(nodeId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {companionBoardLabel(nodeId)}
              <ExternalLink className="size-3 opacity-70" />
            </a>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] min-w-0 overflow-x-hidden px-3 py-3 sm:px-5 sm:py-4">
        {loading && events.length === 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            <RefreshCw className="size-3.5 animate-spin" />
            Loading catalog…
          </div>
        )}

        {/* 4 primary KPIs only */}
        <section className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <Kpi label="Events" value={String(data?.count ?? events.length)} sub={windowKey} />
          <Kpi
            label="Largest"
            value={largest ? `M${formatMag(largest.magnitude)}` : "—"}
            sub={largest ? formatRelativeTime(largest.time) : "—"}
            danger={!!largest && magValue(largest.magnitude) >= 4}
          />
          <Kpi
            label="1h / 6h"
            value={`${swarm.rate1h} / ${swarm.rate6h}`}
            sub={`${(swarm.shallowFraction * 100).toFixed(0)}% shallow`}
            warn={!!swarm.active}
          />
          <Kpi
            label="Mean Z"
            value={events.length ? `${swarm.meanDepthKm.toFixed(1)} km` : "—"}
            sub={swarm.active ? "swarm on" : `${swarm.clusters?.length ?? 0} clusters`}
            warn={!!swarm.active}
          />
        </section>

        {lastError && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 text-xs">{lastError}</div>
          </div>
        )}

        {largest && magValue(largest.magnitude) >= 3.5 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle className="size-3.5 text-destructive" />
              <span className="font-medium">
                Peak M{formatMag(largest.magnitude)} · {formatRelativeTime(largest.time)} ·{" "}
                {largest.depthKm.toFixed(1)} km
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-8"
              onClick={() => {
                setSelectedId(largest.id);
                setTab("map");
              }}
            >
              Focus map
            </Button>
          </div>
        )}

        {/* Tabs — primary navigation */}
        <div className="mb-3 flex gap-0.5 overflow-x-auto border-b border-border pb-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-xs font-medium transition-colors",
                  tab === t.key
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "map" && (
          <div
            className={cn(
              "grid gap-3",
              quiet ? "lg:grid-cols-1" : "lg:grid-cols-[1.6fr_1fr]",
            )}
          >
            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between space-y-0 px-3 py-2">
                <CardTitle className="text-sm">Map</CardTitle>
                <div className="flex gap-0.5">
                  {(["time", "depth", "mag"] as MapColorMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setColorMode(m)}
                      className={cn(
                        "rounded px-2 py-1 text-[10px] uppercase",
                        colorMode === m
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-2 pt-0 sm:p-3 sm:pt-0">
                <div className="h-[min(64vh,560px)] min-h-[300px]">
                  <OsmEpicenterMap
                    node={node}
                    events={events}
                    selectedId={selectedId}
                    onSelect={onSelectEvent}
                    colorMode={colorMode}
                  />
                </div>
              </CardContent>
            </Card>
            {!quiet && <ObservationLinks nodeId={nodeId} />}
          </div>
        )}

        {tab === "depth" && (
          <DepthProfile
            events={events}
            node={node}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
          />
        )}
        {tab === "timeline" && <TimelineCharts events={events} swarm={swarm} />}
        {tab === "swarm" && (
          <div
            className={cn(
              "grid gap-3",
              quiet && nodeId !== "tonga-kermadec" ? "" : "lg:grid-cols-[1.25fr_1fr]",
            )}
          >
            <SwarmPanel
              swarm={swarm}
              events={events}
              nodeId={nodeId}
              onSelectCluster={focusCluster}
              onSelectEventId={setSelectedId}
              selectedEventId={selectedId}
              newCount={newSincePoll}
            />
            <div className="flex flex-col gap-3">
              {nodeId === "tonga-kermadec" && <GeonetVolcanoPanel />}
              {!quiet && <ObservationLinks nodeId={nodeId} />}
            </div>
          </div>
        )}
        {tab === "detective" && (
          <SuptDetective events={events} node={node} swarm={swarm} />
        )}
        {tab === "feeds" && (
          <div className="space-y-4">
            <section className="space-y-2">
              <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Live signals
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                <SchumannPanel />
                {nodeId === "tonga-kermadec" ? (
                  <GeonetVolcanoPanel expanded />
                ) : (
                  !quiet && <GeonetVolcanoPanel />
                )}
              </div>
              {!quiet && <LaicBrief compact />}
            </section>
            <section className="space-y-2">
              <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Memory · export
              </h3>
              <EpochLogPanel
                nodeId={nodeId}
                continuum={continuum}
                swarm={swarm}
                schumann={schumann}
                density="full"
                enableLearn={false}
              />
            </section>
            {!quiet && (
              <details className="rounded-lg border border-border bg-card">
                <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground">
                  Context library (Pacific · links · Notion)
                </summary>
                <div className="grid gap-3 border-t border-border p-3 lg:grid-cols-2">
                  <PacificNodePanel />
                  <ObservationLinks nodeId={nodeId} />
                  <div className="lg:col-span-2">
                    <NotionFramework />
                  </div>
                </div>
              </details>
            )}
          </div>
        )}
        {tab === "catalog" && (
          <div className={cn("grid gap-3", quiet ? "" : "lg:grid-cols-[1.5fr_1fr]")}>
            <EventTable
              events={events}
              selectedId={selectedId}
              onSelect={(ev) => setSelectedId(ev.id)}
            />
            {!quiet && <ObservationLinks nodeId={nodeId} />}
          </div>
        )}

        {selected && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/20 bg-card px-3 py-2 text-xs">
            <div className="min-w-0">
              <span className="font-mono font-semibold">
                M{formatMag(selected.magnitude)} {selected.magType}
              </span>
              <span className="ml-2 text-muted-foreground">
                {formatDateTime(selected.time)} · {selected.depthKm.toFixed(1)} km ·{" "}
                {selected.place}
              </span>
            </div>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelectedId(null)}>
              Clear
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  danger,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-1.5",
        danger && "border-destructive/40 bg-destructive/5",
        warn && !danger && "border-warn/35 bg-warn/5",
        !danger && !warn && "border-border bg-card",
      )}
    >
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-base font-semibold tabular-nums leading-tight sm:text-lg">
        {value}
      </div>
      {sub && <div className="truncate text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
