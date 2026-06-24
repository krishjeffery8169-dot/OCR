import { Activity, Gauge, Globe2, ShieldCheck } from "lucide-react";
import { usePlatformStore } from "@/store/usePlatformStore";

export default function SystemPage() {
  const bootstrap = usePlatformStore((state) => state.bootstrap);

  if (!bootstrap) {
    return <div className="flex h-full min-h-[720px] items-center justify-center text-sm text-zinc-400">正在加载来源配置...</div>;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[24px] border border-white/10 bg-black/20 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-['Chakra_Petch'] text-xs uppercase tracking-[0.3em] text-zinc-500">Source Registry</p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-50">来源配置</h2>
          </div>
          <Globe2 className="h-5 w-5 text-cyan-200" />
        </div>

        <div className="mt-4 space-y-3">
          {bootstrap.sources.map((source) => (
            <article key={source.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{source.name}</p>
                  <p className="mt-2 text-xs text-zinc-500">{source.site}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                  {source.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Gauge className="h-4 w-4" />
                    频控策略
                  </div>
                  <p className="mt-2 text-sm text-zinc-100">{source.rateLimitPerMinute} req/min</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Activity className="h-4 w-4" />
                    样本量
                  </div>
                  <p className="mt-2 text-sm text-zinc-100">{source.sampleCount} 条</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs text-zinc-500">入口地址</p>
                <p className="mt-2 break-all text-sm text-zinc-100">{source.entryUrl}</p>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs text-zinc-500">允许域名</p>
                <p className="mt-2 text-sm text-zinc-100">{source.allowedDomains.join(", ")}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {source.focus.map((item) => (
                  <span key={item} className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                    {item}
                  </span>
                ))}
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-300">{source.notes}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-200" />
            <div>
              <p className="text-sm font-semibold text-zinc-100">当前约束</p>
              <p className="text-xs text-zinc-500">收口成爬取平台后，界面只保留来源和结果相关配置</p>
            </div>
          </div>

          <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
            <li>仅保留公开来源与白名单域名，不提供绕过限制、规避风控或模拟真人行为。</li>
            <li>结果页直接查看已抓到的样本，旧的草稿、提交、模板流程已移出主界面。</li>
            <li>本地存档写入 `archive/20260618-pre-crawl-platform.md`，方便回看旧版范围。</li>
          </ul>
        </div>

        <div className="rounded-[24px] border border-cyan-300/10 bg-cyan-300/5 p-5">
          <p className="font-['Chakra_Petch'] text-xs uppercase tracking-[0.3em] text-cyan-100/80">Current Scope</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-cyan-100/90">
            <li>创建一轮爬取任务</li>
            <li>查看来源配置与入口地址</li>
            <li>查看已抓到的结果样本和题面预览</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
