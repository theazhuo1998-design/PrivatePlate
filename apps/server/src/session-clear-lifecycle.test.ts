import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  ScriptedProductProvider,
  type AgentModelProvider
} from "@privateplate/agent-runtime";
import { PrivatePlateDomain } from "@privateplate/domain";
import { createApp, createAppContext, type AppContext } from "./app.js";
import { mockAgentTestConfig } from "./runtime-config.js";
import { AgentSessionManager } from "./session-manager.js";

const DINERS = ["mem-admin", "mem-father", "mem-mother"] as const;

type PendingKind =
  | "inventory"
  | "member_memory"
  | "caregiver"
  | "meal_completion";

describe("session clear preserves household state (新对话)", () => {
  let tempDir: string | null = null;
  let domain: PrivatePlateDomain | null = null;
  let ctx: AppContext | null = null;
  let releaseProvider: (() => void) | null = null;

  afterEach(() => {
    releaseProvider?.();
    releaseProvider = null;
    ctx?.domain.close();
    ctx = null;
    domain?.close();
    domain = null;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("keeps inventory, memory, completed meal, and remaining across file-backed session clear", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "pp-session-clear-"));
    const databasePath = join(tempDir, "family.sqlite");
    domain = await PrivatePlateDomain.create(databasePath);
    const manager = new AgentSessionManager(
      domain,
      new ScriptedProductProvider()
    );
    const sessionId = "sess-new-chat";
    const domainRef = domain;
    const sqlitePathBefore = sqliteMainFile(domain);

    await manager.run(
      sessionId,
      "中午我们三个人吃什么？不要鸡腿。",
      [...DINERS]
    );
    const planned = manager.getState(sessionId);
    expect(planned.activePlanId).toBeTruthy();
    expect(domain.loadAgentCheckpoint(sessionId)).not.toBeNull();
    const planId = planned.activePlanId!;

    const restock = domain.previewInventoryChange({
      foodId: "food-tofu",
      quantity: 2,
      unit: "盒"
    });
    const restocked = domain.confirmPendingWrite({
      pendingActionId: restock.confirmation.pendingActionId,
      confirmationToken: restock.confirmation.confirmationToken,
      idempotencyKey: "clear-lifecycle-restock",
      expectedPayloadHash: restock.confirmation.payloadHash
    });
    expect(restocked.ok).toBe(true);

    const memory = domain.previewMemberMemoryChange({
      memberId: "mem-father",
      kind: "preference",
      summary: "少油"
    });
    const remembered = domain.confirmPendingWrite({
      pendingActionId: memory.confirmation.pendingActionId,
      confirmationToken: memory.confirmation.confirmationToken,
      idempotencyKey: "clear-lifecycle-memory",
      expectedPayloadHash: memory.confirmation.payloadHash
    });
    expect(remembered.ok).toBe(true);

    const meal = domain.previewMealCompletion({ planId });
    const completed = domain.confirmPendingWrite({
      pendingActionId: meal.confirmation.pendingActionId,
      confirmationToken: meal.confirmation.confirmationToken,
      idempotencyKey: "clear-lifecycle-meal",
      expectedPayloadHash: meal.confirmation.payloadHash
    });
    expect(completed.ok).toBe(true);

    const beforeClear = snapshotHousehold(domain);
    expect(beforeClear.tofuG).toBeGreaterThan(350);
    expect(beforeClear.preferenceNotes).toContain("少油");
    expect(beforeClear.completedMeals).toBeGreaterThanOrEqual(1);

    await manager.clear(sessionId);

    expect(domain).toBe(domainRef);
    expect(sqliteMainFile(domain)).toBe(sqlitePathBefore);
    expect(sqlitePathBefore.length).toBeGreaterThan(0);
    expect(domain.loadAgentCheckpoint(sessionId)).toBeNull();

    const fresh = manager.getState(sessionId);
    expect(fresh.activePlanId).toBeNull();
    expect(fresh.pendingActionId).toBeNull();
    expect(fresh.confirmationStatus).toBe("not_started");

    expect(snapshotHousehold(domain)).toEqual(beforeClear);
  });

  it.each([
    "inventory",
    "member_memory",
    "caregiver",
    "meal_completion"
  ] as const)(
    "cancels %s pending on session clear; old token cannot commit",
    async (kind) => {
      domain = await PrivatePlateDomain.create(":memory:");
      const manager = new AgentSessionManager(
        domain,
        new ScriptedProductProvider()
      );
      const sessionId = `clear-pending-${kind}`;
      await manager.run(sessionId, "查看库存", [...DINERS]);
      expect(domain.loadAgentCheckpoint(sessionId)).not.toBeNull();

      const before = snapshotHousehold(domain);
      const preview = createUnconfirmedPending(domain, kind, sessionId);
      attachPending(manager, sessionId, preview.pendingActionId);
      expect(manager.getState(sessionId).pendingActionId).toBe(
        preview.pendingActionId
      );

      await manager.clear(sessionId);

      expect(pendingStatus(domain, preview.pendingActionId)).toBe("cancelled");
      expect(domain.loadAgentCheckpoint(sessionId)).toBeNull();

      const revived = await manager.confirm(sessionId, {
        pendingActionId: preview.pendingActionId,
        confirmationToken: preview.confirmationToken,
        idempotencyKey: `revive-${kind}`,
        payloadHash: preview.payloadHash
      });
      expect(revived.ok).toBe(false);
      if (!revived.ok) {
        expect(revived.code).toBe("STALE_CONTEXT");
      }

      const fresh = manager.getState(sessionId);
      expect(fresh.pendingActionId).toBeNull();
      expect(fresh.activePlanId).toBeNull();
      expect(snapshotHousehold(domain)).toEqual(before);
    }
  );

  it("HTTP 新对话 path clears the session without recreating Domain", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "pp-session-clear-http-"));
    const databasePath = join(tempDir, "family.sqlite");
    ctx = await createAppContext({
      config: mockAgentTestConfig({ databasePath })
    });
    const app = createApp(ctx);
    const sessionId = "http-new-chat";
    const domainRef = ctx.domain;
    const sqlitePathBefore = sqliteMainFile(ctx.domain);

    await ctx.sessions.run(
      sessionId,
      "中午我们三个人吃什么？不要鸡腿。",
      [...DINERS]
    );
    const planId = ctx.sessions.getState(sessionId).activePlanId;
    expect(planId).toBeTruthy();

    const restock = ctx.domain.previewInventoryChange({
      foodId: "food-tofu",
      quantity: 2,
      unit: "盒"
    });
    expect(
      ctx.domain.confirmPendingWrite({
        pendingActionId: restock.confirmation.pendingActionId,
        confirmationToken: restock.confirmation.confirmationToken,
        idempotencyKey: "http-clear-restock",
        expectedPayloadHash: restock.confirmation.payloadHash
      }).ok
    ).toBe(true);

    const memory = ctx.domain.previewMemberMemoryChange({
      memberId: "mem-father",
      kind: "preference",
      summary: "少油"
    });
    expect(
      ctx.domain.confirmPendingWrite({
        pendingActionId: memory.confirmation.pendingActionId,
        confirmationToken: memory.confirmation.confirmationToken,
        idempotencyKey: "http-clear-memory",
        expectedPayloadHash: memory.confirmation.payloadHash
      }).ok
    ).toBe(true);

    const meal = ctx.domain.previewMealCompletion({ planId: planId! });
    expect(
      ctx.domain.confirmPendingWrite({
        pendingActionId: meal.confirmation.pendingActionId,
        confirmationToken: meal.confirmation.confirmationToken,
        idempotencyKey: "http-clear-meal",
        expectedPayloadHash: meal.confirmation.payloadHash
      }).ok
    ).toBe(true);

    const beforeClear = snapshotHousehold(ctx.domain);

    const cleared = await request(app)
      .post(`/api/agent/sessions/${sessionId}/clear`)
      .set("X-PrivatePlate-Session", sessionId);
    expect(cleared.status).toBe(200);
    expect(cleared.body).toMatchObject({ ok: true, sessionId });

    expect(ctx.domain).toBe(domainRef);
    expect(ctx.config.databasePath).toBe(databasePath);
    expect(sqliteMainFile(ctx.domain)).toBe(sqlitePathBefore);
    expect(sqlitePathBefore.length).toBeGreaterThan(0);
    expect(ctx.domain.loadAgentCheckpoint(sessionId)).toBeNull();
    expect(snapshotHousehold(ctx.domain)).toEqual(beforeClear);

    const session = await request(app)
      .get(`/api/agent/sessions/${sessionId}`)
      .set("X-PrivatePlate-Session", sessionId);
    expect(session.status).toBe(200);
    expect(session.body.plan).toBeNull();
    expect(session.body.state.activePlanId).toBeNull();
    expect(session.body.state.pendingActionId).toBeNull();
    expect(session.body.pendingConfirmationExists).toBe(false);
  });

  it("HTTP session clear racing an in-flight run does not leave a half-cleared session", async () => {
    const providerGate = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    let enteredGate = false;
    const provider = gatedInspectProvider(providerGate, () => {
      enteredGate = true;
    });
    ctx = await createAppContext({
      config: mockAgentTestConfig({ provider })
    });
    const app = createApp(ctx);
    const sessionId = "http-clear-race";
    const domainRef = ctx.domain;

    const accepted = await request(app)
      .post("/api/agent/runs")
      .send({
        sessionId,
        text: "查看家庭库存和成员",
        dinerIds: [...DINERS]
      });
    expect(accepted.status).toBe(202);
    await waitUntil(() => enteredGate);

    const clearing = ctx.sessions.clear(sessionId);
    const httpClear = request(app)
      .post(`/api/agent/sessions/${sessionId}/clear`)
      .set("X-PrivatePlate-Session", sessionId);

    await expect(
      ctx.sessions.run(sessionId, "查看家庭库存和成员")
    ).rejects.toThrow(/正在清理/);

    const confirmWhileClearing = await request(app)
      .post("/api/pending-actions/pending-race-token/confirm")
      .set("X-PrivatePlate-Session", sessionId)
      .send({
        sessionId,
        confirmationToken: "not-a-real-token",
        idempotencyKey: "http-clear-race-confirm",
        expectedPayloadHash: "not-a-real-hash"
      });
    expect(confirmWhileClearing.status).toBe(409);
    expect(confirmWhileClearing.body.code).toBe("VALIDATION_ERROR");
    expect(String(confirmWhileClearing.body.message)).toMatch(/正在清理/);

    releaseProvider!();
    const [, cleared] = await Promise.all([clearing, httpClear]);
    expect(cleared.status).toBe(200);
    await waitUntil(
      () => ctx!.runs.get(String(accepted.body.runId))?.status !== "running"
    );

    expect(ctx.domain).toBe(domainRef);
    expect(ctx.domain.loadAgentCheckpoint(sessionId)).toBeNull();
    const fresh = ctx.sessions.getState(sessionId);
    expect(fresh.pendingActionId).toBeNull();
    expect(fresh.activePlanId).toBeNull();
  });
});

function attachPending(
  manager: AgentSessionManager,
  sessionId: string,
  pendingActionId: string
): void {
  const agent = manager.getAgent(sessionId);
  agent.restoreState({
    ...agent.state,
    pendingActionId,
    phase: "AWAITING_CONFIRMATION",
    confirmationStatus: "confirmation_required"
  });
}

function createUnconfirmedPending(
  domain: PrivatePlateDomain,
  kind: PendingKind,
  sessionId: string
): {
  pendingActionId: string;
  confirmationToken: string;
  payloadHash: string;
} {
  if (kind === "inventory") {
    return domain.previewInventoryChange({
      foodId: "food-tofu",
      quantity: 2,
      unit: "盒"
    }).confirmation;
  }
  if (kind === "member_memory") {
    return domain.previewMemberMemoryChange({
      memberId: "mem-father",
      kind: "preference",
      summary: `clear-cancel-${sessionId}`
    }).confirmation;
  }
  const plan = planLunch(domain, sessionId);
  if (kind === "caregiver") {
    return domain.previewCaregiverSend({
      planId: plan.id,
      recipientLabel: "家庭保姆"
    }).confirmation;
  }
  return domain.previewMealCompletion({ planId: plan.id }).confirmation;
}

function planLunch(domain: PrivatePlateDomain, sessionId: string) {
  const dinerIds = [...DINERS];
  const candidates = domain.findDishCandidates({ dinerIds });
  const selectedDishes = [
    "tpl-cabbage-tofu-braise",
    "tpl-shiitake-egg",
    "tpl-steamed-fish",
    "tpl-leftover-rice"
  ]
    .filter((templateId) =>
      candidates.candidates.some((candidate) => candidate.templateId === templateId)
    )
    .map((templateId) => ({
      templateId,
      relativePortion: "standard" as const
    }));
  const result = domain.finalizeMealPlan({
    sessionId,
    dinerIds,
    mealType: "lunch",
    candidateSetId: candidates.candidateSetId,
    selectedDishes,
    mealPortionScale: 1.0,
    selectionReason: "session-clear pending fixture"
  });
  if (result.status !== "ok") {
    throw new Error(`plan failed: ${result.code}`);
  }
  return result.plan;
}

function snapshotHousehold(domain: PrivatePlateDomain) {
  const day = domain.getDayContext({ dinerIds: [...DINERS] });
  const preferenceNotes = domain.db
    .prepare(
      `SELECT note FROM member_preferences WHERE active = 1 ORDER BY note`
    )
    .all() as Array<{ note: string }>;
  const caregiverTasks = domain.db
    .prepare(`SELECT COUNT(*) AS c FROM caregiver_tasks`)
    .get() as { c: number };
  return {
    tofuG:
      day.inventory.find((item) => item.foodId === "food-tofu")?.quantity
        .estimateG ?? 0,
    remainingEnergy: day.householdIntake.remaining.energyKcal,
    completedMeals: day.completedMeals.length,
    preferenceNotes: preferenceNotes.map((row) => row.note),
    caregiverTasks: Number(caregiverTasks.c)
  };
}

function pendingStatus(
  domain: PrivatePlateDomain,
  pendingActionId: string
): string | null {
  const row = domain.db
    .prepare(`SELECT status FROM pending_actions WHERE id = ?`)
    .get(pendingActionId) as { status: string } | undefined;
  return row?.status ?? null;
}

function sqliteMainFile(target: PrivatePlateDomain): string {
  const rows = target.db.prepare("PRAGMA database_list").all() as Array<{
    name: string;
    file: string;
  }>;
  return rows.find((row) => row.name === "main")?.file ?? "";
}

function gatedInspectProvider(
  providerGate: Promise<void>,
  onEnter: () => void
): AgentModelProvider {
  return {
    mode: "local_vllm",
    model: "clear-race-http",
    route: async (input) => {
      if (input.currentTurn.toolResults.length > 0) {
        return {
          kind: "final" as const,
          goal: "inspect_context" as const,
          message: "上下文已读取。",
          reasonCode: null,
          model: "clear-race-http",
          privacy_violation: false,
          format_retry_count: 0,
          format_retry_reasons: [] as string[]
        };
      }
      onEnter();
      await providerGate;
      const effective = {
        dinerIds: [...DINERS]
      };
      return {
        kind: "tool" as const,
        goal: "inspect_context" as const,
        tool: "get_day_context" as const,
        model: "clear-race-http",
        arguments: effective,
        raw_model_arguments: effective,
        normalized_model_arguments: effective,
        effective_arguments: effective,
        policy: {
          status: "ok" as const,
          effective,
          privacy_violation: false,
          reasons: [] as string[]
        },
        privacy_violation: false,
        format_retry_count: 0,
        format_retry_reasons: [] as string[]
      };
    }
  };
}

async function waitUntil(predicate: () => boolean, attempts = 400): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("timed out waiting for condition");
}
