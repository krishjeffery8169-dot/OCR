import { create } from "zustand";
import type { CrawlJob, CreateCrawlJobInput, PlatformBootstrap } from "@/types/platform";
import * as platformApi from "@/utils/platformApi";

type PlatformState = {
  token: string | null;
  userName: string | null;
  bootstrap: PlatformBootstrap | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadBootstrap: () => Promise<void>;
  createCrawlJob: (input: CreateCrawlJobInput) => Promise<CrawlJob>;
};

function mergeJob(bootstrap: PlatformBootstrap, job: CrawlJob): PlatformBootstrap {
  return {
    ...bootstrap,
    overview: {
      sourceCount: bootstrap.sources.length,
      activeJobCount: bootstrap.jobs.filter((item) => item.status === "queued" || item.status === "running").length,
      completedJobCount: [...bootstrap.jobs, job].filter((item) => item.status === "completed").length,
      sampleCount: bootstrap.samples.length,
      lastRunAt: job.updatedAt,
    },
    jobs: [job, ...bootstrap.jobs],
  };
}

export const usePlatformStore = create<PlatformState>((set, get) => ({
  token: null,
  userName: null,
  bootstrap: null,
  loading: false,
  error: null,
  initialized: false,
  login: async (username, password) => {
    set({ loading: true, error: null });

    try {
      const result = await platformApi.login(username, password);
      set({
        token: result.token,
        userName: result.user.name,
        loading: false,
      });
      await get().loadBootstrap();
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "登录失败",
      });
      throw error;
    }
  },
  logout: () => {
    set({
      token: null,
      userName: null,
      bootstrap: null,
      initialized: false,
      error: null,
    });
  },
  loadBootstrap: async () => {
    set({ loading: true, error: null });

    try {
      const bootstrap = await platformApi.getBootstrap();
      set({
        bootstrap,
        initialized: true,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "数据加载失败",
      });
      throw error;
    }
  },
  createCrawlJob: async (input) => {
    const job = await platformApi.createCrawlJob(input);
    const { bootstrap } = get();

    if (bootstrap) {
      set({
        bootstrap: mergeJob(bootstrap, job),
      });
    }

    await get().loadBootstrap();
    return job;
  },
}));
