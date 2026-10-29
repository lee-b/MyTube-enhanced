import express, { Express } from "express";
import { getYouTubeTakeoverStatus, redirectToChannel, redirectToVideo } from "../controllers/redirectController";
import {
  getRedirectorHelp,
  getRedirectorRulesFile,
} from "../controllers/redirectHelpController";
import { streamYouTubeVideo } from "../controllers/streamProxyController";

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

  router.get("/from/youtube/stream/:id", streamYouTubeVideo);
  router.get("/from/youtube/status/:id", getYouTubeTakeoverStatus);
  router.get("/from/youtube/video/:id", redirectToVideo);
  router.get("/from/youtube/channel/{*splat}", redirectToChannel);
  router.get("/from/help", getRedirectorHelp);
  router.get("/from/rules.json", getRedirectorRulesFile);

  app.use(router);
}
