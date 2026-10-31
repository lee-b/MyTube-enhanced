import { Request, Response } from "express";
import { getVisibilityScopedRole } from "./video/visibility";
import * as storageService from "../services/storageService";
import * as onDemandYouTube from "../services/onDemandYouTube";
import { getWildcardParam, getStringParam } from "../utils/paramUtils";
import { logger } from "../utils/logger";

/**
 * Browser-redirector takeover targets.
 *
 * These endpoints let URL-redirector browser extensions (e.g. rxliuli's
 * Redirector) send youtube.com traffic at MyTube instead: the request resolves
 * the YouTube video/channel id against the local library and 302s the browser
 * to the matching local deep link when the content exists locally. When the
 * video is not local, the takeover queues an on-demand download and waits for
 * the local copy; when the channel is not local, it serves a local channel
 * page that lists the channel's recent uploads (downloadable on demand).
 * Nothing is ever lost: the waiting page and channel page both keep a path
 * back to the original YouTube URL when MyTube cannot deliver.
 *
 * The paths are platform-scoped (/from/youtube/...) rather than mimicking
 * youtube.com's own paths so that additional platforms can add their own
 * /from/<platform>/... targets later without colliding with the SPA's routes
 * or with YouTube's URL grammar.
 */

export const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// A channel path is the part after youtube.com/, restricted to the shapes
// YouTube itself uses: /channel/UC..., legacy /c/<name>, and /@<handle>.
// Anything else is not a channel and falls back to YouTube's home page.
const YOUTUBE_CHANNEL_PATH_PATTERN =
  /^(channel\/[A-Za-z0-9_-]+|c\/[^/?#]+|@[A-Za-z0-9._-]+)$/;
const CHANNEL_PATH_MAX_LENGTH = 200;

const redirect = (res: Response, location: string): void => {
  // Redirector hops are one-off navigations, so no cache should serve them.
  res.setHeader("Cache-Control", "no-store");
  res.redirect(location);
};

/**
 * GET /from/youtube/video/:sourceVideoId
 *
 * Resolve a YouTube video id against the local library. 302s to the local
 * player page (/video/<id>) when the video exists and is visible to the
 * caller. Otherwise it queues an on-demand download and 302s to the SPA page
 * (/watch/youtube/<id>) that waits for the local copy — the download, not
 * the user, does the fetching, so playback happens locally without a manual
 * download. If that download fails, the waiting page sends the browser back
 * to youtube.com, keeping the takeover non-destructive.
 */
export const redirectToVideo = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sourceVideoId = getStringParam(req.params.id) ?? "";

  if (!YOUTUBE_VIDEO_ID_PATTERN.test(sourceVideoId)) {
    // Not a video id at all: straight back to YouTube.
    redirect(
      res,
      `https://www.youtube.com/watch?v=${encodeURIComponent(sourceVideoId)}`
    );
    return;
  }

  const downloadCheck = storageService.checkVideoDownloadBySourceId(
    sourceVideoId,
    "youtube",
    "video"
  );

  // A "deleted" tracking row means the video was downloaded once but is gone;
  // only an existing, locally playable video may take over the navigation.
  const locallyAvailable =
    downloadCheck.found &&
    downloadCheck.status === "exists" &&
    !!downloadCheck.videoId &&
    !!storageService.getVideoById(
      downloadCheck.videoId,
      getVisibilityScopedRole(req)
    );

  if (locallyAvailable && downloadCheck.videoId) {
    logger.info(
      `Redirector takeover: serving local video ${downloadCheck.videoId} for YouTube id ${sourceVideoId}`
    );
    redirect(res, `/video/${downloadCheck.videoId}`);
    return;
  }

  // Not in the library: queue an on-demand download (deduped while running)
  // and send the browser to the MyTube page that waits for the local copy —
  // no manual download required. The waiting page falls back to youtube.com
  // if the download fails, so the takeover stays non-destructive.
  onDemandYouTube.queueOnDemandDownload(sourceVideoId);
  redirect(res, `/watch/youtube/${encodeURIComponent(sourceVideoId)}`);
};

/**
 * GET /from/youtube/status/:sourceVideoId
 *
 * Poll target for the waiting page: reports whether the video is playable
 * locally now (with its library id) and whether an on-demand download is
 * currently queued for it.
 */
export const getYouTubeTakeoverStatus = (
  req: Request,
  res: Response
): void => {
  const sourceVideoId = getStringParam(req.params.id) ?? "";
  if (!YOUTUBE_VIDEO_ID_PATTERN.test(sourceVideoId)) {
    res.status(400).json({ error: "Invalid YouTube video id" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(
    onDemandYouTube.getYouTubeLocalStatus(
      sourceVideoId,
      getVisibilityScopedRole(req)
    )
  );
};

/**
 * Normalizes a wildcard channel path ("channel/UC...", "c/name", "@handle")
 * to the canonical youtube.com-relative form. Returns null when the path does
 * not look like a YouTube channel at all.
 */
export const normalizeYouTubeChannelPath = (
  rawPath: string
): string | null => {
  const decoded = rawPath.startsWith("%40")
    ? `@${rawPath.slice(3)}`
    : rawPath;
  // Search results carry bare channel ids ("UC..."); tolerate the missing
  // channel/ prefix so a channel click can never fall through to youtube.com
  // for want of the path form the rest of the redirector uses.
  const withPrefix = /^UC[A-Za-z0-9_-]{10,}$/.test(decoded)
    ? `channel/${decoded}`
    : decoded;
  // Express already URL-decodes params, but be forgiving about %40/@ anyway.
  const withoutQuery = withPrefix.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  if (
    !withoutQuery ||
    withoutQuery.length > CHANNEL_PATH_MAX_LENGTH ||
    !YOUTUBE_CHANNEL_PATH_PATTERN.test(withoutQuery)
  ) {
    return null;
  }
  return withoutQuery;
};

/**
 * GET /from/youtube/channel/<path>
 *
 * Resolve a YouTube channel path against the local library's channel URLs and
 * author names, 302ing to the local author page (/author/<author>) when a
 * match exists. When no local match exists, the browser is still kept on
 * MyTube: it goes to the local channel page (/channel/youtube/<path>), which
 * lists the channel's recent uploads via yt-dlp with download actions, so
 * channels are browsable and downloadable without leaving the instance.
 *
 * Channel URLs are only persisted on videos, so a channel can only be resolved
 * locally when at least one of its videos (visible to the caller) exists in
 * the library. @<handle> paths are matched against author display names, which
 * usually equal the handle for YouTube channels.
 */
export const redirectToChannel = async (
  req: Request,
  res: Response
): Promise<void> => {
  const rawPath =
    getWildcardParam(req.params) ?? getStringParam(req.query.url) ?? "";
  const channelPath = normalizeYouTubeChannelPath(rawPath);

  if (!channelPath) {
    // Not a channel path at all: straight back to YouTube.
    redirect(res, "https://www.youtube.com/");
    return;
  }

  const fallbackUrl = `/channel/youtube/${encodeURIComponent(channelPath)}`;
  const role = getVisibilityScopedRole(req);
  const videos = storageService.getVideoSummaries(role);

  const authorForChannelPath = videos.find((video) => {
    const channelUrl = (video.channelUrl as string | undefined)?.replace(
      /\/+$/,
      ""
    );
    if (channelPath.startsWith("@")) {
      // Handles are not stored on videos; the author display name is the
      // closest stable identity the library keeps.
      const handle = channelPath.slice(1);
      const author = video.author;
      return (
        !!author &&
        author.toLowerCase() === handle.toLowerCase()
      );
    }
    return (
      !!channelUrl && channelUrl.endsWith(`/${channelPath}`)
    );
  })?.author;

  if (authorForChannelPath) {
    logger.info(
      `Redirector takeover: serving local author page for YouTube channel ${channelPath}`
    );
    redirect(
      res,
      `/author/${encodeURIComponent(authorForChannelPath)}`
    );
    return;
  }

  redirect(res, fallbackUrl);
};
