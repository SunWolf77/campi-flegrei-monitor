import { useEffect, useMemo, useState } from "react";
import { Crosshair, Info } from "lucide-react";
import type { FocusNode, QuakeEvent, SwarmAnalysis } from "@/lib/seismic/types";
import { runSwarmDetective } from "@/lib/supt/detective";
import { fetchSpaceWeather } from "@/lib/supt/kpServer";
import { fetchSchumann } from "@/lib/supt/earthFeedsServer";
import type { SpaceWeatherSnapshot } from "@/lib/supt/spaceWeather";
import type { SchumannSnapshot } from "@/lib/supt/schumann";
import { SuptMap } from "@/components/detective/SuptMap";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  events: QuakeEvent[];
  node: FocusNode;
  swarm: SwarmAnalysis;
  height: number;
  className?: string;
};

/**
 * Top-level Stress & fracture map — fabric + observational reading.
 */
export function StressMapPanel({ events, node, swarm, height, className }: Props) {
  const [sw, setSw] = useState<SpaceWeatherSnapshot | null>(null);
  const [schumann, setSchumann] = useState<SchumannSnapshot | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [fs, setFs] = useState(false);
  const [briefOpen, setBriefOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchSpaceWeather().then((s) => {
        if (!cancelled) setSw(s);
      });
      void fetchSchumann().then((s) => {
        if (!cancelled) setSchumann(s);
      });
    };
    load();
    const id = window.setInterval(load, 90_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const report = useMemo(
    () => runSwarmDetective(events, node, swarm, Date.now(), sw, schumann),
    [events, node, swarm, sw, schumann],
  );

  const top = report.fabric.stressNodes[0];
  const topPlane = report.fabric.planes[0];

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {!fs && (
        <div className="flex flex-wrap items-center gap-2 px-0.5">
          <Crosshair className="size-3.5 text-accent" />
          <span className="text-xs font-medium">Stress & fracture</span>
          <Badge variant="outline" className="h-5 font-mono text-[10px]">
            {report.fabric.stressNodes.length} nodes
          </Badge>
          <Badge variant="outline" className="h-5 font-mono text-[10px]">
            {report.fabric.planes.length} planes
          </Badge>
          {top && (
            <span className="font-mono text-[10px] text-muted-foreground">
              #1 score {top.score} · {top.depthKm.toFixed(1)} km · M{top.maxMag.toFixed(1)}
            </span>
          )}
          {topPlane && (
            <span className="font-mono text-[10px] text-muted-foreground">
              plane strike {topPlane.strikeDeg.toFixed(0)}° / dip {topPlane.dipDeg.toFixed(0)}°
            </span>
          )}
          <button
            type="button"
            onClick={() => setBriefOpen((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 text-[10px] text-accent hover:underline"
          >
            <Info className="size-3" />
            {briefOpen ? "Hide" : "Show"} reading
          </button>
        </div>
      )}

      {!fs && briefOpen && (
        <ObservationalBrief
          nodeName={node.name}
          topScore={top?.score}
          planeStrike={topPlane?.strikeDeg}
          planeDip={topPlane?.dipDeg}
          nNodes={report.fabric.stressNodes.length}
          nPlanes={report.fabric.planes.length}
          migrationAz={report.fabric.migration.length >= 2}
          eii={report.continuum.eii}
          rpam={report.continuum.rpam}
        />
      )}

      <div
        className={cn(!fs && "overflow-hidden rounded-lg border border-border")}
        style={!fs ? { height } : undefined}
      >
        <SuptMap
          node={node}
          events={events}
          planes={report.fabric.planes}
          stressNodes={report.fabric.stressNodes}
          lineaments={report.fabric.lineaments}
          migration={report.fabric.migration}
          stressField={report.fabric.stressField}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          height={height}
          onFullscreenChange={setFs}
        />
      </div>
    </div>
  );
}

function ObservationalBrief({
  nodeName,
  topScore,
  planeStrike,
  planeDip,
  nNodes,
  nPlanes,
  migrationAz,
  eii,
  rpam,
}: {
  nodeName: string;
  topScore?: number;
  planeStrike?: number;
  planeDip?: number;
  nNodes: number;
  nPlanes: number;
  migrationAz: boolean;
  eii: number;
  rpam: string;
}) {
  return (
    <div className="rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      <p className="font-medium text-foreground">
        What the map is showing · {nodeName} · not a forecast
      </p>
      <ul className="mt-1.5 list-inside list-disc space-y-1">
        <li>
          <span className="text-foreground">Amber nodes</span> = density/energy/shallowness
          scores ({nNodes} ranked). Highest score
          {topScore != null ? ` (#1 = ${topScore})` : ""} marks where hypocentres pile up — a{" "}
          <em>preferential zone</em> for continued activity in this window, not “the next
          epicentre.”
        </li>
        <li>
          <span className="text-foreground">Magenta lines</span> = PCA fracture planes (
          {nPlanes}) — best-fit planar geometry through recent hypocentres
          {planeStrike != null
            ? ` (top strike ~${planeStrike.toFixed(0)}° / dip ~${planeDip?.toFixed(0)}°)`
            : ""}
          . Where magenta crosses amber, fabric geometry and energy density coincide — that is
          the “connect the dots” signal.
        </li>
        <li>
          <span className="text-foreground">Blue ticks (σ⊥)</span> = map-projected normal to
          strike; black = strike-parallel. Geometric axes from the plane fit — not a full stress
          tensor / CMT.
        </li>
        <li>
          <span className="text-foreground">Teal path</span>
          {migrationAz
            ? " = centroid migration through the window (swarm centre of mass over time)."
            : " = migration (needs enough time bins)."}
        </li>
        <li>
          Continuum EII {eii.toFixed(2)} · {rpam} co-registers space-weather / Schumann context.
          SUPT residual timing is separate (SUPT tab). Together: <strong>where</strong> (fabric)
          + <strong>how ordered</strong> (resonance) + <strong>how intense</strong> (EII) — still
          observational pattern literacy, not civil-protection prediction.
        </li>
      </ul>
    </div>
  );
}
