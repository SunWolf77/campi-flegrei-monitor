/**
 * SolfataraNews (YouTube) — third-party field media for Campi Flegrei.
 *
 * License path (Option A + B):
 * - Outbound links to the channel / watch pages (always fine).
 * - Official YouTube embed player only (ToS “feature of the Service”).
 * - Never rehost MP4s; never strip YouTube branding.
 * - Creator still owns copyright; embed may be disabled per-video.
 *
 * Channel id from public channel page; uploads playlist = UC → UU prefix swap.
 */

export const SOLFATARA_NEWS = {
  handle: "@SolfataraNews",
  title: "SolfataraNews",
  channelUrl: "https://www.youtube.com/@SolfataraNews",
  /** UCC1XzjkXRz0DLJfH-69t1vQ */
  channelId: "UCC1XzjkXRz0DLJfH-69t1vQ",
  /** Uploads playlist for “latest” embed */
  uploadsPlaylistId: "UUC1XzjkXRz0DLJfH-69t1vQ",
  /** privacy-enhanced embed host */
  embedHost: "https://www.youtube-nocookie.com",
  disclaimer:
    "Third-party field reporting (drone / local updates). Not INGV authority and not SES seismic data.",
  attribution: "Source: SolfataraNews on YouTube",
} as const;

/** Official playlist embed of channel uploads (latest-first). */
export function solfataraNewsEmbedSrc(): string {
  const { embedHost, uploadsPlaylistId } = SOLFATARA_NEWS;
  const q = new URLSearchParams({
    list: uploadsPlaylistId,
    // modestbranding kept minimal; rel=0 limits related to same channel when possible
    rel: "0",
  });
  return `${embedHost}/embed/videoseries?${q.toString()}`;
}
