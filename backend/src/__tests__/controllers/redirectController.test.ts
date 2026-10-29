import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const visibilityMocks = vi.hoisted(() => ({
  getVisibilityScopedRole: vi.fn(() => undefined),
}));

vi.mock("../../controllers/video/visibility", () => ({
  getVisibilityScopedRole: visibilityMocks.getVisibilityScopedRole,
}));

const storageMocks = vi.hoisted(() => ({
  checkVideoDownloadBySourceId: vi.fn(),
  getVideoById: vi.fn(),
  // Video summaries are plain objects with an index signature upstream; the
  // widened element type keeps the mocked module's surface honest.
  getVideoSummaries: vi.fn((): Array<Record<string, any>> => []),
}));

const onDemandMocks = vi.hoisted(() => ({
  queueOnDemandDownload: vi.fn(),
  getYouTubeLocalStatus: vi.fn(),
}));

vi.mock("../../services/onDemandYouTube", () => ({
  queueOnDemandDownload: onDemandMocks.queueOnDemandDownload,
  getYouTubeLocalStatus: onDemandMocks.getYouTubeLocalStatus,
}));

vi.mock("../../services/storageService", () => ({
  checkVideoDownloadBySourceId: storageMocks.checkVideoDownloadBySourceId,
  getVideoById: storageMocks.getVideoById,
  getVideoSummaries: storageMocks.getVideoSummaries,
}));

import {
  getYouTubeTakeoverStatus,
  normalizeYouTubeChannelPath,
  redirectToChannel,
  redirectToVideo,
} from "../../controllers/redirectController";

const buildApp = (): express.Express => {
  const app = express();
  app.get("/from/youtube/video/:id", redirectToVideo);
  app.get("/from/youtube/status/:id", getYouTubeTakeoverStatus);
  app.get("/from/youtube/channel/{*splat}", redirectToChannel);
  return app;
};

describe("redirectToVideo", () => {
  beforeEach(() => {
    visibilityMocks.getVisibilityScopedRole.mockClear();
    storageMocks.checkVideoDownloadBySourceId.mockReset();
    storageMocks.getVideoById.mockReset();
    onDemandMocks.queueOnDemandDownload.mockClear();
    onDemandMocks.getYouTubeLocalStatus.mockReset();
  });

  it("302s to the local player page when the video exists locally", async () => {
    storageMocks.checkVideoDownloadBySourceId.mockReturnValue({
      found: true,
      status: "exists",
      videoId: "1786820657381",
    });
    storageMocks.getVideoById.mockReturnValue({ id: "1786820657381" });

    const response = await request(buildApp()).get(
      "/from/youtube/video/6SxEj1cujQE"
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/video/1786820657381");
    expect(storageMocks.checkVideoDownloadBySourceId).toHaveBeenCalledWith(
      "6SxEj1cujQE",
      "youtube",
      "video"
    );
  });

  it("falls back to youtube.com when the video is not in the library", async () => {
    storageMocks.checkVideoDownloadBySourceId.mockReturnValue({
      found: false,
    });

    const response = await request(buildApp()).get(
      "/from/youtube/video/dQw4w9WgXcQ"
    );

    expect(response.status).toBe(302);
    // Non-local videos are queued for an on-demand download and the browser
    // is sent to the MyTube page that waits for the local copy.
    expect(response.headers.location).toBe("/watch/youtube/dQw4w9WgXcQ");
    expect(onDemandMocks.queueOnDemandDownload).toHaveBeenCalledWith("dQw4w9WgXcQ");
    expect(storageMocks.getVideoById).not.toHaveBeenCalled();
  });

  it("falls back when the tracking row says the video was deleted", async () => {
    storageMocks.checkVideoDownloadBySourceId.mockReturnValue({
      found: true,
      status: "deleted",
      videoId: "1786820657381",
    });

    const response = await request(buildApp()).get(
      "/from/youtube/video/6SxEj1cujQE"
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/watch/youtube/6SxEj1cujQE");
    expect(onDemandMocks.queueOnDemandDownload).toHaveBeenCalledWith("6SxEj1cujQE");
    expect(storageMocks.getVideoById).not.toHaveBeenCalled();
  });

  it("falls back when the tracked video id no longer resolves locally", async () => {
    storageMocks.checkVideoDownloadBySourceId.mockReturnValue({
      found: true,
      status: "exists",
      videoId: "1786820657381",
    });
    storageMocks.getVideoById.mockReturnValue(undefined);

    const response = await request(buildApp()).get(
      "/from/youtube/video/6SxEj1cujQE"
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/watch/youtube/6SxEj1cujQE");
    expect(onDemandMocks.queueOnDemandDownload).toHaveBeenCalledWith("6SxEj1cujQE");
  });

  it("falls back without consulting the library for non-video-id paths", async () => {
    const response = await request(buildApp()).get(
      "/from/youtube/video/not-a-video-id"
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      "https://www.youtube.com/watch?v=not-a-video-id"
    );
    expect(storageMocks.checkVideoDownloadBySourceId).not.toHaveBeenCalled();
    expect(onDemandMocks.queueOnDemandDownload).not.toHaveBeenCalled();
  });

  it("never serves stale redirect hops from caches", async () => {
    storageMocks.checkVideoDownloadBySourceId.mockReturnValue({
      found: false,
    });

    const response = await request(buildApp()).get(
      "/from/youtube/video/6SxEj1cujQE"
    );

    expect(response.headers["cache-control"]).toBe("no-store");
  });
});

describe("redirectToChannel", () => {
  beforeEach(() => {
    visibilityMocks.getVisibilityScopedRole.mockClear();
    storageMocks.getVideoSummaries.mockReset();
  });

  it("302s to the local author page when a video carries the channel URL", async () => {
    storageMocks.getVideoSummaries.mockReturnValue([
      { id: "1", author: "Other Channel", channelUrl: "https://www.youtube.com/channel/UCother" },
      {
        id: "2",
        author: "PowerfulJRE",
        channelUrl: "https://www.youtube.com/channel/UCzQUP1qoWDoEbmsQxvdjxgQ/",
      },
    ]);

    const response = await request(buildApp()).get(
      "/from/youtube/channel/channel/UCzQUP1qoWDoEbmsQxvdjxgQ"
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/author/PowerfulJRE");
  });

  it("matches @handle paths against author display names case-insensitively", async () => {
    storageMocks.getVideoSummaries.mockReturnValue([
      { id: "1", author: "powerfuljre", channelUrl: undefined },
    ]);

    const response = await request(buildApp()).get(
      "/from/youtube/channel/@PowerfulJRE"
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/author/powerfuljre");
  });

  it("URL-decodes %40 handles and strips query strings", async () => {
    storageMocks.getVideoSummaries.mockReturnValue([
      { id: "1", author: "PowerfulJRE" },
    ]);

    const response = await request(buildApp()).get(
      "/from/youtube/channel/%40PowerfulJRE?si=trace"
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/author/PowerfulJRE");
  });

  it("serves the local channel page when no local video matches the channel", async () => {
    storageMocks.getVideoSummaries.mockReturnValue([
      { id: "1", author: "PowerfulJRE", channelUrl: "https://www.youtube.com/channel/UCzQUP1qoWDoEbmsQxvdjxgQ" },
    ]);

    const response = await request(buildApp()).get(
      "/from/youtube/channel/channel/UCunknown12345678"
    );

    // The takeover keeps the browser on MyTube: the local channel page lists
    // the channel's recent uploads via yt-dlp instead of bouncing to YouTube.
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      "/channel/youtube/channel%2FUCunknown12345678"
    );
  });

  it("falls back to the youtube.com home page for non-channel paths", async () => {
    const response = await request(buildApp()).get(
      "/from/youtube/channel/playlist?list=PLxyz"
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://www.youtube.com/");
    expect(storageMocks.getVideoSummaries).not.toHaveBeenCalled();
  });

  it("matches legacy /c/ channel paths", async () => {
    storageMocks.getVideoSummaries.mockReturnValue([
      {
        id: "1",
        author: "PowerfulJRE",
        channelUrl: "https://www.youtube.com/c/PowerfulJRE",
      },
    ]);

    const response = await request(buildApp()).get("/from/youtube/channel/c/PowerfulJRE");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/author/PowerfulJRE");
  });
});

describe("normalizeYouTubeChannelPath", () => {
  it("accepts the channel path shapes YouTube uses", () => {
    expect(normalizeYouTubeChannelPath("channel/UCzQUP1qoWDoEbmsQxvdjxgQ")).toBe(
      "channel/UCzQUP1qoWDoEbmsQxvdjxgQ"
    );
    expect(normalizeYouTubeChannelPath("c/PowerfulJRE")).toBe("c/PowerfulJRE");
    expect(normalizeYouTubeChannelPath("@PowerfulJRE")).toBe("@PowerfulJRE");
    expect(normalizeYouTubeChannelPath("%40PowerfulJRE")).toBe("@PowerfulJRE");
  });

  it("rejects paths that are not channels", () => {
    expect(normalizeYouTubeChannelPath("watch?v=6SxEj1cujQE")).toBeNull();
    expect(normalizeYouTubeChannelPath("playlist?list=PLxyz")).toBeNull();
    expect(normalizeYouTubeChannelPath("")).toBeNull();
    expect(normalizeYouTubeChannelPath("shorts/6SxEj1cujQE")).toBeNull();
  });
});
