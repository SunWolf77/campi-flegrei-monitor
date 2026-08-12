/**
 * In-memory last-good catalog for SES degraded mode.
 * Survives transient INGV/GOSSIP failures without wiping densify.
 */

import type { CatalogPayload } from "./catalog";
import type { FocusNodeId } from "./types";

type Key = string;
type Entry = { payload: CatalogPayload; savedAt: number };

const store = new Map<Key, Entry>();
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

function key(nodeId: FocusNodeId, windowKey: string): Key {
  return `${nodeId}:${windowKey}`;
}

export function saveLastGood(
  nodeId: FocusNodeId,
  windowKey: string,
  payload: CatalogPayload,
): void {
  if (!payload.events?.length && payload.error) return;
  store.set(key(nodeId, windowKey), {
    payload: { ...payload, error: undefined },
    savedAt: Date.now(),
  });
}

export function loadLastGood(
  nodeId: FocusNodeId,
  windowKey: string,
): CatalogPayload | null {
  const hit = store.get(key(nodeId, windowKey));
  if (!hit) return null;
  if (Date.now() - hit.savedAt > MAX_AGE_MS) {
    store.delete(key(nodeId, windowKey));
    return null;
  }
  return {
    ...hit.payload,
    fetchedAt: hit.payload.fetchedAt,
  };
}

export function lastGoodAgeMs(
  nodeId: FocusNodeId,
  windowKey: string,
): number | null {
  const hit = store.get(key(nodeId, windowKey));
  if (!hit) return null;
  return Date.now() - hit.savedAt;
}
