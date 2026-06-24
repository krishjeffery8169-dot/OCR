export type ModelCropResult = {
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

export type ModelCropTask = {
  taskId: string;
  status: "running" | "review_required" | "done" | "failed";
  phase: "upload" | "crop" | "classify" | "export";
  progress: number;
  message: string;
  logs: string[];
  outputDir: string;
  resultDir: string;
  results: ModelCropResult[];
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: string;
};

async function readEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "请求失败");
  }
  return payload.data;
}

export async function createModelCropTask(input: {
  file: File;
  stage: string;
  subject: string;
  dimensionText: string;
  onlyImageQuestions: boolean;
  provider: "openai-compatible" | "disabled";
  baseUrl: string;
  apiKey: string;
  model: string;
  useVision: boolean;
}) {
  const formData = new FormData();
  formData.set("file", input.file);
  formData.set("stage", input.stage);
  formData.set("subject", input.subject);
  formData.set("dimensionText", input.dimensionText);
  formData.set("onlyImageQuestions", String(input.onlyImageQuestions));
  formData.set("provider", input.provider);
  formData.set("baseUrl", input.baseUrl);
  formData.set("apiKey", input.apiKey);
  formData.set("model", input.model);
  formData.set("useVision", String(input.useVision));

  const response = await fetch("/api/model-crop/tasks", {
    method: "POST",
    body: formData,
  });
  return readEnvelope<ModelCropTask>(response);
}

export async function updateModelCropQuestion(taskId: string, qid: string, input: {
  qtype: string;
  dimension: string;
  doubtful: boolean;
  reason: string;
}) {
  const response = await fetch(`/api/model-crop/tasks/${taskId}/questions/${encodeURIComponent(qid)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readEnvelope<ModelCropResult>(response);
}
