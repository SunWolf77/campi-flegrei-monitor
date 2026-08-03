/**
 * External observation quick-links per focus node.
 * Pattern from tonga-kermadec-node-monitor (FIRMS / Sentinel / authority maps).
 */

import type { FocusNodeId } from "./types";

export type ObservationLink = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  group: "authority" | "satellite" | "spaceweather" | "resonance";
};

export function observationLinks(nodeId: FocusNodeId): ObservationLink[] {
  if (nodeId === "campi-flegrei") {
    return [
      {
        id: "gossip",
        title: "INGV–OV GOSSIP map",
        subtitle: "Official Localizzazioni Sismiche · Campi Flegrei",
        href: "https://terremoti.ov.ingv.it/gossip/flegrei/",
        group: "authority",
      },
      {
        id: "ov-home",
        title: "Osservatorio Vesuviano",
        subtitle: "Operational volcano monitoring · CF / Vesuvius / Ischia",
        href: "https://www.ov.ingv.it/",
        group: "authority",
      },
      {
        id: "ingv-cnt",
        title: "INGV national event list",
        subtitle: "FDSN / CNT bulletin",
        href: "https://terremoti.ingv.it/",
        group: "authority",
      },
      {
        id: "firms-cf",
        title: "NASA FIRMS thermal",
        subtitle: "VIIRS/MODIS hotspot map · Naples / Phlegraean area",
        href: "https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@14.1,40.83,10z",
        group: "satellite",
      },
      {
        id: "sentinel-cf",
        title: "Copernicus Sentinel-2",
        subtitle: "Browser · Campi Flegrei viewport",
        href: "https://browser.dataspace.copernicus.eu/?zoom=12&lat=40.83&lng=14.14&themeId=DEFAULT-THEME&datasetId=SENTINEL-2-L2A",
        group: "satellite",
      },
      {
        id: "s1-cf",
        title: "Sentinel-1 SAR",
        subtitle: "Ground deformation context (InSAR-capable scenes)",
        href: "https://browser.dataspace.copernicus.eu/?zoom=12&lat=40.83&lng=14.14&themeId=DEFAULT-THEME&datasetId=SENTINEL-1-GRD",
        group: "satellite",
      },
      {
        id: "swpc",
        title: "NOAA SWPC dashboard",
        subtitle: "Kp · solar wind · flares",
        href: "https://www.swpc.noaa.gov/",
        group: "spaceweather",
      },
      {
        id: "resonanceone",
        title: "ResonanceOne SR index",
        subtitle: "Live Tomsk-attributed Schumann activity index",
        href: "https://resonanceone.app/schumann-resonance-today",
        group: "resonance",
      },
    ];
  }

  // Tonga–Kermadec — from tonga-kermadec-node-monitor
  return [
    {
      id: "usgs-map",
      title: "USGS map · swarm region",
      subtitle: "7-day · all magnitudes · satellite basemap",
      href: "https://earthquake.usgs.gov/earthquakes/map/?extent=-27,-178&extent=-22,-172&range=week&magnitude=all&baseLayer=satellite",
      group: "authority",
    },
    {
      id: "geonet-val",
      title: "GeoNet VAL API",
      subtitle: "Kermadec Islands + NZ arc volcanic alert levels",
      href: "https://api.geonet.org.nz/volcano/val",
      group: "authority",
    },
    {
      id: "geonet",
      title: "GeoNet volcano status",
      subtitle: "GNS Science · NZ / Kermadec",
      href: "https://www.geonet.org.nz/volcano",
      group: "authority",
    },
    {
      id: "firms-tk",
      title: "NASA FIRMS thermal",
      subtitle: "Hunga / Tonga region hotspots",
      href: "https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@-175.2,-20.5,6z",
      group: "satellite",
    },
    {
      id: "s2-tk",
      title: "Copernicus Sentinel-2",
      subtitle: "Tonga–Kermadec viewport",
      href: "https://browser.dataspace.copernicus.eu/?zoom=7&lat=-24.5&lng=-175.2&themeId=DEFAULT-THEME&datasetId=SENTINEL-2-L2A",
      group: "satellite",
    },
    {
      id: "s1-tk",
      title: "Sentinel-1 SAR",
      subtitle: "SW Pacific arc",
      href: "https://browser.dataspace.copernicus.eu/?zoom=7&lat=-24.5&lng=-175.2&themeId=DEFAULT-THEME&datasetId=SENTINEL-1-GRD",
      group: "satellite",
    },
    {
      id: "metservice",
      title: "MetService",
      subtitle: "Regional weather / marine context",
      href: "https://www.metservice.com/",
      group: "authority",
    },
    {
      id: "swpc",
      title: "NOAA SWPC dashboard",
      subtitle: "Kp · solar wind · flares",
      href: "https://www.swpc.noaa.gov/",
      group: "spaceweather",
    },
    {
      id: "resonanceone",
      title: "ResonanceOne SR index",
      subtitle: "Live Tomsk-attributed Schumann activity index",
      href: "https://resonanceone.app/schumann-resonance-today",
      group: "resonance",
    },
  ];
}
