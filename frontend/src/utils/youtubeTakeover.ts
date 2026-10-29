/**
 * The original YouTube URL for a video id, used by the takeover waiting page
 * as the non-destructive fallback when the on-demand download fails.
 */
export const youtubeWatchUrl = (sourceVideoId: string): string =>
  `https://www.youtube.com/watch?v=${encodeURIComponent(sourceVideoId)}`;

/**
 * How often the waiting page polls the takeover status endpoint.
 * Exported so tests can shrink it.
 */
export const YOUTUBE_TAKEOVER_POLL_INTERVAL_MS = 3000;
