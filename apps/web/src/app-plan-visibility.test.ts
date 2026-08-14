import { describe, expect, it } from "vitest";
import type { MealPlan, UiOnly } from "./api";
import { hasPlanWorkspaceData } from "./App";

const plan = { id: "plan-1" } as MealPlan;

function confirmation(actionType?: string): UiOnly {
  return {
    pendingActionId: "pending-1",
    confirmationToken: "token",
    payloadHash: "hash",
    expiresAt: "2099-01-01T00:00:00.000Z",
    ...(actionType ? { actionType } : {})
  };
}

describe("plan drawer visibility", () => {
  it("stays closed without a real plan or meal confirmation", () => {
    expect(hasPlanWorkspaceData(null, null, null)).toBe(false);
  });

  it("opens for a real meal plan", () => {
    expect(hasPlanWorkspaceData(plan, null, null)).toBe(true);
  });

  it("opens for a meal-plan confirmation or orphaned pending action", () => {
    expect(hasPlanWorkspaceData(null, confirmation("caregiver_task_send"), null)).toBe(
      true
    );
    expect(hasPlanWorkspaceData(null, confirmation(), null)).toBe(true);
    expect(hasPlanWorkspaceData(null, null, "pending-orphan")).toBe(true);
  });

  it("does not treat inventory or member previews as the meal-plan drawer", () => {
    expect(
      hasPlanWorkspaceData(null, confirmation("inventory_restock"), null)
    ).toBe(false);
    expect(
      hasPlanWorkspaceData(null, confirmation("member_memory_change"), null)
    ).toBe(false);
  });
});
