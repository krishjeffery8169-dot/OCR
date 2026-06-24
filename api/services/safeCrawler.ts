import type { CrawlSample, CrawlSource } from "../mockData.js";

type RobotsRules = {
  allow: string[];
  disallow: string[];
  crawlDelaySeconds?: number;
  status: "allowed" | "blocked";
  message: string;
};

type CrawlResult = {
  samples: CrawlSample[];
  report: string[];
  error?: string;
};

const USER_AGENT = "VLMWorksheetCrawler/1.0 (+research-data-collection; no-login; respects-robots)";
const MAX_PAGES_PER_JOB = 12;
const MAX_HTML_CHARS = 900_000;
const REQUEST_TIMEOUT_MS = 9_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(min = 250, max = 900) {
  return min + Math.floor(Math.random() * (max - min));
}

function normalizeText(value: string) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function safeUrl(value: string, base?: string) {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    return url;
  } catch (_error) {
    return null;
  }
}

function hostAllowed(hostname: string, allowedDomains: string[]) {
  const host = hostname.toLowerCase();
  return allowedDomains.some((domain) => {
    const normalized = domain.toLowerCase();
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

async function fetchWithTimeout(url: string, report: string[]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.2",
      },
      redirect: "follow",
    });

    if (response.status === 403 || response.status === 429) {
      report.push(`收到 ${response.status}，立即停止该来源，避免继续触发限制：${url}`);
      return { response, text: "" };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !url.endsWith("/robots.txt")) {
      report.push(`跳过非 HTML 响应：${url}`);
      return { response, text: "" };
    }

    const text = (await response.text()).slice(0, MAX_HTML_CHARS);
    return { response, text };
  } finally {
    clearTimeout(timer);
  }
}

function parseRobots(robotsText: string, userAgent: string): RobotsRules {
  const groups: Array<{ agents: string[]; allow: string[]; disallow: string[]; crawlDelaySeconds?: number }> = [];
  let current: { agents: string[]; allow: string[]; disallow: string[]; crawlDelaySeconds?: number } | null = null;

  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line || !line.includes(":")) {
      continue;
    }

    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      current = { agents: [value.toLowerCase()], allow: [], disallow: [] };
      groups.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    if (key === "allow") {
      current.allow.push(value);
    }

    if (key === "disallow") {
      current.disallow.push(value);
    }

    if (key === "crawl-delay") {
      const delay = Number(value);
      if (Number.isFinite(delay) && delay >= 0) {
        current.crawlDelaySeconds = delay;
      }
    }
  }

  const normalizedAgent = userAgent.toLowerCase();
  const applicable = groups.filter((group) =>
    group.agents.some((agent) => agent === "*" || normalizedAgent.includes(agent)),
  );

  const selected = applicable.length ? applicable : groups.filter((group) => group.agents.includes("*"));
  return {
    allow: selected.flatMap((group) => group.allow),
    disallow: selected.flatMap((group) => group.disallow),
    crawlDelaySeconds: selected.find((group) => typeof group.crawlDelaySeconds === "number")?.crawlDelaySeconds,
    status: "allowed",
    message: selected.length ? "已读取 robots.txt 规则" : "robots.txt 未声明适用规则，按允许处理",
  };
}

function canFetchByRobots(url: URL, rules: RobotsRules) {
  const path = `${url.pathname}${url.search}`;
  const candidates = [
    ...rules.allow.map((rule) => ({ type: "allow" as const, rule })),
    ...rules.disallow.map((rule) => ({ type: "disallow" as const, rule })),
  ]
    .filter((item) => item.rule !== "")
    .filter((item) => path.startsWith(item.rule))
    .sort((a, b) => b.rule.length - a.rule.length);

  if (!candidates.length) {
    return true;
  }

  return candidates[0].type === "allow";
}

async function loadRobots(entry: URL, report: string[]): Promise<RobotsRules> {
  const robotsUrl = `${entry.origin}/robots.txt`;

  try {
    const { response, text } = await fetchWithTimeout(robotsUrl, report);

    if (response.status === 404) {
      return { allow: [], disallow: [], status: "allowed", message: "robots.txt 不存在，按允许抓取公开页面处理" };
    }

    if (!response.ok) {
      return {
        allow: [],
        disallow: ["/"],
        status: "blocked",
        message: `robots.txt 返回 ${response.status}，严格模式下停止抓取`,
      };
    }

    const parsed = parseRobots(text, USER_AGENT);
    report.push(parsed.message);
    return parsed;
  } catch (error) {
    return {
      allow: [],
      disallow: ["/"],
      status: "blocked",
      message: `robots.txt 无法读取，严格模式下停止抓取：${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

function extractTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  return normalizeText(title || h1 || "未命名页面").slice(0, 120);
}

function extractImage(html: string, baseUrl: string) {
  const metaImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const firstImg = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  const candidate = metaImage || firstImg;
  const resolved = candidate ? safeUrl(candidate, baseUrl) : null;
  return resolved?.toString();
}

function extractLinks(html: string, baseUrl: string, allowedDomains: string[]) {
  const links = new Set<string>();
  const regex = /<a[^>]+href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html))) {
    const url = safeUrl(match[1], baseUrl);
    if (!url || !hostAllowed(url.hostname, allowedDomains)) {
      continue;
    }

    if (/\.(zip|rar|7z|pdf|docx?|xlsx?|pptx?|mp4|mp3)$/i.test(url.pathname)) {
      continue;
    }

    links.add(url.toString());
  }

  return [...links];
}

function classify(text: string) {
  const normalized = text.toLowerCase();
  if (/(shape|circle|square|triangle|图形|圆形|方形)/i.test(text)) {
    return "图形连线";
  }
  if (/(句图|picture|image|图片|短语|sentence)/i.test(text)) {
    return "图文配对";
  }
  if (/(数学|语文|试卷|连线题|worksheet|matching)/i.test(text)) {
    return "试卷连线题";
  }
  return normalized.includes("match") ? "匹配题" : "待复核";
}

function extractInterference(text: string) {
  const tags: Array<[string, RegExp]> = [
    ["胡萝卜", /carrot|胡萝卜/i],
    ["圆形", /circle|圆形/i],
    ["图形外轮廓", /outline|轮廓/i],
    ["钟表图", /clock|钟表|时间/i],
    ["文本密集", /句子|短语|名句|人物|story|sentence/i],
  ];

  const matched = tags.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  return matched.length ? matched.join(";") : "待人工复核";
}

function matchesKeywords(text: string, keywords: string) {
  const tokens = keywords
    .split(/[\s,，;；/]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (!tokens.length) {
    return true;
  }

  const normalized = text.toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

function toSample(args: {
  html: string;
  url: string;
  source: CrawlSource;
  jobId: string;
  keywords: string;
}): CrawlSample | null {
  const text = normalizeText(args.html);
  const title = extractTitle(args.html);
  const combined = `${title} ${text}`;

  if (!matchesKeywords(combined, args.keywords)) {
    return null;
  }

  const image = extractImage(args.html, args.url);
  const summary = text.slice(0, 180) || title;
  const idSeed = Buffer.from(args.url).toString("base64url").slice(0, 10);

  return {
    id: `CR-${Date.now()}-${idSeed}`,
    title,
    prompt: `请识别该页面中的连线题或匹配题样本，并保留来源信息：${title}`,
    language: /[\u4e00-\u9fa5]/.test(combined) ? "中文" : "英语",
    sourceType: "真实爬取",
    sourceSite: args.source.site,
    sourceTitle: title,
    sourceUrl: args.url,
    scenario: "教育",
    category: classify(combined),
    interference: extractInterference(combined),
    summary,
    note: "由安全爬取服务生成，需人工复核版权、题面完整性与训练适用性。",
    previewImageUrl: image,
    capturedAt: new Date().toISOString(),
    tags: ["真实爬取", args.source.site, image ? "可预览" : "文本预览"],
    jobId: args.jobId,
  };
}

export async function runSafeCrawl(params: {
  source: CrawlSource;
  entryUrl: string;
  keywords: string;
  expectedCount: number;
  withPreviewOnly: boolean;
  jobId: string;
}): Promise<CrawlResult> {
  const report: string[] = [
    "启用严格安全策略：不登录、不使用 Cookie、不使用代理、不绕过风控。",
    `User-Agent: ${USER_AGENT}`,
  ];
  const entry = safeUrl(params.entryUrl);

  if (!entry) {
    return { samples: [], report, error: "入口 URL 非法。" };
  }

  if (!hostAllowed(entry.hostname, params.source.allowedDomains)) {
    return { samples: [], report, error: "入口 URL 不在来源白名单域名内。" };
  }

  const robots = await loadRobots(entry, report);
  report.push(robots.message);

  if (robots.status === "blocked") {
    return { samples: [], report, error: robots.message };
  }

  const baseDelay = process.env.NODE_ENV === "test" ? 0 : Math.max(
    Math.ceil(60_000 / Math.max(params.source.rateLimitPerMinute, 1)),
    Math.ceil((robots.crawlDelaySeconds ?? 0) * 1000),
    1_500,
  );
  report.push(`频控：至少间隔 ${baseDelay}ms，并附加随机抖动。`);

  const targetCount = Math.min(Math.max(params.expectedCount, 1), MAX_PAGES_PER_JOB);
  const queue = [entry.toString()];
  const visited = new Set<string>();
  const collected: CrawlSample[] = [];

  while (queue.length && visited.size < MAX_PAGES_PER_JOB && collected.length < targetCount) {
    const current = queue.shift();
    const currentUrl = current ? safeUrl(current) : null;
    if (!currentUrl || visited.has(currentUrl.toString())) {
      continue;
    }

    if (!hostAllowed(currentUrl.hostname, params.source.allowedDomains)) {
      report.push(`跳过非白名单域名：${currentUrl.toString()}`);
      continue;
    }

    if (!canFetchByRobots(currentUrl, robots)) {
      report.push(`robots.txt 禁止抓取，已跳过：${currentUrl.toString()}`);
      continue;
    }

    await sleep(baseDelay + (process.env.NODE_ENV === "test" ? 0 : jitter()));
    visited.add(currentUrl.toString());

    try {
      const { response, text } = await fetchWithTimeout(currentUrl.toString(), report);

      if (response.status === 403 || response.status === 429) {
        break;
      }

      if (!response.ok || !text) {
        report.push(`跳过异常响应 ${response.status}：${currentUrl.toString()}`);
        continue;
      }

      const sample = toSample({
        html: text,
        url: currentUrl.toString(),
        source: params.source,
        jobId: params.jobId,
        keywords: params.keywords,
      });

      if (sample && (!params.withPreviewOnly || sample.previewImageUrl)) {
        collected.push(sample);
      }

      for (const link of extractLinks(text, currentUrl.toString(), params.source.allowedDomains)) {
        if (!visited.has(link) && queue.length < MAX_PAGES_PER_JOB * 2) {
          queue.push(link);
        }
      }
    } catch (error) {
      report.push(`请求失败，已跳过：${currentUrl.toString()}，${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  report.push(`本轮访问页面 ${visited.size} 个，新增样本 ${collected.length} 条。`);
  return { samples: collected, report };
}
