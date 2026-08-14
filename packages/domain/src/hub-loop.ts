/**
 * Pure Home Hub closed-loop helpers. No React, no SQLite.
 * Web keeps a matching copy in apps/web/src/hub-loop.ts (no domain import).
 */

export const KEY_LOOP_FOOD_IDS = ["food-rice-cooked", "food-tofu"] as const;

const KEY_FOOD_NAMES: Record<string, string> = {
  "food-rice-cooked": "熟米饭",
  "food-tofu": "豆腐",
  "food-egg": "鸡蛋",
  "food-beef": "牛肉",
  "food-chicken-leg": "鸡腿",
  "food-cabbage": "白菜"
};

const GENERIC_AVOID_CUE = "避指定食材";

export type HubLoopInventoryItem = {
  foodId: string;
  estimateG: number | null;
};

export type HubLoopMemberRemaining = {
  memberId: string;
  displayName: string;
  energyKcal: number;
  carbohydrateG: number;
};

export type HubLoopSnapshot = {
  householdRemaining: {
    energyKcal: number;
    carbohydrateG: number;
    sodiumMg: number;
  } | null;
  completedMealsCount: number;
  inventoryVersion: number | null;
  inventory: HubLoopInventoryItem[];
  members: HubLoopMemberRemaining[];
  cues: string[];
};

export type HubLoopDeltaLine = {
  kind: "inventory" | "remaining" | "member" | "meals" | "cue" | "version";
  text: string;
};

export function foodDisplayName(foodId: string): string {
  return KEY_FOOD_NAMES[foodId] ?? foodId.replace(/^food-/, "").replaceAll("-", "");
}

export function avoidCueForFood(foodId: string): string {
  return `避${foodDisplayName(foodId)}`;
}

export function mergeOperationalCues(input: {
  sharedCues: string[];
  avoidFoodIds: string[];
}): string[] {
  const specificAvoids = input.avoidFoodIds.map(avoidCueForFood);
  const fromShared = input.sharedCues.filter((cue) => {
    if (cue === GENERIC_AVOID_CUE) return specificAvoids.length === 0;
    return cue.trim().length > 0;
  });
  return unique([...fromShared, ...specificAvoids]);
}

export function computeHubLoopDelta(
  before: HubLoopSnapshot,
  after: HubLoopSnapshot
): HubLoopDeltaLine[] {
  const lines: HubLoopDeltaLine[] = [];

  const beforeByFood = inventoryMap(before.inventory);
  const afterByFood = inventoryMap(after.inventory);
  const foodIds = unique([
    ...KEY_LOOP_FOOD_IDS,
    ...beforeByFood.keys(),
    ...afterByFood.keys()
  ]).filter((foodId) => KEY_LOOP_FOOD_IDS.includes(foodId as (typeof KEY_LOOP_FOOD_IDS)[number]) ||
      gramsChanged(beforeByFood.get(foodId), afterByFood.get(foodId)));

  for (const foodId of foodIds) {
    const delta = (afterByFood.get(foodId) ?? 0) - (beforeByFood.get(foodId) ?? 0);
    const rounded = Math.round(delta);
    if (rounded === 0) continue;
    lines.push({
      kind: "inventory",
      text: `库存 ${signedPrefix(rounded)}${foodDisplayName(foodId)} ${Math.abs(rounded)}g`
    });
  }

  if (before.householdRemaining && after.householdRemaining) {
    const energy = Math.round(
      after.householdRemaining.energyKcal - before.householdRemaining.energyKcal
    );
    if (energy !== 0) {
      lines.push({
        kind: "remaining",
        text: `全家剩余热量 ${signedNumber(energy)} kcal`
      });
    }
    const carb = Math.round(
      after.householdRemaining.carbohydrateG - before.householdRemaining.carbohydrateG
    );
    if (carb !== 0) {
      lines.push({
        kind: "remaining",
        text: `全家剩余碳水 ${signedNumber(carb)}g`
      });
    }
  }

  const afterMembers = new Map(after.members.map((row) => [row.memberId, row]));
  for (const member of before.members) {
    const next = afterMembers.get(member.memberId);
    if (!next) continue;
    const carb = Math.round(next.carbohydrateG - member.carbohydrateG);
    if (carb !== 0) {
      lines.push({
        kind: "member",
        text: `${member.displayName}剩余碳水 ${signedNumber(carb)}g`
      });
    }
    const energy = Math.round(next.energyKcal - member.energyKcal);
    if (energy !== 0 && carb === 0) {
      lines.push({
        kind: "member",
        text: `${member.displayName}剩余热量 ${signedNumber(energy)} kcal`
      });
    }
  }

  const meals = after.completedMealsCount - before.completedMealsCount;
  if (meals !== 0) {
    lines.push({
      kind: "meals",
      text: `已完成餐 ${signedNumber(meals)}`
    });
  }

  if (
    before.inventoryVersion != null &&
    after.inventoryVersion != null &&
    after.inventoryVersion !== before.inventoryVersion &&
    !lines.some((line) => line.kind === "inventory")
  ) {
    lines.push({
      kind: "version",
      text: `库存版本 v${before.inventoryVersion} → v${after.inventoryVersion}`
    });
  }

  const beforeCues = new Set(before.cues);
  for (const cue of after.cues) {
    if (!beforeCues.has(cue)) {
      lines.push({ kind: "cue", text: `执行提示：${cue}` });
    }
  }

  return lines;
}

function inventoryMap(items: HubLoopInventoryItem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!item.foodId || item.estimateG == null) continue;
    map.set(item.foodId, (map.get(item.foodId) ?? 0) + item.estimateG);
  }
  return map;
}

function gramsChanged(before: number | undefined, after: number | undefined): boolean {
  return Math.round((after ?? 0) - (before ?? 0)) !== 0;
}

function signedPrefix(value: number): string {
  return value < 0 ? "−" : "+";
}

function signedNumber(value: number): string {
  return `${signedPrefix(value)}${Math.abs(value)}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
