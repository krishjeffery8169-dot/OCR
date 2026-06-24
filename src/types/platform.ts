export type PlatformUser = {
  id: string;
  name: string;
  role: "operator";
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

export type CrawlJobStatus = "queued" | "running" | "completed" | "failed";

export type CrawlJob = {
  id: string;
  sourceId: string;
  sourceName: string;
  keywords: string;
  expectedCount: number;
  fetchedCount: number;
  withPreviewOnly: boolean;
  status: CrawlJobStatus;
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

export type CrawlOverview = {
  sourceCount: number;
  activeJobCount: number;
  completedJobCount: number;
  sampleCount: number;
  lastRunAt: string;
};

export type PlatformBootstrap = {
  user: PlatformUser;
  overview: CrawlOverview;
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

export type LoginResult = {
  token: string;
  user: PlatformUser;
};
