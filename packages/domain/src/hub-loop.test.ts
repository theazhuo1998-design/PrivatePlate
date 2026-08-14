import { describe, expect, it } from "vitest";
import {
  avoidCueForFood,
  computeHubLoopDelta,
  mergeOperationalCues,
  type HubLoopSnapshot
} from "./hub-loop.js";

function snapshot(overrides: Partial<HubLoopSnapshot> = {}): HubLoopSnapshot {
  return {
    householdRemaining: {
      energyKcal: 1800,
      carbohydrateG: 210,
      sodiumMg: 1800
    },
    completedMealsCount: 0,
    inventoryVersion: 1,
    inventory: [
      { foodId: "food-tofu", estimateG: 700 },
      { foodId: "food-rice-cooked", estimateG: 400 }
    ],
    members: [
      {
        memberId: "mem-father",
        displayName: "父亲",
        energyKcal: 1800,
        carbohydrateG: 180
      }
    ],
    cues: ["父亲：主食小份"],
    ...overrides
  };
}

describe("hub-loop delta", () => {
  it("reports remaining, inventory, and completed-meal changes after meal complete", () => {
    const lines = computeHubLoopDelta(
      snapshot(),
      snapshot({
        householdRemaining: {
          energyKcal: 1200,
          carbohydrateG: 150,
          sodiumMg: 1400
        },
        completedMealsCount: 1,
        inventoryVersion: 2,
        inventory: [
          { foodId: "food-tofu", estimateG: 350 },
          { foodId: "food-rice-cooked", estimateG: 250 }
        ],
        members: [
          {
            memberId: "mem-father",
            displayName: "父亲",
            energyKcal: 1400,
            carbohydrateG: 130
          }
        ]
      })
    );
    expect(lines.map((line) => line.text)).toEqual([
      "库存 −熟米饭 150g",
      "库存 −豆腐 350g",
      "全家剩余热量 −600 kcal",
      "全家剩余碳水 −60g",
      "父亲剩余碳水 −50g",
      "已完成餐 +1"
    ]);
  });

  it("reports restock inventory without inventing a fridge clock", () => {
    const lines = computeHubLoopDelta(
      snapshot(),
      snapshot({
        inventoryVersion: 3,
        inventory: [
          { foodId: "food-tofu", estimateG: 1050 },
          { foodId: "food-rice-cooked", estimateG: 400 }
        ]
      })
    );
    expect(lines.map((line) => line.text)).toEqual(["库存 +豆腐 350g"]);
  });

  it("shows new operational cues after memory confirm", () => {
    const lines = computeHubLoopDelta(
      snapshot(),
      snapshot({
        cues: ["父亲：主食小份", "父亲：避鸡蛋"]
      })
    );
    expect(lines.map((line) => line.text)).toEqual(["执行提示：父亲：避鸡蛋"]);
  });

  it("does not emit zero-change lines", () => {
    expect(computeHubLoopDelta(snapshot(), snapshot())).toEqual([]);
  });
});

describe("operational cue mapping", () => {
  it("turns egg avoid into 避鸡蛋 and drops the generic placeholder", () => {
    expect(avoidCueForFood("food-egg")).toBe("避鸡蛋");
    expect(
      mergeOperationalCues({
        sharedCues: ["主食小份", "避指定食材"],
        avoidFoodIds: ["food-egg"]
      })
    ).toEqual(["主食小份", "避鸡蛋"]);
  });
});
