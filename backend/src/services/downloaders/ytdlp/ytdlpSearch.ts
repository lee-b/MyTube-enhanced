import { logger } from "../../../utils/logger";
import {
  executeYtDlpJson,
  getNetworkConfigFromUserConfig,
  getUserYtDlpConfig,
} from "../../../utils/ytDlpUtils";
import { getProviderScript } from "./ytdlpHelpers";

/**
 * Search for videos (primarily for YouTube, but could be adapted)
 */
export async function searchVideos(
  query: string,
  limit: number = 8,
  offset: number = 1
): Promise<any[]> {
  logger.info(
    `Processing search request for query: "${query}", limit: ${limit}, offset: ${offset}`
  );

  // Get user config for network options
  const userConfig = getUserYtDlpConfig();
  const networkConfig = getNetworkConfigFromUserConfig(userConfig);
  const PROVIDER_SCRIPT = getProviderScript();

  // Calculate the total number of items to fetch from search
  // We need to request enough items to cover the offset + limit
  const searchLimit = offset + limit - 1;

  // Use ytsearch for searching
  const searchResults = await executeYtDlpJson(
    `ytsearch${searchLimit}:${query}`,
    {
      ...networkConfig,
      noWarnings: true,
      skipDownload: true,
      flatPlaylist: true, // Use flat playlist for faster search results
      playlistStart: offset,
      playlistEnd: searchLimit,
      ...(PROVIDER_SCRIPT
        ? {
            extractorArgs: `youtubepot-bgutilscript:script_path=${PROVIDER_SCRIPT}`,
          }
        : {}),
    }
  );

  if (!searchResults || !searchResults.entries) {
    return [];
  }

  // Format the search results
  const formattedResults = searchResults.entries.map((entry: any) => ({
    id: entry.id,
    title: entry.title,
    author: entry.uploader,
    // Flat search entries carry the channel id when YouTube returns it; the
    // frontend links the author to the redirector channel target with it.
    channelId: entry.channel_id || undefined,
    thumbnailUrl:
      entry.thumbnail ||
      (entry.thumbnails && entry.thumbnails.length > 0
        ? entry.thumbnails[0].url
        : ""),
    duration: entry.duration,
    viewCount: entry.view_count,
    sourceUrl: `https://www.youtube.com/watch?v=${entry.id}`, // Default to YT for search results
    source: "youtube",
  }));

  logger.info(
    `Found ${formattedResults.length} search results for "${query}" (requested ${limit})`
  );

  return formattedResults;
}

/**
 * List a YouTube channel's recent videos without downloading anything.
 *
 * Backs the local channel page for the /from/youtube/channel takeover
 * target: when a channel is not in the library, MyTube still shows it
 * locally by fetching the recent uploads with a flat yt-dlp playlist
 * (ids and titles only, like the search flow) instead of bouncing the
 * browser to youtube.com.
 *
 * @param channelPath youtube.com-relative channel path, e.g.
 *   "channel/UC...", "c/<name>" or "@<handle>" (as normalized by the
 *   redirect controller).
 */
export interface YouTubeChannelMetadata {
  id?: string;
  name: string;
  url?: string;
  subscriberCount?: number;
  description?: string;
  thumbnailUrl?: string;
}

export async function searchChannelVideos(
  channelPath: string,
  limit: number = 24,
  offset: number = 1
): Promise<{ videos: any[]; channel?: YouTubeChannelMetadata }> {
  logger.info(
    `Fetching YouTube channel videos for "${channelPath}" (limit: ${limit}, offset: ${offset})`
  );

  const userConfig = getUserYtDlpConfig();
  const networkConfig = getNetworkConfigFromUserConfig(userConfig);
  const PROVIDER_SCRIPT = getProviderScript();

  const playlistEnd = offset + limit - 1;
  const result = await executeYtDlpJson(
    `https://www.youtube.com/${channelPath}/videos`,
    {
      ...networkConfig,
      noWarnings: true,
      skipDownload: true,
      flatPlaylist: true,
      playlistStart: offset,
      playlistEnd,
      ...(PROVIDER_SCRIPT
        ? {
            extractorArgs: `youtubepot-bgutilscript:script_path=${PROVIDER_SCRIPT}`,
          }
        : {}),
    }
  );

  if (!result || !result.entries) {
    return { videos: [], channel: undefined };
  }

  const formattedResults = result.entries
    // A flat channel playlist opens with a stub entry for the channel itself.
    .filter((entry: any) => !(entry.id && /^UC.{22}$/.test(entry.id)))
    .map((entry: any) => ({
      id: entry.id,
      title: entry.title,
      author: entry.uploader || entry.channel,
      channelId: entry.channel_id || undefined,
      thumbnailUrl:
        entry.thumbnail ||
        (entry.thumbnails && entry.thumbnails.length > 0
          ? entry.thumbnails[0].url
          : ""),
      duration: entry.duration,
      viewCount: entry.view_count,
      sourceUrl: `https://www.youtube.com/watch?v=${entry.id}`,
      source: "youtube",
    }));

  // The flat playlist response carries the channel's identity alongside the
  // entries, so the channel page can show a real name, subscriber count and
  // blurb instead of the raw "channel/UC..." path it was reached through.
  const playlistChannelName: string | undefined =
    result.channel || result.uploader || undefined;
  const channel: YouTubeChannelMetadata | undefined = playlistChannelName
    ? {
        id: result.channel_id || undefined,
        name: playlistChannelName,
        url: result.channel_url || undefined,
        subscriberCount: result.channel_follower_count || undefined,
        description: result.description || undefined,
        thumbnailUrl:
          result.thumbnails && result.thumbnails.length > 0
            ? result.thumbnails[0].url
            : undefined,
      }
    : undefined;

  logger.info(
    `Found ${formattedResults.length} videos on YouTube channel "${channelPath}"`
  );

  return { videos: formattedResults, channel };
}

