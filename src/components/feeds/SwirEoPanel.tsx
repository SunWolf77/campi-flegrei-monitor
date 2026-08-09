import { useEffect, useState } from "react";
import { ExternalLink, Flame, RefreshCw, Satellite } from "lucide-react";
import type { FocusNodeId } from "@/lib/seismic/types";
import {
  emptySwirPack,
  type SwirPack,
  type SwirProductId,
} from "@/lib/eo/swir";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, formatRelativeTime } from "@/lib/utils";

type Props = {
  nodeId: FocusNodeId;
  className?: string;
};

const PRODUCT_ORDER: SwirProductId[] = ["truecolor", "geology", "heat"];

export function SwirEoPanel({ nodeId, className }: Props) {
  const [pack, setPack] = useState<SwirPack>(() => emptySwirPack(nodeId));
  const [active, setActive] = useState<SwirProductId>("truecolor");
  const [loading, setLoading] = useState(true);
  const [imgErr, setImgErr] = useState(false);

  const load = (force = false) => {
    setLoading(true);
    setImgErr(false);
    const q = new URLSearchParams({ node: nodeId });
    if (force) q.set("_", String(Date.now()));
    void fetch(`/api/eo/swir?${q}`, { headers: { Accept: "application/json" } })
      .then(async (r) => {
        const j = (await r.json()) as SwirPack;
        setPack(j);
        if (j.products[0]) setActive(j.products[0].id);
      })
      .catch((e) => {
        setPack(
          emptySwirPack(
            nodeId,
            e instanceof Error ? e.message : "EO fetch failed",
          ),
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(false);
    // refresh every 6h client-side (server cache matches)
    const id = window.setInterval(() => load(false), 6 * 3600_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  const product =
    pack.products.find((p) => p.id === active) ?? pack.products[0] ?? null;

  const cloudLabel =
    pack.cloudCoverPct != null
      ? `${pack.cloudCoverPct.toFixed(1)}% cloud`
      : "cloud n/a";
  const ageLabel =
    pack.sceneTime != null && Number.isFinite(Date.parse(pack.sceneTime))
      ? formatRelativeTime(Date.parse(pack.sceneTime))
      : pack.ageDays != null
        ? `${pack.ageDays.toFixed(1)} d ago`
        : "—";

  return (
    <Card className={cn("overflow-hidden border-accent/20", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Satellite className="size-4 text-accent" aria-hidden />
          <CardTitle className="text-sm">SWIR · Sentinel-2 Phase A</CardTitle>
          <Badge variant="outline" className="font-mono text-[10px]">
            EO
          </Badge>
          {pack.ok && (
            <Badge variant="secondary" className="font-mono text-[10px]">
              {cloudLabel}
            </Badge>
          )}
        </div>
        <CardDescription className="text-[11px] leading-snug">
          Latest low-cloud S2 L2A over this node AOI.{" "}
          <strong className="font-medium text-foreground">Observational only</strong>{" "}
          — not a thermal alert and not INGV authority. {pack.note}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {PRODUCT_ORDER.map((id) => {
            const p = pack.products.find((x) => x.id === id);
            const disabled = !p;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled || loading}
                onClick={() => {
                  setActive(id);
                  setImgErr(false);
                }}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                  active === id && p
                    ? "border-accent/50 bg-accent/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                  disabled && "opacity-40",
                )}
              >
                {id === "heat" && <Flame className="size-3" aria-hidden />}
                {p?.label ?? id}
              </button>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto h-9 gap-1 px-2 text-[11px]"
            onClick={() => load(true)}
            disabled={loading}
            title="Refresh EO pack"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <div className="relative aspect-square max-h-[min(420px,70vw)] w-full overflow-hidden rounded-lg border border-border bg-secondary/50 sm:aspect-[4/3] sm:max-h-[360px]">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 text-xs text-muted-foreground backdrop-blur-[1px]">
              Loading Sentinel-2 pack…
            </div>
          )}
          {!loading && product && !imgErr && (
            <img
              src={product.imageUrl}
              alt={`${product.label} · ${pack.sceneId ?? "S2"}`}
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgErr(true)}
            />
          )}
          {!loading && (imgErr || !product) && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
              <p>{pack.error ?? "Preview unavailable for this scene."}</p>
              {pack.browserUrl && (
                <a
                  href={pack.browserUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  Open Copernicus Browser
                </a>
              )}
            </div>
          )}
          {product && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-8">
              <p className="text-[11px] font-medium text-white">{product.label}</p>
              <p className="font-mono text-[10px] text-white/80">
                {product.bands} · {ageLabel}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Kpi label="Scene age" value={ageLabel} />
          <Kpi
            label="Cloud"
            value={
              pack.cloudCoverPct != null
                ? `${pack.cloudCoverPct.toFixed(1)}%`
                : "—"
            }
          />
          <Kpi label="Tile" value={pack.tile ?? "—"} mono />
        </div>

        {product && (
          <p className="text-[10px] leading-snug text-muted-foreground">
            {product.blurb}
            {pack.sceneId && (
              <>
                {" "}
                · <span className="font-mono">{pack.sceneId}</span>
              </>
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {pack.browserUrl && (
            <a
              href={pack.browserUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-[11px] font-medium hover:border-accent/40 hover:text-accent"
            >
              Copernicus Browser
              <ExternalLink className="size-3" />
            </a>
          )}
          {pack.explorerUrl && (
            <a
              href={pack.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-[11px] font-medium hover:border-accent/40 hover:text-accent"
            >
              Scene explorer
              <ExternalLink className="size-3" />
            </a>
          )}
          {pack.stacUrl && (
            <a
              href={pack.stacUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-[11px] font-medium hover:border-accent/40 hover:text-accent"
            >
              STAC item
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground">{pack.attribution}</p>
      </CardContent>
    </Card>
  );
}

function Kpi({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-2 py-1.5">
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "truncate text-xs font-semibold text-foreground",
          mono && "font-mono",
        )}
      >
        {value}
      </div>
    </div>
  );
}
