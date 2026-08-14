import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { sharedDisplayForbiddenLabelRe } from "@privateplate/domain";
import { createApp, createAppContext, type AppContext } from "./app.js";
import { mockAgentTestConfig } from "./runtime-config.js";
import { toBrowserDayContext } from "./web-day-context.js";

describe("HTTP day-context omits disease labels for the browser", () => {
  let app: Express;
  let ctx: AppContext;

  beforeAll(async () => {
    ctx = await createAppContext({ config: mockAgentTestConfig() });
    app = createApp(ctx);
  });

  afterAll(() => {
    ctx.domain.close();
  });

  it("keeps healthFacts on Domain.getDayContext used by Agent tools", () => {
    const day = ctx.domain.getDayContext();
    expect(day.members.some((member) => member.healthFacts.length > 0)).toBe(true);
    expect(day.sharedDisplay.members.length).toBeGreaterThan(0);
    const mapped = toBrowserDayContext(day);
    const serialized = JSON.stringify(mapped);
    expect(serialized).not.toMatch(/healthFacts|healthTags|nutritionProfile/);
    expect(serialized).not.toMatch(sharedDisplayForbiddenLabelRe());
    expect(serialized).not.toMatch(/血糖管理|血压管理|体重管理/);
    expect(mapped.sharedDisplay).toBeDefined();
    expect(mapped.inventoryVersion).toBe(day.inventoryVersion);
  });

  it("GET /day-context returns the mapped browser payload", async () => {
    const status = await request(app).get("/api/runtime/status");
    expect(status.status).toBe(200);
    const day = await request(app).get(
      `/api/households/${status.body.householdId}/day-context`
    );
    expect(day.status).toBe(200);
    expect(day.body.householdIntake.remaining.energyKcal).toBeGreaterThan(0);
    expect(day.body.memberIntake[0]?.target).toBeDefined();
    expect(day.body.memberIntake[0]?.consumed).toBeDefined();
    expect(day.body.completedMeals).toEqual(expect.any(Array));
    expect(day.body.inventoryVersion).toEqual(expect.any(Number));
    expect(day.body.sharedDisplay.members.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(day.body);
    expect(serialized).not.toMatch(/healthFacts|healthTags/);
    expect(serialized).not.toMatch(sharedDisplayForbiddenLabelRe());
    expect(day.body.members?.[0]?.healthFacts).toBeUndefined();
  });
});
