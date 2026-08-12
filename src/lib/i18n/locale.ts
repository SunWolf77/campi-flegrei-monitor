/**
 * Locale detection + sticky preference.
 * Default: it for navigator it-*, else en. ?lang=it|en overrides and sticks.
 */

import type { Locale } from "./messages";

const LANG_KEY = "ses-cf-lang";

export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "it" || q === "en") return q;
    const stored = window.localStorage.getItem(LANG_KEY);
    if (stored === "it" || stored === "en") return stored;
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("it")) return "it";
  } catch {
    /* */
  }
  return "en";
}

export function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    if (v === "it" || v === "en") return v;
  } catch {
    /* */
  }
  return null;
}

export function setLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANG_KEY, locale);
    document.documentElement.lang = locale;
    const u = new URL(window.location.href);
    u.searchParams.set("lang", locale);
    window.history.replaceState({}, "", u.pathname + u.search + u.hash);
  } catch {
    /* */
  }
}

export function applyDocumentLang(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}
