/** Canonical public URL for Open Graph / X cards. */
export const SITE_URL =
  (typeof process !== "undefined" &&
    (process.env.SITE_URL || process.env.VITE_SITE_URL)?.replace(/\/$/, "")) ||
  "https://campi-flegrei-monitor.vercel.app";

export const SITE_NAME = "Campi Flegrei Monitor";
export const SITE_TITLE = "Campi Flegrei Monitor · Sun-Earth-Sentinel";
export const SITE_DESCRIPTION =
  "INGV-powered Campi Flegrei seismic and volcano monitoring — depth visualization, swarm analysis, SUPT detective, SES focus node #2 after Tonga–Kermadec.";

/** Absolute OG image (1200×630). X requires absolute HTTPS URL. */
export const OG_IMAGE = `${SITE_URL}/og.png`;

export const TWITTER_HANDLE = "@Sunwolf77";
