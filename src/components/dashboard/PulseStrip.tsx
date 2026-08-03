import type { ContinuumReport } from "@/lib/supt/continuum";
import type { SwarmIntensity } from "@/lib/seismic/intensity";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  continuum: ContinuumReport;
  intensity: SwarmIntensity;
  newSincePoll: number;
  rate6h: number;
  className?: string;
};

/** Compact global pulse — one scan line, always visible in header. */
export function PulseStrip({
  continuum: C,
  intensity,
  newSincePoll,
  rate6h,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 overflow-x-auto text-[11px]",
        className,
      )}
      role="status"
      aria-label="Live pulse strip"
    >
      <Pill
        label="EII"
        value={C.eii.toFixed(2)}
        tone={C.eii >= 0.85 ? "critical" : C.eii >= 0.6 ? "warn" : "muted"}
      />
      <Pill
        label="RPAM"
        value={C.rpam}
        tone={
          C.rpam === "ACTIVE" ? "critical" : C.rpam === "ELEVATED" ? "warn" : "muted"
        }
      />
      <Pill
        label="SR"
        value={String(C.schumannIndex || "—")}
        tone={C.schumannIndex >= 70 ? "warn" : "muted"}
        mono
      />
      <Pill
        label="Int"
        value={intensity.level}
        tone={
          intensity.tone === "critical"
            ? "critical"
            : intensity.tone === "warn"
              ? "warn"
              : intensity.tone === "accent"
                ? "accent"
                : "muted"
        }
      />
      <Pill label="6h" value={String(rate6h)} mono tone="muted" />
      {newSincePoll > 0 && (
        <Badge variant="outline" className="h-5 shrink-0 px-1.5 font-mono text-[10px]">
          +{newSincePoll}
        </Badge>
      )}
      <span className="ml-auto hidden shrink-0 font-mono text-[10px] text-muted-foreground xl:inline">
        CCI {C.cci.toFixed(2)} · Kp {C.kp.toFixed(1)}
      </span>
    </div>
  );
}

function Pill({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone: "muted" | "accent" | "warn" | "critical";
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-0.5 rounded border px-1.5 text-[10px] leading-none",
        mono && "font-mono tabular-nums",
        tone === "critical" && "border-destructive/40 bg-destructive/10 text-destructive",
        tone === "warn" && "border-warn/40 bg-warn/10 text-warn",
        tone === "accent" && "border-accent/40 bg-accent/10 text-accent",
        tone === "muted" && "border-border bg-card text-foreground",
      )}
    >
      <span className="text-[9px] font-medium uppercase tracking-wide opacity-60">{label}</span>
      <span className={cn("font-semibold", mono && "font-mono tabular-nums")}>{value}</span>
    </span>
  );
}
