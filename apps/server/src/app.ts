import { timingSafeEqual } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express, type Request, type Response } from "express";
import { PrivatePlateDomain } from "@privateplate/domain";
import { z } from "zod";
import type { AgentEvent } from "./events.js";
import {
  AudioTranscriptionRequestSchema,
  IntakeError,
  InventoryImageRequestSchema,
  MediaIntakeService
} from "./intake-service.js";
import { AgentRunStore } from "./run-store.js";
import {
  loadRuntimeConfig,
  type RuntimeConfig
} from "./runtime-config.js";
import {
  AgentSessionManager,
  SessionInputError
} from "./session-manager.js";
import { buildWebRuntimeStatus } from "./runtime-status.js";
import { toBrowserDayContext } from "./web-day-context.js";
import { toBrowserHouseholdContext } from "./web-household-context.js";

export type AppContext = {
  domain: PrivatePlateDomain;
  sessions: AgentSessionManager;
  runs: AgentRunStore;
  intake: MediaIntakeService;
  config: RuntimeConfig;
};

type CreateAppContextOptions = {
  config?: RuntimeConfig;
  intake?: MediaIntakeService;
};

const SessionIdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-zA-Z0-9_-]+$/);

const ChatBodySchema = z.object({
  text: z.string().trim().min(1).max(2000),
  sessionId: SessionIdSchema.optional(),
  dinerIds: z.array(z.string().min(1)).min(1).max(3).optional()
});

const ConfirmBodySchema = z.object({
  sessionId: SessionIdSchema.optional(),
  confirmationToken: z.string().min(1),
  idempotencyKey: z.string().min(1),
  expectedPayloadHash: z.string().min(1)
});

const SessionBodySchema = z.object({
  sessionId: SessionIdSchema.optional()
});

export async function createAppContext(
  options: CreateAppContextOptions = {}
): Promise<AppContext> {
  const config = options.config ?? loadRuntimeConfig();
  if (config.databasePath !== ":memory:") {
    await mkdir(path.dirname(path.resolve(config.databasePath)), {
      recursive: true
    });
  }
  const domain = await PrivatePlateDomain.create(config.databasePath);
  return {
    domain,
    sessions: new AgentSessionManager(domain, config.provider),
    runs: new AgentRunStore(),
    intake:
      options.intake ??
      new MediaIntakeService({
        baseUrl: config.baseUrl,
        model: config.model,
        ...(config.vllmApiKey == null ? {} : { apiKey: config.vllmApiKey }),
        ...(config.requestTimeoutMs == null
          ? {}
          : { timeoutMs: config.requestTimeoutMs })
      }),
    config
  };
}

export function createApp(ctx: AppContext): Express {
  const app = express();
  app.use((req, res, next) => {
    if (
      ctx.config.appMode === "demo" ||
      hasValidBasicAuth(req, ctx.config.accessToken)
    ) {
      next();
      return;
    }
    res.setHeader("WWW-Authenticate", 'Basic realm="PrivatePlate", charset="UTF-8"');
    res.status(401).type("text").send("PrivatePlate authentication required.");
  });
  // Lightweight access log for dashboard debugging (SSH-tunnel UX).
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/")) {
      next();
      return;
    }
    const started = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - started;
      // Skip noisy health polls unless they fail.
      if (
        req.path === "/api/runtime/status" &&
        res.statusCode < 400 &&
        ms < 3_000
      ) {
        return;
      }
      console.log(
        `[http] ${req.method} ${req.path} → ${res.statusCode} ${ms}ms` +
          (req.header("x-privateplate-session")
            ? ` session=${req.header("x-privateplate-session")}`
            : "")
      );
    });
    next();
  });
  app.use(express.json({ limit: "8mb" }));

  app.post("/api/intake/inventory-image", async (req, res) => {
    const parsed = InventoryImageRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "请求必须只包含 imageDataUrl。"
      });
      return;
    }
    try {
      res.json(await ctx.intake.recognizeInventoryImage(parsed.data.imageDataUrl));
    } catch (error) {
      sendIntakeError(res, error);
    }
  });

  app.post("/api/intake/audio-transcription", async (req, res) => {
    const parsed = AudioTranscriptionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "请求必须包含 audioDataUrl、format 和 durationMs。"
      });
      return;
    }
    try {
      res.json(await ctx.intake.transcribeAudio({
        dataUrl: parsed.data.audioDataUrl,
        format: parsed.data.format,
        durationMs: parsed.data.durationMs
      }));
    } catch (error) {
      sendIntakeError(res, error);
    }
  });

  app.get("/api/runtime/status", async (req, res) => {
    const sessionId = sessionIdFor(req, res);
    if (!sessionId) return;
    const state = ctx.sessions.getState(sessionId);
    res.json(
      await buildWebRuntimeStatus({
        config: ctx.config,
        householdId: ctx.domain.householdId,
        sessionId,
        agentPhase: state.phase,
        activePlanId: state.activePlanId,
        activePlanVersion: state.activePlanVersion,
        dinerIds: state.dinerIds,
        embedding: ctx.domain.getEmbeddingInfo()
      })
    );
  });

  app.get("/api/households/:id/context", (req, res) => {
    if (req.params.id !== ctx.domain.householdId) {
      res.status(404).json({ code: "NOT_FOUND", message: "household not found" });
      return;
    }
    const mealContext = ctx.domain.getMealContext();
    const day = ctx.domain.getDayContext();
    res.json(toBrowserHouseholdContext(mealContext, day.sharedDisplay));
  });

  /** Single fact source for today's targets, intake remaining, inventory, memory. */
  app.get("/api/households/:id/day-context", (req, res) => {
    if (req.params.id !== ctx.domain.householdId) {
      res.status(404).json({ code: "NOT_FOUND", message: "household not found" });
      return;
    }
    const serviceDate =
      typeof req.query.date === "string" && req.query.date
        ? req.query.date
        : undefined;
    const timeZone =
      typeof req.query.timeZone === "string" && req.query.timeZone
        ? req.query.timeZone
        : "Asia/Shanghai";
    const day = ctx.domain.getDayContext({
      timeZone,
      ...(serviceDate ? { serviceDate } : {})
    });
    res.json(toBrowserDayContext(day));
  });

  /**
   * Meal completion is preview-only here: creates pending meal_completion.
   * Actual write requires POST /api/pending-actions/:id/confirm with token.
   */
  app.post("/api/households/:id/meal-complete", async (req, res) => {
    if (req.params.id !== ctx.domain.householdId) {
      res.status(404).json({ code: "NOT_FOUND", message: "household not found" });
      return;
    }
    const planId = String(req.body?.planId ?? "");
    if (!planId) {
      res.status(400).json({ code: "VALIDATION_ERROR", message: "planId required" });
      return;
    }
    // Legacy body with confirmationToken commits via pending path.
    if (
      typeof req.body?.confirmationToken === "string" &&
      typeof req.body?.pendingActionId === "string" &&
      typeof req.body?.expectedPayloadHash === "string"
    ) {
      const committed = ctx.domain.confirmPendingWrite({
        pendingActionId: req.body.pendingActionId,
        confirmationToken: req.body.confirmationToken,
        idempotencyKey: String(
          req.body.idempotencyKey ?? `meal-complete-${req.body.pendingActionId}`
        ),
        expectedPayloadHash: req.body.expectedPayloadHash
      });
      if (!committed.ok) {
        res.status(409).json(committed);
        return;
      }
      res.json(committed);
      return;
    }
    try {
      const preview = ctx.domain.previewMealCompletion({
        planId,
        ...(typeof req.body?.serviceDate === "string"
          ? { serviceDate: req.body.serviceDate }
          : {})
      });
      res.status(202).json({
        status: "preview",
        actionType: preview.actionType,
        preview: preview.preview,
        confirmation: preview.confirmation,
        note: "Confirm with POST /api/pending-actions/:id/confirm — no inventory write yet."
      });
    } catch (error) {
      res.status(409).json({
        ok: false,
        code:
          error && typeof error === "object" && "code" in error
            ? String((error as { code: string }).code)
            : "PREVIEW_FAILED",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/households/:id/inventory", (req, res) => {
    if (req.params.id !== ctx.domain.householdId) {
      res.status(404).json({ code: "NOT_FOUND", message: "household not found" });
      return;
    }
    const data = ctx.domain.getMealContext();
    res.json({
      householdId: data.householdId,
      inventoryVersion: data.inventoryVersion,
      items: data.inventory.map((item) => ({
        id: item.id,
        foodId: item.foodId,
        priorityConsume: item.priorityConsume,
        quantity: item.quantity,
        state: item.state
      }))
    });
  });

  app.get("/api/plans/active", (req, res) => {
    const sessionId = sessionIdFor(req, res);
    if (!sessionId) return;
    const state = ctx.sessions.getState(sessionId);
    const plan = state.activePlanId
      ? ctx.domain.getPlanById(state.activePlanId)
      : null;
    res.json({ plan });
  });

  app.get("/api/agent/sessions/:id", (req, res) => {
    const sessionId = sessionIdFor(req, res, req.params.id);
    if (!sessionId) return;
    const state = ctx.sessions.getState(sessionId);
    const plan = state.activePlanId
      ? ctx.domain.getPlanById(state.activePlanId)
      : null;
    res.json({
      sessionId,
      state,
      plan,
      pendingConfirmationExists: state.pendingActionId !== null
    });
  });

  app.post("/api/agent/runs", (req, res) => {
    const parsed = ChatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "invalid body"
      });
      return;
    }
    const sessionId = sessionIdFor(req, res, parsed.data.sessionId);
    if (!sessionId) return;

    const run = ctx.runs.create(sessionId);
    ctx.runs.append(run.runId, { type: "run_started", runId: run.runId });
    res.status(202).json({ runId: run.runId, sessionId });

    queueMicrotask(() => {
      const input = {
        runId: run.runId,
        sessionId,
        text: parsed.data.text
      };
      void executeAgentRun(
        ctx,
        parsed.data.dinerIds
          ? { ...input, dinerIds: parsed.data.dinerIds }
          : input
      );
    });
  });

  app.get("/api/agent/runs/:id/events", (req, res) => {
    const sessionId = sessionIdFor(req, res);
    if (!sessionId) return;
    const run = ctx.runs.get(req.params.id);
    if (!run || run.sessionId !== sessionId) {
      res.status(404).json({ code: "NOT_FOUND", message: "run not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let replaying = true;
    let closed = false;
    const queued: AgentEvent[] = [];
    const heartbeat = setInterval(() => {
      if (!closed) res.write(": heartbeat\n\n");
    }, 15_000);
    heartbeat.unref();
    const write = (event: AgentEvent) => {
      if (closed) return;
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.type === "run_completed" || event.type === "run_failed") {
        res.write("event: stream_end\ndata: {}\n\n");
        res.end();
        closed = true;
        clearInterval(heartbeat);
      }
    };
    const unsubscribe = ctx.runs.subscribe(run.runId, (event) => {
      if (replaying) queued.push(event);
      else write(event);
    });
    const snapshot = ctx.runs.takeDeliverySnapshot(run.runId);
    const snapshotEvents = new Set(snapshot);
    snapshot.forEach(write);
    replaying = false;
    queued.filter((event) => !snapshotEvents.has(event)).forEach(write);

    if (!closed && run.status !== "running") {
      res.write("event: stream_end\ndata: {}\n\n");
      res.end();
      closed = true;
      clearInterval(heartbeat);
    }

    req.on("close", () => {
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.post("/api/pending-actions/:id/confirm", async (req, res) => {
    const parsed = ConfirmBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: "VALIDATION_ERROR", message: "invalid body" });
      return;
    }
    const sessionId = sessionIdFor(req, res, parsed.data.sessionId);
    if (!sessionId) return;
    try {
      const result = await ctx.sessions.confirm(sessionId, {
        pendingActionId: req.params.id,
        confirmationToken: parsed.data.confirmationToken,
        idempotencyKey: parsed.data.idempotencyKey,
        payloadHash: parsed.data.expectedPayloadHash
      });
      if (!result.ok) {
        res.status(409).json(result);
        return;
      }
      res.json(result);
    } catch (error) {
      if (writeSessionConflict(res, error)) return;
      throw error;
    }
  });

  app.post("/api/pending-actions/:id/cancel", async (req, res) => {
    const parsed = SessionBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ code: "VALIDATION_ERROR", message: "invalid body" });
      return;
    }
    const sessionId = sessionIdFor(req, res, parsed.data.sessionId);
    if (!sessionId) return;
    try {
      const result = await ctx.sessions.cancel(sessionId, req.params.id);
      if (!result.ok) {
        res.status(409).json(result);
        return;
      }
      res.json(result);
    } catch (error) {
      if (writeSessionConflict(res, error)) return;
      throw error;
    }
  });

  app.post("/api/agent/sessions/:id/clear", async (req, res) => {
    const sessionId = sessionIdFor(req, res, req.params.id);
    if (!sessionId) return;
    await ctx.sessions.clear(sessionId);
    res.json({ ok: true, sessionId });
  });

  app.get("/api/caregiver-inbox", (_req, res) => {
    const rows = ctx.domain.db
      .prepare(
        `SELECT id, household_id, plan_id, plan_version, recipient_label, task_card_json, channel, status, created_at
         FROM caregiver_tasks ORDER BY created_at DESC`
      )
      .all() as Array<Record<string, unknown>>;
    const localDemo = ctx.config.appMode !== "production";
    res.json({
      channel: "local_task_board",
      simulated: true,
      appMode: ctx.config.appMode,
      capability: "尚未连接家庭消息渠道",
      saveMessage: localDemo
        ? "已保存到本地演示数据库"
        : "已保存到当前家庭空间",
      items: rows.map((row) => ({
        id: row.id,
        household_id: row.household_id,
        plan_id: row.plan_id,
        plan_version: row.plan_version,
        recipient_label: row.recipient_label,
        status: row.status,
        created_at: row.created_at,
        channel: "local_task_board",
        taskCard: JSON.parse(String(row.task_card_json))
      }))
    });
  });

  /** Reset household memory + sessions (local/in-memory dashboard only). */
  async function resetDashboard(_req: Request, res: Response): Promise<void> {
    if (ctx.config.appMode !== "demo") {
      res.status(403).json({
        code: "FORBIDDEN",
        message: "session reset is only available in local dashboard mode"
      });
      return;
    }
    if (ctx.runs.hasRunning()) {
      res.status(409).json({
        code: "RUN_IN_PROGRESS",
        message: "请等待当前 Agent 任务完成后再重置会话。"
      });
      return;
    }
    ctx.domain.close();
    ctx.domain = await PrivatePlateDomain.create(":memory:");
    ctx.sessions = new AgentSessionManager(ctx.domain, ctx.config.provider);
    ctx.runs.clear();
    res.json({ ok: true, householdId: ctx.domain.householdId });
  }

  app.post("/api/session/reset", resetDashboard);
  // Legacy path kept for older clients / tests
  app.post("/api/demo/reset", resetDashboard);

  const here = path.dirname(fileURLToPath(import.meta.url));
  const webDist = path.resolve(here, "../../web/dist");
  app.use(express.static(webDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(path.join(webDist, "index.html"), (error) => {
      if (error) {
        res
          .status(404)
          .type("text")
          .send(
            "PrivatePlate API is running. Build apps/web or use Vite dev server on :5173."
          );
      }
    });
  });

  return app;
}

async function executeAgentRun(
  ctx: AppContext,
  input: {
    runId: string;
    sessionId: string;
    text: string;
    dinerIds?: string[];
  }
): Promise<void> {
  try {
    const turn = await ctx.sessions.run(
      input.sessionId,
      input.text,
      input.dinerIds
    );
    for (const step of turn.toolTrace) {
      ctx.runs.append(input.runId, {
        type: "action_started",
        label: toolLabel(step.tool),
        tool: step.tool
      });
      ctx.runs.append(input.runId, {
        type: "action_completed",
        label: toolLabel(step.tool),
        durationMs: Math.round(step.durationMs * 100) / 100,
        ok: step.ok
      });
    }

    const state = ctx.sessions.getState(input.sessionId);
    const plan = state.activePlanId
      ? ctx.domain.getPlanById(state.activePlanId)
      : null;
    const failed =
      turn.phase === "ERROR" ||
      !turn.validationOk ||
      turn.toolTrace.some((step) => !step.ok);
    const finalizedThisTurn = turn.toolTrace.some(
      (step) => step.tool === "finalize_meal_plan" && step.ok
    );

    // Only announce plan_ready when this turn actually produced/revised a plan.
    // Re-emitting whenever an old activePlan exists makes every RAG/inventory
    // reply attach the meal-plan preview in the dashboard.
    if (!failed && plan && finalizedThisTurn) {
      ctx.runs.append(input.runId, {
        type: "plan_ready",
        planId: plan.id,
        version: plan.version,
        menu: plan.sharedTemplates.map((item) => item.name)
      });
    } else if (turn.phase === "PRESENTING_INFEASIBLE") {
      ctx.runs.append(input.runId, { type: "plan_infeasible" });
    }

    if (!failed && turn.uiOnly) {
      ctx.runs.publishUiOnly(input.runId, {
        type: "confirmation_required",
        pendingActionId: turn.uiOnly.pendingActionId,
        confirmationToken: turn.uiOnly.confirmationToken,
        payloadHash: turn.uiOnly.payloadHash,
        expiresAt: turn.uiOnly.expiresAt,
        ...(turn.uiOnly.actionType
          ? { actionType: turn.uiOnly.actionType }
          : {}),
        ...(turn.uiOnly.confirmLabel
          ? { confirmLabel: turn.uiOnly.confirmLabel }
          : {}),
        ...(turn.uiOnly.taskCard ? { taskCard: turn.uiOnly.taskCard } : {}),
        ...(turn.uiOnly.preview ? { preview: turn.uiOnly.preview } : {})
      });
    }

    for (const chunk of chunkText(turn.answer, 32)) {
      ctx.runs.append(input.runId, { type: "answer_delta", text: chunk });
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    if (failed) {
      ctx.runs.append(input.runId, {
        type: "run_failed",
        code: turn.state.errorCode ?? "AGENT_RUN_FAILED",
        message: turn.answer
      });
      ctx.runs.finish(input.runId, "failed");
      return;
    }

    ctx.runs.append(input.runId, {
      type: "run_completed",
      auditRef: input.runId
    });
    ctx.runs.finish(input.runId, "completed");
  } catch (error) {
    const code =
      error instanceof SessionInputError ? error.code : "INTERNAL_ERROR";
    const message =
      error instanceof Error ? error.message : "Agent execution failed.";
    ctx.runs.append(input.runId, {
      type: "run_failed",
      code,
      message
    });
    ctx.runs.finish(input.runId, "failed");
  }
}

/** Present the finished answer in segments. Not live token streaming. */
function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

function toolLabel(tool: string): string {
  const labels: Record<string, string> = {
    get_day_context: "读取今日额度与家庭记忆",
    get_inventory: "读取当前库存",
    find_dish_candidates: "匹配候选菜品",
    finalize_meal_plan: "确认 Agent 选菜并生成计划",
    preview_meal_completion: "预览本餐完成后的写入",
    preview_caregiver_task: "预览任务卡与采购清单",
    retrieve_local_knowledge: "检索本地知识库",
    preview_inventory_change: "预览库存入库",
    preview_member_memory_change: "预览家庭资料变更"
  };
  return labels[tool] ?? tool;
}

function sendIntakeError(res: Response, error: unknown): void {
  if (error instanceof IntakeError) {
    res.status(error.status).json({
      code: error.code,
      message: error.message
    });
    return;
  }
  res.status(500).json({
    code: "INTAKE_FAILED",
    message: "媒体识别暂时失败，请重试。"
  });
}

function writeSessionConflict(res: Response, error: unknown): boolean {
  if (!(error instanceof SessionInputError)) return false;
  res.status(409).json({
    ok: false,
    code: error.code,
    message: error.message
  });
  return true;
}

function sessionIdFor(
  req: Request,
  res: Response,
  explicit?: unknown
): string | null {
  const candidate =
    explicit ??
    req.header("x-privateplate-session") ??
    req.query.sessionId ??
    "dashboard-session";
  const parsed = SessionIdSchema.safeParse(candidate);
  if (!parsed.success) {
    res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "invalid session id"
    });
    return null;
  }
  return parsed.data;
}

function hasValidBasicAuth(
  req: Request,
  expectedToken: string | null
): boolean {
  if (!expectedToken) return false;
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Basic ")) return false;
  const credentials = Buffer.from(authorization.slice("Basic ".length), "base64")
    .toString("utf8");
  const separator = credentials.indexOf(":");
  if (separator < 0 || credentials.slice(0, separator) !== "privateplate") {
    return false;
  }
  const suppliedToken = credentials.slice(separator + 1);
  const supplied = Buffer.from(suppliedToken);
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function listen(
  port = Number(process.env.PORT ?? 8787)
): Promise<{
  app: Express;
  ctx: AppContext;
  server: ReturnType<Express["listen"]>;
}> {
  const ctx = await createAppContext();
  const app = createApp(ctx);
  const server = app.listen(port, "127.0.0.1");
  return { app, ctx, server };
}
