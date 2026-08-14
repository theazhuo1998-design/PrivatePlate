/**
 * Keep in sync with packages/domain/src/hub-loop.ts.
 * Web cannot import domain (node:sqlite barrel). Pure helpers only.
 */
import type { DayContext, HouseholdContext, MealPlan } from "./api";
import { isSharedSafeCue } from "./device-surface";
import { foodName, memberName } from "./formatters";

export const KEY_LOOP_FOOD_IDS = ["food-rice-cooked", "food-tofu"] as const;

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

export function avoidCueForFood(foodId: string): string {
  return `避${foodName(foodId)}`;
}

export function mergeOperationalCues(input: {
  sharedCues: string[];
  avoidFoodIds: string[];
}): string[] {
  const specificAvoids = input.avoidFoodIds.map(avoidCueForFood);
  const fromShared = input.sharedCues.filter((cue) => {
    if (!isSharedSafeCue(cue)) return false;
    if (cue === GENERIC_AVOID_CUE) return specificAvoids.length === 0;
    return true;
  });
  return unique([...fromShared, ...specificAvoids].filter(isSharedSafeCue));
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
  ]).filter(
    (foodId) =>
      KEY_LOOP_FOOD_IDS.includes(foodId as (typeof KEY_LOOP_FOOD_IDS)[number]) ||
      gramsChanged(beforeByFood.get(foodId), afterByFood.get(foodId))
  );

  for (const foodId of foodIds) {
    const delta = (afterByFood.get(foodId) ?? 0) - (beforeByFood.get(foodId) ?? 0);
    const rounded = Math.round(delta);
    if (rounded === 0) continue;
    lines.push({
      kind: "inventory",
      text: `库存 ${signedPrefix(rounded)}${foodName(foodId)} ${Math.abs(rounded)}g`
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

export function captureHubLoopSnapshot(input: {
  dayContext: DayContext | null;
  context: HouseholdContext | null;
  memberLookup: Map<string, string>;
}): HubLoopSnapshot {
  const remaining =
    input.dayContext?.sharedDisplay?.household.remaining ??
    input.dayContext?.householdIntake.remaining ??
    null;
  const inventory = hubInventoryItems(input.dayContext, input.context);
  return {
    householdRemaining: remaining
      ? {
          energyKcal: remaining.energyKcal,
          carbohydrateG: remaining.carbohydrateG,
          sodiumMg: remaining.sodiumMg
        }
      : null,
    completedMealsCount: input.dayContext?.completedMeals.length ?? 0,
    inventoryVersion:
      input.dayContext?.inventoryVersion ?? input.context?.inventoryVersion ?? null,
    inventory,
    members: memberRemainingSnapshot(input.dayContext, input.memberLookup),
    cues: householdCueLines(input.dayContext, input.context, input.memberLookup)
  };
}

export function householdCueLines(
  dayContext: DayContext | null,
  context: HouseholdContext | null,
  memberLookup: Map<string, string>
): string[] {
  const members =
    dayContext?.sharedDisplay?.members ??
    (context?.members ?? []).map((member) => ({
      memberId: member.id,
      displayName: member.displayName,
      operationalCues: [] as string[]
    }));
  return members
    .map((member) => {
      const avoids = avoidFoodIdsForMember(member.memberId, dayContext, context);
      const cues = mergeOperationalCues({
        sharedCues: member.operationalCues ?? [],
        avoidFoodIds: avoids
      });
      if (cues.length === 0) return null;
      const name =
        member.displayName ||
        memberLookup.get(member.memberId) ||
        memberName(member.memberId);
      return `${name}：${cues.join("、")}`;
    })
    .filter((line): line is string => line != null);
}

export function avoidFoodIdsForMember(
  memberId: string,
  dayContext: DayContext | null,
  context: HouseholdContext | null
): string[] {
  const fromDay = (dayContext?.members ?? [])
    .find((member) => member.id === memberId)
    ?.hardConstraints?.filter((constraint) => constraint.kind === "avoid_ingredient")
    .map((constraint) => constraint.targetId) ?? [];
  const fromContext = (context?.constraints ?? [])
    .filter(
      (constraint) =>
        constraint.memberId === memberId && constraint.kind === "avoid_ingredient"
    )
    .map((constraint) => constraint.targetId);
  return unique([...fromDay, ...fromContext]);
}

export function memberDetailRows(
  dayContext: DayContext | null,
  plan: MealPlan | null,
  memberLookup: Map<string, string>
): Array<{
  memberId: string;
  name: string;
  cues: string[];
  reasonLines: string[];
  target: { energyKcal: number; carbohydrateG: number } | null;
  consumed: { energyKcal: number; carbohydrateG: number } | null;
  remaining: { energyKcal: number; carbohydrateG: number };
  plannedItems: Array<{ foodId: string; quantityG: number }>;
}> {
  const shared = dayContext?.sharedDisplay?.members ?? [];
  const intakeById = new Map(
    (dayContext?.memberIntake ?? []).map((row) => [row.memberId, row])
  );
  const planItemsByMember = plannedItemsByMember(plan);
  if (shared.length > 0) {
    return shared.map((member) => {
      const intake = member.intake ?? intakeById.get(member.memberId);
      const planned =
        member.plannedIntake?.items.map((item) => ({
          foodId: item.foodId,
          quantityG: item.quantityG
        })) ?? planItemsByMember.get(member.memberId) ?? [];
      return {
        memberId: member.memberId,
        name: member.displayName,
        cues: mergeOperationalCues({
          sharedCues: member.operationalCues,
          avoidFoodIds: avoidFoodIdsForMember(member.memberId, dayContext, null)
        }),
        reasonLines: (member.reasonLines ?? []).filter(isSharedSafeCue),
        target: intake?.target
          ? {
              energyKcal: intake.target.energyKcal,
              carbohydrateG: intake.target.carbohydrateG
            }
          : null,
        consumed: intake?.consumed
          ? {
              energyKcal: intake.consumed.energyKcal,
              carbohydrateG: intake.consumed.carbohydrateG
            }
          : null,
        remaining: {
          energyKcal: intake?.remaining.energyKcal ?? 0,
          carbohydrateG: intake?.remaining.carbohydrateG ?? 0
        },
        plannedItems: collapseFoodGrams(planned)
      };
    });
  }
  return (dayContext?.memberIntake ?? []).map((row) => ({
    memberId: row.memberId,
    name: memberLookup.get(row.memberId) ?? memberName(row.memberId),
    cues: [],
    reasonLines: [],
    target: row.target
      ? {
          energyKcal: row.target.energyKcal,
          carbohydrateG: row.target.carbohydrateG
        }
      : null,
    consumed: row.consumed
      ? {
          energyKcal: row.consumed.energyKcal,
          carbohydrateG: row.consumed.carbohydrateG
        }
      : null,
    remaining: {
      energyKcal: row.remaining.energyKcal,
      carbohydrateG: row.remaining.carbohydrateG
    },
    plannedItems: collapseFoodGrams(planItemsByMember.get(row.memberId) ?? [])
  }));
}

export function mealTypeLabel(mealType: string): string {
  if (mealType === "lunch") return "午餐";
  if (mealType === "dinner") return "晚餐";
  if (mealType === "breakfast") return "早餐";
  if (mealType === "snack") return "加餐";
  return mealType;
}

export function formatCompletedAt(
  iso: string | null | undefined,
  timeZone = "Asia/Shanghai"
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function hubInventoryItems(
  dayContext: DayContext | null,
  context: HouseholdContext | null
): HubLoopInventoryItem[] {
  if (context) {
    return context.inventory.map((item) => ({
      foodId: item.foodId,
      estimateG: item.quantity.normalized.estimateG
    }));
  }
  return (dayContext?.inventory ?? [])
    .filter((item): item is typeof item & { foodId: string } => item.foodId != null)
    .map((item) => ({
      foodId: item.foodId,
      estimateG: item.quantity.estimateG
    }));
}

function memberRemainingSnapshot(
  dayContext: DayContext | null,
  memberLookup: Map<string, string>
): HubLoopMemberRemaining[] {
  const shared = dayContext?.sharedDisplay?.members ?? [];
  if (shared.length > 0) {
    return shared.map((member) => ({
      memberId: member.memberId,
      displayName: member.displayName,
      energyKcal: member.intake?.remaining.energyKcal ??
        dayContext?.memberIntake.find((row) => row.memberId === member.memberId)
          ?.remaining.energyKcal ??
        0,
      carbohydrateG:
        member.intake?.remaining.carbohydrateG ??
        dayContext?.memberIntake.find((row) => row.memberId === member.memberId)
          ?.remaining.carbohydrateG ??
        0
    }));
  }
  return (dayContext?.memberIntake ?? []).map((row) => ({
    memberId: row.memberId,
    displayName: memberLookup.get(row.memberId) ?? memberName(row.memberId),
    energyKcal: row.remaining.energyKcal,
    carbohydrateG: row.remaining.carbohydrateG
  }));
}

function plannedItemsByMember(
  plan: MealPlan | null
): Map<string, Array<{ foodId: string; quantityG: number }>> {
  const map = new Map<string, Array<{ foodId: string; quantityG: number }>>();
  if (!plan) return map;
  const allocations = plan.plannedIntake?.byMember ?? plan.memberAllocations;
  for (const allocation of allocations) {
    const items = (allocation.items ?? []).map((item) => ({
      foodId: item.foodId,
      quantityG: item.quantityG
    }));
    map.set(allocation.memberId, items);
  }
  return map;
}

function collapseFoodGrams(
  items: Array<{ foodId: string; quantityG: number }>
): Array<{ foodId: string; quantityG: number }> {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.foodId, (totals.get(item.foodId) ?? 0) + item.quantityG);
  }
  return [...totals.entries()].map(([foodId, quantityG]) => ({ foodId, quantityG }));
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
