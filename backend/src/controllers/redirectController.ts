import { Request, Response } from "express";
import { getVisibilityScopedRole } from "./video/visibility";
import * as storageService from "../services/storageService";
import { getWildcardParam, getStringParam } from "../utils/paramUtils";
import { logger } from "../utils/logger";

/**
 * Browser-redirector takeover targets.
 *
 * These endpoints let URL-redirector browser extensions (e.g. rxliuli's
 * Redirector) send youtube.com traffic at MyTube instead: the request resolves
 * the YouTube video/channel id against the local library and 302s the browser
 * to the matching local deep link when the content exists locally, or back to
 * the original YouTube URL when it does not. The takeover is therefore
 * non-destructive: nothing that MyTube cannot serve locally is lost.
 *
 * The paths are platform-scoped (/from/youtube/...) rather than mimicking
 * youtube.com's own paths so that additional platforms can add their own
 * /from/<platform>/... targets later without colliding with the SPA's routes
 * or with YouTube's URL grammar.
 */

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

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
 * caller, and back to youtube.com when it is not.
 */
export const redirectToVideo = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sourceVideoId = getStringParam(req.params.id) ?? "";
  const fallbackUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(sourceVideoId)}`;

  if (!YOUTUBE_VIDEO_ID_PATTERN.test(sourceVideoId)) {
    redirect(res, fallbackUrl);
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

  redirect(res, fallbackUrl);
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
  // Express already URL-decodes params, but be forgiving about %40/@ anyway.
  const withoutQuery = decoded.split(/[?#]/, 1)[0].replace(/\/+$/, "");
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
 * match exists and back to youtube.com when it does not.
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
    redirect(res, "https://www.youtube.com/");
    return;
  }

  const fallbackUrl = `https://www.youtube.com/${channelPath}`;
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
