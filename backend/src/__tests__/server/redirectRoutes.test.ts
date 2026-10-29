import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const redirectControllerMocks = vi.hoisted(() => ({
  redirectToVideo: vi.fn((_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.redirect("/video/local-id");
  }),
  redirectToChannel: vi.fn((_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.redirect("/author/PowerfulJRE");
  }),
}));

vi.mock("../../controllers/redirectController", () => ({
  redirectToVideo: redirectControllerMocks.redirectToVideo,
  redirectToChannel: redirectControllerMocks.redirectToChannel,
  normalizeYouTubeChannelPath: vi.fn((path: string) => path),
}));

import { registerRedirectRoutes } from "../../server/redirectRoutes";

describe("registerRedirectRoutes", () => {
  it("serves /from/youtube/video/:id without needing /api auth", async () => {
    const app = express();
    registerRedirectRoutes(app);

    const response = await request(app).get("/from/youtube/video/6SxEj1cujQE");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/video/local-id");
    expect(redirectControllerMocks.redirectToVideo).toHaveBeenCalledTimes(1);
  });

  it("serves the wildcard channel route and preserves the full channel path", async () => {
    const app = express();
    registerRedirectRoutes(app);

    const response = await request(app).get(
      "/from/youtube/channel/channel/UCzQUP1qoWDoEbmsQxvdjxgQ"
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/author/PowerfulJRE");
    expect(redirectControllerMocks.redirectToChannel).toHaveBeenCalledTimes(1);
    // Express 5 hands wildcard params over as arrays; getWildcardParam joins
    // them back into the original channel path.
    expect(redirectControllerMocks.redirectToChannel.mock.calls[0][0].params).toMatchObject({
      splat: ["channel", "UCzQUP1qoWDoEbmsQxvdjxgQ"],
    });
  });

  it("does not swallow other paths so the SPA fallback still answers them", async () => {
    const app = express();
    registerRedirectRoutes(app);
    app.get("/{*splat}", (_req, res) => {
      res.send("spa-fallback");
    });

    const spaResponse = await request(app).get("/video/1786820657381");
    expect(spaResponse.status).toBe(200);
    expect(spaResponse.text).toBe("spa-fallback");

    const apiResponse = await request(app).get("/from/youtube/video/6SxEj1cujQE");
    expect(apiResponse.status).toBe(302);
  });
});
