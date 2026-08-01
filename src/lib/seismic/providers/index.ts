import type { FetchResult, FocusNode, SeismicProviderId, SeismicQuery } from "../types";
import type { SeismicProvider } from "./base";
import { ingvProvider } from "./ingv";
import { usgsProvider } from "./usgs";
import { gossipProvider } from "./gossip";
import { getAuthority, resolveProviderChain } from "../authority";

const providers: Record<SeismicProviderId, SeismicProvider> = {
  ingv: ingvProvider,
  usgs: usgsProvider,
  gossip: gossipProvider,
};

export function getProvider(id: SeismicProviderId): SeismicProvider {
  return providers[id];
}

/**
 * Fetch for a focus node using its EXCLUSIVE authority chain.
 *
 * Campi Flegrei → GOSSIP → INGV FDSN only (USGS blocked — no double-read).
 * Tonga–Kermadec → USGS only (INGV/GOSSIP blocked).
 *
 * First successful provider wins; results are never merged across families.
 */
export async function fetchForNode(
  node: FocusNode,
  opts: {
    start: Date;
    end: Date;
    minMagnitude?: number;
    limit?: number;
    forceProvider?: SeismicProviderId;
  },
): Promise<FetchResult> {
  const { chain, authority } = resolveProviderChain(node.id, opts.forceProvider);
  const policy = getAuthority(node.id);

  // Safety: strip any blocked provider that snuck in
  const safeChain = chain.filter((id) => !policy.blocked.includes(id));
  if (safeChain.length === 0) {
    throw new Error(`No allowed providers for node ${node.id}`);
  }

  const query: SeismicQuery = {
    node,
    start: opts.start,
    end: opts.end,
    minMagnitude: opts.minMagnitude,
    limit: opts.limit,
  };

  const attempted: SeismicProviderId[] = [];
  let lastErr: unknown;

  for (const id of safeChain) {
    attempted.push(id);
    try {
      const result = await getProvider(id).fetchEvents(query);
      // Soft-empty: try next in SAME family only (never cross-family)
      if (
        result.events.length === 0 &&
        attempted.length < safeChain.length
      ) {
        continue;
      }
      return {
        ...result,
        authority,
        attempted,
      };
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(`All ${authority} providers failed for ${node.id}`);
}

export { ingvProvider, usgsProvider, gossipProvider };
