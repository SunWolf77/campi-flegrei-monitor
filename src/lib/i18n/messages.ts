/**
 * Bilingual chrome strings (EN + IT).
 * Italian-first civic desk — not a bolt-on translate layer.
 * Critical safety framing is observational only (not Civil Protection).
 */

export type Locale = "en" | "it";

export type MessageKey = keyof typeof EN;

const EN = {
  titleLive: "Campi Flegrei · live desk",
  dataLine: "Data: INGV-OV (GOSSIP → FDSN) · observation only",
  emergency:
    "In an emergency follow Civil Protection and local authorities. This desk does not issue official alerts.",
  honesty:
    "Public observation · not a forecast product · official network data (INGV-OV and others). In emergency follow Civil Protection / local authorities.",
  fullBoard: "Full board",
  tabMap: "Map",
  tabSupt: "SUPT",
  tabDepth: "Depth",
  tabTime: "Time",
  tabSwarm: "Swarms",
  tabFeeds: "Feeds",
  tabList: "List",
  tabLinks: "Links",
  rate1h: "1h",
  rate6h: "6h",
  rate24h: "24h",
  rate7d: "7d",
  events: "Events",
  largest: "Largest",
  meanDepth: "Mean depth",
  shallowPct: "Shallow <3 km",
  loading: "Loading catalog…",
  offline: "Cached data · live update unavailable",
  degraded: "Upstream degraded · showing last good catalog",
  officialLinks: "Official links",
  officialSite: "official site",
  thisDesk: "this SES desk",
  alertTitle: "Attention / status",
  alertSource: "Source",
  alertNote:
    "Operational context from INGV-OV · not a Civil Protection alert issued by this tool",
  langToggle: "IT",
  langToggleEn: "EN",
  refresh: "Refresh",
  backToSes: "SES hub",
  rateStrip: "Event counts (observation)",
  filters: "Filters",
  starting: "Starting Campi Flegrei desk…",
  ownership: "SES / WolfWatch board · data authority INGV-OV",
  // Pulse strip
  pulseEnergy: "Energy",
  pulsePhase: "Phase",
  pulseSr: "SR",
  pulseSwarm: "Swarm",
  pulse6h: "6h",
  pulseAria: "Live pulse strip",
  energyHigh: "High",
  energyElev: "Elev.",
  energyMod: "Mod.",
  energyBase: "Base",
  phaseHighLoad: "High load",
  phaseElevated: "Elevated",
  phaseWatching: "Watching",
  // Intensity levels
  intensityQuiet: "Quiet",
  intensityLow: "Low",
  intensityElevated: "Elevated",
  intensityHigh: "High",
  intensityIntense: "Intense",
  // Status notes (long form)
  statusNoteCf:
    "Long-term unrest with bradyseism, hydrothermal activity, and recurrent seismic swarms. Depths are typically very shallow (under 4 km).",
  statusNoteVe:
    "Somma–Vesuvius stratovolcano. Local seismicity is usually sparse; dense catalog is INGV–OV GOSSIP (vesuvio area).",
  statusNoteTk:
    "Tonga–Kermadec trench seismicity. Authority is USGS; not an Italian civil-protection product.",
  // Lite / Full (quiet mode)
  modeLite: "Lite",
  modeFull: "Full",
  modeLiteHint: "Map, list, links · lighter for daily check",
  modeFullHint: "Advanced analytics visible",
  quietOn: "Lite mode on",
  quietOff: "Full analytics",
  // Misc chrome
  observationLinks: "Observation links",
  advancedAnalytics: "Advanced analytics",
} as const;

const IT: Record<MessageKey, string> = {
  titleLive: "Campi Flegrei · scrivania live",
  dataLine: "Dati: INGV-OV (GOSSIP → FDSN) · solo osservazione",
  emergency:
    "In emergenza segui la Protezione Civile e le autorità locali. Questo strumento non emette allarmi ufficiali.",
  honesty:
    "Osservazione pubblica · non costituisce una previsione · dati da reti ufficiali (INGV-OV e altre). In emergenza segui Protezione Civile / autorità locali.",
  fullBoard: "Scrivania completa",
  tabMap: "Mappa",
  tabSupt: "SUPT",
  tabDepth: "Profondità",
  tabTime: "Tempo",
  tabSwarm: "Sciami",
  tabFeeds: "Feed",
  tabList: "Lista",
  tabLinks: "Link",
  rate1h: "1h",
  rate6h: "6h",
  rate24h: "24h",
  rate7d: "7d",
  events: "Eventi",
  largest: "Massima",
  meanDepth: "Prof. media",
  shallowPct: "Superficiali <3 km",
  loading: "Caricamento catalogo…",
  offline: "Dati in cache · aggiornamento non disponibile",
  degraded: "Sorgente degradata · ultimo catalogo valido",
  officialLinks: "Link ufficiali",
  officialSite: "sito ufficiale",
  thisDesk: "questa scrivania SES",
  alertTitle: "Attenzione / stato",
  alertSource: "Fonte",
  alertNote:
    "Contesto operativo INGV-OV · non è un allarme di Protezione Civile emesso da questo strumento",
  langToggle: "IT",
  langToggleEn: "EN",
  refresh: "Aggiorna",
  backToSes: "Hub SES",
  rateStrip: "Conteggi eventi (osservazione)",
  filters: "Filtri",
  starting: "Avvio scrivania Campi Flegrei…",
  ownership: "Scrivania SES / WolfWatch · autorità dati INGV-OV",
  pulseEnergy: "Energia",
  pulsePhase: "Fase",
  pulseSr: "SR",
  pulseSwarm: "Sciame",
  pulse6h: "6h",
  pulseAria: "Indicatore di stato live",
  energyHigh: "Alta",
  energyElev: "Elev.",
  energyMod: "Mod.",
  energyBase: "Base",
  phaseHighLoad: "Carico alto",
  phaseElevated: "Elevata",
  phaseWatching: "In osservazione",
  intensityQuiet: "Calmo",
  intensityLow: "Basso",
  intensityElevated: "Elevato",
  intensityHigh: "Alto",
  intensityIntense: "Intenso",
  statusNoteCf:
    "Inquietudine di lungo periodo con bradisismo, attività idrotermale e sciami sismici ricorrenti. Le profondità sono tipicamente molto superficiali (sotto i 4 km).",
  statusNoteVe:
    "Stratovulcano Somma–Vesuvio. La sismicità locale è di solito sparsa; il catalogo denso è GOSSIP INGV–OV (area vesuvio).",
  statusNoteTk:
    "Sismicità della fossa Tonga–Kermadec. Autorità dati USGS; non è un prodotto di protezione civile italiana.",
  modeLite: "Lite",
  modeFull: "Completo",
  modeLiteHint: "Mappa, lista, link · più leggero per il controllo quotidiano",
  modeFullHint: "Analisi avanzate visibili",
  quietOn: "Modalità Lite attiva",
  quietOff: "Analisi complete",
  observationLinks: "Link di osservazione",
  advancedAnalytics: "Analisi avanzate",
};

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  en: EN as Record<MessageKey, string>,
  it: IT,
};

export function t(locale: Locale, key: MessageKey): string {
  return MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key;
}

export function statusNoteForNode(
  locale: Locale,
  nodeId: string,
): string {
  if (nodeId === "vesuvius") return t(locale, "statusNoteVe");
  if (nodeId === "tonga-kermadec") return t(locale, "statusNoteTk");
  return t(locale, "statusNoteCf");
}

export function intensityLabel(
  locale: Locale,
  level: string,
): string {
  switch (level) {
    case "Quiet":
      return t(locale, "intensityQuiet");
    case "Low":
      return t(locale, "intensityLow");
    case "Elevated":
      return t(locale, "intensityElevated");
    case "High":
      return t(locale, "intensityHigh");
    case "Intense":
      return t(locale, "intensityIntense");
    default:
      return level;
  }
}
