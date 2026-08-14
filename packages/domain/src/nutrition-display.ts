/**
 * Shared-display projection for the current contest nutrition path.
 * Derives hard limits and execution cues from meal-policy guardrails,
 * constraints, allocation, and day remaining. Not a nutrition engine.
 */
import type {
  MealBudgetBounds,
  MealHardLimits,
  MealPlan,
  MemberHardLimits,
  MemberMealPolicy,
  MemberNutritionBudget,
  NutritionSnapshot,
  SharedHouseholdDisplay,
  SharedMealCap,
  SharedMemberDisplay
} from "@privateplate/contracts";
import {
  NUTRITION_BUDGET_BOUNDARY,
  NUTRITION_BUDGET_FALLBACK_BOUNDARY,
  NUTRITION_BUDGET_VERSION
} from "./nutrition-budget.js";
import { emptyNutritionSnapshot, type DayContext } from "./ledger/types.js";

export const OPERATIONAL_CUE_SMALL_STAPLE = "主食小份";
export const OPERATIONAL_CUE_LOW_SODIUM = "少盐";
export const OPERATIONAL_CUE_AVOID_BEEF = "避牛肉";
export const OPERATIONAL_CUE_WEIGHT_LOSS = "控制热量";
export const OPERATIONAL_CUE_LOW_OIL = "少油";

/** Staple units below this are shown as a small-staple execution cue. */
export const SMALL_STAPLE_THRESHOLD = 0.75;
/** Sodium meal cap below this mg is shown as a low-salt execution cue. */
export const LOW_SODIUM_THRESHOLD_MG = 1000;
/** Carbohydrate meal cap at or below this g is tagged carb_cap. */
export const CARB_CAP_THRESHOLD_G = 70;

const AVOID_INGREDIENT_CUES: Record<string, string> = {
  "food-beef": OPERATIONAL_CUE_AVOID_BEEF
};

const DISEASE_LABEL_RE =
  /糖尿病|高血压|diabetes|hypertension|stable_type2_diabetes_demo|hypertension_demo|weight_management/i;

export type BudgetDisplayInput = {
  budget: MemberNutritionBudget;
  mealPolicies: MemberMealPolicy[];
  hardConstraints: Array<{ kind: string; targetId: string }>;
  preferenceKinds?: string[];
  weightGoal?: "maintain" | "loss" | "gain";
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function hardLimitsFromPolicy(policy: MemberMealPolicy): MealHardLimits {
  const protein = policy.guardrails.proteinG;
  return {
    energyKcalMin: policy.guardrails.energyKcal.min,
    energyKcalMax: policy.guardrails.energyKcal.max,
    carbohydrateGMin: policy.guardrails.carbohydrateG.min,
    carbohydrateGMax: policy.guardrails.carbohydrateG.max,
    ...(protein
      ? { proteinGMin: protein.min, proteinGMax: protein.max }
      : {}),
    sodiumMgMax: policy.guardrails.sodiumMgMax,
    staplePortion: policy.portionUnitsByRole.staple ?? 1
  };
}

function snapshotMin(left: NutritionSnapshot, right: NutritionSnapshot): NutritionSnapshot {
  return {
    energyKcal: Math.min(left.energyKcal, right.energyKcal),
    carbohydrateG: Math.min(left.carbohydrateG, right.carbohydrateG),
    proteinG: Math.min(left.proteinG, right.proteinG),
    fatG: Math.min(left.fatG, right.fatG),
    sodiumMg: Math.min(left.sodiumMg, right.sodiumMg)
  };
}

function mealCap(bounds: MealBudgetBounds, remaining: NutritionSnapshot): SharedMealCap {
  return {
    min: bounds.min,
    max: snapshotMin(bounds.max, remaining),
    target: bounds.target,
    reserve: bounds.reserve
  };
}

function sanitizeDisplayText(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || DISEASE_LABEL_RE.test(trimmed)) return null;
  return trimmed;
}

function sanitizeList(values: string[]): string[] {
  return unique(
    values
      .map((value) => sanitizeDisplayText(value))
      .filter((value): value is string => value != null)
  );
}

/**
 * Attach policy/constraint display fields onto an existing member budget.
 * Does not change dailyTarget or mealBudgets; does not allocate grams.
 */
export function enrichMemberNutritionBudget(input: BudgetDisplayInput): MemberNutritionBudget {
  const hardLimits: MemberHardLimits = {};
  const cues: string[] = [...(input.budget.operationalCues ?? [])];
  const codes: string[] = [...(input.budget.reasonCodes ?? [])];

  for (const policy of input.mealPolicies) {
    if (policy.mealType !== "lunch" && policy.mealType !== "dinner") continue;
    hardLimits[policy.mealType] = hardLimitsFromPolicy(policy);
    const staple = policy.portionUnitsByRole.staple ?? 1;
    if (staple < SMALL_STAPLE_THRESHOLD) {
      cues.push(OPERATIONAL_CUE_SMALL_STAPLE);
      codes.push("staple_reduced");
    }
    if (policy.guardrails.carbohydrateG.max <= CARB_CAP_THRESHOLD_G) {
      codes.push("carb_cap");
    }
    if (policy.guardrails.sodiumMgMax < LOW_SODIUM_THRESHOLD_MG) {
      cues.push(OPERATIONAL_CUE_LOW_SODIUM);
      codes.push("sodium_cap");
    }
  }

  for (const constraint of input.hardConstraints) {
    if (constraint.kind !== "avoid_ingredient") continue;
    codes.push("hard_avoid_ingredient");
    const cue = AVOID_INGREDIENT_CUES[constraint.targetId];
    cues.push(cue ?? "避指定食材");
  }

  if (input.weightGoal === "loss" || codes.includes("weight_goal_loss")) {
    cues.push(OPERATIONAL_CUE_WEIGHT_LOSS);
  }
  if (input.preferenceKinds?.includes("low_oil_preference")) {
    cues.push(OPERATIONAL_CUE_LOW_OIL);
    codes.push("low_oil_preference");
  }

  return {
    ...input.budget,
    hardLimits: Object.keys(hardLimits).length > 0 ? hardLimits : input.budget.hardLimits,
    operationalCues: sanitizeList(cues),
    reasonCodes: unique(codes)
  };
}

function reasonLinesFor(member: {
  budget: MemberNutritionBudget;
  hardLimits: MemberHardLimits;
}): string[] {
  const lines: string[] = [];
  const dinner = member.hardLimits.dinner;
  const lunch = member.hardLimits.lunch;
  const codes = new Set(member.budget.reasonCodes ?? []);

  if (codes.has("staple_reduced") || codes.has("carb_cap")) {
    const staple = dinner?.staplePortion ?? lunch?.staplePortion;
    const carbMax = dinner?.carbohydrateGMax ?? lunch?.carbohydrateGMax;
    if (staple != null && carbMax != null) {
      lines.push(`主食小份：晚餐碳水上限 ${carbMax}g，主食份量 ${staple}`);
    } else if (carbMax != null) {
      lines.push(`碳水上限 ${carbMax}g`);
    }
  }
  if (codes.has("sodium_cap")) {
    const sodium = dinner?.sodiumMgMax ?? lunch?.sodiumMgMax;
    if (sodium != null) lines.push(`少盐：钠上限 ${sodium}mg`);
  }
  if (codes.has("hard_avoid_ingredient")) {
    const beef = (member.budget.operationalCues ?? []).includes(OPERATIONAL_CUE_AVOID_BEEF);
    lines.push(beef ? "硬排除牛肉" : "硬排除指定食材");
  }
  if (codes.has("weight_goal_loss")) {
    lines.push(
      `控制热量：体重目标减重，热量按 ${member.budget.calculation.goalAdjustment} 调整`
    );
  }
  if (codes.has("missing_profile_fallback")) {
    lines.push("缺资料，使用演示默认预算，置信度低");
  }
  lines.push(
    `算法 ${member.budget.version}，来源 ${member.budget.source}，置信度 ${member.budget.confidence ?? "medium"}`
  );
  return sanitizeList(lines);
}

function emptyHardLimits(): MemberHardLimits {
  return {};
}

function plannedForMember(
  plan: MealPlan,
  memberId: string
): SharedMemberDisplay["plannedIntake"] | undefined {
  const allocation = plan.memberAllocations.find((item) => item.memberId === memberId);
  if (!allocation) return undefined;
  const mealPortionScale = plan.selectionTrace.agentSelection?.mealPortionScale;
  return {
    mealType: plan.mealType,
    planId: plan.id,
    planVersion: plan.version,
    ...(mealPortionScale != null ? { mealPortionScale } : {}),
    remainingBudgetRole: "upper_cap_only",
    nutrition: allocation.nutrition,
    items: allocation.items.map((item) => ({
      templateId: item.templateId,
      role: item.role,
      foodId: item.foodId,
      quantityG: item.quantityG
    }))
  };
}

export type SharedDisplayOptions = {
  plan?: MealPlan;
};

/**
 * UI-facing projection. Strips healthFacts, healthTags, preference notes,
 * and other disease labels. Planned grams come from allocation, not the budget.
 */
export function toSharedHouseholdDisplay(
  dayContext: Omit<DayContext, "sharedDisplay">,
  options: SharedDisplayOptions = {}
): SharedHouseholdDisplay {
  const members: SharedMemberDisplay[] = dayContext.members.map((member) => {
    const intake = dayContext.memberIntake.find((row) => row.memberId === member.id);
    const budget = intake?.nutritionBudget ?? member.nutritionBudget;
    const remaining = intake?.remaining ?? emptyNutritionSnapshot();
    const hardLimits = budget.hardLimits ?? emptyHardLimits();
    const confidence = budget.confidence ?? "medium";
    const plannedIntake = options.plan
      ? plannedForMember(options.plan, member.id)
      : undefined;
    return {
      memberId: member.id,
      displayName: member.displayName,
      roleLabel: member.roleLabel,
      operationalCues: sanitizeList(budget.operationalCues ?? []),
      reasonCodes: unique(budget.reasonCodes ?? []),
      reasonLines: reasonLinesFor({ budget, hardLimits }),
      confidence,
      source: budget.source,
      version: budget.version,
      applicability: budget.applicability,
      dailyTarget: budget.dailyTarget,
      mealBudgets: budget.mealBudgets,
      hardLimits,
      intake: {
        target: intake?.target ?? budget.dailyTarget,
        consumed: intake?.consumed ?? emptyNutritionSnapshot(),
        remaining
      },
      mealCaps: {
        lunch: mealCap(budget.mealBudgets.lunch, remaining),
        dinner: mealCap(budget.mealBudgets.dinner, remaining)
      },
      ...(plannedIntake ? { plannedIntake } : {})
    };
  });

  const confidence =
    members.some((member) => member.confidence === "low") ? "low" : "medium";
  const boundary =
    confidence === "low"
      ? NUTRITION_BUDGET_FALLBACK_BOUNDARY
      : (members[0]?.applicability.boundary ?? NUTRITION_BUDGET_BOUNDARY);

  const display: SharedHouseholdDisplay = {
    serviceDate: dayContext.serviceDate,
    algorithm: {
      source: "engineering_estimate",
      version: members[0]?.version ?? NUTRITION_BUDGET_VERSION,
      confidence,
      boundary,
      remainingBudgetRole: "upper_cap_only"
    },
    household: {
      target: dayContext.householdIntake.target,
      consumed: dayContext.householdIntake.consumed,
      remaining: dayContext.householdIntake.remaining,
      mealBudgets: dayContext.householdIntake.mealBudgets
    },
    members,
    completedMeals: dayContext.completedMeals.map((meal) => ({
      id: meal.id,
      mealType: meal.mealType,
      planId: meal.planId,
      planVersion: meal.planVersion,
      completedAt: meal.completedAt,
      dinerIds: meal.dinerIds
    }))
  };
  return display;
}

export function sharedDisplayForbiddenLabelRe(): RegExp {
  return DISEASE_LABEL_RE;
}
