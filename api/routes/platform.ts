import { Router, type Request, type Response } from "express";
import { createCrawlJob, getBootstrap } from "../mockData.js";

const router = Router();

router.get("/bootstrap", (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    data: getBootstrap(),
  });
});

router.post("/crawl/jobs", async (req: Request, res: Response): Promise<void> => {
  const { sourceId, keywords, expectedCount, withPreviewOnly, note, entryUrl } = req.body ?? {};

  if (!sourceId || typeof keywords !== "string" || typeof expectedCount !== "number") {
    res.status(400).json({
      success: false,
      error: "缺少创建爬取任务所需参数。",
    });
    return;
  }

  const job = await createCrawlJob({
    sourceId,
    keywords,
    expectedCount,
    withPreviewOnly: Boolean(withPreviewOnly),
    note: typeof note === "string" ? note : "",
    entryUrl: typeof entryUrl === "string" ? entryUrl : undefined,
  });

  if (!job) {
    res.status(404).json({
      success: false,
      error: "未找到对应来源配置。",
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: job,
  });
});

export default router;
