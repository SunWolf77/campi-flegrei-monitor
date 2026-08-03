import { useEffect, useMemo, useState } from "react";
import { Crosshair } from "lucide-react";
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
  /** Pixel height for embedded (non-fullscreen) map */
  height: number;
  className?: string;
};

/**
 * Top-level Stress & fracture map — same fabric as SUPT detective, map-first chrome.
 */
export function StressMapPanel({ events, node, swarm, height, className }: Props) {
  const [sw, setSw] = useState<SpaceWeatherSnapshot | null>(null);
  const [schumann, setSchumann] = useState<SchumannSnapshot | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [fs, setFs] = useState(false);

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
          <span className="text-[10px] text-muted-foreground">
            Home = caldera · Fabric = stress frame · Full = immersive
          </span>
        </div>
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
