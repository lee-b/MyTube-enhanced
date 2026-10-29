import { beforeEach, describe, expect, it, vi } from "vitest";

const ytDlpMocks = vi.hoisted(() => ({
  executeYtDlpJson: vi.fn(),
  getNetworkConfigFromUserConfig: vi.fn(() => ({})),
  getUserYtDlpConfig: vi.fn(() => ({})),
  getProviderScript: vi.fn(() => null),
}));

vi.mock("../../../utils/ytDlpUtils", () => ({
  executeYtDlpJson: ytDlpMocks.executeYtDlpJson,
  getNetworkConfigFromUserConfig: ytDlpMocks.getNetworkConfigFromUserConfig,
  getUserYtDlpConfig: ytDlpMocks.getUserYtDlpConfig,
}));
vi.mock("../../../services/downloaders/ytdlp/ytdlpHelpers", () => ({
  getProviderScript: ytDlpMocks.getProviderScript,
}));

import {
  clearStreamResolutionCache,
  resolveYouTubeStream,
  selectPlayableFormat,
} from "../../../services/downloaders/ytdlp/ytdlpStream";

describe("selectPlayableFormat", () => {
  it("prefers progressive MP4 over split DASH tracks", () => {
    const picked = selectPlayableFormat([
      { url: "video-only", ext: "mp4", vcodec: "avc1", acodec: "none", tbr: 2000 },
      { url: "audio-only", ext: "m4a", vcodec: "none", acodec: "mp4a", tbr: 128 },
      { url: "progressive-webm", ext: "webm", vcodec: "vp9", acodec: "vorbis", tbr: 3000 },
      { url: "progressive-mp4", ext: "mp4", vcodec: "avc1", acodec: "mp4a", tbr: 1500 },
    ]);

    expect(picked?.url).toBe("progressive-mp4");
  });

  it("picks the highest bitrate among equally playable candidates", () => {
    const picked = selectPlayableFormat([
      { url: "low", ext: "mp4", vcodec: "avc1", acodec: "mp4a", tbr: 400 },
      { url: "high", ext: "mp4", vcodec: "avc1", acodec: "mp4a", tbr: 1900 },
    ]);

    expect(picked?.url).toBe("high");
  });

  it("returns null when nothing progressive exists", () => {
    expect(
      selectPlayableFormat([
        { url: "video-only", ext: "mp4", vcodec: "avc1", acodec: "none" },
      ])
    ).toBeNull();
    expect(selectPlayableFormat([])).toBeNull();
  });

  it("ignores formats without a media URL", () => {
    const picked = selectPlayableFormat([
      { ext: "mp4", vcodec: "avc1", acodec: "mp4a", tbr: 500 },
    ]);

    expect(picked).toBeNull();
  });
});

describe("resolveYouTubeStream", () => {
  beforeEach(() => {
    ytDlpMocks.executeYtDlpJson.mockReset();
    ytDlpMocks.executeYtDlpJson.mockResolvedValue({ formats: [] });
    clearStreamResolutionCache();
  });

  it("resolves the watch URL through the download stack and returns the playable format", async () => {
    ytDlpMocks.executeYtDlpJson.mockResolvedValue({
      formats: [
        { url: "https://media/mp4", ext: "mp4", vcodec: "avc1", acodec: "mp4a", tbr: 1000 },
      ],
    });

    const resolved = await resolveYouTubeStream("6SxEj1cujQE");

    expect(resolved).toEqual({ url: "https://media/mp4", contentType: "video/mp4" });
    expect(ytDlpMocks.executeYtDlpJson).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=6SxEj1cujQE",
      expect.objectContaining({ skipDownload: true }),
      true
    );
  });

  it("caches the resolution for repeat requests", async () => {
    ytDlpMocks.executeYtDlpJson.mockResolvedValue({
      formats: [
        { url: "https://media/mp4", ext: "mp4", vcodec: "avc1", acodec: "mp4a", tbr: 1000 },
      ],
    });

    await resolveYouTubeStream("6SxEj1cujQE");
    await resolveYouTubeStream("6SxEj1cujQE");

    expect(ytDlpMocks.executeYtDlpJson).toHaveBeenCalledTimes(1);
  });

  it("negative-caches failures briefly instead of re-resolving every click", async () => {
    ytDlpMocks.executeYtDlpJson.mockResolvedValue({ formats: [] });

    expect(await resolveYouTubeStream("6SxEj1cujQE")).toBeNull();
    expect(await resolveYouTubeStream("6SxEj1cujQE")).toBeNull();
    expect(ytDlpMocks.executeYtDlpJson).toHaveBeenCalledTimes(1);
  });

  it("reports a webm content type for webm progressive formats", async () => {
    ytDlpMocks.executeYtDlpJson.mockResolvedValue({
      formats: [
        { url: "https://media/webm", ext: "webm", vcodec: "vp9", acodec: "vorbis", tbr: 1000 },
      ],
    });

    expect(await resolveYouTubeStream("6SxEj1cujQE")).toEqual({
      url: "https://media/webm",
      contentType: "video/webm",
    });
  });
});
