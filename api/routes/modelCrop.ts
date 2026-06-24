import { Router, type Request, type Response } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const execFileAsync = promisify(execFile);
const router = Router();
const uploadLimitMb = Number(process.env.MODEL_CROP_UPLOAD_LIMIT_MB || 80);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: uploadLimitMb * 1024 * 1024 } });

type ModelProvider = "openai-compatible" | "disabled";

type QuestionResult = {
  qid: string;
  imageName: string;
  imageUrl: string;
  text: string;
  stage: string;
  subject: string;
  qtype: string;
  dimension: string;
  confidence: number;
  doubtful: boolean;
  reason: string;
};

type ModelTask = {
  taskId: string;
  status: "running" | "review_required" | "done" | "failed";
  phase: "upload" | "crop" | "classify" | "export";
  progress: number;
  message: string;
  logs: string[];
  outputDir: string;
  resultDir: string;
  results: QuestionResult[];
};

const runtimeRoot = process.env.MODEL_CROP_RUNTIME_ROOT || path.join(process.cwd(), ".runtime", "model-crop");
const tasks = new Map<string, ModelTask>();

function pushLog(task: ModelTask, message: string) {
  task.logs.push(`[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${message}`);
  task.message = message;
}

function safeSegment(value: string) {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, "_").slice(0, 80) || "未命名";
}

function getDesktopScriptPath() {
  const desktop = path.join(os.homedir(), "Desktop");
  const candidates = [
    process.env.CROP_SCRIPT_PATH,
    path.join(process.cwd(), "scripts", "docx_wordml_crop_generic.ps1"),
    path.join(desktop, "截取工具", "scripts", "docx_wordml_crop_generic.ps1"),
    path.join(desktop, "截取工具_可发送版", "scripts", "crop.ps1"),
    path.join(process.cwd(), "docx_wordml_crop_physics.ps1"),
  ].filter(Boolean) as string[];
  return candidates;
}

async function findScriptPath() {
  for (const candidate of getDesktopScriptPath()) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // continue
    }
  }
  throw new Error("未找到截题脚本，请确认桌面截取工具存在。");
}

function parseDimensionCandidates(text: string) {
  const candidates = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine
      .trim()
      .replace(/^[-*•\d.、\s]+/, "")
      .replace(/^#+\s*/, "");
    if (!line || line.length < 2) continue;
    if (/^(小学|初中|高中|数学|语文|英语|物理|化学|生物|地理|历史|政治)$/.test(line)) continue;
    const name = line.split(/[：:]/)[0].trim();
    if (name && name.length <= 32 && !/每题|必须|按模块|这是/.test(name)) {
      candidates.add(name);
    }
  }
  return Array.from(candidates);
}

function inferQtype(fileName: string) {
  if (fileName.includes("_选择")) return "选择";
  if (fileName.includes("_填空")) return "填空";
  if (fileName.includes("_解答")) return "解答";
  return "待确认";
}

function localClassify(fileName: string, questionText: string, dimensionText: string, candidates: string[]) {
  const haystack = `${fileName}\n${questionText}\n${dimensionText}`;
  let best = "待确认";
  let bestScore = 0;
  for (const candidate of candidates) {
    let score = 0;
    for (const token of candidate.split(/[\/、,，;；_\s]+/)) {
      if (token && haystack.includes(token)) score += token.length;
    }
    if (haystack.includes(candidate)) score += 10;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return {
    qtype: inferQtype(fileName),
    dimension: bestScore > 0 ? best : "待确认",
    confidence: bestScore > 0 ? 0.45 : 0,
    doubtful: true,
    reason: bestScore > 0 ? "未配置模型，使用本地弱匹配，建议人工复核。" : "未配置模型或无法明确匹配，需人工确认。",
  };
}

async function callModel(params: {
  provider: ModelProvider;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  useVision: boolean;
  imagePath: string;
  fileName: string;
  questionText: string;
  stage: string;
  subject: string;
  dimensionText: string;
  candidates: string[];
}) {
  const apiKey = params.apiKey || process.env.OPENROUTER_API_KEY || process.env.MODEL_CROP_API_KEY;
  if (params.provider !== "openai-compatible" || !params.baseUrl || !apiKey || !params.model) {
    return null;
  }

  const imageBase64 = params.useVision ? await fs.readFile(params.imagePath, "base64") : "";
  const prompt = [
    "你是教育题库维度标注助手。你的任务是根据题图和题面文字识别题型，并从用户给定维度说明中选择最匹配的维度。",
    "题图和题面文字是主要依据；文件名只能作为辅助信息，不能因为文件名或旧规则直接决定维度。",
    "如果题图包含几何字母、函数符号、英文变量、A1B1C1、f(x) 等数学符号，必须把它们作为题目条件理解。",
    "只能从用户给定维度说明中选择最匹配的维度，不允许自造维度。",
    "如果无法明确判断，dimension 必须返回“待确认”，doubtful 返回 true。",
    "qtype 必须根据题目形态判断：有 A/B/C/D 选项的是选择；有空格/括号待填的是填空；有(1)(2)(3)步骤或要求求证/计算过程的是解答。",
    "请只返回 JSON，不要输出解释性段落。",
    `学段：${params.stage}`,
    `学科：${params.subject}`,
    `文件名：${params.fileName}`,
    `题面文字：\n${params.questionText || "未提取到题面文字，请优先看题图判断。"}`,
    `候选维度：${params.candidates.join(" | ") || "未解析到候选维度"}`,
    `维度说明：\n${params.dimensionText}`,
    'JSON Schema：{"qtype":"选择|填空|解答|待确认","dimension":"候选维度或待确认","confidence":0到1,"doubtful":true或false,"reason":"一句话理由"}',
  ].join("\n\n");

  const content = params.useVision
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
      ]
    : prompt;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (params.baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "http://localhost:3001/model-crop";
    headers["X-Title"] = "Model Crop Tool";
  }

  const response = await fetch(`${params.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: params.model,
      temperature: 0,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    throw new Error(`模型接口失败：${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  const jsonText = raw.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
  const parsed = JSON.parse(jsonText) as Partial<Pick<QuestionResult, "qtype" | "dimension" | "confidence" | "doubtful" | "reason">>;
  const dimension = params.candidates.includes(parsed.dimension ?? "") ? parsed.dimension ?? "待确认" : "待确认";
  const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0;
  return {
    qtype: parsed.qtype || "待确认",
    dimension,
    confidence,
    doubtful: Boolean(parsed.doubtful) || dimension === "待确认" || confidence < 0.65,
    reason: parsed.reason || "模型未给出理由。",
  };
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];
    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  if (current || row.length) {
    row.push(current);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildResultsCsv(results: QuestionResult[]) {
  const headers = ["题号", "图片名", "学段", "学科", "题型", "匹配维度", "置信度", "待确认", "模型/人工理由", "题面文本"];
  const rows = results.map((item) => [
    item.qid,
    item.imageName,
    item.stage,
    item.subject,
    item.qtype,
    item.dimension,
    item.confidence,
    item.doubtful ? "是" : "否",
    item.reason,
    item.text,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

async function runTask(task: ModelTask, input: {
  file: Express.Multer.File;
  stage: string;
  subject: string;
  dimensionText: string;
  onlyImageQuestions: boolean;
  provider: ModelProvider;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  useVision: boolean;
}) {
  try {
    await fs.mkdir(task.outputDir, { recursive: true });
    const sourceDir = path.join(task.outputDir, "source");
    await fs.mkdir(sourceDir, { recursive: true });
    const sourcePath = path.join(sourceDir, input.file.originalname);
    await fs.writeFile(sourcePath, input.file.buffer);

    task.phase = "crop";
    task.progress = 15;
    pushLog(task, "源文件已保存，开始调用截题脚本。");

    const scriptPath = await findScriptPath();
    const configPath = path.join(task.outputDir, "task.config.json");
    const candidates = parseDimensionCandidates(input.dimensionText);
    const config = {
      sourceDocx: sourcePath,
      outRoot: path.join(task.outputDir, "result"),
      stage: input.stage,
      subject: input.subject,
      skipQuestionBeforeParagraph: 10,
      screenshotTimeoutMs: 30000,
      autoDetectImageQuestions: true,
      onlyImageQuestions: input.onlyImageQuestions,
      groupSharedMaterial: false,
      defaultType: `${input.subject}图像题`,
      defaultQtype: "选择_填空_解答",
      defaultKnowledgePoint: candidates.join("|") || "待确认",
      defaultKnowledgeMap: {
        选择: candidates.join("|") || "待确认",
        填空: candidates.join("|") || "待确认",
        解答: candidates.join("|") || "待确认",
      },
      defaultDoubtful: false,
      items: {},
    };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

    const powershellExe = process.env.POWERSHELL_EXE || "powershell.exe";
    const { stdout, stderr } = await execFileAsync(powershellExe, [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-ConfigPath",
      configPath,
    ], { maxBuffer: 1024 * 1024 * 20 });
    if (stdout.trim()) pushLog(task, stdout.trim());
    if (stderr.trim()) pushLog(task, stderr.trim());

    task.phase = "classify";
    task.progress = 70;
    pushLog(task, "截图完成，开始生成模型分类结果。");

    const resultDir = path.join(task.outputDir, "result", input.stage, input.subject);
    task.resultDir = resultDir;
    const imageDir = path.join(resultDir, "image");
    const files = (await fs.readdir(imageDir)).filter((name) => name.toLowerCase().endsWith(".png"));
    const manifestPath = path.join(resultDir, "manifest_简化维度.csv");
    let manifestRows: Record<string, string>[] = [];
    try {
      const csv = await fs.readFile(manifestPath, "utf8");
      const [headers = [], ...rows] = parseCsvRows(csv);
      manifestRows = rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
    } catch {
      manifestRows = [];
    }

    const results: QuestionResult[] = [];
    for (const fileName of files) {
      const row = manifestRows.find((item) => item["图片文件名"] === fileName);
      const qid = row?.["题号"] || fileName.split("_")[0] || "Q";
      const questionText = row?.["题面文本"] || "";
      const imagePath = path.join(imageDir, fileName);
      let classified = localClassify(fileName, questionText, input.dimensionText, candidates);
      try {
        const modelResult = await callModel({
          provider: input.provider,
          baseUrl: input.baseUrl,
          apiKey: input.apiKey,
          model: input.model,
          useVision: input.useVision,
          imagePath,
          fileName,
          questionText,
          stage: input.stage,
          subject: input.subject,
          dimensionText: input.dimensionText,
          candidates,
        });
        if (modelResult) classified = modelResult;
      } catch (error) {
        classified = {
          ...classified,
          reason: `模型调用失败，已转待确认：${error instanceof Error ? error.message : String(error)}`,
          doubtful: true,
          confidence: 0,
          dimension: "待确认",
        };
      }

      results.push({
        qid,
        imageName: fileName,
        imageUrl: `/api/model-crop/tasks/${task.taskId}/images/${encodeURIComponent(fileName)}`,
        text: questionText,
        stage: input.stage,
        subject: input.subject,
        ...classified,
      });
    }

    task.phase = "export";
    task.progress = 90;
    task.results = results;
    await fs.writeFile(path.join(task.outputDir, "model-results.json"), JSON.stringify(results, null, 2), "utf8");
    task.status = "review_required";
    task.progress = 100;
    pushLog(task, `处理完成，共生成 ${results.length} 道题，待人工审核。`);
  } catch (error) {
    task.status = "failed";
    task.progress = 100;
    pushLog(task, error instanceof Error ? error.message : String(error));
  }
}

router.post("/tasks", upload.single("file"), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ success: false, error: "请上传 Word 或 PDF 文件。" });
    return;
  }
  const taskId = `task_${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}_${randomUUID().slice(0, 8)}`;
  const stage = String(req.body.stage || "高中");
  const subject = String(req.body.subject || "数学");
  const outputDir = path.join(runtimeRoot, taskId);
  const task: ModelTask = {
    taskId,
    status: "running",
    phase: "upload",
    progress: 5,
    message: "任务已创建。",
    logs: [],
    outputDir,
    resultDir: "",
    results: [],
  };
  tasks.set(taskId, task);
  pushLog(task, "任务已创建。");

  await runTask(task, {
    file: req.file,
    stage,
    subject,
    dimensionText: String(req.body.dimensionText || ""),
    onlyImageQuestions: String(req.body.onlyImageQuestions) !== "false",
    provider: String(req.body.provider || "disabled") as ModelProvider,
    baseUrl: req.body.baseUrl ? String(req.body.baseUrl) : undefined,
    apiKey: req.body.apiKey ? String(req.body.apiKey) : undefined,
    model: req.body.model ? String(req.body.model) : undefined,
    useVision: String(req.body.useVision) === "true",
  });

  res.status(task.status === "failed" ? 500 : 200).json({ success: task.status !== "failed", data: task, error: task.status === "failed" ? task.message : undefined });
});

router.get("/tasks/:taskId", (req: Request, res: Response): void => {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    res.status(404).json({ success: false, error: "任务不存在或服务已重启。" });
    return;
  }
  res.status(200).json({ success: true, data: task });
});

router.get("/tasks/:taskId/images/:fileName", async (req: Request, res: Response): Promise<void> => {
  const task = tasks.get(req.params.taskId);
  if (!task || !task.resultDir) {
    res.status(404).json({ success: false, error: "图片不存在。" });
    return;
  }
  const fileName = path.basename(req.params.fileName);
  const imagePath = path.join(task.resultDir, "image", fileName);
  res.sendFile(imagePath);
});

router.get("/tasks/:taskId/export.csv", (req: Request, res: Response): void => {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    res.status(404).json({ success: false, error: "任务不存在或服务已重启。" });
    return;
  }
  const csv = buildResultsCsv(task.results);
  const fileName = encodeURIComponent(`${task.taskId}_模型截题结果.csv`);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${fileName}`);
  res.send(`\uFEFF${csv}`);
});

router.patch("/tasks/:taskId/questions/:qid", expressJsonPatchHandler);

async function expressJsonPatchHandler(req: Request, res: Response): Promise<void> {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    res.status(404).json({ success: false, error: "任务不存在。" });
    return;
  }
  const item = task.results.find((result) => result.qid === req.params.qid);
  if (!item) {
    res.status(404).json({ success: false, error: "题目不存在。" });
    return;
  }
  item.qtype = String(req.body.qtype || item.qtype);
  item.dimension = String(req.body.dimension || item.dimension);
  item.doubtful = Boolean(req.body.doubtful);
  item.reason = String(req.body.reason || item.reason);
  await fs.writeFile(path.join(task.outputDir, "model-results.json"), JSON.stringify(task.results, null, 2), "utf8");
  res.status(200).json({ success: true, data: item });
}

export default router;
