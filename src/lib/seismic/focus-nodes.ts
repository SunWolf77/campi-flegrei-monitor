import type { FocusNode, FocusNodeId } from "./types";

/**
 * Sun-Earth-Sentinel focus nodes.
 * Tonga–Kermadec is node #1 (USGS authority); Campi Flegrei is node #2
 * (INGV-OV GOSSIP → FDSN authority — never dual-read USGS for this box).
 * Vesuvius is node #3 (same INGV-OV GOSSIP family, vesuvio area).
 *
 * SES dragon ids: tonga / mediterranean / vesuvius (see ses-bridge.ts).
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
      // Catalog query box (dense GOSSIP microseismicity)
      minLat: 40.78,
      maxLat: 40.9,
      minLon: 14.05,
      maxLon: 14.22,
    },
    center: { lat: 40.827, lon: 14.139 },
    mapPad: 0.01,
    /** Tighter initial map frame (caldera) — does not shrink catalog bbox */
    mapView: {
      minLat: 40.795,
      maxLat: 40.855,
      minLon: 14.09,
      maxLon: 14.19,
    },
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
  vesuvius: {
    id: "vesuvius",
    name: "Vesuvius",
    code: "VE",
    networkOrder: 3,
    network: "sun-earth-sentinel",
    description:
      "Mount Vesuvius stratovolcano east of Naples. INGV–Osservatorio Vesuviano GOSSIP (vesuvio area) is the exclusive dense local catalog. Same INGV-family authority as Campi Flegrei — never dual-read USGS for this box.",
    region: "Campania, Italy",
    provider: "gossip",
    fallbackProvider: "ingv",
    bbox: {
      // Catalog query box around the cone + proximal slopes
      minLat: 40.78,
      maxLat: 40.86,
      minLon: 14.38,
      maxLon: 14.48,
    },
    center: { lat: 40.821, lon: 14.426 },
    mapPad: 0.008,
    mapView: {
      minLat: 40.8,
      maxLat: 40.84,
      minLon: 14.4,
      maxLon: 14.45,
    },
    volcano: {
      name: "Mount Vesuvius",
      type: "Stratovolcano (Somma–Vesuvius complex)",
      statusNote:
        "Alert level green (baseline). Seismicity is typically very shallow and low-energy, concentrated under the crater and upper cone. Observational monitoring only — not a forecast product.",
      outline: [
        [14.4, 40.81],
        [14.41, 40.825],
        [14.42, 40.835],
        [14.435, 40.838],
        [14.45, 40.832],
        [14.455, 40.82],
        [14.45, 40.808],
        [14.435, 40.802],
        [14.42, 40.8],
        [14.41, 40.805],
        [14.4, 40.81],
      ],
      officialMapUrl: "https://terremoti.ov.ingv.it/gossip/vesuvio/",
    },
    depthRangeKm: { shallow: 1.0, deep: 4 },
  },
  "tonga-kermadec": {
    id: "tonga-kermadec",
    name: "Tonga–Kermadec",
    code: "TK",
    networkOrder: 1,
    network: "sun-earth-sentinel",
    description:
      "Primary sun-earth-sentinel focus node — full Tonga–Kermadec arc (northern Hunga through southern Kermadec slab). USGS exclusive authority (SES dragon node `tonga`). Catalog spans both sides of the dateline; map centres on the trench corridor.",
    region: "SW Pacific",
    provider: "usgs",
    fallbackProvider: "usgs",
    bbox: {
      // Full arc: northern Tonga transition → southern Kermadec (excludes Auckland Islands / Alpine)
      minLat: -36.5,
      maxLat: -14.0,
      // Primary west-of-dateline strip for map bounds; USGS provider also queries east strip [168, 180]
      minLon: -180.0,
      maxLon: -168.0,
    },
    center: { lat: -25.0, lon: -175.0 },
    mapPad: 0.8,
    /** Initial frame — full N–S arc corridor (swarm focus still available via pan/zoom) */
    mapView: {
      minLat: -36.5,
      maxLat: -14.0,
      minLon: -180.0,
      maxLon: -168.0,
    },
    volcano: {
      name: "Tonga–Kermadec arc / Hunga region",
      type: "Submarine arc volcano / trench system",
      statusNote:
        "Full arc–trench seismicity including intermediate-depth southern Kermadec slab. Linked as SES node #1.",
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
