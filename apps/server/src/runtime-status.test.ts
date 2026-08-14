import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { OpenAiCompatibleToolProvider } from "@privateplate/agent-runtime";
import { createApp, createAppContext, type AppContext } from "./app.js";
import { mockAgentTestConfig } from "./runtime-config.js";
import {
  capabilityBoundaryText,
  databaseStorageClass,
  RUNTIME_STATUS_SCHEMA
} from "./runtime-status.js";

describe("databaseStorageClass", () => {
  it("classifies memory vs local sqlite without exposing a path", () => {
    expect(databaseStorageClass(":memory:")).toBe("memory");
    expect(databaseStorageClass("./data/privateplate-demo.sqlite")).toBe(
      "local_sqlite_file"
    );
    expect(
      databaseStorageClass("/Users/someone/privateplate-demo.sqlite")
    ).toBe("local_sqlite_file");
  });
});

describe("capabilityBoundaryText", () => {
  it("describes only product runtime requirements", () => {
    const text = capabilityBoundaryText({
      scriptedMock: false,
      storageClass: "local_sqlite_file"
    });
    expect(text).toMatch(/loopback/);
    expect(text).toMatch(/9 个/);
  });
});

describe("GET /api/runtime/status web DTO", () => {
  let app: Express;
  let ctx: AppContext;

  beforeAll(async () => {
    ctx = await createAppContext({ config: mockAgentTestConfig() });
    app = createApp(ctx);
  });

  afterAll(() => {
    ctx.domain.close();
  });

  it("reports honest local-demo status without internal evidence fields", async () => {
    const response = await request(app)
      .get("/api/runtime/status")
      .query({ sessionId: "runtime-status-demo" });
    expect(response.status).toBe(200);
    expect(response.body.schemaVersion).toBe(RUNTIME_STATUS_SCHEMA);
    expect(response.body.appMode).toBe("demo");
    expect(response.body.modelReady).toBe(true);
    expect(response.body.operable).toBe(true);
    expect(response.body.agentKind).toBe("scripted_mock");
    expect(response.body.ragReady).toBe(false);
    expect(response.body.rag.ready).toBe(false);
    expect(response.body.rag.mode).toBe("hash_offline");
    expect(response.body.cameraSource).toBe("current_browser");
    expect(response.body.microphoneSource).toBe("current_browser");
    expect(response.body.databaseStorageClass).toBe("memory");
    expect(response.body.capabilityBoundary).toMatch(/脚本化模型/);
    expect(response.body.capabilityBoundary).toMatch(/进程内内存/);
    expect(response.body).not.toHaveProperty("evidenceEligible");
    expect(response.body).not.toHaveProperty("claimBoundary");
    expect(response.body).not.toHaveProperty("databasePath");
    expect(response.body.llm).not.toHaveProperty("baseUrl");
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/evidenceEligible/i);
  });

  it("classifies a sqlite file without leaking the filesystem path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pp-runtime-status-"));
    const databasePath = join(dir, "household.sqlite");
    const fileCtx = await createAppContext({
      config: mockAgentTestConfig({ databasePath })
    });
    try {
      const fileApp = createApp(fileCtx);
      const response = await request(fileApp)
        .get("/api/runtime/status")
        .query({ sessionId: "runtime-status-file" });
      expect(response.status).toBe(200);
      expect(response.body.databaseStorageClass).toBe("local_sqlite_file");
      expect(response.body).not.toHaveProperty("databasePath");
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain(databasePath);
      expect(serialized).not.toContain(dir);
    } finally {
      fileCtx.domain.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("says the model is not ready when the loopback endpoint is down", async () => {
    const offlineCtx = await createAppContext({
      config: mockAgentTestConfig({
        provider: new OpenAiCompatibleToolProvider({
          baseUrl: "http://127.0.0.1:9/v1",
          model: "offline-test"
        }),
        model: "offline-test",
        baseUrl: "http://127.0.0.1:9/v1"
      })
    });
    try {
      const offlineApp = createApp(offlineCtx);
      const response = await request(offlineApp)
        .get("/api/runtime/status")
        .query({ sessionId: "runtime-status-offline" });
      expect(response.status).toBe(200);
      expect(response.body.modelReady).toBe(false);
      expect(response.body.operable).toBe(false);
      expect(response.body.llm.ready).toBe(false);
      expect(response.body.agentKind).toBe("model_agent");
      expect(JSON.stringify(response.body)).not.toMatch(/已连接/);
    } finally {
      offlineCtx.domain.close();
    }
  });
});
