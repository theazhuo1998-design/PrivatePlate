import type { RuntimeStatus } from "./api";

export const MODEL_READY_LABEL = "可以安排本餐";
export const MODEL_OFFLINE_LABEL = "模型未连接";
export const MODEL_OFFLINE_RECOVERY =
  "模型未连接。可以继续看对话，暂不能安排或确认写入。请在本机 127.0.0.1:8000 启动 OpenAI 兼容模型或 vLLM，然后刷新。";

export function appModeLabel(appMode: string | null | undefined): string {
  return appMode === "production" ? "评审模式" : "本地演示";
}

export function storageClassLabel(
  storageClass: string | null | undefined
): string {
  if (!storageClass) return "正在读取";
  return storageClass === "memory" ? "内存数据库" : "本地 SQLite 文件";
}

export function modelStatusLabel(runtime: RuntimeStatus | null): {
  state: string;
  detail: string;
  ready: boolean;
} {
  if (!runtime) {
    return { state: "正在读取", detail: "尚未拿到模型状态", ready: false };
  }
  if (runtime.modelReady === true || runtime.operable === true) {
    return {
      state: MODEL_READY_LABEL,
      detail: runtime.llm?.model ?? "OpenAI 兼容模型",
      ready: true
    };
  }
  return {
    state: MODEL_OFFLINE_LABEL,
    detail: "本机 loopback 上没有可用的 OpenAI 兼容模型",
    ready: false
  };
}

export function ragStatusLabel(runtime: RuntimeStatus | null): {
  state: string;
  detail: string;
  ready: boolean;
} {
  if (!runtime) {
    return { state: "正在读取", detail: "尚未拿到检索状态", ready: false };
  }
  if (runtime.ragReady) {
    return {
      state: "已就绪",
      detail: runtime.rag?.embeddingModel ?? "本地 embedding",
      ready: true
    };
  }
  if (runtime.rag?.mode === "hash_offline") {
    return {
      state: "哈希检索（测试）",
      detail: "不是本地 embedding RAG",
      ready: false
    };
  }
  return {
    state: "未就绪",
    detail: "请在本机 127.0.0.1:8001 启动 embedding 模型",
    ready: false
  };
}
