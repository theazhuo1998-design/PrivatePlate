import { describe, expect, it } from "vitest";
import type { DayContext, HouseholdContext, MealPlan, NutritionSnapshot } from "./api";
import { isSharedSafeCue } from "./device-surface";
import {
  captureHubLoopSnapshot,
  computeHubLoopDelta,
  formatCompletedAt,
  householdCueLines,
  mealTypeLabel,
  memberDetailRows,
  mergeOperationalCues
} from "./hub-loop";

function nutrition(energyKcal: number): NutritionSnapshot {
  return {
    energyKcal,
    carbohydrateG: energyKcal / 10,
    proteinG: energyKcal / 20,
    fatG: energyKcal / 30,
    sodiumMg: energyKcal
  };
}

function dayContext(overrides: Partial<DayContext> = {}): DayContext {
  return {
    householdId: "hh-demo-001",
    serviceDate: "2026-08-13",
    inventoryVersion: 1,
    householdIntake: {
      target: nutrition(2000),
      consumed: nutrition(0),
      remaining: nutrition(1800)
    },
    memberIntake: [
      {
        memberId: "mem-father",
        target: nutrition(1800),
        consumed: nutrition(0),
        remaining: nutrition(1800)
      }
    ],
    completedMeals: [],
    inventory: [
      {
        foodId: "food-tofu",
        rawName: "豆腐",
        quantity: { estimateG: 700 }
      }
    ],
    members: [
      {
        id: "mem-father",
        displayName: "父亲",
        hardConstraints: [
          { id: "c-egg", kind: "avoid_ingredient", targetId: "food-egg" }
        ]
      }
    ],
    sharedDisplay: {
      serviceDate: "2026-08-13",
      household: { remaining: nutrition(1800) },
      members: [
        {
          memberId: "mem-father",
          displayName: "父亲",
          operationalCues: ["主食小份", "糖尿病", "避指定食材"],
          reasonLines: ["主食小份", "血糖管理"],
          intake: {
            target: nutrition(1800),
            consumed: nutrition(0),
            remaining: nutrition(1800)
          }
        }
      ]
    },
    ...overrides
  };
}

const memberLookup = new Map([["mem-father", "父亲"]]);

describe("day-context / hub-loop display conversion", () => {
  it("captures remaining, inventory, meals, and shared-safe cues", () => {
    const snapshot = captureHubLoopSnapshot({
      dayContext: dayContext(),
      context: null,
      memberLookup
    });
    expect(snapshot.householdRemaining?.energyKcal).toBe(1800);
    expect(snapshot.inventory).toEqual([{ foodId: "food-tofu", estimateG: 700 }]);
    expect(snapshot.completedMealsCount).toBe(0);
    expect(snapshot.members[0]?.displayName).toBe("父亲");
    expect(snapshot.cues.join(" ")).toContain("父亲：");
    expect(snapshot.cues.join(" ")).toContain("主食小份");
    expect(snapshot.cues.join(" ")).toContain("避鸡蛋");
    expect(snapshot.cues.join(" ")).not.toMatch(/糖尿病|血糖管理/);
  });

  it("prefers household context inventory grams when both sources exist", () => {
    const context = {
      householdId: "hh-demo-001",
      householdContextVersion: 1,
      inventoryVersion: 4,
      mealPolicyVersion: "demo",
      members: [{ id: "mem-father", displayName: "父亲", roleLabel: "father" }],
      constraints: [
        {
          id: "c-egg",
          memberId: "mem-father",
          kind: "avoid_ingredient",
          targetId: "food-egg"
        }
      ],
      inventory: [
        {
          id: "inv-tofu",
          foodId: "food-tofu",
          priorityConsume: true,
          quantity: {
            rawExpression: "3盒",
            normalized: {
              confidence: "exact",
              estimateG: 1050,
              minG: 1050,
              maxG: 1050
            }
          }
        }
      ]
    } as HouseholdContext;
    const snapshot = captureHubLoopSnapshot({
      dayContext: dayContext({ inventoryVersion: 4 }),
      context,
      memberLookup
    });
    expect(snapshot.inventoryVersion).toBe(4);
    expect(snapshot.inventory).toEqual([{ foodId: "food-tofu", estimateG: 1050 }]);
  });

  it("maps meal type and completed-at for the hub timeline", () => {
    expect(mealTypeLabel("dinner")).toBe("晚餐");
    expect(mealTypeLabel("lunch")).toBe("午餐");
    expect(formatCompletedAt("2026-08-13T12:05:00+08:00")).toBe("12:05");
    expect(formatCompletedAt(null)).toBeNull();
  });

  it("memberDetailRows drops disease reason lines and keeps operational cues", () => {
    const plan = {
      id: "plan-1",
      version: 1,
      status: "valid",
      bundleId: "agent",
      sharedTemplates: [],
      memberAllocations: [
        {
          memberId: "mem-father",
          nutrition: nutrition(400),
          items: [
            {
              templateId: "tpl-leftover-rice",
              role: "staple",
              foodId: "food-rice-cooked",
              quantityG: 120
            }
          ],
          portionUnitsByRole: {}
        }
      ],
      shoppingGap: [],
      rejectedFoodIds: [],
      rejectedTemplateIds: []
    } as MealPlan;
    const rows = memberDetailRows(dayContext(), plan, memberLookup);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.cues).toEqual(["主食小份", "避鸡蛋"]);
    expect(rows[0]?.reasonLines).toEqual(["主食小份"]);
    expect(rows[0]?.reasonLines.every(isSharedSafeCue)).toBe(true);
    expect(rows[0]?.plannedItems).toEqual([
      { foodId: "food-rice-cooked", quantityG: 120 }
    ]);
  });
});

describe("privacy mergeOperationalCues", () => {
  it("replaces the generic avoid cue with a food name and drops disease labels", () => {
    expect(
      mergeOperationalCues({
        sharedCues: ["主食小份", "糖尿病", "避指定食材", "血糖管理"],
        avoidFoodIds: ["food-egg"]
      })
    ).toEqual(["主食小份", "避鸡蛋"]);
  });
});

describe("confirm-refresh / delta helpers", () => {
  it("turns a confirm-refresh before/after pair into hub delta lines", () => {
    const lookup = new Map([["mem-father", "父亲"]]);
    const before = captureHubLoopSnapshot({
      dayContext: dayContext(),
      context: null,
      memberLookup: lookup
    });
    const after = captureHubLoopSnapshot({
      dayContext: dayContext({
        inventoryVersion: 2,
        householdIntake: {
          target: nutrition(2000),
          consumed: nutrition(600),
          remaining: nutrition(1200)
        },
        memberIntake: [
          {
            memberId: "mem-father",
            remaining: nutrition(1400)
          }
        ],
        completedMeals: [
          {
            id: "meal-1",
            mealType: "lunch",
            completedAt: "2026-08-13T12:05:00+08:00"
          }
        ],
        inventory: [
          {
            foodId: "food-tofu",
            rawName: "豆腐",
            quantity: { estimateG: 350 }
          }
        ],
        sharedDisplay: {
          serviceDate: "2026-08-13",
          household: { remaining: nutrition(1200) },
          members: [
            {
              memberId: "mem-father",
              displayName: "父亲",
              operationalCues: ["主食小份", "避鸡蛋"],
              intake: {
                target: nutrition(1800),
                consumed: nutrition(400),
                remaining: nutrition(1400)
              }
            }
          ]
        }
      }),
      context: null,
      memberLookup: lookup
    });
    const lines = computeHubLoopDelta(before, after).map((line) => line.text);
    expect(lines).toContain("库存 −豆腐 350g");
    expect(lines).toContain("全家剩余热量 −600 kcal");
    expect(lines).toContain("已完成餐 +1");
    expect(lines.some((text) => text.includes("父亲剩余"))).toBe(true);
  });

  it("does not emit a fridge clock when nothing changed", () => {
    const snapshot = captureHubLoopSnapshot({
      dayContext: dayContext(),
      context: null,
      memberLookup
    });
    expect(computeHubLoopDelta(snapshot, snapshot)).toEqual([]);
  });
});

describe("householdCueLines", () => {
  it("joins member cues without leaking healthTags", () => {
    const lines = householdCueLines(dayContext(), null, memberLookup);
    expect(lines.join(" ")).toMatch(/父亲：/);
    expect(lines.join(" ")).not.toMatch(/糖尿病|hypertension|healthTags/);
  });
});
