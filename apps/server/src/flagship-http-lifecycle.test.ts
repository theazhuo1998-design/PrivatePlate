/**
 * Flagship HTTP lifecycle for Task 7.2.
 *
 * Evidence class: structure_only
 * Provider: ScriptedProductProvider (not a real model).
 * This verifies the HTTP lifecycle with a scripted provider, not real-model quality.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { PrivatePlateDomain } from "@privateplate/domain";
import { createApp, createAppContext, type AppContext } from "./app.js";
import type { AgentEvent, ConfirmationRequiredEvent } from "./events.js";
import { mockAgentTestConfig } from "./runtime-config.js";

const DINERS = ["mem-admin", "mem-father", "mem-mother"] as const;
const EVIDENCE_CLASS = "structure_only" as const;

describe("flagship HTTP lifecycle (structure_only, ScriptedProvider)", () => {
  let tempDir: string | null = null;
  let ctx: AppContext | null = null;

  afterEach(() => {
    ctx?.domain.close();
    ctx = null;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("structure_only: 确认入库 → 规划 → 修订成员/菜品 → 确认任务 → 确认吃完 → 清会话 → 重开并读取更新状态", async () => {
    expect(EVIDENCE_CLASS).toBe("structure_only");
    tempDir = mkdtempSync(join(tmpdir(), "pp-flagship-http-"));
    const databasePath = join(tempDir, "family.sqlite");
    ctx = await createAppContext({
      config: mockAgentTestConfig({ databasePath })
    });
    const app = createApp(ctx);
    const sessionId = "flagship-http-structure";
    const householdId = ctx.domain.householdId;
    const domainRef = ctx.domain;
    const sqlitePathBefore = sqliteMainFile(ctx.domain);

    const tofuSeed =
      dayInventoryGrams(ctx.domain, "food-tofu") ?? 0;
    const remainingBeforeRestock = dayRemainingEnergy(ctx.domain);
    expect(tofuSeed).toBeGreaterThan(0);

    const restock = await runTurn(app, ctx, sessionId, "刚买了两盒豆腐，帮我记入库。");
    expect(restock.tools).toContain("preview_inventory_change");
    expect(restock.confirmation).toBeTruthy();
    expect(dayInventoryGrams(ctx.domain, "food-tofu")).toBe(tofuSeed);

    const restocked = await confirmPending(app, sessionId, restock.confirmation!);
    expect(restocked.status).toBe(200);
    expect(restocked.body.ok).toBe(true);
    const tofuAfterRestock = dayInventoryGrams(ctx.domain, "food-tofu") ?? 0;
    expect(tofuAfterRestock).toBeGreaterThan(tofuSeed);

    const planned = await runTurn(
      app,
      ctx,
      sessionId,
      "中午我们三个人吃什么？不要鸡腿。",
      [...DINERS]
    );
    expect(planned.tools).toContain("get_day_context");
    expect(planned.tools).toContain("find_dish_candidates");
    expect(planned.tools).toContain("finalize_meal_plan");
    expect(planned.events.some((event) => event.type === "plan_ready")).toBe(
      true
    );
    const afterPlan = await getSession(app, sessionId);
    expect(afterPlan.state.activePlanId).toBeTruthy();
    expect(afterPlan.plan?.dinerIds).toEqual([...DINERS]);
    const firstMenu = menuTemplateIds(afterPlan.plan);
    expect(firstMenu.length).toBeGreaterThan(0);

    const revised = await runTurn(
      app,
      ctx,
      sessionId,
      "改成管理员和母亲，蒸蛋也换掉，其他保留。"
    );
    expect(revised.tools).toContain("find_dish_candidates");
    expect(revised.tools).toContain("finalize_meal_plan");
    const afterRevise = await getSession(app, sessionId);
    expect(afterRevise.state.activePlanId).toBeTruthy();
    expect(afterRevise.plan?.dinerIds).toEqual(["mem-admin", "mem-mother"]);
    expect(afterRevise.plan?.dinerIds).not.toEqual(["mem-father"]);
    expect(menuTemplateIds(afterRevise.plan)).not.toContain("tpl-shiitake-egg");
    expect(afterRevise.plan?.version).toBeGreaterThan(afterPlan.plan?.version ?? 0);
    const planId = afterRevise.state.activePlanId as string;

    const handoff = await runTurn(app, ctx, sessionId, "发给保姆，预览任务卡。");
    expect(handoff.tools).toContain("preview_caregiver_task");
    expect(handoff.confirmation).toBeTruthy();
    expect(caregiverTaskCount(ctx.domain)).toBe(0);

    const tasked = await confirmPending(app, sessionId, handoff.confirmation!);
    expect(tasked.status).toBe(200);
    expect(tasked.body.ok).toBe(true);
    expect(caregiverTaskCount(ctx.domain)).toBe(1);

    const remainingBeforeMeal = dayRemainingEnergy(ctx.domain);
    const mealPreview = await request(app)
      .post(`/api/households/${householdId}/meal-complete`)
      .send({ planId });
    expect(mealPreview.status).toBe(202);
    expect(mealPreview.body.status).toBe("preview");
    expect(dayRemainingEnergy(ctx.domain)).toBe(remainingBeforeMeal);

    const mealConfirm = await confirmPending(app, sessionId, {
      pendingActionId: mealPreview.body.confirmation.pendingActionId,
      confirmationToken: mealPreview.body.confirmation.confirmationToken,
      payloadHash: mealPreview.body.confirmation.payloadHash,
      expiresAt: mealPreview.body.confirmation.expiresAt,
      type: "confirmation_required"
    });
    expect(mealConfirm.status).toBe(200);
    expect(mealConfirm.body.ok).toBe(true);
    expect(ctx.domain.loadAgentCheckpoint(sessionId)).not.toBeNull();
    const afterMeal = snapshotHousehold(ctx.domain);
    expect(afterMeal.completedMeals).toBeGreaterThanOrEqual(1);
    expect(afterMeal.remainingEnergy).toBeLessThan(remainingBeforeMeal);
    expect(afterMeal.remainingEnergy).toBeLessThan(remainingBeforeRestock);
    expect(afterMeal.tofuG).toBeLessThanOrEqual(tofuAfterRestock);
    expect(afterMeal.caregiverTasks).toBe(1);

    const cleared = await request(app)
      .post(`/api/agent/sessions/${sessionId}/clear`)
      .set("X-PrivatePlate-Session", sessionId);
    expect(cleared.status).toBe(200);
    expect(cleared.body).toMatchObject({ ok: true, sessionId });
    expect(ctx.domain).toBe(domainRef);
    expect(sqliteMainFile(ctx.domain)).toBe(sqlitePathBefore);
    expect(ctx.domain.loadAgentCheckpoint(sessionId)).toBeNull();
    expect(snapshotHousehold(ctx.domain)).toEqual(afterMeal);

    const emptySession = await getSession(app, sessionId);
    expect(emptySession.plan).toBeNull();
    expect(emptySession.state.activePlanId).toBeNull();
    expect(emptySession.state.pendingActionId).toBeNull();
    expect(emptySession.pendingConfirmationExists).toBe(false);

    ctx.domain.close();
    ctx = await createAppContext({
      config: mockAgentTestConfig({ databasePath })
    });
    const reopened = createApp(ctx);
    expect(sqliteMainFile(ctx.domain)).toBe(sqlitePathBefore);
    expect(ctx.domain.loadAgentCheckpoint(sessionId)).toBeNull();
    expect(snapshotHousehold(ctx.domain)).toEqual(afterMeal);

    const day = await request(reopened).get(
      `/api/households/${householdId}/day-context`
    );
    expect(day.status).toBe(200);
    expect(day.body.completedMeals.length).toBeGreaterThanOrEqual(1);
    expect(day.body.householdIntake.remaining.energyKcal).toBe(
      afterMeal.remainingEnergy
    );
    const tofuRow = day.body.inventory.find(
      (item: { foodId: string | null }) => item.foodId === "food-tofu"
    );
    expect(tofuRow?.quantity.estimateG).toBe(afterMeal.tofuG);

    const freshSession = await getSession(reopened, sessionId);
    expect(freshSession.plan).toBeNull();
    expect(freshSession.state.activePlanId).toBeNull();
  });

  it("structure_only fail-closed: ambiguous recipient does not send or write", async () => {
    expect(EVIDENCE_CLASS).toBe("structure_only");
    ctx = await createAppContext({ config: mockAgentTestConfig() });
    const app = createApp(ctx);
    const sessionId = "flagship-fail-closed";

    await runTurn(
      app,
      ctx,
      sessionId,
      "中午我们三个人吃什么？不要鸡腿。",
      [...DINERS]
    );
    expect(ctx.sessions.getState(sessionId).activePlanId).toBeTruthy();
    const before = snapshotHousehold(ctx.domain);
    expect(before.caregiverTasks).toBe(0);

    const ambiguous = await runTurn(
      app,
      ctx,
      sessionId,
      "把任务发给执行者。"
    );
    expect(ambiguous.tools).not.toContain("preview_caregiver_task");
    expect(ambiguous.confirmation).toBeNull();
    expect(snapshotHousehold(ctx.domain)).toEqual(before);
    expect(openPendingCount(ctx.domain)).toBe(0);
    expect(ctx.sessions.getState(sessionId).pendingActionId).toBeNull();
  });
});

async function runTurn(
  app: Express,
  ctx: AppContext,
  sessionId: string,
  text: string,
  dinerIds?: string[]
) {
  const accepted = await request(app)
    .post("/api/agent/runs")
    .send({
      sessionId,
      text,
      ...(dinerIds ? { dinerIds } : {})
    });
  expect(accepted.status).toBe(202);
  const runId = String(accepted.body.runId);
  await waitUntil(() => ctx.runs.get(runId)?.status !== "running");
  const stream = await request(app)
    .get(`/api/agent/runs/${runId}/events`)
    .query({ sessionId });
  const events = parseEvents(stream.text);
  const tools = events
    .filter(
      (event): event is Extract<AgentEvent, { type: "action_started" }> =>
        event.type === "action_started"
    )
    .map((event) => event.tool);
  const confirmation =
    events.find(
      (event): event is ConfirmationRequiredEvent =>
        event.type === "confirmation_required"
    ) ?? null;
  return { events, tools, confirmation, runId };
}

async function confirmPending(
  app: Express,
  sessionId: string,
  confirmation: ConfirmationRequiredEvent
) {
  return request(app)
    .post(`/api/pending-actions/${confirmation.pendingActionId}/confirm`)
    .set("X-PrivatePlate-Session", sessionId)
    .send({
      sessionId,
      confirmationToken: confirmation.confirmationToken,
      idempotencyKey: `structure-only-${confirmation.pendingActionId}`,
      expectedPayloadHash: confirmation.payloadHash
    });
}

async function getSession(app: Express, sessionId: string) {
  const response = await request(app)
    .get(`/api/agent/sessions/${sessionId}`)
    .set("X-PrivatePlate-Session", sessionId);
  expect(response.status).toBe(200);
  return response.body as {
    plan: {
      version: number;
      dinerIds?: string[];
      sharedTemplates?: Array<{ templateId: string }>;
    } | null;
    state: {
      activePlanId: string | null;
      pendingActionId: string | null;
    };
    pendingConfirmationExists: boolean;
  };
}

function menuTemplateIds(plan: {
  sharedTemplates?: Array<{ templateId: string }>;
} | null): string[] {
  return plan?.sharedTemplates?.map((item) => item.templateId) ?? [];
}

function snapshotHousehold(domain: PrivatePlateDomain) {
  const day = domain.getDayContext({ dinerIds: [...DINERS] });
  return {
    tofuG:
      day.inventory.find((item) => item.foodId === "food-tofu")?.quantity
        .estimateG ?? 0,
    remainingEnergy: day.householdIntake.remaining.energyKcal,
    completedMeals: day.completedMeals.length,
    caregiverTasks: caregiverTaskCount(domain)
  };
}

function dayInventoryGrams(domain: PrivatePlateDomain, foodId: string) {
  return domain
    .getDayContext({ dinerIds: [...DINERS] })
    .inventory.find((item) => item.foodId === foodId)?.quantity.estimateG;
}

function dayRemainingEnergy(domain: PrivatePlateDomain) {
  return domain.getDayContext({ dinerIds: [...DINERS] }).householdIntake
    .remaining.energyKcal;
}

function caregiverTaskCount(domain: PrivatePlateDomain): number {
  const row = domain.db
    .prepare(`SELECT COUNT(*) AS c FROM caregiver_tasks`)
    .get() as { c: number };
  return Number(row.c);
}

function openPendingCount(domain: PrivatePlateDomain): number {
  const row = domain.db
    .prepare(`SELECT COUNT(*) AS c FROM pending_actions WHERE status = 'pending'`)
    .get() as { c: number };
  return Number(row.c);
}

function sqliteMainFile(target: PrivatePlateDomain): string {
  const rows = target.db.prepare("PRAGMA database_list").all() as Array<{
    name: string;
    file: string;
  }>;
  return rows.find((row) => row.name === "main")?.file ?? "";
}

function parseEvents(text: string): AgentEvent[] {
  const events: AgentEvent[] = [];
  for (const block of text.split("\n\n")) {
    const name = block
      .split("\n")
      .find((line) => line.startsWith("event: "))
      ?.slice("event: ".length);
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice("data: ".length))
      .join("\n");
    if (!name || name === "stream_end" || !data) continue;
    events.push(JSON.parse(data) as AgentEvent);
  }
  return events;
}

async function waitUntil(predicate: () => boolean, attempts = 400): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("timed out waiting for condition");
}
