import { beforeEach, describe, expect, it, vi } from "vitest";

const downloadMocks = vi.hoisted(() => ({
  downloadYouTubeVideo: vi.fn(),
}));

vi.mock("../../services/downloadService", () => ({
  downloadYouTubeVideo: downloadMocks.downloadYouTubeVideo,
}));

const storageMocks = vi.hoisted(() => ({
  checkVideoDownloadBySourceId: vi.fn(),
  getVideoById: vi.fn(),
}));

vi.mock("../../services/storageService", () => ({
  checkVideoDownloadBySourceId: storageMocks.checkVideoDownloadBySourceId,
  getVideoById: storageMocks.getVideoById,
}));

import {
  getYouTubeLocalStatus,
  queueOnDemandDownload,
} from "../../services/onDemandYouTube";

const notFoundCheck = {
  found: false,
  status: undefined,
  videoId: undefined,
};

const localCheck = {
  found: true,
  status: "exists",
  videoId: "1786820657381",
};

const flushMicrotasks = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

describe("onDemandYouTube", () => {
  beforeEach(async () => {
    downloadMocks.downloadYouTubeVideo.mockReset();
    downloadMocks.downloadYouTubeVideo.mockResolvedValue({});
    storageMocks.checkVideoDownloadBySourceId.mockReset().mockReturnValue({
      ...notFoundCheck,
    });
    storageMocks.getVideoById.mockReset().mockReturnValue(undefined);
    // Let any download queued by an earlier test settle so the service's
    // module-level in-flight marker does not leak between tests.
    await flushMicrotasks();
  });

  describe("queueOnDemandDownload", () => {
    it("queues a background download through the regular yt-dlp stack", () => {
      queueOnDemandDownload("6SxEj1cujQE");

      expect(downloadMocks.downloadYouTubeVideo).toHaveBeenCalledTimes(1);
      expect(downloadMocks.downloadYouTubeVideo).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=6SxEj1cujQE",
        expect.objectContaining({ downloadId: expect.stringMatching(/^ondemand-6SxEj1cujQE-/) })
      );
    });

    it("does not queue duplicate downloads for the same video while one runs", async () => {
      // A slow download (still pending) must hold the dedupe.
      let releaseDownload: ((value?: unknown) => void) | undefined;
      downloadMocks.downloadYouTubeVideo.mockReturnValue(
        new Promise((resolve) => {
          releaseDownload = resolve;
        })
      );

      queueOnDemandDownload("6SxEj1cujQE");
      queueOnDemandDownload("6SxEj1cujQE");

      expect(downloadMocks.downloadYouTubeVideo).toHaveBeenCalledTimes(1);

      releaseDownload?.();
      await flushMicrotasks();
    });

    it("allows re-queueing after a download finished or failed", async () => {
      downloadMocks.downloadYouTubeVideo
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce(undefined);

      queueOnDemandDownload("6SxEj1cujQE");
      // Let the failing download settle and clear the in-flight marker.
      await flushMicrotasks();

      queueOnDemandDownload("6SxEj1cujQE");

      expect(downloadMocks.downloadYouTubeVideo).toHaveBeenCalledTimes(2);
    });

    it("does nothing for videos that are already local", () => {
      storageMocks.checkVideoDownloadBySourceId.mockReturnValue(localCheck);

      queueOnDemandDownload("6SxEj1cujQE");

      expect(downloadMocks.downloadYouTubeVideo).not.toHaveBeenCalled();
    });
  });

  describe("getYouTubeLocalStatus", () => {
    it("reports local with the library id for existing, visible videos", async () => {
      storageMocks.checkVideoDownloadBySourceId.mockReturnValue(localCheck);
      storageMocks.getVideoById.mockReturnValue({ id: "1786820657381" });

      const status = getYouTubeLocalStatus("6SxEj1cujQE", undefined);
      await flushMicrotasks();

      expect(status).toEqual({
        local: true,
        videoId: "1786820657381",
        queued: false,
      });
    });

    it("reports not-local for deleted tracking rows or invisible videos", () => {
      storageMocks.checkVideoDownloadBySourceId.mockReturnValue({
        found: true,
        status: "deleted",
        videoId: "1786820657381",
      });

      expect(getYouTubeLocalStatus("6SxEj1cujQE", undefined).local).toBe(false);
    });

    it("reports queued downloads so the waiting page can show progress", async () => {
      let releaseDownload: ((value?: unknown) => void) | undefined;
      downloadMocks.downloadYouTubeVideo.mockReturnValue(
        new Promise((resolve) => {
          releaseDownload = resolve;
        })
      );

      queueOnDemandDownload("6SxEj1cujQE");

      const status = getYouTubeLocalStatus("6SxEj1cujQE", undefined);
      expect(status.local).toBe(false);
      expect(status.queued).toBe(true);

      releaseDownload?.();
      await flushMicrotasks();
    });
  });
});
