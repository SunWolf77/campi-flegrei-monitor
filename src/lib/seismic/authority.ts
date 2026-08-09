/**
 * Catalog authority routing for sun-earth-sentinel focus nodes.
 *
 * Rule: ONE authority family per node. Never dual-read USGS + INGV for the
 * same focus box — that produces double-counts, mismatched magnitudes (Mw vs Md),
 * and incomplete Italian microseismicity from USGS.
 *
 * Live check (7d Campi Flegrei, 2026-08-01):
 *   USGS FDSN bbox  → ~1 event
 *   INGV FDSN bbox  → ~60 events
 *   GOSSIP (OV)     → ~1500+ localized YTD
 *
 * Italy / CF / Vesuvius → INGV family (GOSSIP → FDSN). Pacific TK → USGS only.
 */

import type { FocusNodeId, SeismicProviderId } from "./types";

export type CatalogAuthority = "ingv-family" | "usgs-family";

export type NodeAuthorityPolicy = {
  nodeId: FocusNodeId;
  /** Exclusive family — SES merge must not mix families for this node. */
  authority: CatalogAuthority;
  /** Ordered exclusive provider chain (first success wins, no merge). */
  chain: SeismicProviderId[];
  /** Providers that must never be queried for this node. */
  blocked: SeismicProviderId[];
  /** SES dragon-node id (sun-earth-sentinel DRAGON_NODES). */
  sesDragonId: string;
  /** Human label for feed health strip. */
  label: string;
  rationale: string;
};

export const NODE_AUTHORITY: Record<FocusNodeId, NodeAuthorityPolicy> = {
  "campi-flegrei": {
    nodeId: "campi-flegrei",
    authority: "ingv-family",
    chain: ["gossip", "ingv"],
    blocked: ["usgs"],
    sesDragonId: "mediterranean",
    label: "INGV-OV (GOSSIP → FDSN)",
    rationale:
      "INGV is the national authority for Italian seismicity. USGS reports at most a handful of felt CF events and systematically under-samples the shallow Md swarm catalog used operationally by Osservatorio Vesuviano.",
  },
  vesuvius: {
    nodeId: "vesuvius",
    authority: "ingv-family",
    chain: ["gossip", "ingv"],
    blocked: ["usgs"],
    sesDragonId: "vesuvius",
    label: "INGV-OV (GOSSIP vesuvio → FDSN)",
    rationale:
      "Vesuvius local seismicity is published by Osservatorio Vesuviano on the GOSSIP vesuvio area feed. USGS does not resolve the dense shallow cone catalog; exclusive INGV-family authority, no dual-read.",
  },
  "tonga-kermadec": {
    nodeId: "tonga-kermadec",
    authority: "usgs-family",
    chain: ["usgs"],
    blocked: ["ingv", "gossip"],
    sesDragonId: "tonga",
    label: "USGS FDSN / realtime",
    rationale:
      "Tonga–Kermadec trench is covered by the USGS global FDSN + summary feeds used by sun-earth-sentinel node #1. INGV has no local dense catalog here.",
  },
};

export function getAuthority(nodeId: FocusNodeId | string): NodeAuthorityPolicy {
  if (nodeId in NODE_AUTHORITY) return NODE_AUTHORITY[nodeId as FocusNodeId];
  return NODE_AUTHORITY["campi-flegrei"];
}

/** True for Campi Flegrei + Vesuvius (shared GOSSIP / INGV-OV family). */
export function isIngvGossipNode(nodeId: FocusNodeId | string): boolean {
  const policy = getAuthority(nodeId);
  return policy.authority === "ingv-family";
}

/**
 * Build the exclusive fetch chain for a node.
 * forceProvider is allowed only if it belongs to the node's authority family;
 * cross-family force is ignored (never dual-read).
 */
export function resolveProviderChain(
  nodeId: FocusNodeId,
  forceProvider?: SeismicProviderId,
): { chain: SeismicProviderId[]; authority: CatalogAuthority; forced: boolean } {
  const policy = getAuthority(nodeId);

  if (forceProvider) {
    if (policy.blocked.includes(forceProvider)) {
      // Hard block: never USGS for CF/VE, never GOSSIP for TK
      return { chain: [...policy.chain], authority: policy.authority, forced: false };
    }
    if (policy.chain.includes(forceProvider)) {
      // Re-order: forced primary, then remaining of same family
      const rest = policy.chain.filter((p) => p !== forceProvider);
      return {
        chain: [forceProvider, ...rest],
        authority: policy.authority,
        forced: true,
      };
    }
  }

  return { chain: [...policy.chain], authority: policy.authority, forced: false };
}

export function isProviderAllowed(
  nodeId: FocusNodeId,
  provider: SeismicProviderId,
): boolean {
  const policy = getAuthority(nodeId);
  return policy.chain.includes(provider) && !policy.blocked.includes(provider);
}
