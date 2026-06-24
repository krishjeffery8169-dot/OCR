import { runSafeCrawl } from "./services/safeCrawler.js";

type UserRole = "operator";

export type PlatformUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
};

export type CrawlSource = {
  id: string;
  name: string;
  site: string;
  entryUrl: string;
  allowedDomains: string[];
  rateLimitPerMinute: number;
  status: "active" | "review";
  focus: string[];
  notes: string;
  sampleCount: number;
};

export type CrawlJob = {
  id: string;
  sourceId: string;
  sourceName: string;
  keywords: string;
  expectedCount: number;
  fetchedCount: number;
  withPreviewOnly: boolean;
  status: "queued" | "running" | "completed" | "failed";
  note: string;
  createdAt: string;
  updatedAt: string;
  safetyReport: string[];
  error?: string;
};

export type CrawlSample = {
  id: string;
  title: string;
  prompt: string;
  language: string;
  sourceType: string;
  sourceSite: string;
  sourceTitle: string;
  sourceUrl: string;
  scenario: string;
  category: string;
  interference: string;
  summary: string;
  note: string;
  previewImageUrl?: string;
  capturedAt: string;
  tags: string[];
  jobId?: string;
};

export type PlatformBootstrap = {
  user: Omit<PlatformUser, "username">;
  overview: {
    sourceCount: number;
    activeJobCount: number;
    completedJobCount: number;
    sampleCount: number;
    lastRunAt: string;
  };
  sources: CrawlSource[];
  jobs: CrawlJob[];
  samples: CrawlSample[];
};

export type CreateCrawlJobInput = {
  sourceId: string;
  keywords: string;
  expectedCount: number;
  withPreviewOnly: boolean;
  note: string;
  entryUrl?: string;
};

const demoUser: PlatformUser = {
  id: "user-001",
  username: "annotator",
  name: "Crawler Operator",
  role: "operator",
};

const demoPassword = "vlm-demo";

const samples: CrawlSample[] = [
  {
    id: "LM-001",
    title: "兔子-胡萝卜图形连线",
    prompt: "请将左侧兔子与右侧相同形状的胡萝卜连线",
    language: "英语",
    sourceType: "线上网页",
    sourceSite: "Homeschool Share",
    sourceTitle: "Rabbit Matching Shapes Worksheets",
    sourceUrl: "https://www.homeschoolshare.com/rabbit-shapes-activity/",
    scenario: "教育",
    category: "图形连线",
    interference: "胡萝卜;图形外轮廓",
    summary: "兔子形状与胡萝卜形状一一对应的连线练习",
    note: "公开网页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/NXIA1wceZ6",
    capturedAt: "2026-06-18T08:10:00.000Z",
    tags: ["胡萝卜", "图形连线", "可预览"],
  },
  {
    id: "LM-002",
    title: "heart rabbit 到 heart carrot 配对",
    prompt: "请把 heart rabbit 连到 heart carrot 并忽略其余形状干扰",
    language: "英语",
    sourceType: "线上网页",
    sourceSite: "Homeschool Share",
    sourceTitle: "Rabbit Matching Shapes Worksheets",
    sourceUrl: "https://www.homeschoolshare.com/rabbit-shapes-activity/",
    scenario: "教育",
    category: "图形连线",
    interference: "胡萝卜;混合图形",
    summary: "同一题面中包含多种基础图形并要求按相同形状匹配",
    note: "公开网页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/N62m1wceZ6",
    capturedAt: "2026-06-18T08:12:00.000Z",
    tags: ["胡萝卜", "心形", "可预览"],
  },
  {
    id: "LM-003",
    title: "shape 与 name 连线",
    prompt: "请将 shape 与对应的 name 连线",
    language: "英语",
    sourceType: "线上网页",
    sourceSite: "A to Z Worksheet",
    sourceTitle: "Matching Shapes Worksheets for Kindergarten (Free PDF)",
    sourceUrl: "https://atozworksheet.com/matching-shapes-worksheet/",
    scenario: "教育",
    category: "图文配对",
    interference: "圆形;基础图形",
    summary: "shape to name 的基础匹配练习覆盖 circle square triangle 等",
    note: "公开网页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/x5x51wceZ6",
    capturedAt: "2026-06-18T08:15:00.000Z",
    tags: ["圆形", "英文", "可预览"],
  },
  {
    id: "LM-004",
    title: "filled shape 与 outline 配对",
    prompt: "请将 filled shape 与对应 outline 连线",
    language: "英语",
    sourceType: "线上网页",
    sourceSite: "A to Z Worksheet",
    sourceTitle: "Matching Shapes Worksheets for Kindergarten (Free PDF)",
    sourceUrl: "https://atozworksheet.com/matching-shapes-worksheet/",
    scenario: "教育",
    category: "图形连线",
    interference: "图形外轮廓;圆形",
    summary: "实心图形与空心轮廓之间的匹配连线",
    note: "公开网页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/b5Tg1wceZ6",
    capturedAt: "2026-06-18T08:18:00.000Z",
    tags: ["图形轮廓", "圆形", "可预览"],
  },
  {
    id: "LM-005",
    title: "real-world object 与 shape 配对",
    prompt: "请将 real-world object 与相关 shape 连线",
    language: "英语",
    sourceType: "线上网页",
    sourceSite: "A to Z Worksheet",
    sourceTitle: "Matching Shapes Worksheets for Kindergarten (Free PDF)",
    sourceUrl: "https://atozworksheet.com/matching-shapes-worksheet/",
    scenario: "教育",
    category: "图文配对",
    interference: "圆形;物体图标",
    summary: "如 wheel 对应 circle 的对象与图形配对",
    note: "公开网页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/5PDU1wceZ6",
    capturedAt: "2026-06-18T08:20:00.000Z",
    tags: ["物体图标", "圆形", "可预览"],
  },
  {
    id: "LM-006",
    title: "根据钟表图片读时间连线",
    prompt: "请根据钟表图片读出时间并连线",
    language: "中文",
    sourceType: "线上网页",
    sourceSite: "二一教育课件站",
    sourceTitle: "苏教版2025年二年级下学期数学(期末复习)暑假伴学营分类专训系列：连线题(附答案)",
    sourceUrl: "https://edu.21cnjy.com/p-23206500.html",
    scenario: "教育",
    category: "试卷连线题",
    interference: "钟表图;数字时间",
    summary: "看图读出时间并与对应时刻连线",
    note: "公开预览页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/2wUp1wcgVg",
    capturedAt: "2026-06-18T08:22:00.000Z",
    tags: ["时间读图", "试卷", "可预览"],
  },
  {
    id: "LM-007",
    title: "物体高度与单位数值连线",
    prompt: "请把物体高度与对应单位数值连线",
    language: "中文",
    sourceType: "线上网页",
    sourceSite: "二一教育课件站",
    sourceTitle: "苏教版2025年二年级下学期数学(期末复习)暑假伴学营分类专训系列：连线题(附答案)",
    sourceUrl: "https://edu.21cnjy.com/p-23206500.html",
    scenario: "教育",
    category: "试卷连线题",
    interference: "数字;单位",
    summary: "物体高度与 8分米 210厘米 8米 160毫米 等数值配对",
    note: "公开预览页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/9uik1wcgVg",
    capturedAt: "2026-06-18T08:25:00.000Z",
    tags: ["单位换算", "试卷", "可预览"],
  },
  {
    id: "LM-008",
    title: "找出和为 1000 的两个数",
    prompt: "请找出相加和为1000的两个数并连线",
    language: "中文",
    sourceType: "线上网页",
    sourceSite: "二一教育课件站",
    sourceTitle: "苏教版2025年二年级下学期数学(期末复习)暑假伴学营分类专训系列：连线题(附答案)",
    sourceUrl: "https://edu.21cnjy.com/p-23206500.html",
    scenario: "教育",
    category: "试卷连线题",
    interference: "数字密集分布",
    summary: "多个数字同时出现需要做正确配对",
    note: "公开预览页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/2wUp1wcgVg",
    capturedAt: "2026-06-18T08:27:00.000Z",
    tags: ["数字配对", "试卷", "可预览"],
  },
  {
    id: "LM-009",
    title: "蝴蝶找到对应花朵",
    prompt: "请帮蝴蝶找到应该落下的花朵并连线",
    language: "中文",
    sourceType: "线上网页",
    sourceSite: "二一教育课件站",
    sourceTitle: "苏教版2025年二年级下学期数学(期末复习)暑假伴学营分类专训系列：连线题(附答案)",
    sourceUrl: "https://edu.21cnjy.com/p-23206500.html",
    scenario: "教育",
    category: "试卷连线题",
    interference: "蝴蝶;花朵",
    summary: "蝴蝶与目标花朵之间的匹配连线",
    note: "公开预览页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/9uik1wcgVg",
    capturedAt: "2026-06-18T08:28:00.000Z",
    tags: ["蝴蝶", "花朵", "可预览"],
  },
  {
    id: "LM-010",
    title: "小兔子送回对应的家",
    prompt: "请把小兔子送回对应的家并连线",
    language: "中文",
    sourceType: "线上网页",
    sourceSite: "二一教育课件站",
    sourceTitle: "苏教版2025年二年级下学期数学(期末复习)暑假伴学营分类专训系列：连线题(附答案)",
    sourceUrl: "https://edu.21cnjy.com/p-23206500.html",
    scenario: "教育",
    category: "试卷连线题",
    interference: "兔子;路径干扰",
    summary: "目标对象与终点位置之间的归属匹配",
    note: "公开预览页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/9uik1wcgVg",
    capturedAt: "2026-06-18T08:30:00.000Z",
    tags: ["路径干扰", "试卷", "可预览"],
  },
  {
    id: "LM-011",
    title: "观察物体视角匹配",
    prompt: "请把右侧图形分别与看到它的人连线",
    language: "中文",
    sourceType: "线上网页",
    sourceSite: "51教习网",
    sourceTitle: "苏教版（2024）三年级上册八 观察物体（二）单元测试课时训练",
    sourceUrl: "https://m.51jiaoxi.com/doc-17612412.html",
    scenario: "教育",
    category: "试卷连线题",
    interference: "视角图形;空间位置",
    summary: "观察物体题中人物视角与图形结果连线",
    note: "公开预览页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/nTEN1wcgVg",
    capturedAt: "2026-06-18T08:32:00.000Z",
    tags: ["空间视角", "试卷", "可预览"],
  },
  {
    id: "LM-012",
    title: "立体图观察位置连线",
    prompt: "请根据左图把右侧图形与对应观察位置连线",
    language: "中文",
    sourceType: "线上网页",
    sourceSite: "51教习网",
    sourceTitle: "苏教版（2024）三年级上册八 观察物体（二）单元测试课时训练",
    sourceUrl: "https://m.51jiaoxi.com/doc-17612412.html",
    scenario: "教育",
    category: "试卷连线题",
    interference: "空间视角;几何体",
    summary: "同一立体图从不同方位观察结果之间的匹配",
    note: "公开预览页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/nTEN1wcgVg",
    capturedAt: "2026-06-18T08:34:00.000Z",
    tags: ["几何体", "空间视角", "可预览"],
  },
  {
    id: "LM-013",
    title: "古代人物与对应事迹连线",
    prompt: "请把古代人物与对应事迹连线",
    language: "中文",
    sourceType: "线上网页",
    sourceSite: "二一教育课件站",
    sourceTitle: "统编版2025-2026学年小学三年级语文(2024)上学期第八单元分类训练题：连线题(附答案)",
    sourceUrl: "https://edu.21cnjy.com/p-23533501.html",
    scenario: "教育",
    category: "试卷连线题",
    interference: "文本选项密集",
    summary: "黄香 孔融 曹冲 与温席 让梨 称象等内容配对",
    note: "公开预览页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/1l431wcgVg",
    capturedAt: "2026-06-18T08:36:00.000Z",
    tags: ["语文", "人物事迹", "可预览"],
  },
  {
    id: "LM-014",
    title: "名句与对应人物连线",
    prompt: "请把名句与对应人物连线",
    language: "中文",
    sourceType: "线上网页",
    sourceSite: "二一教育课件站",
    sourceTitle: "统编版2025-2026学年小学三年级语文(2024)上学期第八单元分类训练题：连线题(附答案)",
    sourceUrl: "https://edu.21cnjy.com/p-23533501.html",
    scenario: "教育",
    category: "试卷连线题",
    interference: "文本干扰;人物名称",
    summary: "诗句名句与杜甫 项羽 蒲松龄 诸葛亮等人物匹配",
    note: "公开预览页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/NCIu1wcgVg",
    capturedAt: "2026-06-18T08:38:00.000Z",
    tags: ["语文", "人物", "可预览"],
  },
  {
    id: "LM-015",
    title: "书签内容与书名连线",
    prompt: "请把书签内容与对应书名连线",
    language: "中文",
    sourceType: "线上网页",
    sourceSite: "二一教育课件站",
    sourceTitle: "统编版2025-2026学年小学三年级语文(2024)上学期第八单元分类训练题：连线题(附答案)",
    sourceUrl: "https://edu.21cnjy.com/p-23533501.html",
    scenario: "教育",
    category: "试卷连线题",
    interference: "文本摘要;书名干扰",
    summary: "故事摘要与丑小鸭 拇指姑娘 稻草人等书名配对",
    note: "公开预览页样本",
    previewImageUrl: "https://aka.doubaocdn.com/s/1l431wcgVg",
    capturedAt: "2026-06-18T08:40:00.000Z",
    tags: ["语文", "书名匹配", "可预览"],
  },
  {
    id: "LM-016",
    title: "句子或对话选择对应图片",
    prompt: "请根据句子或对话选择对应图片并连线",
    language: "中文",
    sourceType: "线上网页",
    sourceSite: "学科网",
    sourceTitle: "【期末考点培优】考点22：句图匹配（专项训练）-2025-2026学年人教PEP版英语六年级下册",
    sourceUrl: "https://www.zxxk.com/soft/58311000.html",
    scenario: "教育",
    category: "图文配对",
    interference: "多图候选;语义干扰",
    summary: "英语句子与生活场景图片之间的匹配",
    note: "公开预览文本样本",
    capturedAt: "2026-06-18T08:42:00.000Z",
    tags: ["句图匹配", "文本预览"],
  },
  {
    id: "LM-017",
    title: "故事发展句子与图片排序",
    prompt: "请把故事发展句子与相应图片排序并连线",
    language: "中文",
    sourceType: "线上网页",
    sourceSite: "学科网",
    sourceTitle: "【期末考点培优】考点22：句图匹配（专项训练）-2025-2026学年人教PEP版英语六年级下册",
    sourceUrl: "https://www.zxxk.com/soft/58311000.html",
    scenario: "教育",
    category: "图文配对",
    interference: "故事序列;图片候选",
    summary: "故事发展与图片排序结合的句图匹配任务",
    note: "公开预览文本样本",
    capturedAt: "2026-06-18T08:43:00.000Z",
    tags: ["故事序列", "文本预览"],
  },
  {
    id: "LM-018",
    title: "短语与对应图片连线",
    prompt: "请把 go to the cinema 等短语与对应图片连线",
    language: "英语",
    sourceType: "线上网页",
    sourceSite: "学科网",
    sourceTitle: "专项05 句图匹配题（专项训练）三升四年级英语暑假专项提升（沪教版·新教材）",
    sourceUrl: "https://m.zxxk.com/soft/58389465.html",
    scenario: "教育",
    category: "图文配对",
    interference: "短语候选;图片候选",
    summary: "短语与图片连线如 go to the cinema walk along the path at night 等",
    note: "公开预览文本样本",
    capturedAt: "2026-06-18T08:44:00.000Z",
    tags: ["英语短语", "文本预览"],
  },
];

const sources: CrawlSource[] = [
  {
    id: "source-homeschoolshare",
    name: "Rabbit Matching Shapes Worksheets",
    site: "Homeschool Share",
    entryUrl: "https://www.homeschoolshare.com/rabbit-shapes-activity/",
    allowedDomains: ["www.homeschoolshare.com", "aka.doubaocdn.com"],
    rateLimitPerMinute: 8,
    status: "active",
    focus: ["兔子-胡萝卜配对", "基础图形", "可预览图片"],
    notes: "适合抓取图形连线、胡萝卜干扰和卡通对象配对样本。",
    sampleCount: samples.filter((item) => item.sourceSite === "Homeschool Share").length,
  },
  {
    id: "source-atozworksheet",
    name: "Matching Shapes Worksheets",
    site: "A to Z Worksheet",
    entryUrl: "https://atozworksheet.com/matching-shapes-worksheet/",
    allowedDomains: ["atozworksheet.com", "aka.doubaocdn.com"],
    rateLimitPerMinute: 8,
    status: "active",
    focus: ["shape-to-name", "outline matching", "circle 干扰"],
    notes: "公开图形练习资源，适合做基础形状连线首批抓取。",
    sampleCount: samples.filter((item) => item.sourceSite === "A to Z Worksheet").length,
  },
  {
    id: "source-21cnjy",
    name: "小学试卷连线题预览",
    site: "二一教育课件站",
    entryUrl: "https://edu.21cnjy.com/p-23206500.html",
    allowedDomains: ["edu.21cnjy.com", "aka.doubaocdn.com"],
    rateLimitPerMinute: 6,
    status: "review",
    focus: ["数学试卷", "语文连线题", "综合预览页"],
    notes: "目前以公开预览页为主，适合先做预览图和来源信息抓取。",
    sampleCount: samples.filter((item) => item.sourceSite === "二一教育课件站").length,
  },
  {
    id: "source-school-sites",
    name: "其他公开教育站点",
    site: "51教习网 / 学科网",
    entryUrl: "https://m.51jiaoxi.com/doc-17612412.html",
    allowedDomains: ["m.51jiaoxi.com", "www.zxxk.com", "m.zxxk.com"],
    rateLimitPerMinute: 4,
    status: "review",
    focus: ["观察物体", "句图匹配", "文本预览样本"],
    notes: "包含图片预览和纯文本预览两类来源，适合补齐多形态样本。",
    sampleCount: samples.filter((item) => item.sourceSite === "51教习网" || item.sourceSite === "学科网").length,
  },
];

let jobs: CrawlJob[] = [
  {
    id: "job-001",
    sourceId: "source-homeschoolshare",
    sourceName: "Rabbit Matching Shapes Worksheets",
    keywords: "rabbit carrot matching",
    expectedCount: 6,
    fetchedCount: 5,
    withPreviewOnly: true,
    status: "completed",
    note: "首轮验证图形连线来源。",
    createdAt: "2026-06-18T08:45:00.000Z",
    updatedAt: "2026-06-18T08:46:00.000Z",
    safetyReport: ["历史 mock 任务：用于验证平台展示。"],
  },
  {
    id: "job-002",
    sourceId: "source-21cnjy",
    sourceName: "小学试卷连线题预览",
    keywords: "数学 连线题 读时间",
    expectedCount: 12,
    fetchedCount: 10,
    withPreviewOnly: true,
    status: "completed",
    note: "优先抓可见预览图。",
    createdAt: "2026-06-18T08:47:00.000Z",
    updatedAt: "2026-06-18T08:49:00.000Z",
    safetyReport: ["历史 mock 任务：用于验证平台展示。"],
  },
  {
    id: "job-003",
    sourceId: "source-school-sites",
    sourceName: "其他公开教育站点",
    keywords: "句图匹配 观察物体",
    expectedCount: 8,
    fetchedCount: 3,
    withPreviewOnly: false,
    status: "completed",
    note: "同时收图片预览和文本预览。",
    createdAt: "2026-06-18T08:50:00.000Z",
    updatedAt: "2026-06-18T08:52:00.000Z",
    safetyReport: ["历史 mock 任务：用于验证平台展示。"],
  },
];

function overview() {
  const lastRunAt = jobs.length
    ? [...jobs].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0].updatedAt
    : new Date().toISOString();

  return {
    sourceCount: sources.length,
    activeJobCount: jobs.filter((job) => job.status === "queued" || job.status === "running").length,
    completedJobCount: jobs.filter((job) => job.status === "completed").length,
    sampleCount: samples.length,
    lastRunAt,
  };
}

function publicUser() {
  return {
    id: demoUser.id,
    name: demoUser.name,
    role: demoUser.role,
  };
}

export function getBootstrap(): PlatformBootstrap {
  return {
    user: publicUser(),
    overview: overview(),
    sources,
    jobs,
    samples,
  };
}

export function authenticate(username: string, password: string) {
  if (username !== demoUser.username || password !== demoPassword) {
    return null;
  }

  return {
    token: "vlm-platform-demo-token",
    user: publicUser(),
  };
}

export function getDemoCredentials() {
  return {
    username: demoUser.username,
    password: demoPassword,
  };
}

export async function createCrawlJob(input: CreateCrawlJobInput) {
  const source = sources.find((item) => item.id === input.sourceId);

  if (!source) {
    return null;
  }

  const now = new Date().toISOString();
  const jobId = `job-${Date.now()}`;
  const crawlResult = await runSafeCrawl({
    source,
    entryUrl: input.entryUrl || source.entryUrl,
    keywords: input.keywords,
    expectedCount: input.expectedCount,
    withPreviewOnly: input.withPreviewOnly,
    jobId,
  });

  if (crawlResult.samples.length) {
    const existingUrls = new Set(samples.map((sample) => sample.sourceUrl));
    const newSamples = crawlResult.samples.filter((sample) => !existingUrls.has(sample.sourceUrl));
    samples.unshift(...newSamples);
  }

  const job: CrawlJob = {
    id: jobId,
    sourceId: source.id,
    sourceName: source.name,
    keywords: input.keywords,
    expectedCount: input.expectedCount,
    fetchedCount: crawlResult.samples.length,
    withPreviewOnly: input.withPreviewOnly,
    status: crawlResult.error ? "failed" : "completed",
    note: input.note,
    createdAt: now,
    updatedAt: new Date().toISOString(),
    safetyReport: crawlResult.report,
    error: crawlResult.error,
  };

  jobs = [job, ...jobs];
  return job;
}
