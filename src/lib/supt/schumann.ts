/**
 * Tomsk Schumann resonance feeds
 * ------------------------------
 * Primary numeric: ResonanceOne Activity Index (Tomsk-attributed)
 *   https://resonanceone.app/api/now
 * Chart imagery: SOSRFF TSU /new/ directory (sch.png is 404 in 2026)
 *   https://sosrff.tsu.ru/new/sra.jpg  (Schumann amplitude)
 *   https://sosrff.tsu.ru/new/fc_fsr1.jpg … fc_fsr4.jpg
 *
 * Used by Continuum / SUPT-Dashboard (was OCR on sch.png).
 */

export const SCHUMANN_API_URL = "https://resonanceone.app/api/now";
export const TOMSK_BASE = "https://sosrff.tsu.ru/new";

/** Live chart assets still served from Tomsk SOSRFF (2026). */
export const TOMSK_CHARTS = {
  amplitude: `${TOMSK_BASE}/sra.jpg`,
  spectrogram1: `${TOMSK_BASE}/fc_fsr1.jpg`,
  spectrogram2: `${TOMSK_BASE}/fc_fsr2.jpg`,
  quality: `${TOMSK_BASE}/srq.jpg`,
  frequency: `${TOMSK_BASE}/srf.jpg`,
  magnetic: `${TOMSK_BASE}/mag.jpg`,
  home: "https://sosrff.tsu.ru/",
} as const;

export type SchumannSnapshot = {
  activityIndex: number;
  activityLabel: string;
  schumannIndex: number;
  frequencyHz: number;
  kpIndex: number;
  kpLabel: string;
  solarFlareClass: string;
  geomagneticStatus: string;
  summary: string;
  dataSource: string;
  updatedAt: string | null;
  /** SUPT-Dashboard-style factor: clip(index/50, 0.5, 2) */
  schumannFactor: number;
  charts: typeof TOMSK_CHARTS;
  sourceUrl: string;
  error?: string;
};

export function emptySchumann(error?: string): SchumannSnapshot {
  return {
    activityIndex: 0,
    activityLabel: "unknown",
    schumannIndex: 0,
    frequencyHz: 7.83,
    kpIndex: 0,
    kpLabel: "unknown",
    solarFlareClass: "—",
    geomagneticStatus: "unknown",
    summary: error ?? "Schumann feed unavailable",
    dataSource: "none",
    updatedAt: null,
    schumannFactor: 1,
    charts: TOMSK_CHARTS,
    sourceUrl: SCHUMANN_API_URL,
    error,
  };
}

export function parseSchumannJson(data: unknown): SchumannSnapshot {
  if (!data || typeof data !== "object") {
    return emptySchumann("Invalid Schumann payload");
  }
  const d = data as Record<string, unknown>;
  const schumannIndex = Number(d.schumann_index ?? 0);
  const activityIndex = Number(d.activity_index ?? 0);
  // Continuum / SUPT-Dashboard used power~20 as baseline; index 0–100 → factor
  const schumannFactor = Math.max(
    0.5,
    Math.min(2, (Number.isFinite(schumannIndex) ? schumannIndex : 20) / 50),
  );

  return {
    activityIndex: Number.isFinite(activityIndex) ? activityIndex : 0,
    activityLabel: String(d.activity_index_label ?? "—"),
    schumannIndex: Number.isFinite(schumannIndex) ? schumannIndex : 0,
    frequencyHz: Number(d.schumann_frequency_hz ?? 7.83) || 7.83,
    kpIndex: Number(d.kp_index ?? 0) || 0,
    kpLabel: String(d.kp_label ?? "—"),
    solarFlareClass: String(d.solar_flare_class ?? "—"),
    geomagneticStatus: String(d.geomagnetic_status ?? "—"),
    summary: String(d.summary ?? ""),
    dataSource: String(d.data_source ?? "tomsk"),
    updatedAt: d.updated_at != null ? String(d.updated_at) : null,
    schumannFactor,
    charts: TOMSK_CHARTS,
    sourceUrl: SCHUMANN_API_URL,
  };
}

export function schumannTone(
  index: number,
): "muted" | "accent" | "warn" | "critical" {
  if (index >= 80) return "critical";
  if (index >= 60) return "warn";
  if (index >= 40) return "accent";
  return "muted";
}
