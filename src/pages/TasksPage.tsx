import { useMemo, useState } from "react";
import { Clock3, PlayCircle, Search, ShieldCheck } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { usePlatformStore } from "@/store/usePlatformStore";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function TasksPage() {
  const bootstrap = usePlatformStore((state) => state.bootstrap);
  const createCrawlJob = usePlatformStore((state) => state.createCrawlJob);
  const [sourceId, setSourceId] = useState("");
  const [entryUrl, setEntryUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [expectedCount, setExpectedCount] = useState(3);
  const [withPreviewOnly, setWithPreviewOnly] = useState(true);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sources = bootstrap?.sources ?? [];
  const jobs = bootstrap?.jobs ?? [];
  const selectedSource = useMemo(
    () => sources.find((source) => source.id === sourceId) ?? sources[0] ?? null,
    [sourceId, sources],
  );
  const effectiveEntryUrl = entryUrl.trim() || selectedSource?.entryUrl || "";

  if (!bootstrap) {
    return <div className="flex h-full min-h-[720px] items-center justify-center text-sm text-zinc-400">正在加载爬取任务...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard label="来源数量" value={String(bootstrap.overview.sourceCount)} hint="当前白名单来源总数" />
        <MetricCard label="活跃任务" value={String(bootstrap.overview.activeJobCount)} hint="运行中或排队中的爬取任务" />
        <MetricCard label="已完成任务" value={String(bootstrap.overview.completedJobCount)} hint="已落地结果的爬取任务" />
        <MetricCard
          label="抓取样本"
          value={String(bootstrap.overview.sampleCount)}
          hint={`最后运行时间 ${formatDate(bootstrap.overview.lastRunAt)}`}
        />
      </div>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
          <div className="flex items-center gap-3">
            <PlayCircle className="h-5 w-5 text-cyan-200" />
            <div>
              <p className="text-sm font-semibold text-zinc-100">新建爬取任务</p>
              <p className="text-xs text-zinc-500">以来源、关键词和预期数量创建一轮抓取</p>
            </div>
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const activeSource = selectedSource;

              if (!activeSource) {
                return;
              }

              setSubmitting(true);
              try {
                await createCrawlJob({
                  sourceId: activeSource.id,
                  entryUrl: effectiveEntryUrl,
                  keywords,
                  expectedCount,
                  withPreviewOnly,
                  note,
                });
                setEntryUrl("");
                setKeywords("");
                setExpectedCount(3);
                setWithPreviewOnly(true);
                setNote("");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">来源站点</span>
              <select
                value={selectedSource?.id ?? ""}
                onChange={(event) => setSourceId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/40"
              >
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">入口 URL</span>
              <input
                value={entryUrl}
                onChange={(event) => setEntryUrl(event.target.value)}
                placeholder={selectedSource?.entryUrl ?? "使用来源默认入口"}
                className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/40"
              />
              <span className="text-xs text-zinc-500">留空会使用来源配置里的默认入口，填写时仍必须命中白名单域名。</span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">关键词</span>
              <input
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="例如：连线题 / 胡萝卜 / 读时间 / 句图匹配"
                className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/40"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-[0.7fr_1.3fr]">
              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">目标数量</span>
                <input
                  type="number"
                  min={1}
                  value={expectedCount}
                  onChange={(event) => setExpectedCount(Number(event.target.value) || 1)}
                  className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/40"
                />
              </label>

              <label className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={withPreviewOnly}
                  onChange={(event) => setWithPreviewOnly(event.target.checked)}
                  className="h-4 w-4 rounded border-white/10 bg-zinc-900"
                />
                只保留带题面预览图的样本
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">任务备注</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="记录本轮抓取目标，例如优先看数学试卷预览，过滤纯文本样本。"
                className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/40"
              />
            </label>

            <button
              type="submit"
              disabled={!selectedSource || submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:shadow-[0_0_30px_rgba(34,211,238,0.25)] disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              {submitting ? "正在安全爬取，可能需要十几秒..." : "创建并执行爬取"}
            </button>
          </form>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-200" />
            <div>
              <p className="text-sm font-semibold text-zinc-100">当前来源范围</p>
              <p className="text-xs text-zinc-500">只保留公开来源，不再展示旧的标注流程页面</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {sources.map((source) => (
              <article key={source.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{source.name}</p>
                    <p className="mt-2 text-xs text-zinc-500">{source.site}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                    {source.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {source.focus.map((item) => (
                    <span key={item} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-300">
                      {item}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-300">{source.notes}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-black/20 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-['Chakra_Petch'] text-xs uppercase tracking-[0.3em] text-zinc-500">Job Queue</p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-50">最近爬取任务</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Clock3 className="h-4 w-4" />
            最近一次运行 {formatDate(bootstrap.overview.lastRunAt)}
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {jobs.map((job) => (
            <article key={job.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{job.sourceName}</p>
                  <p className="mt-2 text-xs text-zinc-500">{job.id}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs ${
                  job.status === "failed"
                    ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
                    : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                }`}>
                  {job.status}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs text-zinc-500">关键词</p>
                  <p className="mt-2 text-sm text-zinc-100">{job.keywords || "未指定"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs text-zinc-500">目标数量</p>
                  <p className="mt-2 text-sm text-zinc-100">{job.expectedCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs text-zinc-500">实际抓取</p>
                  <p className="mt-2 text-sm text-zinc-100">{job.fetchedCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs text-zinc-500">预览要求</p>
                  <p className="mt-2 text-sm text-zinc-100">{job.withPreviewOnly ? "仅带图" : "图文都收"}</p>
                </div>
              </div>
              {job.error ? (
                <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                  {job.error}
                </div>
              ) : null}
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs text-zinc-500">安全执行记录</p>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-300">
                  {job.safetyReport.slice(0, 5).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-300">{job.note || "无额外备注。"}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
