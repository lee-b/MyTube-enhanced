import express, { Express } from "express";
import { redirectToChannel, redirectToVideo } from "../controllers/redirectController";

/**
 * Browser-redirector takeover routes (see documents/en/redirector.md).
 *
 * Registered ahead of the SPA fallback so the paths below are never served
 * index.html. The routes are intentionally outside /api: they answer with 302
 * navigations rather than JSON, and they must not be gated behind login since
 * their whole job is to catch a browser that is on its way to youtube.com.
 */
export function registerRedirectRoutes(app: Express): void {
  const router = express.Router();

  router.get("/from/youtube/video/:id", redirectToVideo);
  router.get("/from/youtube/channel/{*splat}", redirectToChannel);

  app.use(router);
}
