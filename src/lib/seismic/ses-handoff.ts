/**
 * Bidirectional handoff with Sun Earth Sentinel (SES).
 *
 * Contract (shared with sun-earth-sentinel publishedMonitors.ts):
 *  - Sentinel → board:  ?from=ses&sesNode=<dragonId>
 *  - Board → Sentinel:  https://sun-earth-sentinel.vercel.app/?tab=live&node=<dragonId>
 *  - Catalog feed:      GET /api/ses/catalog?window=7d  (GeoJSON, CORS open)
 *
 * Dragon ids: tonga (SES #1), mediterranean (SES #2 / Campi Flegrei).
 */

import type { FocusNodeId } from "./types";
import { getAuthority } from "./authority";

export const SENTINEL_ORIGIN = "https://sun-earth-sentinel.vercel.app";
export const TONGA_BOARD_URL = "https://tonga-kermadec-monitor.vercel.app/";
export const CAMPI_BOARD_URL = "https://campi-flegrei-monitor.vercel.app/";

/** Map SES dragon id / aliases → this app's focus node id. */
const SES_TO_FOCUS: Record<string, FocusNodeId> = {
  mediterranean: "campi-flegrei",
  campi: "campi-flegrei",
  "campi-flegrei": "campi-flegrei",
  cf: "campi-flegrei",
  flegrei: "campi-flegrei",
  tonga: "tonga-kermadec",
  "tonga-kermadec": "tonga-kermadec",
  tk: "tonga-kermadec",
  kermadec: "tonga-kermadec",
};

export type SesNetworkHop = {
  id: "ses-hub" | FocusNodeId;
  /** SES dragon id when applicable */
  dragonId: string | null;
  short: string;
  label: string;
  order: number | null;
  /** External absolute URL (hub or other board) */
  href: string | null;
  /** In-app focus node (switch without leaving this board) */
  inAppNode: FocusNodeId | null;
};

/** SES network rails — hub + published swarm boards. Full titles for a11y/tooltips. */
export const SES_NETWORK: SesNetworkHop[] = [
  {
    id: "ses-hub",
    dragonId: null,
    short: "SES",
    label: "Sun-Earth-Sentinel",
    order: null,
    href: SENTINEL_ORIGIN + "/",
    inAppNode: null,
  },
  {
    id: "campi-flegrei",
    dragonId: "mediterranean",
    short: "CF",
    label: "Campi Flegrei Monitor",
    order: 2,
    href: CAMPI_BOARD_URL,
    inAppNode: "campi-flegrei",
  },
  {
    id: "tonga-kermadec",
    dragonId: "tonga",
    short: "TK",
    label: "Tonga–Kermadec Monitor",
    order: 1,
    href: TONGA_BOARD_URL,
    inAppNode: "tonga-kermadec",
  },
];

export function focusNodeFromSesParam(raw: string | null | undefined): FocusNodeId | null {
  if (!raw) return null;
  return SES_TO_FOCUS[raw.trim().toLowerCase()] ?? null;
}

export function sesDragonId(nodeId: FocusNodeId | string): string {
  return getAuthority(nodeId).sesDragonId;
}

/** Absolute Sentinel deep link that restores node focus. */
export function sentinelFocusUrl(
  nodeId: FocusNodeId | string,
  opts?: { tab?: string; returnBoard?: boolean },
): string {
  const dragon = sesDragonId(nodeId);
  const u = new URL(SENTINEL_ORIGIN + "/");
  u.searchParams.set("tab", opts?.tab ?? "live");
  u.searchParams.set("node", dragon);
  if (opts?.returnBoard) {
    // SES may ignore; documents intent for future return chips
    u.searchParams.set("board", dragon);
  }
  return u.toString();
}

/** Companion board URL (other published SES monitor) with handoff query. */
export function companionBoardUrl(nodeId: FocusNodeId): string {
  const isCf = nodeId === "campi-flegrei";
  const base = isCf ? TONGA_BOARD_URL : CAMPI_BOARD_URL;
  const companionDragon = isCf ? "tonga" : "mediterranean";
  const u = new URL(base);
  u.searchParams.set("from", "ses");
  u.searchParams.set("sesNode", companionDragon);
  return u.toString();
}

export function companionBoardLabel(nodeId: FocusNodeId): string {
  return nodeId === "campi-flegrei" ? "Tonga–Kermadec board (#1)" : "Campi Flegrei board (#2)";
}

/** This board’s public GeoJSON feed for SES merge (absolute when origin known). */
export function sesCatalogFeedUrl(
  windowKey = "7d",
  origin?: string,
): string {
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : CAMPI_BOARD_URL.replace(/\/$/, ""));
  const u = new URL("/api/ses/catalog", base.endsWith("/") ? base : `${base}/`);
  u.searchParams.set("window", windowKey);
  u.searchParams.set("node", "mediterranean");
  return u.toString();
}

export type SesHandoffState = {
  fromSes: boolean;
  /** Focus node resolved from ?sesNode= (if any) */
  focusFromQuery: FocusNodeId | null;
  sesNodeRaw: string | null;
};

/** Parse inbound handoff from the current location. */
export function parseSesHandoff(
  search = typeof window !== "undefined" ? window.location.search : "",
): SesHandoffState {
  try {
    const q = new URLSearchParams(search);
    const from = (q.get("from") || "").toLowerCase();
    const sesNodeRaw = q.get("sesNode") || q.get("node");
    return {
      fromSes:
        from === "ses" ||
        from === "sentinel" ||
        from === "sun-earth-sentinel" ||
        from === "ses-hub",
      focusFromQuery: focusNodeFromSesParam(sesNodeRaw),
      sesNodeRaw,
    };
  } catch {
    return { fromSes: false, focusFromQuery: null, sesNodeRaw: null };
  }
}

/**
 * Keep address bar aligned with active node so share / SES return feel continuous.
 * Preserves from=ses when the visit originated from Sentinel.
 */
export function syncBoardLocation(opts: {
  nodeId: FocusNodeId;
  windowKey?: string;
  fromSes?: boolean;
  replace?: boolean;
}): void {
  if (typeof window === "undefined") return;
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("node", sesDragonId(opts.nodeId));
    if (opts.windowKey) u.searchParams.set("window", opts.windowKey);
    if (opts.fromSes) {
      u.searchParams.set("from", "ses");
      u.searchParams.set("sesNode", sesDragonId(opts.nodeId));
    } else {
      // keep clean share URLs when not from SES
      if (u.searchParams.get("from") === "ses") {
        /* leave until user dismisses return chip */
      }
    }
    const next = u.pathname + u.search + u.hash;
    if (next === window.location.pathname + window.location.search + window.location.hash) return;
    if (opts.replace === false) window.history.pushState({}, "", next);
    else window.history.replaceState({}, "", next);
  } catch {
    /* ignore */
  }
}

/** Open hop: in-app node switch preferred; external only for SES hub or dedicated full board. */
export function resolveNetworkAction(
  hop: SesNetworkHop,
  currentNode: FocusNodeId,
): { kind: "external"; href: string } | { kind: "in-app"; nodeId: FocusNodeId } | { kind: "current" } {
  if (hop.id === "ses-hub") {
    return { kind: "external", href: sentinelFocusUrl(currentNode) };
  }
  if (hop.inAppNode && hop.inAppNode === currentNode) return { kind: "current" };
  if (hop.inAppNode) return { kind: "in-app", nodeId: hop.inAppNode };
  if (hop.href) return { kind: "external", href: hop.href };
  return { kind: "current" };
}
