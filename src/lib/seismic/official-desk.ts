/**
 * One-stop official link desk — static, offline-cacheable.
 * Labels bilingual; hrefs are official sites.
 */

import type { FocusNodeId } from "./types";
import type { Locale } from "@/lib/i18n/messages";

export type DeskLink = {
  id: string;
  href: string;
  /** true = external official institution */
  official: boolean;
  label: { en: string; it: string };
  blurb: { en: string; it: string };
  group: "authority" | "emergency" | "context" | "ses";
};

export function officialDeskLinks(nodeId: FocusNodeId): DeskLink[] {
  const isIt = nodeId === "campi-flegrei" || nodeId === "vesuvius";
  if (!isIt) {
    return [
      {
        id: "ses",
        href: "https://sun-earth-sentinel.vercel.app/?tab=live&node=tonga",
        official: false,
        label: { en: "SES hub", it: "Hub SES" },
        blurb: { en: "Global multi-desk network", it: "Rete multi-scrivania" },
        group: "ses",
      },
    ];
  }

  const gossip =
    nodeId === "vesuvius"
      ? "https://terremoti.ov.ingv.it/gossip/vesuvio/"
      : "https://terremoti.ov.ingv.it/gossip/flegrei/";
  const dragon = nodeId === "vesuvius" ? "vesuvius" : "mediterranean";

  return [
    {
      id: "ov",
      href: "https://www.ov.ingv.it/",
      official: true,
      label: {
        en: "INGV Osservatorio Vesuviano",
        it: "INGV Osservatorio Vesuviano",
      },
      blurb: {
        en: "Home authority · volcano monitoring",
        it: "Autorità di riferimento · monitoraggio vulcanico",
      },
      group: "authority",
    },
    {
      id: "bollettini",
      href: "https://www.ov.ingv.it/index.php/monitoraggio-e-infrastrutture/bollettini",
      official: true,
      label: {
        en: "Bulletins / notices",
        it: "Bollettini / comunicati",
      },
      blurb: {
        en: "Latest official OV communications",
        it: "Ultimi comunicati ufficiali OV",
      },
      group: "authority",
    },
    {
      id: "gossip",
      href: gossip,
      official: true,
      label: {
        en: "GOSSIP / recent quakes",
        it: "GOSSIP / terremoti recenti",
      },
      blurb: {
        en: "Catalog UI · Localizzazioni Sismiche",
        it: "Catalogo · Localizzazioni Sismiche",
      },
      group: "authority",
    },
    {
      id: "pc-naz",
      href: "https://www.protezionecivile.gov.it/",
      official: true,
      label: {
        en: "Protezione Civile (national)",
        it: "Protezione Civile (nazionale)",
      },
      blurb: {
        en: "National emergency authority",
        it: "Autorità nazionale di emergenza",
      },
      group: "emergency",
    },
    {
      id: "pc-campania",
      href: "https://www.regione.campania.it/regione/it/tematiche/protezione-civile",
      official: true,
      label: {
        en: "PC Campania",
        it: "PC Campania",
      },
      blurb: {
        en: "Regional civil protection",
        it: "Protezione civile regionale",
      },
      group: "emergency",
    },
    {
      id: "ingv-cnt",
      href: "https://terremoti.ingv.it/",
      official: true,
      label: {
        en: "INGV national list",
        it: "Elenco nazionale INGV",
      },
      blurb: {
        en: "CNT / FDSN bulletin",
        it: "Bollettino CNT / FDSN",
      },
      group: "authority",
    },
    {
      id: "ses",
      href: `https://sun-earth-sentinel.vercel.app/?tab=live&node=${dragon}`,
      official: false,
      label: {
        en: "SES world hub",
        it: "Hub mondiale SES",
      },
      blurb: {
        en: "Back to global multi-desk map",
        it: "Torna alla mappa multi-scrivania",
      },
      group: "ses",
    },
  ];
}

export function deskLabel(link: DeskLink, locale: Locale): string {
  return link.label[locale] ?? link.label.en;
}

export function deskBlurb(link: DeskLink, locale: Locale): string {
  return link.blurb[locale] ?? link.blurb.en;
}
