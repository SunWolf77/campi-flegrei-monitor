import type { SwarmAnalysis } from "@/lib/seismic/types";
import type { Locale } from "@/lib/i18n/messages";
import { t } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

type Props = {
  swarm: SwarmAnalysis;
  locale: Locale;
  className?: string;
};

/** Observation-only event counts: 1h / 6h / 24h / 7d */
export function RateStrip({ swarm, locale, className }: Props) {
  const cells = [
    { k: t(locale, "rate1h"), v: swarm.rate1h },
    { k: t(locale, "rate6h"), v: swarm.rate6h },
    { k: t(locale, "rate24h"), v: swarm.rate24h },
    { k: t(locale, "rate7d"), v: swarm.rate7d ?? 0 },
  ];

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card px-2 py-1.5",
        className,
      )}
      role="group"
      aria-label={t(locale, "rateStrip")}
    >
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {t(locale, "rateStrip")}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {cells.map((c) => (
          <div
            key={c.k}
            className="rounded-md border border-border/80 bg-secondary/30 px-1.5 py-1 text-center"
          >
            <div className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {c.v}
            </div>
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
              {c.k}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
