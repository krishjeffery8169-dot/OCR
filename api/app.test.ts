import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "./app";

describe("platform api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns health status", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("allows demo login", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "annotator", password: "vlm-demo" });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toBe("vlm-platform-demo-token");
  });

  it("creates crawl job", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/robots.txt")) {
          return new Response("User-agent: *\nAllow: /\nCrawl-delay: 0\n", {
            status: 200,
            headers: { "content-type": "text/plain" },
          });
        }

        return new Response(
          "<html><head><title>Rabbit carrot matching worksheet</title><meta property=\"og:image\" content=\"https://www.homeschoolshare.com/sample.png\" /></head><body><h1>Rabbit carrot matching worksheet</h1><p>circle shape matching carrot worksheet</p></body></html>",
          {
            status: 200,
            headers: { "content-type": "text/html" },
          },
        );
      }),
    );

    const response = await request(app)
      .post("/api/platform/crawl/jobs")
      .send({
        sourceId: "source-homeschoolshare",
        keywords: "rabbit carrot",
        expectedCount: 5,
        withPreviewOnly: true,
        note: "测试创建爬取任务",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.sourceId).toBe("source-homeschoolshare");
    expect(response.body.data.status).toBe("completed");
  });

  it("rejects model crop task without file", async () => {
    const response = await request(app)
      .post("/api/model-crop/tasks")
      .field("stage", "高中")
      .field("subject", "数学")
      .field("dimensionText", "函数与导数题：必含函数图象。");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain("请上传");
  });
});
