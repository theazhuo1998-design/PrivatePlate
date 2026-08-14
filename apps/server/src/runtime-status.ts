import type { RuntimeConfig } from "./runtime-config.js";

export const RUNTIME_STATUS_SCHEMA = "1.3";

export type DatabaseStorageClass = "memory" | "local_sqlite_file";

export type WebRuntimeStatus = {
  schemaVersion: typeof RUNTIME_STATUS_SCHEMA;
  providerMode: "local_vllm";
  appMode: "demo" | "production";
  agentKind: "model_agent" | "scripted_mock";
  modelReady: boolean;
  modelDetail: string;
  operable: boolean;
  ragReady: boolean;
  rag: {
    ready: boolean;
    mode: "vllm_embedding" | "hash_offline";
    embeddingModel: string;
    embeddingDims: number;
    retrievalVersion: string;
    tool: "retrieve_local_knowledge";
    corpus: string;
    note: string;
  };
  cameraSource: "current_browser";
  microphoneSource: "current_browser";
  databaseStorageClass: DatabaseStorageClass;
  remoteApi: false;
  capabilityBoundary: string;
  llm: {
    mode: string;
    model: string | null;
    ready: boolean;
    commitToolsRegistered: false;
  };
  householdId: string;
  sessionId: string;
  agentPhase: string;
  activePlanId: string | null;
  activePlanVersion: number | null;
  dinerIds: string[];
};

export function databaseStorageClass(
  databasePath: string
): DatabaseStorageClass {
  return databasePath === ":memory:" ? "memory" : "local_sqlite_file";
}

export function capabilityBoundaryText(input: {
  scriptedMock: boolean;
  storageClass: DatabaseStorageClass;
}): string {
  const model = input.scriptedMock
    ? "当前为测试用脚本化模型，不能当作真实推理质量证据。"
    : "推理只接受本机 loopback 上的 OpenAI 兼容接口，不会调用第三方托管模型 API。";
  const storage =
    input.storageClass === "memory"
      ? "当前数据库为进程内内存。"
      : "当前数据库为本地 SQLite 文件。";
  return (
    `${model}${storage}` +
    "9 个预览优先工具；确认后才写入。" +
    "相机和麦克风来自当前浏览器。" +
    "未接入冰箱门控、温度、唤醒词或真实家电 API；任务不会发到外部消息渠道。"
  );
}

export async function probeOpenAiCompatible(
  baseUrl: string | null
): Promise<{ ready: boolean; detail: string }> {
  if (!baseUrl) {
    return { ready: false, detail: "missing loopback model URL" };
  }
  const modelsUrl = `${baseUrl.replace(/\/$/, "")}/models`;
  try {
    const response = await fetch(modelsUrl, {
      signal: AbortSignal.timeout(2_500)
    });
    if (!response.ok) {
      return {
        ready: false,
        detail: `${modelsUrl} → HTTP ${response.status}`
      };
    }
    return { ready: true, detail: `${modelsUrl} ok` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ready: false, detail: `${modelsUrl} → ${message}` };
  }
}

export async function buildWebRuntimeStatus(input: {
  config: RuntimeConfig;
  householdId: string;
  sessionId: string;
  agentPhase: string;
  activePlanId: string | null;
  activePlanVersion: number | null;
  dinerIds: string[];
  embedding: {
    kind: "vllm" | "hash";
    modelId: string;
    dimensions: number;
    baseUrl: string | null;
  };
}): Promise<WebRuntimeStatus> {
  const providerMode = input.config.provider.mode;
  const isScriptedMock = providerMode === "scripted_mock";
  const storageClass = databaseStorageClass(input.config.databasePath);
  const ragConfigured = input.embedding.kind === "vllm";
  const [modelProbe, ragProbe] = await Promise.all([
    isScriptedMock
      ? {
          ready: true,
          detail: "scripted_mock provider (offline tests only)"
        }
      : probeOpenAiCompatible(input.config.baseUrl),
    ragConfigured
      ? probeOpenAiCompatible(input.embedding.baseUrl)
      : {
          ready: false,
          detail: "hash embedding only — not product RAG"
        }
  ]);
  const ragReady = ragConfigured && ragProbe.ready;

  return {
    schemaVersion: RUNTIME_STATUS_SCHEMA,
    providerMode: input.config.providerMode,
    appMode: input.config.appMode,
    agentKind: isScriptedMock ? "scripted_mock" : "model_agent",
    modelReady: modelProbe.ready,
    modelDetail: modelProbe.detail,
    operable: modelProbe.ready,
    ragReady,
    rag: {
      ready: ragReady,
      mode: ragConfigured ? "vllm_embedding" : "hash_offline",
      embeddingModel: input.embedding.modelId,
      embeddingDims: input.embedding.dimensions,
      retrievalVersion: "rag-embedding-local-1.0.0",
      tool: "retrieve_local_knowledge",
      corpus: "fixtures/knowledge/corpus",
      note: ragReady
        ? "Local embedding RAG via loopback OpenAI-compatible /v1/embeddings."
        : ragConfigured
          ? `Embedding server not reachable: ${ragProbe.detail}. Start a loopback embedding model on :8001.`
          : "Hash embedding only — set PRIVATEPLATE_RAG_MODE=vllm and start a loopback embedding model on :8001 for real RAG."
    },
    cameraSource: "current_browser",
    microphoneSource: "current_browser",
    databaseStorageClass: storageClass,
    remoteApi: false,
    capabilityBoundary: capabilityBoundaryText({
      scriptedMock: isScriptedMock,
      storageClass
    }),
    llm: {
      mode: providerMode,
      model: input.config.model,
      ready: modelProbe.ready,
      commitToolsRegistered: false
    },
    householdId: input.householdId,
    sessionId: input.sessionId,
    agentPhase: input.agentPhase,
    activePlanId: input.activePlanId,
    activePlanVersion: input.activePlanVersion,
    dinerIds: input.dinerIds
  };
}
