import { AlertTriangle, ExternalLink, Shield } from "lucide-react";
import type { FocusNode } from "@/lib/seismic/types";
import type { Locale } from "@/lib/i18n/messages";
import { t } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

type Props = {
  node: FocusNode;
  locale: Locale;
  className?: string;
};

/**
 * Always-visible alert context + bilingual non-forecast honesty.
 * Not a Civil Protection product — links out to OV/PC.
 */
export function AlertHonestyStrip({ node, locale, className }: Props) {
  const officialHref =
    node.volcano?.officialMapUrl ?? "https://www.ov.ingv.it/";
  const statusNote =
    node.volcano?.statusNote ??
    (locale === "it"
      ? "Contesto operativo INGV-OV (osservazione)."
      : "INGV-OV operational context (observation).");

  return (
    <div
      className={cn(
        "space-y-1.5 rounded-lg border border-warn/30 bg-warn/5 px-2.5 py-2",
        className,
      )}
      role="region"
      aria-label={t(locale, "alertTitle")}
    >
      <div className="flex flex-wrap items-start gap-2">
        <Shield
          className="mt-0.5 size-4 shrink-0 text-warn"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">
              {t(locale, "alertTitle")}
            </span>
            <span className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {node.code} · SES
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-foreground/90">
            {statusNote}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {t(locale, "alertNote")}
          </p>
          <a
            href={officialHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-9 items-center gap-1 text-[11px] font-medium text-accent hover:underline"
          >
            {t(locale, "alertSource")}: INGV-OV
            <ExternalLink className="size-3" aria-hidden />
            <span className="text-muted-foreground">
              ({t(locale, "officialSite")})
            </span>
          </a>
        </div>
      </div>

      <div className="flex items-start gap-1.5 border-t border-border/60 pt-1.5">
        <AlertTriangle
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <p className="text-[10px] leading-snug text-muted-foreground">
          <span className="font-medium text-foreground/80">
            {t(locale, "honesty")}
          </span>
        </p>
      </div>
    </div>
  );
}
