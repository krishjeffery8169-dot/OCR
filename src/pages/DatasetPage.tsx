import { ExternalLink, Eye, EyeOff, Filter, ImageIcon, TableProperties } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePlatformStore } from "@/store/usePlatformStore";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function DatasetPage() {
  const bootstrap = usePlatformStore((state) => state.bootstrap);
  const [keyword, setKeyword] = useState("");
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);

  const filteredSamples = useMemo(() => {
    if (!bootstrap) {
      return [];
    }

    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return bootstrap.samples;
    }

    return bootstrap.samples.filter((sample) =>
      [
        sample.id,
        sample.title,
        sample.prompt,
        sample.language,
        sample.sourceSite,
        sample.category,
        sample.interference,
        sample.summary,
        ...sample.tags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [bootstrap, keyword]);

  useEffect(() => {
    if (!filteredSamples.length) {
      setActiveSampleId(null);
      return;
    }

    if (!activeSampleId || !filteredSamples.some((sample) => sample.id === activeSampleId)) {
      setActiveSampleId(filteredSamples[0].id);
    }
  }, [activeSampleId, filteredSamples]);

  if (!bootstrap) {
    return <div className="flex h-full min-h-[720px] items-center justify-center text-sm text-zinc-400">正在加载抓取结果...</div>;
  }

  const activeSample = filteredSamples.find((sample) => sample.id === activeSampleId) ?? filteredSamples[0];

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
          <div className="flex items-center gap-3">
            <TableProperties className="h-5 w-5 text-cyan-200" />
            <div>
              <p className="text-sm font-semibold text-zinc-100">抓取结果池</p>
              <p className="text-xs text-zinc-500">这里直接看已经抓到的样本，而不是旧的标注结果页</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-zinc-500">样本总数</p>
              <p className="mt-2 font-['Chakra_Petch'] text-3xl font-semibold text-zinc-50">{bootstrap.samples.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-zinc-500">带图样本</p>
              <p className="mt-2 font-['Chakra_Petch'] text-3xl font-semibold text-zinc-50">
                {bootstrap.samples.filter((sample) => Boolean(sample.previewImageUrl)).length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-zinc-500">来源站点</p>
              <p className="mt-2 font-['Chakra_Petch'] text-3xl font-semibold text-zinc-50">
                {new Set(bootstrap.samples.map((sample) => sample.sourceSite)).size}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-amber-200" />
            <div>
              <p className="text-sm font-semibold text-zinc-100">结果筛选</p>
              <p className="text-xs text-zinc-500">按关键词、来源、题型和干扰元素缩小结果范围</p>
            </div>
          </div>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="例如：胡萝卜 / 读时间 / 学科网 / 图文配对"
            className="mt-4 w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/40"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {["胡萝卜", "试卷连线题", "图文配对", "学科网", "二一教育课件站", "圆形"].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setKeyword(tag)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-['Chakra_Petch'] text-xs uppercase tracking-[0.3em] text-zinc-500">Result Table</p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-50">抓取结果明细</h2>
            </div>
            <div className="text-xs text-zinc-500">当前显示 {filteredSamples.length} 条</div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[20px] border border-white/10">
            <div className="max-h-[640px] overflow-auto">
              <table className="min-w-[1680px] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#0d1421] text-zinc-200">
                  <tr>
                    {["序号", "预览", "样本ID", "标题", "来源站点", "题目分类", "干扰元素", "抓取时间", "来源链接"].map((header) => (
                      <th key={header} className="border-b border-white/10 px-4 py-3 font-medium whitespace-nowrap">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSamples.map((sample, index) => {
                    const isActive = sample.id === activeSample?.id;

                    return (
                      <tr
                        key={sample.id}
                        onClick={() => setActiveSampleId(sample.id)}
                        className={`cursor-pointer border-b border-white/5 align-top text-zinc-300 transition ${
                          isActive ? "bg-cyan-400/10" : "bg-black/10 hover:bg-white/[0.04]"
                        }`}
                      >
                        <td className="px-4 py-3 text-zinc-500">{index + 1}</td>
                        <td className="px-4 py-3">
                          {sample.previewImageUrl ? (
                            <img src={sample.previewImageUrl} alt={sample.id} className="h-16 w-24 rounded-xl border border-white/10 object-cover" />
                          ) : (
                            <div className="flex h-16 w-24 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-xs text-zinc-500">
                              文本预览
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-100">{sample.id}</td>
                        <td className="max-w-[320px] px-4 py-3 leading-6">{sample.title}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{sample.sourceSite}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{sample.category}</td>
                        <td className="max-w-[220px] px-4 py-3">{sample.interference}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(sample.capturedAt)}</td>
                        <td className="px-4 py-3">
                          <a
                            href={sample.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1 text-cyan-200 transition hover:text-cyan-100"
                          >
                            打开
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="rounded-[24px] border border-white/10 bg-black/20 p-5">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-cyan-200" />
            <div>
              <p className="text-sm font-semibold text-zinc-100">结果预览</p>
              <p className="text-xs text-zinc-500">选中一条结果后直接看题面或文本说明</p>
            </div>
          </div>

          {activeSample ? (
            <div className="mt-5 space-y-4">
              <div className="overflow-hidden rounded-[20px] border border-white/10 bg-zinc-950">
                {activeSample.previewImageUrl ? (
                  <img src={activeSample.previewImageUrl} alt={activeSample.id} className="max-h-[420px] w-full object-contain" />
                ) : (
                  <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-zinc-500">
                    <EyeOff className="h-8 w-8" />
                    <p className="text-sm">该条结果目前只有文本预览，没有题面截图。</p>
                  </div>
                )}
              </div>

              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-['Chakra_Petch'] text-xs uppercase tracking-[0.3em] text-zinc-500">{activeSample.id}</p>
                    <h3 className="mt-2 text-base font-semibold text-zinc-100">{activeSample.title}</h3>
                  </div>
                  <ImageIcon className="h-5 w-5 text-amber-200" />
                </div>

                <p className="mt-4 text-sm leading-6 text-zinc-300">{activeSample.prompt}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeSample.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-300">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 space-y-3 text-sm text-zinc-300">
                  <p><span className="text-zinc-500">来源：</span>{activeSample.sourceSite}</p>
                  <p><span className="text-zinc-500">题型：</span>{activeSample.category}</p>
                  <p><span className="text-zinc-500">摘要：</span>{activeSample.summary}</p>
                  <p><span className="text-zinc-500">干扰元素：</span>{activeSample.interference}</p>
                  <p><span className="text-zinc-500">抓取时间：</span>{formatDate(activeSample.capturedAt)}</p>
                </div>
                <a
                  href={activeSample.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-cyan-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
                >
                  打开来源页
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
