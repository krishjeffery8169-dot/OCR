import { useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, FileText, FolderOpen, Loader2, Sparkles } from "lucide-react";
import { createModelCropTask, updateModelCropQuestion, type ModelCropResult, type ModelCropTask } from "@/utils/modelCropApi";

const defaultDimensionText = `示例：
- 函数与导数题：必含函数图象或导函数图象，考察图象与性质综合。
- 几何题：立体几何、解析几何，必须带图。
- 概率统计与建模题：统计图表、真实情境建模图。
- 综合压轴题：多模块交叉，贴近高考压轴题形态。`;

function FieldLabel({ children }: { children: string }) {
  return <label className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">{children}</label>;
}

function StatusPill({ result }: { result: ModelCropResult }) {
  if (result.doubtful) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
        <AlertTriangle className="h-3.5 w-3.5" />
        待确认
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
      <CheckCircle2 className="h-3.5 w-3.5" />
      已识别
    </span>
  );
}

function ResultCard({ taskId, result, onUpdated }: { taskId: string; result: ModelCropResult; onUpdated: (item: ModelCropResult) => void }) {
  const [dimension, setDimension] = useState(result.dimension);
  const [qtype, setQtype] = useState(result.qtype);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await updateModelCropQuestion(taskId, result.qid, {
        qtype,
        dimension,
        doubtful: false,
        reason: "人工审核确认。",
      });
      onUpdated(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="grid gap-4 rounded-[24px] border border-white/10 bg-black/20 p-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-[18px] border border-white/10 bg-white">
        <img src={result.imageUrl} alt={result.imageName} className="max-h-[360px] w-full object-contain" />
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-['Chakra_Petch'] text-xs uppercase tracking-[0.3em] text-zinc-500">{result.qid}</p>
            <h3 className="mt-1 text-base font-semibold text-zinc-50">{result.imageName}</h3>
          </div>
          <StatusPill result={result} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel>题型</FieldLabel>
            <input
              value={qtype}
              onChange={(event) => setQtype(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50"
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>匹配维度</FieldLabel>
            <input
              value={dimension}
              onChange={(event) => setDimension(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
          <p className="mb-1 text-xs text-zinc-500">模型/本地判断理由</p>
          {result.reason}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">置信度 {(result.confidence * 100).toFixed(0)}%</span>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            保存修正
          </button>
        </div>
      </div>
    </article>
  );
}

export default function ModelCropPage() {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState("高中");
  const [subject, setSubject] = useState("数学");
  const [dimensionText, setDimensionText] = useState(defaultDimensionText);
  const [onlyImageQuestions, setOnlyImageQuestions] = useState(true);
  const [provider, setProvider] = useState<"openai-compatible" | "disabled">("disabled");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [useVision, setUseVision] = useState(true);
  const [task, setTask] = useState<ModelCropTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    if (!task) return null;
    const doubtful = task.results.filter((item) => item.doubtful).length;
    return { total: task.results.length, doubtful, ok: task.results.length - doubtful };
  }, [task]);

  async function submit() {
    if (!file) {
      setError("请先选择 Word/PDF 文件。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const nextTask = await createModelCropTask({
        file,
        stage,
        subject,
        dimensionText,
        onlyImageQuestions,
        provider,
        baseUrl,
        apiKey,
        model,
        useVision,
      });
      setTask(nextTask);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function replaceResult(updated: ModelCropResult) {
    setTask((current) => {
      if (!current) return current;
      return {
        ...current,
        results: current.results.map((item) => (item.qid === updated.qid ? updated : item)),
      };
    });
  }

  return (
    <div className="mx-auto min-h-screen max-w-[1500px] space-y-5 px-5 py-6 text-zinc-50">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#f8f5ef] text-zinc-950">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-zinc-950 p-3 text-emerald-200">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div>
                <p className="font-['Chakra_Petch'] text-xs uppercase tracking-[0.35em] text-emerald-700">Model Crop Desk</p>
                <h2 className="text-2xl font-semibold">模型理解题库截取</h2>
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-zinc-600">
              每次粘贴新的维度说明，工具先裁切题目图片，再把题图和维度说明交给模型判断。没有模型配置时仍可完成截图，分类会统一进入待确认。
            </p>
          </div>
          <div className="border-t border-zinc-900/10 bg-zinc-950 p-7 text-zinc-100 lg:border-l lg:border-t-0">
            <p className="text-sm text-zinc-400">默认输出</p>
            <p className="mt-2 break-all font-mono text-xs text-emerald-200">Documents/题库分类结果</p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-lg font-semibold">{summary?.total ?? 0}</p>
                <p className="text-xs text-zinc-500">题目</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-lg font-semibold text-emerald-200">{summary?.ok ?? 0}</p>
                <p className="text-xs text-zinc-500">已识别</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-lg font-semibold text-amber-200">{summary?.doubtful ?? 0}</p>
                <p className="text-xs text-zinc-500">待确认</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="space-y-2">
            <FieldLabel>源文件</FieldLabel>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-[22px] border border-dashed border-cyan-200/30 bg-black/20 px-4 py-8 text-center transition hover:border-cyan-200/60 hover:bg-cyan-200/5">
              <FileText className="mb-3 h-8 w-8 text-cyan-200" />
              <span className="text-sm font-medium text-zinc-100">{file?.name ?? "选择 Word / PDF 文件"}</span>
              <span className="mt-1 text-xs text-zinc-500">当前优先支持 docx</span>
              <input
                type="file"
                accept=".docx,.pdf"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <FieldLabel>学段</FieldLabel>
              <input value={stage} onChange={(event) => setStage(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50" />
            </div>
            <div className="space-y-2">
              <FieldLabel>学科</FieldLabel>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50" />
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel>本批次维度说明</FieldLabel>
            <textarea
              value={dimensionText}
              onChange={(event) => setDimensionText(event.target.value)}
              className="min-h-[220px] w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm leading-6 text-white outline-none focus:border-cyan-300/50"
            />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-200">
            <input type="checkbox" checked={onlyImageQuestions} onChange={(event) => setOnlyImageQuestions(event.target.checked)} />
            只截取带图片的题目
          </label>
        </div>

        <div className="space-y-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-emerald-200" />
            <div>
              <h3 className="text-base font-semibold">模型配置</h3>
              <p className="text-xs text-zinc-500">不填写也能截题，但分类会进入待确认。</p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel>模式</FieldLabel>
              <select value={provider} onChange={(event) => setProvider(event.target.value as "openai-compatible" | "disabled")} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50">
                <option value="disabled">先不接模型</option>
                <option value="openai-compatible">OpenAI-compatible</option>
              </select>
            </div>
            <div className="space-y-2">
              <FieldLabel>模型名</FieldLabel>
              <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="例如 gpt-4o / doubao-vision" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50" />
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel>接口地址</FieldLabel>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://.../v1" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50" />
          </div>

          <div className="space-y-2">
            <FieldLabel>API Key</FieldLabel>
            <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} type="password" placeholder="只用于本次请求，不写入导出包" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50" />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-200">
            <input type="checkbox" checked={useVision} onChange={(event) => setUseVision(event.target.checked)} />
            把题图一起发给支持视觉的模型
          </label>

          {error ? <div className="rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-100">{error}</div> : null}

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-5 py-4 text-sm font-bold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <BrainCircuit className="h-5 w-5" />}
            {loading ? "正在截题和分类..." : "开始处理"}
          </button>

          {task ? (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">{task.message}</span>
                <span className="font-mono text-emerald-200">{task.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-emerald-300" style={{ width: `${task.progress}%` }} />
              </div>
              <div className="max-h-36 overflow-auto rounded-xl bg-zinc-950/70 p-3 font-mono text-xs leading-5 text-zinc-400">
                {task.logs.map((line) => <div key={line}>{line}</div>)}
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <FolderOpen className="h-4 w-4" />
                <span className="break-all">{task.resultDir || task.outputDir}</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {task?.results.length ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">结果审核</h3>
            <p className="text-sm text-zinc-500">逐题检查模型判断，错误项可直接修正。</p>
          </div>
          {task.results.map((result) => (
            <ResultCard key={result.qid + result.imageName} taskId={task.taskId} result={result} onUpdated={replaceResult} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
