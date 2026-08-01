/**
 * Bidirectional handoff with Sun Earth Sentinel (SES).
 *
 * Contract (shared with sun-earth-sentinel publishedMonitors.ts):
 *  - Sentinel → board:  ?from=ses&sesNode=<dragonId>
 *  - Board → Sentinel:  https://sun-earth-sentinel.vercel.app/?tab=live&node=<dragonId>
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

export function focusNodeFromSesParam(raw: string | null | undefined): FocusNodeId | null {
  if (!raw) return null;
  return SES_TO_FOCUS[raw.trim().toLowerCase()] ?? null;
}

export function sesDragonId(nodeId: FocusNodeId | string): string {
  return getAuthority(nodeId).sesDragonId;
}

/** Absolute Sentinel deep link that restores node focus. */
export function sentinelFocusUrl(nodeId: FocusNodeId | string): string {
  const dragon = sesDragonId(nodeId);
  const u = new URL(SENTINEL_ORIGIN + "/");
  u.searchParams.set("tab", "live");
  u.searchParams.set("node", dragon);
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

export type SesHandoffState = {
  fromSes: boolean;
  /** Focus node resolved from ?sesNode= (if any) */
  focusFromQuery: FocusNodeId | null;
  sesNodeRaw: string | null;
};

/** Parse inbound handoff from the current location. */
export function parseSesHandoff(search = typeof window !== "undefined" ? window.location.search : ""): SesHandoffState {
  try {
    const q = new URLSearchParams(search);
    const from = (q.get("from") || "").toLowerCase();
    const sesNodeRaw = q.get("sesNode") || q.get("node");
    return {
      fromSes: from === "ses" || from === "sentinel" || from === "sun-earth-sentinel",
      focusFromQuery: focusNodeFromSesParam(sesNodeRaw),
      sesNodeRaw,
    };
  } catch {
    return { fromSes: false, focusFromQuery: null, sesNodeRaw: null };
  }
}
