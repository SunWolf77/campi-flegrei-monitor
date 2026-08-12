import { ExternalLink, X } from "lucide-react";
import type { QuakeEvent } from "@/lib/seismic/types";
import {
  formatDateTime,
  formatMag,
  formatRelativeTime,
  cn,
} from "@/lib/utils";
import { magColor } from "@/lib/seismic/colors";
import { Button } from "@/components/ui/button";

type Props = {
  event: QuakeEvent | null;
  onClose: () => void;
  locale?: "en" | "it";
};

function romeTime(ms: number): string {
  try {
    return new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(ms));
  } catch {
    return formatDateTime(ms);
  }
}

function gossipHref(e: QuakeEvent): string | null {
  if (e.provider !== "gossip" && e.provider !== "ingv") return null;
  // Stable external catalog UIs
  if (e.catalog?.toLowerCase().includes("vesuv")) {
    return "https://terremoti.ov.ingv.it/gossip/vesuvio/";
  }
  return "https://terremoti.ov.ingv.it/gossip/flegrei/";
}

/**
 * Phase B event drawer — mag type, review/status, depth, external INGV id.
 * Observation only; not a bulletin.
 */
export function EventDetailDrawer({ event, onClose, locale = "en" }: Props) {
  if (!event) return null;

  const magNd = event.magnitude == null || !Number.isFinite(event.magnitude);
  const external = gossipHref(event);
  const idLabel = event.id.replace(/^(gossip|ingv|usgs)-/i, "");

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[1400px] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4"
      role="dialog"
      aria-label={locale === "it" ? "Dettaglio evento" : "Event detail"}
    >
      <div className="rounded-t-xl border border-border bg-card shadow-lg sm:rounded-xl">
        <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ background: magColor(event.magnitude) }}
                aria-hidden
              />
              <span className="font-mono text-base font-semibold tabular-nums">
                {magNd ? "M—" : `M${formatMag(event.magnitude)}`}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {event.magType || (magNd ? "N/D" : "")}
                </span>
              </span>
              {magNd && (
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {locale === "it"
                    ? "magnitudo non determinata"
                    : "magnitude not determined"}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {event.place || "—"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 shrink-0 px-0"
            onClick={onClose}
            aria-label={locale === "it" ? "Chiudi" : "Close"}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 py-2.5 text-[11px] sm:grid-cols-4">
          <Field
            label={locale === "it" ? "Profondità" : "Depth"}
            value={`${event.depthKm.toFixed(2)} km`}
          />
          <Field
            label={locale === "it" ? "Ora (Roma)" : "Time (Rome)"}
            value={romeTime(event.time)}
          />
          <Field label="UTC" value={formatDateTime(event.time)} />
          <Field label="Δt" value={formatRelativeTime(event.time)} />
          <Field
            label="Lat"
            value={event.latitude.toFixed(5)}
            mono
          />
          <Field
            label="Lon"
            value={event.longitude.toFixed(5)}
            mono
          />
          <Field
            label={locale === "it" ? "Rete / fonte" : "Net / source"}
            value={`${event.provider}${event.author ? ` · ${event.author}` : ""}`}
          />
          <Field
            label={locale === "it" ? "ID catalogo" : "Catalog id"}
            value={idLabel}
            mono
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
          <span className="text-[10px] text-muted-foreground">
            {locale === "it"
              ? "Osservazione · non bollettino ufficiale"
              : "Observation · not an official bulletin"}
          </span>
          {external && (
            <a
              href={external}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex min-h-9 items-center gap-1 text-[11px] font-medium text-accent hover:underline"
            >
              {locale === "it" ? "Apri su GOSSIP" : "Open on GOSSIP"}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border/70 bg-secondary/20 px-2 py-1.5">
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "truncate text-[12px] text-foreground",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </div>
    </div>
  );
}
