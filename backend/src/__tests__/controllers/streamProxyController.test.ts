/* eslint-disable @typescript-eslint/no-explicit-any */
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamYouTubeVideo } from "../../controllers/streamProxyController";
import * as ytdlpStream from "../../services/downloaders/ytdlp/ytdlpStream";

vi.mock("../../services/downloaders/ytdlp/ytdlpStream", () => ({
  resolveYouTubeStream: vi.fn(),
  clearStreamResolutionCache: vi.fn(),
}));

const fetchMock = vi.hoisted(() => vi.fn());

function buildApp(): express.Express {
  const app = express();
  app.get("/from/youtube/stream/:id", streamYouTubeVideo);
  return app;
}

const resolvedStream = {
  url: "https://media.example/googlevideo.com/media.mp4",
  contentType: "video/mp4",
};

// A real web-readable body so Readable.fromWeb accepts it, with a little
// payload so supertest completes.
const mediaBody = () =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });

function mockUpstreamResponse(overrides: Record<string, any> = {}): any {
  const headerEntries: Record<string, string> = {
    "content-type": "video/mp4",
    "content-length": "1234",
    "accept-ranges": "bytes",
    ...(overrides.headers ?? {}),
  };
  return {
    status: overrides.status ?? 200,
    // Real Headers lookups are case-insensitive; mirror that.
    headers: {
      get: (name: string) =>
        headerEntries[name.toLowerCase()] ?? null,
    },
    body: overrides.body ?? mediaBody(),
  };
}

describe("streamYouTubeVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock as any;
  });

  it("302s non-video-id paths straight to youtube.com", async () => {
    const res = await request(buildApp()).get("/from/youtube/stream/not-a-video-id");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      "https://www.youtube.com/watch?v=not-a-video-id"
    );
    expect(ytdlpStream.resolveYouTubeStream).not.toHaveBeenCalled();
  });

  it("302s to youtube.com when no playable format resolves", async () => {
    vi.mocked(ytdlpStream.resolveYouTubeStream).mockResolvedValue(null);

    const res = await request(buildApp()).get("/from/youtube/stream/6SxEj1cujQE");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      "https://www.youtube.com/watch?v=6SxEj1cujQE"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("relays the upstream media response with passthrough headers", async () => {
    vi.mocked(ytdlpStream.resolveYouTubeStream).mockResolvedValue(resolvedStream);
    fetchMock.mockResolvedValue(mockUpstreamResponse());

    const res = await request(buildApp()).get("/from/youtube/stream/6SxEj1cujQE");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("video/mp4");
    expect(res.headers["accept-ranges"]).toBe("bytes");
    expect(fetchMock).toHaveBeenCalledWith(resolvedStream.url, {
      headers: {},
      redirect: "follow",
    });
  });

  it("forwards the player's Range header so seeking works", async () => {
    vi.mocked(ytdlpStream.resolveYouTubeStream).mockResolvedValue(resolvedStream);
    fetchMock.mockResolvedValue(
      mockUpstreamResponse({
        status: 206,
        headers: { "content-range": "bytes 100-999/1234" },
      })
    );

    const res = await request(buildApp())
      .get("/from/youtube/stream/6SxEj1cujQE")
      .set("Range", "bytes=100-999");

    expect(fetchMock).toHaveBeenCalledWith(resolvedStream.url, {
      headers: { Range: "bytes=100-999" },
      redirect: "follow",
    });
    expect(res.status).toBe(206);
    expect(res.headers["content-range"]).toBe("bytes 100-999/1234");
  });

  it("re-resolves once when the cached media URL has expired upstream", async () => {
    vi.mocked(ytdlpStream.resolveYouTubeStream)
      .mockResolvedValueOnce(resolvedStream)
      .mockResolvedValueOnce({
        url: "https://media.example/googlevideo.com/fresh.mp4",
        contentType: "video/mp4",
      });
    fetchMock
      .mockResolvedValueOnce(mockUpstreamResponse({ status: 403, body: null }))
      .mockResolvedValueOnce(mockUpstreamResponse());

    await request(buildApp()).get("/from/youtube/stream/6SxEj1cujQE");

    expect(ytdlpStream.resolveYouTubeStream).toHaveBeenCalledTimes(2);
    expect(ytdlpStream.clearStreamResolutionCache).toHaveBeenCalledWith(
      "6SxEj1cujQE"
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://media.example/googlevideo.com/fresh.mp4",
      { headers: {}, redirect: "follow" }
    );
  });

  it("falls back to youtube.com when even the retry fails upstream", async () => {
    vi.mocked(ytdlpStream.resolveYouTubeStream)
      .mockResolvedValueOnce(resolvedStream)
      .mockResolvedValueOnce(null);
    fetchMock.mockResolvedValue(mockUpstreamResponse({ status: 404, body: null }));

    const res = await request(buildApp()).get("/from/youtube/stream/6SxEj1cujQE");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      "https://www.youtube.com/watch?v=6SxEj1cujQE"
    );
  });

  it("falls back to youtube.com when the upstream fetch throws", async () => {
    vi.mocked(ytdlpStream.resolveYouTubeStream).mockResolvedValue(resolvedStream);
    fetchMock.mockRejectedValue(new Error("connection reset"));

    const res = await request(buildApp()).get("/from/youtube/stream/6SxEj1cujQE");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      "https://www.youtube.com/watch?v=6SxEj1cujQE"
    );
    // The poisoned resolution is dropped so the next click starts clean.
    expect(ytdlpStream.clearStreamResolutionCache).toHaveBeenCalledWith(
      "6SxEj1cujQE"
    );
  });
});
