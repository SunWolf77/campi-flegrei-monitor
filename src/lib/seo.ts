/** Canonical public URL for Open Graph / X cards. */
export const SITE_URL =
  (typeof process !== "undefined" &&
    (process.env.SITE_URL || process.env.VITE_SITE_URL)?.replace(/\/$/, "")) ||
  "https://campi-flegrei-monitor.vercel.app";

export const SITE_NAME = "Campi Flegrei Monitor";
export const SITE_TITLE = "Campi Flegrei Monitor · Sun-Earth-Sentinel";

/** Keep under ~200 chars for X card body. */
export const SITE_DESCRIPTION =
  "Live Campi Flegrei seismic & volcano monitor (INGV-OV) — depth, swarms, SUPT Continuum. Sun-Earth-Sentinel focus node #2. Not a forecast.";

/**
 * Absolute OG image. Bump CARD_VERSION whenever art or tags change so X
 * treats the image URL as new (card cache cannot be purged via API).
 */
export const CARD_VERSION = "20260801b";

export const OG_IMAGE = `${SITE_URL}/og-card-v2.png?v=${CARD_VERSION}`;

export const TWITTER_HANDLE = "@Sunwolf77";
