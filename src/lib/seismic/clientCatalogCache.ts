/**
 * Client localStorage last-good catalog for offline / first paint.
 */

import type { CatalogPayload } from "./catalog";
import type { FocusNodeId } from "./types";

const PREFIX = "ses-cf-catalog-v1:";

function key(nodeId: FocusNodeId, windowKey: string): string {
  return `${PREFIX}${nodeId}:${windowKey}`;
}

export function saveClientCatalog(
  nodeId: FocusNodeId,
  windowKey: string,
  payload: CatalogPayload,
): void {
  if (typeof window === "undefined") return;
  if (!payload.events?.length && payload.error) return;
  try {
    const slim: CatalogPayload = {
      ...payload,
      // cap for storage budget
      events: (payload.events ?? []).slice(0, 800),
      error: undefined,
    };
    window.localStorage.setItem(
      key(nodeId, windowKey),
      JSON.stringify({ t: Date.now(), payload: slim }),
    );
  } catch {
    /* quota */
  }
}

export function loadClientCatalog(
  nodeId: FocusNodeId,
  windowKey: string,
  maxAgeMs = 6 * 60 * 60 * 1000,
): CatalogPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(nodeId, windowKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t?: number; payload?: CatalogPayload };
    if (!parsed.payload || !parsed.t) return null;
    if (Date.now() - parsed.t > maxAgeMs) return null;
    return parsed.payload;
  } catch {
    return null;
  }
}
