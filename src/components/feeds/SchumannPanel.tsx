import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { fetchSchumann } from "@/lib/supt/earthFeedsServer";
import {
  type SchumannSnapshot,
  emptySchumann,
  schumannTone,
  TOMSK_CHARTS,
} from "@/lib/supt/schumann";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SchumannPanel({ className }: { className?: string }) {
  const [snap, setSnap] = useState<SchumannSnapshot>(emptySchumann());

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchSchumann().then((s) => {
        if (!cancelled) setSnap(s);
      });
    };
    load();
    const id = window.setInterval(load, 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const tone = schumannTone(snap.schumannIndex);

  return (
    <Card className={cn("border-accent/20", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Radio className="size-4 text-accent" />
          <CardTitle className="text-sm">Tomsk Schumann resonance</CardTitle>
          <Badge
            variant={
              tone === "critical"
                ? "critical"
                : tone === "warn"
                  ? "warn"
                  : tone === "accent"
                    ? "live"
                    : "outline"
            }
          >
            SR index {snap.schumannIndex}
          </Badge>
        </div>
        <CardDescription>
          Tomsk-attributed SR (global lightning → Earth–ionosphere cavity). Live SOSRFF charts;
          numeric index via ResonanceOne. Used as ELF term in EII — see LAIC brief below Feeds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini k="Activity" v={String(snap.activityIndex)} h={snap.activityLabel} />
          <Mini k="SR freq" v={`${snap.frequencyHz.toFixed(2)} Hz`} h="fundamental" />
          <Mini k="Factor" v={snap.schumannFactor.toFixed(2)} h="SUPT scale" />
          <Mini k="Kp (feed)" v={String(snap.kpIndex)} h={snap.kpLabel} />
        </div>

        {snap.summary && (
          <p className="rounded-md border border-border bg-secondary/40 p-2.5 leading-relaxed text-muted-foreground">
            {snap.summary}
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <ChartThumb
            href={TOMSK_CHARTS.amplitude}
            label="Amplitude (sra)"
            src={TOMSK_CHARTS.amplitude}
          />
          <ChartThumb
            href={TOMSK_CHARTS.spectrogram1}
            label="Spectrogram (fc_fsr1)"
            src={TOMSK_CHARTS.spectrogram1}
          />
        </div>

        <div className="flex flex-wrap gap-2 text-[10px]">
          <a
            className="text-accent hover:underline"
            href={TOMSK_CHARTS.home}
            target="_blank"
            rel="noopener noreferrer"
          >
            SOSRFF Tomsk ↗
          </a>
          <a
            className="text-accent hover:underline"
            href="https://resonanceone.app/schumann-resonance-today"
            target="_blank"
            rel="noopener noreferrer"
          >
            ResonanceOne method ↗
          </a>
          {snap.updatedAt && (
            <span className="font-mono text-muted-foreground">
              {new Date(snap.updatedAt).toISOString().slice(0, 16)}Z
            </span>
          )}
          {snap.error && <span className="text-destructive">{snap.error}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ k, v, h }: { k: string; v: string; h: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-0.5 font-mono text-base font-semibold tabular-nums">{v}</div>
      <div className="text-[10px] text-muted-foreground">{h}</div>
    </div>
  );
}

function ChartThumb({
  src,
  href,
  label,
}: {
  src: string;
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-lg border border-border bg-secondary/20"
    >
      <div className="border-b border-border px-2 py-1 text-[10px] text-muted-foreground">
        {label}
      </div>
      <img
        src={src}
        alt={label}
        className="h-36 w-full object-cover object-top"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </a>
  );
}
