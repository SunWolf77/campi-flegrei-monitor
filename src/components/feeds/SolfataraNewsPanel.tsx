import { ExternalLink, Video } from "lucide-react";
import {
  SOLFATARA_NEWS,
  solfataraNewsEmbedSrc,
} from "@/lib/media/solfatara-news";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Compact: shorter embed */
  compact?: boolean;
};

/**
 * Option A + B: channel link + official YouTube uploads embed.
 * CF-context field media only — not seismic authority.
 */
export function SolfataraNewsPanel({ className, compact = false }: Props) {
  const embed = solfataraNewsEmbedSrc();

  return (
    <Card className={cn("overflow-hidden border-border", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Video className="size-4 text-accent" aria-hidden />
          <CardTitle className="text-sm">Field video · SolfataraNews</CardTitle>
          <Badge variant="outline" className="font-mono text-[10px]">
            YouTube
          </Badge>
        </div>
        <CardDescription className="text-[11px] leading-snug">
          {SOLFATARA_NEWS.disclaimer}{" "}
          <a
            href={SOLFATARA_NEWS.channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-accent hover:underline"
          >
            {SOLFATARA_NEWS.handle}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-lg border border-border bg-secondary/40",
            compact ? "aspect-video max-h-48" : "aspect-video",
          )}
        >
          <iframe
            title={`${SOLFATARA_NEWS.title} — latest uploads`}
            src={embed}
            className="absolute inset-0 h-full w-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>{SOLFATARA_NEWS.attribution}</span>
          <a
            href={SOLFATARA_NEWS.channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-[11px] font-medium text-foreground hover:border-accent/40 hover:text-accent"
          >
            Watch on YouTube
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
