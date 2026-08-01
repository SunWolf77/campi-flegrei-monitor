import type { FocusNode, FocusNodeId } from "./types";

/**
 * Sun-Earth-Sentinel focus nodes.
 * Tonga–Kermadec is node #1 (USGS authority); Campi Flegrei is node #2
 * (INGV-OV GOSSIP → FDSN authority — never dual-read USGS for this box).
 *
 * SES dragon ids: tonga / mediterranean (see ses-bridge.ts).
 */
export const FOCUS_NODES: Record<FocusNodeId, FocusNode> = {
  "campi-flegrei": {
    id: "campi-flegrei",
    name: "Campi Flegrei",
    code: "CF",
    networkOrder: 2,
    network: "sun-earth-sentinel",
    description:
      "Phlegraean Fields caldera west of Naples. Dense shallow swarm seismicity from INGV–Osservatorio Vesuviano GOSSIP (Localizzazioni Sismiche). USGS under-reports microseismicity here — exclusive INGV-family authority, no dual-read.",
    region: "Campania, Italy",
    provider: "gossip",
    fallbackProvider: "ingv",
    bbox: {
      minLat: 40.78,
      maxLat: 40.90,
      minLon: 14.05,
      maxLon: 14.22,
    },
    center: { lat: 40.827, lon: 14.139 },
    mapPad: 0.02,
    volcano: {
      name: "Campi Flegrei caldera",
      type: "Restless caldera / resurgent caldera",
      statusNote:
        "Long-term unrest with bradyseism, hydrothermal activity, and recurrent seismic swarms. Depths are typically very shallow (under 4 km).",
      outline: [
        [14.05, 40.8],
        [14.07, 40.845],
        [14.1, 40.865],
        [14.14, 40.875],
        [14.18, 40.87],
        [14.2, 40.855],
        [14.21, 40.83],
        [14.2, 40.8],
        [14.18, 40.78],
        [14.14, 40.77],
        [14.1, 40.775],
        [14.07, 40.785],
        [14.05, 40.8],
      ],
      officialMapUrl: "https://terremoti.ov.ingv.it/gossip/flegrei/",
    },
    depthRangeKm: { shallow: 1.5, deep: 5 },
  },
  "tonga-kermadec": {
    id: "tonga-kermadec",
    name: "Tonga–Kermadec",
    code: "TK",
    networkOrder: 1,
    network: "sun-earth-sentinel",
    description:
      "Primary sun-earth-sentinel focus node — Tonga–Kermadec arc / Hunga region. USGS global catalog is the exclusive authority (matches SES dragon node `tonga`).",
    region: "SW Pacific",
    provider: "usgs",
    fallbackProvider: "usgs",
    bbox: {
      minLat: -26.5,
      maxLat: -14.0,
      minLon: -179.5,
      maxLon: -172.0,
    },
    center: { lat: -20.5, lon: -175.4 },
    mapPad: 0.5,
    volcano: {
      name: "Hunga Tonga–Hunga Haʻapai region",
      type: "Submarine arc volcano / trench system",
      statusNote:
        "Arc–trench seismicity with intermediate-depth slabs. Linked as SES node #1.",
    },
    depthRangeKm: { shallow: 70, deep: 300 },
  },
};

export const DEFAULT_FOCUS_NODE: FocusNodeId = "campi-flegrei";

export function getFocusNode(id: FocusNodeId | string): FocusNode {
  if (id in FOCUS_NODES) return FOCUS_NODES[id as FocusNodeId];
  return FOCUS_NODES["campi-flegrei"];
}

export function listFocusNodes(): FocusNode[] {
  return Object.values(FOCUS_NODES).sort((a, b) => a.networkOrder - b.networkOrder);
}
