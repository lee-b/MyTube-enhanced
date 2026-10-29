import { beforeEach, describe, expect, it, vi } from "vitest";

const ytDlpMocks = vi.hoisted(() => ({
  executeYtDlpJson: vi.fn(),
  getNetworkConfigFromUserConfig: vi.fn(() => ({})),
  getUserYtDlpConfig: vi.fn(() => ({})),
  getProviderScript: vi.fn(() => null),
}));

// ytdlpSearch imports through the ytDlpUtils re-export barrel.
vi.mock("../../../utils/ytDlpUtils", () => ({
  executeYtDlpJson: ytDlpMocks.executeYtDlpJson,
  getNetworkConfigFromUserConfig: ytDlpMocks.getNetworkConfigFromUserConfig,
  getUserYtDlpConfig: ytDlpMocks.getUserYtDlpConfig,
}));
vi.mock("../../../services/downloaders/ytdlp/ytdlpHelpers", () => ({
  getProviderScript: ytDlpMocks.getProviderScript,
}));

import { searchVideos } from "../../../services/downloaders/ytdlp/ytdlpSearch";

describe("ytdlpSearch.searchVideos", () => {
  beforeEach(() => {
    ytDlpMocks.executeYtDlpJson.mockReset();
    ytDlpMocks.executeYtDlpJson.mockResolvedValue({ entries: [] });
  });

  it("maps flat search entries and keeps the channel id for local-first links", async () => {
    ytDlpMocks.executeYtDlpJson.mockResolvedValue({
      entries: [
        {
          id: "6SxEj1cujQE",
          title: "A video",
          uploader: "PowerfulJRE",
          channel_id: "UCzQUP1qoWDoEbmsQxvdjxgQ",
          duration: 754,
          view_count: 4321,
          thumbnail: "https://i.ytimg.com/thumb.jpg",
        },
        {
          id: "8meG8CX7FAc",
          title: "Another video",
          uploader: "BlackBeltBarrister",
          thumbnails: [{ url: "https://i.ytimg.com/other.jpg" }],
        },
      ],
    });

    const results = await searchVideos("podcast", 8, 1);

    expect(results).toEqual([
      {
        id: "6SxEj1cujQE",
        title: "A video",
        author: "PowerfulJRE",
        channelId: "UCzQUP1qoWDoEbmsQxvdjxgQ",
        thumbnailUrl: "https://i.ytimg.com/thumb.jpg",
        duration: 754,
        viewCount: 4321,
        sourceUrl: "https://www.youtube.com/watch?v=6SxEj1cujQE",
        source: "youtube",
      },
      {
        id: "8meG8CX7FAc",
        title: "Another video",
        author: "BlackBeltBarrister",
        channelId: undefined,
        thumbnailUrl: "https://i.ytimg.com/other.jpg",
        duration: undefined,
        viewCount: undefined,
        sourceUrl: "https://www.youtube.com/watch?v=8meG8CX7FAc",
        source: "youtube",
      },
    ]);
  });

  it("builds the ytsearch request from the query, limit, and offset", async () => {
    await searchVideos("podcast", 8, 1);

    expect(ytDlpMocks.executeYtDlpJson).toHaveBeenCalledWith(
      "ytsearch8:podcast",
      expect.objectContaining({ skipDownload: true })
    );
  });

  it("returns no results when the search answers without entries", async () => {
    ytDlpMocks.executeYtDlpJson.mockResolvedValue({});

    await expect(searchVideos("podcast")).resolves.toEqual([]);
  });
});
