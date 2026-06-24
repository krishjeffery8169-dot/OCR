import type { CreateCrawlJobInput, CrawlJob, LoginResult, PlatformBootstrap } from "@/types/platform";

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: string;
};

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "请求失败");
  }

  return payload.data;
}

export function login(username: string, password: string) {
  return request<LoginResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getDemoCredentials() {
  return request<{ username: string; password: string }>("/api/auth/demo-credentials");
}

export function getBootstrap() {
  return request<PlatformBootstrap>("/api/platform/bootstrap");
}

export function createCrawlJob(input: CreateCrawlJobInput) {
  return request<CrawlJob>("/api/platform/crawl/jobs", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
