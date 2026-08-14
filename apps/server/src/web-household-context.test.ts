import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { sharedDisplayForbiddenLabelRe } from "@privateplate/domain";
import { createApp, createAppContext, type AppContext } from "./app.js";
import { mockAgentTestConfig } from "./runtime-config.js";
import { toBrowserHouseholdContext } from "./web-household-context.js";

describe("HTTP household context omits sensitive member fields", () => {
  let app: Express;
  let ctx: AppContext;

  beforeAll(async () => {
    ctx = await createAppContext({ config: mockAgentTestConfig() });
    app = createApp(ctx);
  });

  afterAll(() => {
    ctx.domain.close();
  });

  it("keeps healthTags, nutritionProfile, and notes on Domain.getMealContext", () => {
    const mealContext = ctx.domain.getMealContext();
    expect(mealContext.members.some((member) => member.healthTags.length > 0)).toBe(
      true
    );
    expect(
      mealContext.members.some((member) => member.nutritionProfile != null)
    ).toBe(true);
    expect(mealContext.members.some((member) => Boolean(member.notes))).toBe(true);
    const mapped = toBrowserHouseholdContext(
      mealContext,
      ctx.domain.getDayContext().sharedDisplay
    );
    const serialized = JSON.stringify(mapped);
    expect(serialized).not.toMatch(
      /healthTags|nutritionProfile|"notes"|frozenPreferences|mealPolicies|allMembers/
    );
    expect(serialized).not.toMatch(sharedDisplayForbiddenLabelRe());
    expect(serialized).not.toMatch(/heightCm|weightKg|birthYear/);
    expect(mapped.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "mem-father",
          displayName: "父亲",
          operationalCues: expect.any(Array)
        })
      ])
    );
  });

  it("GET /context returns the mapped browser payload", async () => {
    const status = await request(app).get("/api/runtime/status");
    expect(status.status).toBe(200);
    const context = await request(app).get(
      `/api/households/${status.body.householdId}/context`
    );
    expect(context.status).toBe(200);
    expect(context.body.members[0]?.id).toBeTruthy();
    expect(context.body.members[0]?.displayName).toBeTruthy();
    expect(context.body.members[0]?.healthTags).toBeUndefined();
    expect(context.body.members[0]?.nutritionProfile).toBeUndefined();
    expect(context.body.members[0]?.notes).toBeUndefined();
    expect(context.body.frozenPreferences).toBeUndefined();
    expect(context.body.mealPolicies).toBeUndefined();
    expect(context.body.allMembers).toBeUndefined();
    const serialized = JSON.stringify(context.body);
    expect(serialized).not.toMatch(/healthTags|nutritionProfile/);
    expect(serialized).not.toMatch(sharedDisplayForbiddenLabelRe());
    expect(serialized).not.toMatch(/合成人物|少油，仅作演示/);
  });
});
