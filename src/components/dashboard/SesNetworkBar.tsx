import { ArrowLeft, ExternalLink, Network } from "lucide-react";
import type { FocusNodeId } from "@/lib/seismic/types";
import {
  SES_NETWORK,
  companionBoardUrl,
  resolveNetworkAction,
  sentinelFocusUrl,
  type SesNetworkHop,
} from "@/lib/seismic/ses-handoff";
import { cn } from "@/lib/utils";

type Props = {
  nodeId: FocusNodeId;
  fromSes: boolean;
  onSelectNode: (id: FocusNodeId) => void;
  onDismissFromSes?: () => void;
  className?: string;
  /** Compact single-row for sticky header */
  compact?: boolean;
};

/**
 * SES network rail — hub + CF + TK with seamless in-app node switch and return to Sentinel.
 */
export function SesNetworkBar({
  nodeId,
  fromSes,
  onSelectNode,
  onDismissFromSes,
  className,
  compact = true,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1",
        !compact && "rounded-lg border border-border bg-card/80 px-2 py-1.5",
        className,
      )}
      role="navigation"
      aria-label="Sun-Earth-Sentinel network"
    >
      {fromSes && (
        <a
          href={sentinelFocusUrl(nodeId)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-accent/40 bg-accent/15 px-2 text-[11px] font-semibold text-accent hover:bg-accent/25"
          title="Return to Sun-Earth-Sentinel with this node focused"
        >
          <ArrowLeft className="size-3.5" />
          Sentinel
        </a>
      )}

      <span className="inline-flex items-center gap-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        <Network className="size-3 opacity-70" />
        {!compact && "Network"}
      </span>

      <div className="flex items-center rounded-md border border-border p-0.5">
        {SES_NETWORK.map((hop) => (
          <HopButton
            key={hop.id}
            hop={hop}
            currentNode={nodeId}
            onSelectNode={onSelectNode}
          />
        ))}
      </div>

      {!fromSes && (
        <a
          href={sentinelFocusUrl(nodeId)}
          className="hidden h-7 items-center gap-1 rounded-md border border-border px-2 text-[10px] font-medium text-muted-foreground hover:border-accent/40 hover:text-accent sm:inline-flex"
          title="Open Sun-Earth-Sentinel live map on this node"
        >
          Hub
          <ExternalLink className="size-2.5 opacity-70" />
        </a>
      )}

      <a
        href={companionBoardUrl(nodeId)}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden h-7 items-center gap-1 rounded-md px-1.5 text-[10px] text-muted-foreground hover:text-foreground lg:inline-flex"
        title="Open the other published swarm board"
      >
        {nodeId === "campi-flegrei" ? "TK board" : "CF board"}
        <ExternalLink className="size-2.5 opacity-60" />
      </a>

      {fromSes && onDismissFromSes && (
        <button
          type="button"
          onClick={onDismissFromSes}
          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
        >
          Stay here
        </button>
      )}
    </div>
  );
}

function HopButton({
  hop,
  currentNode,
  onSelectNode,
}: {
  hop: SesNetworkHop;
  currentNode: FocusNodeId;
  onSelectNode: (id: FocusNodeId) => void;
}) {
  const action = resolveNetworkAction(hop, currentNode);
  const active =
    action.kind === "current" ||
    (hop.inAppNode != null && hop.inAppNode === currentNode);

  const base =
    "inline-flex h-7 min-w-[2rem] items-center justify-center gap-0.5 rounded px-2 text-[11px] font-medium transition-colors";

  if (action.kind === "external") {
    return (
      <a
        href={action.href}
        className={cn(
          base,
          hop.id === "ses-hub"
            ? "text-accent hover:bg-accent/10"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
        title={hop.label}
      >
        {hop.short}
        {hop.order != null && (
          <span className="font-mono text-[9px] opacity-60">#{hop.order}</span>
        )}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (action.kind === "in-app") onSelectNode(action.nodeId);
      }}
      className={cn(
        base,
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
      title={hop.label}
      aria-current={active ? "page" : undefined}
    >
      {hop.short}
      {hop.order != null && (
        <span className={cn("font-mono text-[9px]", active ? "opacity-80" : "opacity-60")}>
          #{hop.order}
        </span>
      )}
    </button>
  );
}
