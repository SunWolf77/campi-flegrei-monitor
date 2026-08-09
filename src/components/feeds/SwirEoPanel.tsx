import { useEffect, useState, type SyntheticEvent } from "react";
import {
  ExternalLink,
  Flame,
  GitCompareArrows,
  Leaf,
  RefreshCw,
  Satellite,
} from "lucide-react";
import type { FocusNodeId } from "@/lib/seismic/types";
import {
  SWIR_PHASE_A,
  SWIR_PHASE_B,
  SWIR_PHASE_C,
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

export function SwirEoPanel({ nodeId, className }: Props) {
  const [pack, setPack] = useState<SwirPack>(() => emptySwirPack(nodeId));
  const [active, setActive] = useState<SwirProductId>("truecolor");
  const [loading, setLoading] = useState(true);
  const [imgErr, setImgErr] = useState(false);
  const [changeStats, setChangeStats] = useState<string | null>(null);

  const load = (force = false) => {
    setLoading(true);
    setImgErr(false);
    setChangeStats(null);
    const q = new URLSearchParams({ node: nodeId });
    if (force) q.set("refresh", "1");
    void fetch(`/api/eo/swir?${q}`, { headers: { Accept: "application/json" } })
      .then(async (r) => {
        const j = (await r.json()) as SwirPack;
        setPack(j);
        if (!j.products.some((p) => p.id === active) && j.products[0]) {
          setActive(j.products[0].id);
        }
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

  const select = (id: SwirProductId) => {
    setActive(id);
    setImgErr(false);
    setChangeStats(null);
  };

  const onImgLoad = (_e: SyntheticEvent<HTMLImageElement>) => {
    /* reserved */
  };

  // When change product selected, fetch HEAD/GET for stats header once
  useEffect(() => {
    if (!product || product.phase !== "C" || !product.imageUrl) {
      setChangeStats(null);
      return;
    }
    let cancelled = false;
    void fetch(product.imageUrl, { method: "GET" })
      .then(async (r) => {
        if (cancelled) return;
        const raw = r.headers.get("X-Ses-Eo-Stats");
        if (raw) {
          try {
            const s = JSON.parse(raw) as {
              mean: number;
              p90: number;
              fracHigh: number;
              fracModerate: number;
            };
            setChangeStats(
              `mean ${s.mean.toFixed(3)} · p90 ${s.p90.toFixed(3)} · mod+ ${(
                (s.fracModerate + s.fracHigh) *
                100
              ).toFixed(0)}%`,
            );
          } catch {
            setChangeStats(null);
          }
        }
        // ensure browser has body cached for img
      })
      .catch(() => {
        if (!cancelled) setChangeStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.imageUrl, product?.phase]);

  const pair = pack.pair;

  return (
    <Card className={cn("overflow-hidden border-accent/20", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Satellite className="size-4 text-accent" aria-hidden />
          <CardTitle className="text-sm">S2 EO · Phase A–C</CardTitle>
          <Badge variant="outline" className="font-mono text-[10px]">
            EO
          </Badge>
          {pack.ok && (
            <Badge variant="secondary" className="font-mono text-[10px]">
              {cloudLabel}
            </Badge>
          )}
          {pair && (
            <Badge variant="outline" className="font-mono text-[10px]">
              Δ {pair.daysBetween?.toFixed(0) ?? "?"}d
            </Badge>
          )}
        </div>
        <CardDescription className="text-[11px] leading-snug">
          Composites · single-date indices ·{" "}
          <strong className="font-medium text-foreground">
            dual-scene dNBR / RdNBR / dNDVI / dNDMI
          </strong>
          . Observational only — not INGV authority, not a fire/thermal alert.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ProductRow
          title="Phase A · composites"
          ids={SWIR_PHASE_A}
          pack={pack}
          active={active}
          loading={loading}
          onSelect={select}
        />
        <ProductRow
          title="Phase B · indices"
          ids={SWIR_PHASE_B}
          pack={pack}
          active={active}
          loading={loading}
          onSelect={select}
          indexStyle
        />
        <ProductRow
          title="Phase C · change (pre − post)"
          ids={SWIR_PHASE_C}
          pack={pack}
          active={active}
          loading={loading}
          onSelect={select}
          changeStyle
        />

        {pair && (
          <p className="rounded-md border border-border bg-secondary/30 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
            <span className="font-sans font-medium text-foreground">Pair · </span>
            post {pair.postTime?.slice(0, 10) ?? "—"} (cloud{" "}
            {pair.postCloud?.toFixed(1) ?? "?"}%) ← pre{" "}
            {pair.preTime?.slice(0, 10) ?? "—"} (cloud{" "}
            {pair.preCloud?.toFixed(1) ?? "?"}%)
            {pair.daysBetween != null && <> · {pair.daysBetween.toFixed(1)} d</>}
          </p>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 gap-1 px-2 text-[11px]"
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
          {!loading && product && !imgErr && product.imageUrl && (
            <img
              src={product.imageUrl}
              alt={`${product.label} · ${pack.sceneId ?? "S2"}`}
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={onImgLoad}
              onError={() => setImgErr(true)}
            />
          )}
          {!loading && (imgErr || !product?.imageUrl) && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
              <p>
                {pack.error ??
                  (product?.phase === "C" && !pair
                    ? "No clear pre/post pair yet for change products."
                    : "Preview unavailable for this scene.")}
              </p>
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
              <p className="text-[11px] font-medium text-white">
                {product.label}
                <span className="ml-1.5 font-mono text-[10px] text-white/70">
                  · Phase {product.phase}
                </span>
              </p>
              <p className="font-mono text-[10px] text-white/80">
                {product.formula ?? product.bands} · {ageLabel}
              </p>
            </div>
          )}
        </div>

        {product?.phase === "B" && <IndexLegend productId={product.id} />}
        {product?.phase === "C" && (
          <ChangeLegend productId={product.id} statsLine={changeStats} />
        )}

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

function ProductRow({
  title,
  ids,
  pack,
  active,
  loading,
  onSelect,
  indexStyle,
  changeStyle,
}: {
  title: string;
  ids: SwirProductId[];
  pack: SwirPack;
  active: SwirProductId;
  loading: boolean;
  onSelect: (id: SwirProductId) => void;
  indexStyle?: boolean;
  changeStyle?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {ids.map((id) => {
          const p = pack.products.find((x) => x.id === id);
          const disabled = !p;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled || loading}
              onClick={() => onSelect(id)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                active === id && p
                  ? "border-accent/50 bg-accent/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
                disabled && "opacity-40",
              )}
            >
              {id === "heat" && <Flame className="size-3" aria-hidden />}
              {indexStyle && <Leaf className="size-3" aria-hidden />}
              {changeStyle && <GitCompareArrows className="size-3" aria-hidden />}
              {p?.label ?? id.toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function IndexLegend({ productId }: { productId: SwirProductId }) {
  if (productId === "ndvi") {
    return (
      <p className="rounded-md border border-border bg-secondary/30 px-2 py-1.5 text-[10px] text-muted-foreground">
        <span className="font-medium text-foreground">NDVI ramp</span> — red/low
        (bare, urban) → green/high (dense vegetation). Single date.
      </p>
    );
  }
  if (productId === "ndmi") {
    return (
      <p className="rounded-md border border-border bg-secondary/30 px-2 py-1.5 text-[10px] text-muted-foreground">
        <span className="font-medium text-foreground">NDMI ramp</span> — brown/low
        (dry) → teal/high (moister canopy/soil).
      </p>
    );
  }
  if (productId === "nbr") {
    return (
      <p className="rounded-md border border-border bg-secondary/30 px-2 py-1.5 text-[10px] text-muted-foreground">
        <span className="font-medium text-foreground">NBR ramp</span> — single-date
        burn/bare contrast. Use Phase C dNBR for change.
      </p>
    );
  }
  return null;
}

function ChangeLegend({
  productId,
  statsLine,
}: {
  productId: SwirProductId;
  statsLine: string | null;
}) {
  const title =
    productId === "rdnbr"
      ? "RdNBR severity"
      : productId === "dndvi"
        ? "dNDVI (veg loss)"
        : productId === "dndmi"
          ? "dNDMI (moisture loss)"
          : "dNBR change";
  return (
    <div className="space-y-1 rounded-md border border-border bg-secondary/30 px-2 py-1.5 text-[10px] text-muted-foreground">
      <p>
        <span className="font-medium text-foreground">{title}</span>
        {" — "}
        blue/cyan = gain (greener/wetter) · white ≈ stable · yellow/red = loss
        (pre − post). Severity bins are{" "}
        <em>illustrative</em> for caldera/urban mix.
      </p>
      {statsLine && (
        <p className="font-mono text-foreground/90">AOI · {statsLine}</p>
      )}
    </div>
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
