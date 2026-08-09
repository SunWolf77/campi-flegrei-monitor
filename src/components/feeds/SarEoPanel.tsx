import { useEffect, useState } from "react";
import { ExternalLink, Radar, RefreshCw } from "lucide-react";
import type { FocusNodeId } from "@/lib/seismic/types";
import {
  SAR_PRODUCT_ORDER,
  emptySarPack,
  type SarPack,
  type SarProductId,
} from "@/lib/eo/sar";
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

export function SarEoPanel({ nodeId, className }: Props) {
  const [pack, setPack] = useState<SarPack>(() => emptySarPack(nodeId));
  const [active, setActive] = useState<SarProductId>("rgb");
  const [loading, setLoading] = useState(true);
  const [imgErr, setImgErr] = useState(false);

  const load = (force = false) => {
    setLoading(true);
    setImgErr(false);
    const q = new URLSearchParams({ node: nodeId });
    if (force) q.set("refresh", "1");
    void fetch(`/api/eo/sar?${q}`, { headers: { Accept: "application/json" } })
      .then(async (r) => {
        const j = (await r.json()) as SarPack;
        setPack(j);
        if (!j.products.some((p) => p.id === active) && j.products[0]) {
          setActive(j.products[0].id);
        }
      })
      .catch((e) => {
        setPack(
          emptySarPack(
            nodeId,
            e instanceof Error ? e.message : "SAR fetch failed",
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

  const ageLabel =
    pack.sceneTime != null && Number.isFinite(Date.parse(pack.sceneTime))
      ? formatRelativeTime(Date.parse(pack.sceneTime))
      : pack.ageDays != null
        ? `${pack.ageDays.toFixed(1)} d ago`
        : "—";

  const orbitLabel = [
    pack.orbitState,
    pack.relativeOrbit != null ? `R${pack.relativeOrbit}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className={cn("overflow-hidden border-border", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Radar className="size-4 text-accent" aria-hidden />
          <CardTitle className="text-sm">S1 SAR · Phase D1</CardTitle>
          <Badge variant="outline" className="font-mono text-[10px]">
            RTC
          </Badge>
          {pack.platform && (
            <Badge variant="secondary" className="font-mono text-[10px]">
              {pack.platform}
            </Badge>
          )}
          {orbitLabel && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {orbitLabel}
            </Badge>
          )}
        </div>
        <CardDescription className="text-[11px] leading-snug">
          Latest Sentinel-1{" "}
          <strong className="font-medium text-foreground">RTC amplitude</strong>{" "}
          (VV · VH). All-weather radar context —{" "}
          <em>not</em> InSAR displacement or a deformation alert.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {SAR_PRODUCT_ORDER.map((id) => {
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
                {p?.label ?? id.toUpperCase()}
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
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <div className="relative aspect-square max-h-[min(420px,70vw)] w-full overflow-hidden rounded-lg border border-border bg-secondary/50 sm:aspect-[4/3] sm:max-h-[360px]">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 text-xs text-muted-foreground">
              Loading Sentinel-1 RTC…
            </div>
          )}
          {!loading && product && !imgErr && (
            <img
              src={product.imageUrl}
              alt={`${product.label} · ${pack.sceneId ?? "S1"}`}
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgErr(true)}
            />
          )}
          {!loading && (imgErr || !product) && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
              <p>{pack.error ?? "SAR preview unavailable."}</p>
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

        <p className="rounded-md border border-border bg-secondary/30 px-2 py-1.5 text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">Speckle</span> is
          normal for single-look radar. For mm-scale uplift use external InSAR
          time series (COMET / INGV GeoSAR) — not this amplitude pack.
        </p>

        <div className="grid grid-cols-3 gap-2">
          <Kpi label="Scene age" value={ageLabel} />
          <Kpi
            label="Pol"
            value={pack.polarizations.join("·") || "—"}
            mono
          />
          <Kpi label="Orbit" value={orbitLabel || "—"} mono />
        </div>

        {product && (
          <p className="text-[10px] leading-snug text-muted-foreground">
            {product.blurb}
            {pack.sceneId && (
              <>
                {" "}
                · <span className="font-mono break-all">{pack.sceneId}</span>
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
