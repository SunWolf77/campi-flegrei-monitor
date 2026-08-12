/**
 * Phase A bilingual chrome strings (EN + IT).
 * Italian-first civic desk — not a bolt-on translate layer.
 */

export type Locale = "en" | "it";

export type MessageKey = keyof typeof EN;

const EN = {
  titleLive: "Campi Flegrei · live desk",
  titleLiveIt: "Campi Flegrei · scrivania live",
  dataLine: "Data: INGV-OV (GOSSIP → FDSN) · observation only",
  dataLineIt: "Dati: INGV-OV (GOSSIP → FDSN) · solo osservazione",
  emergency:
    "In an emergency follow Civil Protection and local authorities. This desk does not issue alerts.",
  emergencyIt:
    "In emergenza segui la Protezione Civile e le autorità locali. Questa scrivania non emette allarmi ufficiali.",
  honesty:
    "Public observation · not a forecast product · official network data (INGV-OV and others). In emergency follow Civil Protection / local authorities.",
  honestyIt:
    "Osservazione pubblica · non è un prodotto di previsione · dati da reti ufficiali (INGV-OV e altre). In emergenza segui Protezione Civile / autorità locali.",
  fullBoard: "Full board",
  fullBoardIt: "Scrivania completa",
  tabMap: "Map",
  tabMapIt: "Mappa",
  tabSupt: "SUPT",
  tabSuptIt: "SUPT",
  tabDepth: "Depth",
  tabDepthIt: "Profondità",
  tabTime: "Time",
  tabTimeIt: "Tempo",
  tabSwarm: "Swarms",
  tabSwarmIt: "Sciami",
  tabFeeds: "Feeds",
  tabFeedsIt: "Feed",
  tabList: "List",
  tabListIt: "Lista",
  tabLinks: "Links",
  tabLinksIt: "Link",
  rate1h: "1h",
  rate6h: "6h",
  rate24h: "24h",
  rate7d: "7d",
  events: "Events",
  largest: "Largest",
  meanDepth: "Mean depth",
  shallowPct: "Shallow <3 km",
  loading: "Loading catalog…",
  loadingIt: "Caricamento catalogo…",
  offline: "Cached data · live update unavailable",
  offlineIt: "Dati in cache · aggiornamento non disponibile",
  degraded: "Upstream degraded · showing last good catalog",
  degradedIt: "Sorgente degradata · ultimo catalogo valido",
  officialLinks: "Official links",
  officialLinksIt: "Link ufficiali",
  officialSite: "official site",
  officialSiteIt: "sito ufficiale",
  thisDesk: "this SES desk",
  thisDeskIt: "questa scrivania SES",
  alertTitle: "Attention / status",
  alertTitleIt: "Attenzione / stato",
  alertSource: "Source",
  alertSourceIt: "Fonte",
  alertNote:
    "Operational context from INGV-OV · not a Civil Protection alert issued by this desk",
  alertNoteIt:
    "Contesto operativo INGV-OV · non è un allarme di Protezione Civile emesso da questa scrivania",
  langToggle: "IT",
  langToggleEn: "EN",
  refresh: "Refresh",
  refreshIt: "Aggiorna",
  backToSes: "SES hub",
  backToSesIt: "Hub SES",
  rateStrip: "Event counts (observation)",
  rateStripIt: "Conteggi eventi (osservazione)",
  filters: "Filters",
  filtersIt: "Filtri",
  starting: "Starting Campi Flegrei desk…",
  startingIt: "Avvio scrivania Campi Flegrei…",
  ownership: "SES / WolfWatch board · data authority INGV-OV",
  ownershipIt: "Scrivania SES / WolfWatch · autorità dati INGV-OV",
} as const;

const IT: Record<MessageKey, string> = {
  titleLive: "Campi Flegrei · scrivania live",
  titleLiveIt: "Campi Flegrei · scrivania live",
  dataLine: "Dati: INGV-OV (GOSSIP → FDSN) · solo osservazione",
  dataLineIt: "Dati: INGV-OV (GOSSIP → FDSN) · solo osservazione",
  emergency:
    "In emergenza segui la Protezione Civile e le autorità locali. Questa scrivania non emette allarmi ufficiali.",
  emergencyIt:
    "In emergenza segui la Protezione Civile e le autorità locali. Questa scrivania non emette allarmi ufficiali.",
  honesty:
    "Osservazione pubblica · non è un prodotto di previsione · dati da reti ufficiali (INGV-OV e altre). In emergenza segui Protezione Civile / autorità locali.",
  honestyIt:
    "Osservazione pubblica · non è un prodotto di previsione · dati da reti ufficiali (INGV-OV e altre). In emergenza segui Protezione Civile / autorità locali.",
  fullBoard: "Scrivania completa",
  fullBoardIt: "Scrivania completa",
  tabMap: "Mappa",
  tabMapIt: "Mappa",
  tabSupt: "SUPT",
  tabSuptIt: "SUPT",
  tabDepth: "Profondità",
  tabDepthIt: "Profondità",
  tabTime: "Tempo",
  tabTimeIt: "Tempo",
  tabSwarm: "Sciami",
  tabSwarmIt: "Sciami",
  tabFeeds: "Feed",
  tabFeedsIt: "Feed",
  tabList: "Lista",
  tabListIt: "Lista",
  tabLinks: "Link",
  tabLinksIt: "Link",
  rate1h: "1h",
  rate6h: "6h",
  rate24h: "24h",
  rate7d: "7d",
  events: "Eventi",
  largest: "Massima",
  meanDepth: "Prof. media",
  shallowPct: "Superficiali <3 km",
  loading: "Caricamento catalogo…",
  loadingIt: "Caricamento catalogo…",
  offline: "Dati in cache · aggiornamento non disponibile",
  offlineIt: "Dati in cache · aggiornamento non disponibile",
  degraded: "Sorgente degradata · ultimo catalogo valido",
  degradedIt: "Sorgente degradata · ultimo catalogo valido",
  officialLinks: "Link ufficiali",
  officialLinksIt: "Link ufficiali",
  officialSite: "sito ufficiale",
  officialSiteIt: "sito ufficiale",
  thisDesk: "questa scrivania SES",
  thisDeskIt: "questa scrivania SES",
  alertTitle: "Attenzione / stato",
  alertTitleIt: "Attenzione / stato",
  alertSource: "Fonte",
  alertSourceIt: "Fonte",
  alertNote:
    "Contesto operativo INGV-OV · non è un allarme di Protezione Civile emesso da questa scrivania",
  alertNoteIt:
    "Contesto operativo INGV-OV · non è un allarme di Protezione Civile emesso da questa scrivania",
  langToggle: "IT",
  langToggleEn: "EN",
  refresh: "Aggiorna",
  refreshIt: "Aggiorna",
  backToSes: "Hub SES",
  backToSesIt: "Hub SES",
  rateStrip: "Conteggi eventi (osservazione)",
  rateStripIt: "Conteggi eventi (osservazione)",
  filters: "Filtri",
  filtersIt: "Filtri",
  starting: "Avvio scrivania Campi Flegrei…",
  startingIt: "Avvio scrivania Campi Flegrei…",
  ownership: "Scrivania SES / WolfWatch · autorità dati INGV-OV",
  ownershipIt: "Scrivania SES / WolfWatch · autorità dati INGV-OV",
};

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  en: EN as Record<MessageKey, string>,
  it: IT,
};

export function t(locale: Locale, key: MessageKey): string {
  return MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key;
}
