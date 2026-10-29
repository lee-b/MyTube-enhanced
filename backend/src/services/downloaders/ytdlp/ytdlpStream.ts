import { logger } from "../../../utils/logger";
import {
  executeYtDlpJson,
  getNetworkConfigFromUserConfig,
  getUserYtDlpConfig,
} from "../../../utils/ytDlpUtils";
import { getProviderScript } from "./ytdlpHelpers";

/**
 * On-demand streaming for YouTube videos through the local instance.
 *
 * The takeover targets (/from/youtube/...) used to bounce non-local videos
 * straight back to youtube.com, which forced a manual download before local
 * playback was possible. Instead, the stream proxy resolves a playable media
 * URL through the same yt-dlp stack the regular downloads use (cookies,
 * bgutil PO-token provider, user network config — identical auth and
 * throttling characteristics) and pipes the bytes through MyTube, so a
 * search-result click plays locally without any manual download.
 *
 * Browsers cannot play YouTube's split DASH audio/video tracks, so the
 * resolver only accepts progressive formats (video and audio in one file).
 * If nothing playable is available, the caller falls back to youtube.com.
 */

const RESOLUTION_CACHE_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 60 * 1000;

interface ResolvedStream {
  url: string;
  contentType: string;
}

type CacheEntry =
  | { kind: "resolved"; expiresAt: number; stream: ResolvedStream }
  | { kind: "negative"; expiresAt: number };

const resolutionCache = new Map<string, CacheEntry>();

const contentTypeForExt = (ext: string): string =>
  ext.toLowerCase() === "mp4" ? "video/mp4" : "video/webm";

interface YtDlpFormat {
  url?: string;
  ext?: string;
  protocol?: string;
  vcodec?: string;
  acodec?: string;
  tbr?: number;
  filesize?: number;
}

/**
 * Pick the most browser-friendly progressive format: an MP4 (H.264/AAC) is
 * playable everywhere, so those win first and higher bitrate breaks ties;
 * WebM progressive formats are the fallback. Split (DASH) formats are
 * excluded — a <video> element cannot play them without muxing.
 */
export const selectPlayableFormat = (formats: YtDlpFormat[]): YtDlpFormat | null => {
  const progressive = (formats || []).filter(
    (format) =>
      !!format.url &&
      format.vcodec !== "none" &&
      format.acodec !== "none" &&
      (!format.protocol || /^https?$/.test(format.protocol))
  );

  const scored = progressive.map((format) => ({
    format,
    // MP4 is universally playable in <video> elements; prefer it, then bitrate.
    score:
      (format.ext?.toLowerCase() === "mp4" ? 1e12 : 0) +
      (format.tbr || format.filesize || 0),
  }));

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.format ?? null;
};

export const clearStreamResolutionCache = (sourceVideoId?: string): void => {
  if (sourceVideoId) {
    resolutionCache.delete(sourceVideoId);
  } else {
    resolutionCache.clear();
  }
};

/**
 * Resolve a YouTube video id to a playable stream URL. Cached for a few
 * minutes (media URLs are expensive to resolve — a full metadata round-trip
 * that may solve PO tokens — but do expire), with a short negative cache so a
 * failing video id is not re-resolved on every click.
 */
export async function resolveYouTubeStream(
  sourceVideoId: string
): Promise<ResolvedStream | null> {
  const now = Date.now();
  const cached = resolutionCache.get(sourceVideoId);
  if (cached && cached.expiresAt > now) {
    if (cached.kind === "negative") {
      return null;
    }
    return cached.stream;
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${sourceVideoId}`;
    const userConfig = getUserYtDlpConfig(videoUrl);
    const networkConfig = getNetworkConfigFromUserConfig(userConfig);
    const PROVIDER_SCRIPT = getProviderScript();

    const info = await executeYtDlpJson(
      videoUrl,
      {
        ...networkConfig,
        noWarnings: true,
        skipDownload: true,
        ...(PROVIDER_SCRIPT
          ? {
              extractorArgs: `youtubepot-bgutilscript:script_path=${PROVIDER_SCRIPT}`,
            }
          : {}),
      },
      true
    );

    const format = selectPlayableFormat(info?.formats || []);
    if (!format?.url) {
      logger.info(
        `Stream proxy: no playable progressive format for YouTube id ${sourceVideoId}`
      );
      resolutionCache.set(sourceVideoId, {
        kind: "negative",
        expiresAt: now + NEGATIVE_CACHE_TTL_MS,
      });
      return null;
    }

    const stream: ResolvedStream = {
      url: format.url,
      contentType: contentTypeForExt(format.ext || "mp4"),
    };
    resolutionCache.set(sourceVideoId, {
      kind: "resolved",
      expiresAt: now + RESOLUTION_CACHE_TTL_MS,
      stream,
    });
    return stream;
  } catch (error) {
    logger.error(
      `Stream proxy: failed to resolve YouTube id ${sourceVideoId}:`,
      error instanceof Error ? error : new Error(String(error))
    );
    resolutionCache.set(sourceVideoId, {
      kind: "negative",
      expiresAt: now + NEGATIVE_CACHE_TTL_MS,
    });
    return null;
  }
}
