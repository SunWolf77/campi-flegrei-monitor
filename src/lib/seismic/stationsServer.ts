import { createServerFn } from "@tanstack/react-start";
import { getFocusNode } from "./focus-nodes";
import type { FocusNodeId } from "./types";
import { isIngvGossipNode } from "./authority";
import {
  fetchIngvStations,
  filterMapStations,
  type SeismicStation,
} from "./stations";

export type StationsPayload = {
  stations: SeismicStation[];
  sourceUrl: string;
  fetchedAt: number;
  nodeId: FocusNodeId;
  error?: string;
};

export async function loadStationsPayload(
  nodeId: FocusNodeId = "campi-flegrei",
): Promise<StationsPayload> {
  const node = getFocusNode(nodeId);
  // Station layer is INGV FDSN — meaningful for Campania volcano nodes (CF + VE).
  // TK / Pacific nodes get empty set (no false global stations).
  if (!isIngvGossipNode(nodeId)) {
    return {
      stations: [],
      sourceUrl: "",
      fetchedAt: Date.now(),
      nodeId,
      error: "Station layer is INGV-OV only (Campi Flegrei / Vesuvius).",
    };
  }

  try {
    const { stations, sourceUrl, fetchedAt } = await fetchIngvStations(node.bbox);
    return {
      stations: filterMapStations(stations, { primaryOnly: true, includeInactive: false }),
      sourceUrl,
      fetchedAt,
      nodeId,
    };
  } catch (err) {
    return {
      stations: [],
      sourceUrl: "",
      fetchedAt: Date.now(),
      nodeId,
      error: err instanceof Error ? err.message : "Station fetch failed",
    };
  }
}

export const fetchStations = createServerFn({ method: "GET" })
  .validator((data: { nodeId?: string } | undefined) => data ?? {})
  .handler(async ({ data }): Promise<StationsPayload> => {
    const nodeId = (data?.nodeId ?? "campi-flegrei") as FocusNodeId;
    return loadStationsPayload(nodeId);
  });
