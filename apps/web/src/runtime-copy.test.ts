import { describe, expect, it } from "vitest";
import type { RuntimeStatus } from "./api";
import {
  MODEL_OFFLINE_LABEL,
  MODEL_OFFLINE_RECOVERY,
  MODEL_READY_LABEL,
  appModeLabel,
  modelStatusLabel,
  ragStatusLabel,
  storageClassLabel
} from "./runtime-copy";

function runtime(overrides: Partial<RuntimeStatus> = {}): RuntimeStatus {
  return {
    providerMode: "local_vllm",
    appMode: "demo",
    agentKind: "model_agent",
    modelReady: false,
    operable: false,
    ragReady: false,
    remoteApi: false,
    householdId: "hh-demo-001",
    sessionId: "sess-1",
    agentPhase: "IDLE",
    activePlanId: null,
    activePlanVersion: null,
    dinerIds: [],
    llm: {
      mode: "local_vllm",
      model: null,
      ready: false,
      commitToolsRegistered: false
    },
    ...overrides
  };
}

describe("runtime status mapping", () => {
  it("does not claim 已连接 when the model is down", () => {
    const label = modelStatusLabel(runtime({ modelReady: false, operable: false }));
    expect(label.ready).toBe(false);
    expect(label.state).toBe(MODEL_OFFLINE_LABEL);
    expect(label.state).not.toMatch(/已连接/);
    expect(MODEL_OFFLINE_RECOVERY).toMatch(/模型未连接/);
    expect(MODEL_OFFLINE_RECOVERY).not.toMatch(/已连接/);
  });

  it("uses 可以安排本餐 only when modelReady or operable is true", () => {
    expect(modelStatusLabel(runtime({ modelReady: true })).state).toBe(
      MODEL_READY_LABEL
    );
    expect(modelStatusLabel(runtime({ operable: true })).ready).toBe(true);
    expect(modelStatusLabel(null).ready).toBe(false);
    expect(modelStatusLabel(null).state).toBe("正在读取");
  });

  it("maps storage and app mode without infrastructure-specific copy", () => {
    expect(appModeLabel("production")).toBe("评审模式");
    expect(appModeLabel("demo")).toBe("本地演示");
    expect(storageClassLabel("memory")).toBe("内存数据库");
    expect(storageClassLabel("local_sqlite_file")).toBe("本地 SQLite 文件");
    expect(storageClassLabel(undefined)).toBe("正在读取");
    const blob = [
      MODEL_READY_LABEL,
      MODEL_OFFLINE_LABEL,
      MODEL_OFFLINE_RECOVERY,
      appModeLabel("production"),
      storageClassLabel("local_sqlite_file")
    ].join(" ");
  });

  it("maps RAG hash_offline as a test fallback, not ready embedding", () => {
    const hash = ragStatusLabel(
      runtime({
        ragReady: false,
        rag: { ready: false, mode: "hash_offline" }
      })
    );
    expect(hash.ready).toBe(false);
    expect(hash.state).toBe("哈希检索（测试）");
    expect(ragStatusLabel(runtime({ ragReady: true })).ready).toBe(true);
    expect(ragStatusLabel(null).ready).toBe(false);
  });
});
