import { logger } from "../utils/logger";
import downloadManager from "./downloadManager";
import * as downloadService from "./downloadService";
import * as storageService from "./storageService";
type VisibilityRole = import("../services/storageService").VideoCallerRole | undefined;

/**
 * On-demand local playback for the browser-redirector takeover targets.
 *
 * When a takeover target (or a search-result link) is hit for a video that is
 * not in the library, the video target queues a regular background download —
 * the same yt-dlp stack, quality settings, and DASH muxing as any manual
 * download — and sends the browser to a MyTube page that polls until the
 * local copy is ready, then plays it in the local player. If the download
 * fails, that page hands the user back to youtube.com, so the takeover stays
 * non-destructive.
 *
 * A pure stream proxy was considered first, but YouTube no longer serves
 * progressive (video+audio) formats for most videos — only split DASH tracks
 * and HLS — which a <video> element cannot play without HLS.js support. The
 * download pipeline already muxes those correctly, so downloading is the
 * robust path.
 */

// In-flight markers, so repeated clicks on the same video do not queue
// duplicate downloads. Cleared on failure so the next click can retry.
const inFlightSourceIds = new Set<string>();

const youtubeWatchUrl = (sourceVideoId: string): string =>
  `https://www.youtube.com/watch?v=${sourceVideoId}`;

export interface YouTubeLocalStatus {
  /** The video exists locally, is playable, and is visible to the caller. */
  local: boolean;
  /** The local library id, when local is true. */
  videoId?: string;
  /** A download for this video is queued or running right now. */
  queued: boolean;
}

/**
 * Visibility-aware status of a YouTube video id in the local library.
 */
export function getYouTubeLocalStatus(
  sourceVideoId: string,
  role: VisibilityRole
): YouTubeLocalStatus {
  const downloadCheck = storageService.checkVideoDownloadBySourceId(
    sourceVideoId,
    "youtube",
    "video"
  );
  const locallyAvailable =
    downloadCheck.found &&
    downloadCheck.status === "exists" &&
    !!downloadCheck.videoId &&
    !!storageService.getVideoById(downloadCheck.videoId, role);

  return {
    local: locallyAvailable,
    videoId: locallyAvailable ? downloadCheck.videoId : undefined,
    queued: inFlightSourceIds.has(sourceVideoId),
  };
}

/**
 * Queue a background download for a YouTube video id, deduped per id while a
 * download is already running. Fire-and-forget: callers must not block the
 * takeover redirect on the download.
 */
export function queueOnDemandDownload(sourceVideoId: string): void {
  const downloadCheck = storageService.checkVideoDownloadBySourceId(
    sourceVideoId,
    "youtube",
    "video"
  );
  if (
    downloadCheck.found &&
    downloadCheck.status === "exists" &&
    downloadCheck.videoId
  ) {
    // Already local; nothing to queue.
    return;
  }

  if (inFlightSourceIds.has(sourceVideoId)) {
    return;
  }
  inFlightSourceIds.add(sourceVideoId);

  const downloadId = `ondemand-${sourceVideoId}-${Date.now()}`;
  logger.info(
    `On-demand YouTube: queueing download for id ${sourceVideoId} (${downloadId})`
  );

  // Route through the download manager (the same path a manual download
  // takes) so the yt-dlp child's cancellation checks see the task as active.
  try {
    const downloadTask = downloadService.createDownloadTask(
      "youtube",
      youtubeWatchUrl(sourceVideoId),
      downloadId
    );
    downloadManager
      .addDownload(
        downloadTask,
        downloadId,
        `On-demand YouTube ${sourceVideoId}`,
        youtubeWatchUrl(sourceVideoId),
        "youtube"
      )
      .then(() => {
        logger.info(
          `On-demand YouTube: download for id ${sourceVideoId} completed`
        );
      })
      .catch((error: unknown) => {
        logger.error(
          `On-demand YouTube: download for id ${sourceVideoId} failed:`,
          error instanceof Error ? error : new Error(String(error))
        );
      })
      .finally(() => {
        inFlightSourceIds.delete(sourceVideoId);
      });
  } catch (error) {
    inFlightSourceIds.delete(sourceVideoId);
    logger.error(
      `On-demand YouTube: could not queue download for id ${sourceVideoId}:`,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
