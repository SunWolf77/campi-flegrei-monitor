import { ExternalLink, Link2 } from "lucide-react";
import type { FocusNodeId } from "@/lib/seismic/types";
import {
  deskBlurb,
  deskLabel,
  officialDeskLinks,
} from "@/lib/seismic/official-desk";
import type { Locale } from "@/lib/i18n/messages";
import { t } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

type Props = {
  nodeId: FocusNodeId;
  locale: Locale;
  className?: string;
  /** Compact chip row for sticky chrome */
  compact?: boolean;
};

export function OfficialDeskStrip({
  nodeId,
  locale,
  className,
  compact,
}: Props) {
  const links = officialDeskLinks(nodeId);

  if (compact) {
    return (
      <div
        className={cn(
          "flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
        role="navigation"
        aria-label={t(locale, "officialLinks")}
      >
        {links.slice(0, 6).map((l) => (
          <a
            key={l.id}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-[11px] font-medium text-foreground hover:border-accent/40 hover:text-accent"
          >
            {deskLabel(l, locale)}
            {l.official && (
              <span className="text-[9px] text-muted-foreground">·</span>
            )}
          </a>
        ))}
      </div>
    );
  }

  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card",
        className,
      )}
      aria-label={t(locale, "officialLinks")}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Link2 className="size-3.5 text-accent" aria-hidden />
        <h2 className="text-xs font-semibold text-foreground">
          {t(locale, "officialLinks")}
        </h2>
        <span className="text-[10px] text-muted-foreground">
          {t(locale, "ownership")}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {links.map((l) => (
          <li key={l.id}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-start justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-secondary/40"
            >
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-foreground">
                  {deskLabel(l, locale)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {deskBlurb(l, locale)}
                  {" · "}
                  {l.official
                    ? t(locale, "officialSite")
                    : t(locale, "thisDesk")}
                </div>
              </div>
              <ExternalLink
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
