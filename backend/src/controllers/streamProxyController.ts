import { Request, Response } from "express";
import { Readable } from "stream";
import { logger } from "../utils/logger";
import { YOUTUBE_VIDEO_ID_PATTERN } from "./redirectController";
import {
  clearStreamResolutionCache,
  resolveYouTubeStream,
} from "../services/downloaders/ytdlp/ytdlpStream";

/**
 * GET /from/youtube/stream/:id
 *
 * The media endpoint behind the takeover targets: resolves the YouTube video
 * through the same yt-dlp stack the regular downloads use and pipes the
 * bytes through this instance, so non-local videos play locally without a
 * manual download. Handles HTTP Range requests (seeking) by passing the
 * Range header through and relaying the upstream 206/200 response.
 *
 * Every failure path ends in a 302 back to youtube.com — the takeover stays
 * non-destructive even when no playable stream can be served.
 */

// Media URLs yt-dlp hands out expire; a mid-play 4xx/5xx triggers exactly
// one fresh resolution before falling back.
const RETRY_AFTER_UPSTREAM_FAILURE = true;

const youtubeWatchUrl = (sourceVideoId: string): string =>
  `https://www.youtube.com/watch?v=${encodeURIComponent(sourceVideoId)}`;

const fetchUpstreamStream = async (
  streamUrl: string,
  rangeHeader: string | undefined
): Promise<Awaited<ReturnType<typeof fetch>>> =>
  fetch(streamUrl, {
    // Forward the player's Range header so seeking works end to end.
    headers: rangeHeader ? { Range: rangeHeader } : {},
    redirect: "follow",
  });

export const streamYouTubeVideo = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sourceVideoId =
    typeof req.params.id === "string" ? req.params.id : "";

  if (!YOUTUBE_VIDEO_ID_PATTERN.test(sourceVideoId)) {
    res.redirect(youtubeWatchUrl(sourceVideoId));
    return;
  }

  let resolved = await resolveYouTubeStream(sourceVideoId);

  if (!resolved) {
    res.redirect(youtubeWatchUrl(sourceVideoId));
    return;
  }

  const rangeHeader =
    typeof req.headers.range === "string" ? req.headers.range : undefined;

  let upstream: Awaited<ReturnType<typeof fetch>> | undefined;
  try {
    upstream = await fetchUpstreamStream(resolved.url, rangeHeader);
    if (upstream.status >= 400 && RETRY_AFTER_UPSTREAM_FAILURE) {
      // The cached media URL has probably expired — resolve a fresh one.
      clearStreamResolutionCache(sourceVideoId);
      resolved = await resolveYouTubeStream(sourceVideoId);
      if (resolved) {
        upstream = await fetchUpstreamStream(resolved.url, rangeHeader);
      }
    }
  } catch (error) {
    logger.error(
      `Stream proxy: upstream fetch failed for YouTube id ${sourceVideoId}:`,
      error instanceof Error ? error : new Error(String(error))
    );
    clearStreamResolutionCache(sourceVideoId);
    res.redirect(youtubeWatchUrl(sourceVideoId));
    return;
  }

  if (!resolved || !upstream || upstream.status >= 400 || !upstream.body) {
    res.redirect(youtubeWatchUrl(sourceVideoId));
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(upstream.status);
  const headerValue = (name: string): string | null => {
    const value = upstream.headers.get(name);
    return value === null || value === undefined ? null : String(value);
  };
  const passthroughHeaders: Array<[string, string]> = [];
  const contentType = headerValue("content-type");
  passthroughHeaders.push(["Content-Type", contentType ?? resolved.contentType]);
  // Content-Length is deliberately not passed through: the body is piped
  // with chunked encoding, and a stale upstream length would corrupt the
  // stream. Node computes the framing itself.
  for (const name of ["Content-Range", "Accept-Ranges"]) {
    const value = headerValue(name);
    if (value !== null) {
      passthroughHeaders.push([name, value]);
    }
  }
  if (headerValue("accept-ranges") === null) {
    passthroughHeaders.push(["Accept-Ranges", "bytes"]);
  }
  for (const [name, value] of passthroughHeaders) {
    res.setHeader(name, value);
  }

  const body = Readable.fromWeb(upstream.body as never);
  body.on("error", () => res.end());
  body.pipe(res);
};
