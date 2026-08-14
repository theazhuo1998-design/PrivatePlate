import { describe, expect, it } from "vitest";
import { SharedHouseholdDisplaySchema } from "@privateplate/contracts";
import type { MealPlan } from "@privateplate/contracts";
import { PrivatePlateDomain } from "./service/privateplate-domain.js";
import { evaluateSelection } from "./planning/evaluate-selection.js";
import { calculateMemberNutritionBudget } from "./nutrition-budget.js";
import {
  NUTRITION_BUDGET_BOUNDARY,
  NUTRITION_BUDGET_FALLBACK_BOUNDARY,
  NUTRITION_BUDGET_VERSION
} from "./nutrition-budget.js";
import {
  OPERATIONAL_CUE_AVOID_BEEF,
  OPERATIONAL_CUE_LOW_SODIUM,
  OPERATIONAL_CUE_SMALL_STAPLE,
  OPERATIONAL_CUE_WEIGHT_LOSS,
  sharedDisplayForbiddenLabelRe,
  toSharedHouseholdDisplay
} from "./nutrition-display.js";

const DINERS = ["mem-admin", "mem-father", "mem-mother"];
const STANDARD_STRUCTURE = {
  mode: "standard" as const,
  requiredRoles: ["shared_main", "shared_side", "staple"] as (
    | "shared_main"
    | "shared_side"
    | "staple"
  )[],
  omittedRoles: [] as ("shared_main" | "shared_side" | "staple")[]
};

const DISH_SET = [
  { templateId: "tpl-potato-chicken", relativePortion: "standard" as const },
  { templateId: "tpl-garlic-spinach", relativePortion: "standard" as const },
  { templateId: "tpl-leftover-rice", relativePortion: "standard" as const }
];

const FORBIDDEN_COPY = /医学精准处方|临床级精确推荐|保证稳定血糖|适合所有糖尿病患者/;

function restockForSelection(domain: PrivatePlateDomain) {
  for (const [foodId, deltaG] of [
    ["food-chicken-leg", 1000],
    ["food-potato", 1000],
    ["food-spinach", 1000],
    ["food-garlic", 100],
    ["food-rice-cooked", 1000]
  ] as const) {
    domain.restockInventory({ foodId, deltaG, rawExpression: "test-restock" });
  }
}

function finalizeLunch(
  domain: PrivatePlateDomain,
  sessionId: string,
  mealPortionScale = 1
) {
  const candidates = domain.findDishCandidates({ dinerIds: DINERS });
  return domain.finalizeMealPlan({
    sessionId,
    dinerIds: DINERS,
    mealType: "lunch",
    candidateSetId: candidates.candidateSetId,
    selectedDishes: DISH_SET,
    mealPortionScale,
    mealStructure: STANDARD_STRUCTURE,
    selectionReason: "三人物营养回归"
  });
}

function gramsFor(
  plan: MealPlan,
  memberId: string,
  foodId: string
): number {
  const member = plan.memberAllocations.find((row) => row.memberId === memberId);
  return (
    member?.items
      .filter((item) => item.foodId === foodId)
      .reduce((sum, item) => sum + item.quantityG, 0) ?? 0
  );
}

describe("contest nutrition display freeze (demo household)", () => {
  it("same input, version and date yield stable budgets and allocations", async () => {
    const domain = await PrivatePlateDomain.create(":memory:");
    const first = domain.getDayContext({
      dinerIds: DINERS,
      serviceDate: "2026-08-13"
    });
    const second = domain.getDayContext({
      dinerIds: DINERS,
      serviceDate: "2026-08-13"
    });
    expect(first.sharedDisplay.algorithm.version).toBe(NUTRITION_BUDGET_VERSION);
    expect(SharedHouseholdDisplaySchema.parse(first.sharedDisplay).serviceDate).toBe(
      "2026-08-13"
    );
    expect(JSON.stringify(first.sharedDisplay.members)).toBe(
      JSON.stringify(second.sharedDisplay.members)
    );

    const planA = finalizeLunch(domain, "stable-a");
    const planB = finalizeLunch(domain, "stable-b");
    expect(planA.status).toBe("ok");
    expect(planB.status).toBe("ok");
    if (planA.status === "ok" && planB.status === "ok") {
      expect(JSON.stringify(planA.plan.plannedIntake.byMember)).toBe(
        JSON.stringify(planB.plan.plannedIntake.byMember)
      );
    }
    domain.db.close();
  });

  it("normal / carb-control / low-sodium members have explainable differences", async () => {
    const domain = await PrivatePlateDomain.create(":memory:");
    const display = domain.getSharedHouseholdDisplay({ dinerIds: DINERS });
    const admin = display.members.find((m) => m.memberId === "mem-admin");
    const father = display.members.find((m) => m.memberId === "mem-father");
    const mother = display.members.find((m) => m.memberId === "mem-mother");
    expect(admin && father && mother).toBeTruthy();
    if (!admin || !father || !mother) return;

    expect(father.hardLimits.dinner?.carbohydrateGMax).toBe(65);
    expect(father.hardLimits.lunch?.carbohydrateGMax).toBe(70);
    expect(father.hardLimits.dinner?.carbohydrateGMax).toBeLessThan(
      admin.hardLimits.dinner?.carbohydrateGMax ?? 0
    );
    expect(father.operationalCues).toContain(OPERATIONAL_CUE_SMALL_STAPLE);
    expect(father.reasonCodes).toEqual(
      expect.arrayContaining(["carb_cap", "staple_reduced"])
    );
    expect(father.reasonLines.some((line) => line.includes("65"))).toBe(true);

    expect(mother.hardLimits.dinner?.sodiumMgMax).toBe(900);
    expect(mother.hardLimits.dinner?.sodiumMgMax).toBeLessThan(
      admin.hardLimits.dinner?.sodiumMgMax ?? 0
    );
    expect(mother.operationalCues).toContain(OPERATIONAL_CUE_LOW_SODIUM);
    expect(mother.operationalCues).toContain(OPERATIONAL_CUE_AVOID_BEEF);
    expect(mother.reasonCodes).toEqual(
      expect.arrayContaining(["sodium_cap", "hard_avoid_ingredient"])
    );
    expect(mother.reasonLines.some((line) => line.includes("900"))).toBe(true);

    expect(admin.operationalCues).toContain(OPERATIONAL_CUE_WEIGHT_LOSS);
    expect(admin.reasonCodes).toContain("weight_goal_loss");
    expect(admin.mealBudgets.lunch.target.energyKcal).toBeGreaterThan(0);
    expect(admin.reasonLines.some((line) => line.includes("0.9"))).toBe(true);

    const plan = finalizeLunch(domain, "grams-diff");
    expect(plan.status).toBe("ok");
    if (plan.status !== "ok") return;
    const withPlan = toSharedHouseholdDisplay(domain.getDayContext({ dinerIds: DINERS }), {
      plan: plan.plan
    });
    const rice = (memberId: string) =>
      withPlan.members
        .find((m) => m.memberId === memberId)
        ?.plannedIntake?.items.filter((item) => item.foodId === "food-rice-cooked")
        .reduce((sum, item) => sum + item.quantityG, 0) ?? 0;
    expect(rice("mem-father")).toBeGreaterThan(0);
    expect(rice("mem-father")).toBeLessThan(rice("mem-admin"));
    expect(rice("mem-father")).toBeLessThan(rice("mem-mother"));
    expect(gramsFor(plan.plan, "mem-admin", "food-rice-cooked")).not.toBe(
      gramsFor(plan.plan, "mem-father", "food-rice-cooked")
    );
    domain.db.close();
  });

  it("remaining budget is an upper cap, not a second portion multiplier", async () => {
    const domain = await PrivatePlateDomain.create(":memory:");
    const catalog = domain.getCatalog();
    const day = domain.getDayContext({ dinerIds: DINERS });
    const budgets = new Map(
      day.memberIntake.map((row) => [row.memberId, row.nutritionBudget])
    );
    const fullRemaining = new Map(
      day.memberIntake.map((row) => [row.memberId, row.remaining])
    );
    const reducedRemaining = new Map(
      day.memberIntake.map((row) => [
        row.memberId,
        {
          energyKcal: Math.max(row.remaining.energyKcal - 250, row.nutritionBudget.mealBudgets.lunch.max.energyKcal),
          carbohydrateG: Math.max(
            row.remaining.carbohydrateG - 20,
            row.nutritionBudget.mealBudgets.lunch.max.carbohydrateG
          ),
          proteinG: Math.max(row.remaining.proteinG - 8, row.nutritionBudget.mealBudgets.lunch.max.proteinG),
          fatG: Math.max(row.remaining.fatG - 5, row.nutritionBudget.mealBudgets.lunch.max.fatG),
          sodiumMg: Math.max(row.remaining.sodiumMg - 100, row.nutritionBudget.mealBudgets.lunch.max.sodiumMg)
        }
      ])
    );

    const input = {
      dinerIds: DINERS,
      mealType: "lunch" as const,
      selectedDishes: DISH_SET,
      mealPortionScale: 1,
      mealStructure: STANDARD_STRUCTURE,
      mealBudgetsByMemberId: budgets
    };
    const full = evaluateSelection(catalog, {
      ...input,
      remainingNutritionByMember: fullRemaining
    });
    const reduced = evaluateSelection(catalog, {
      ...input,
      remainingNutritionByMember: reducedRemaining
    });
    expect(full.status).toBe("ok");
    expect(reduced.status).toBe("ok");
    if (full.status === "ok" && reduced.status === "ok") {
      expect(JSON.stringify(full.memberAllocations)).toBe(
        JSON.stringify(reduced.memberAllocations)
      );
    }
    domain.db.close();
  });

  it("absolute energy/carb/protein floors and sodium ceiling are not scaled by mealPortionScale", async () => {
    const domain = await PrivatePlateDomain.create(":memory:");
    const catalog = domain.getCatalog();
    const day = domain.getDayContext({ dinerIds: DINERS });
    const budgets = new Map(
      day.memberIntake.map((row) => [row.memberId, row.nutritionBudget])
    );
    const fatherLunch = catalog.mealPolicies.find(
      (policy) => policy.memberId === "mem-father" && policy.mealType === "lunch"
    );
    expect(fatherLunch?.guardrails.energyKcal.min).toBe(250);
    expect(fatherLunch?.guardrails.carbohydrateG.min).toBe(20);
    expect(fatherLunch?.guardrails.sodiumMgMax).toBe(1200);

    const displayFather = day.sharedDisplay.members.find((m) => m.memberId === "mem-father");
    expect(displayFather?.hardLimits.lunch?.energyKcalMin).toBe(250);
    expect(displayFather?.hardLimits.lunch?.carbohydrateGMin).toBe(20);
    expect(displayFather?.hardLimits.lunch?.sodiumMgMax).toBe(1200);

    const low = evaluateSelection(catalog, {
      dinerIds: DINERS,
      mealType: "lunch",
      selectedDishes: DISH_SET,
      mealPortionScale: 0.2,
      mealStructure: STANDARD_STRUCTURE,
      mealBudgetsByMemberId: budgets
    });
    expect(low.status).toBe("failed");
    if (low.status === "failed") {
      expect(["NUTRITION_GUARDRAIL", "NUTRITION_BUDGET"]).toContain(low.code);
      const deficits = (low.details?.deficits ?? []) as Array<{
        nutrient?: string;
        min?: number;
        max?: number;
      }>;
      const energyFloor = deficits.find((row) => row.nutrient === "energyKcal" && row.min != null);
      if (energyFloor?.min != null) {
        expect(energyFloor.min).toBe(fatherLunch?.guardrails.energyKcal.min);
        expect(energyFloor.min).not.toBeCloseTo(250 * 0.2, 5);
      }
      const carbFloor = deficits.find(
        (row) => row.nutrient === "carbohydrateG" && row.min != null
      );
      if (carbFloor?.min != null) {
        expect(carbFloor.min).toBe(20);
      }
      expect(JSON.stringify(low.details)).not.toContain("effectiveShare");
    }
    domain.db.close();
  });

  it("missing profile uses explicit fallback and low confidence", async () => {
    const fallback = calculateMemberNutritionBudget(undefined, "mem-unknown");
    expect(fallback.calculation.method).toBe("fallback_demo_estimate");
    expect(fallback.confidence).toBe("low");
    expect(fallback.reasonCodes).toEqual(
      expect.arrayContaining(["missing_profile_fallback", "fallback_demo_estimate"])
    );
    expect(fallback.applicability.boundary).toBe(NUTRITION_BUDGET_FALLBACK_BOUNDARY);
    expect(fallback.applicability.boundary).toMatch(/缺资料|演示默认值/);
    expect(FORBIDDEN_COPY.test(fallback.applicability.boundary)).toBe(false);

    const domain = await PrivatePlateDomain.create(":memory:");
    domain.db.prepare(`DELETE FROM member_nutrition_profiles WHERE member_id = ?`).run("mem-admin");
    const day = domain.getDayContext({ dinerIds: ["mem-admin"] });
    expect(day.sharedDisplay.members[0]?.confidence).toBe("low");
    expect(day.sharedDisplay.algorithm.confidence).toBe("low");
    expect(day.sharedDisplay.members[0]?.reasonCodes).toContain("missing_profile_fallback");
    expect(
      day.sharedDisplay.members[0]?.reasonLines.some((line) => line.includes("缺资料"))
    ).toBe(true);
    domain.db.close();
  });

  it("reason text matches numeric results and allowed boundary wording", async () => {
    const domain = await PrivatePlateDomain.create(":memory:");
    const display = domain.getSharedHouseholdDisplay({ dinerIds: DINERS });
    expect(display.algorithm.boundary).toBe(NUTRITION_BUDGET_BOUNDARY);
    expect(display.algorithm.remainingBudgetRole).toBe("upper_cap_only");
    expect(FORBIDDEN_COPY.test(display.algorithm.boundary)).toBe(false);
    expect(display.algorithm.boundary).toMatch(/克级建议区间/);
    expect(display.algorithm.boundary).toMatch(/不是医疗诊断、治疗建议或个体化处方/);

    const father = display.members.find((m) => m.memberId === "mem-father")!;
    expect(father.reasonLines.join("")).toContain(String(father.hardLimits.dinner?.carbohydrateGMax));
    expect(father.reasonLines.join("")).toContain(String(father.hardLimits.dinner?.staplePortion));
    const mother = display.members.find((m) => m.memberId === "mem-mother")!;
    expect(mother.reasonLines.join("")).toContain(String(mother.hardLimits.dinner?.sodiumMgMax));
    const admin = display.members.find((m) => m.memberId === "mem-admin")!;
    expect(admin.reasonLines.join("")).toContain("0.9");
    expect(admin.reasonLines.join("")).toContain(admin.version);
    expect(admin.mealBudgets.lunch.target.energyKcal).toBeGreaterThan(0);
    domain.db.close();
  });

  it("shared-display projection contains no disease names or fixture healthTags", async () => {
    const domain = await PrivatePlateDomain.create(":memory:");
    const plan = finalizeLunch(domain, "display-privacy");
    expect(plan.status).toBe("ok");
    if (plan.status !== "ok") return;
    const display = domain.getSharedHouseholdDisplay({
      dinerIds: DINERS,
      plan: plan.plan
    });
    const serialized = JSON.stringify(display);
    expect(serialized).not.toMatch(sharedDisplayForbiddenLabelRe());
    expect(serialized).not.toMatch(/healthFacts|healthTags/);
    expect(display.members.map((m) => m.operationalCues).flat()).toEqual(
      expect.arrayContaining([
        OPERATIONAL_CUE_SMALL_STAPLE,
        OPERATIONAL_CUE_LOW_SODIUM,
        OPERATIONAL_CUE_AVOID_BEEF,
        OPERATIONAL_CUE_WEIGHT_LOSS
      ])
    );
    expect(domain.getDayContext({ dinerIds: DINERS }).members.some((m) => m.healthFacts.length > 0)).toBe(
      true
    );
    domain.db.close();
  });

  it("beef hard-exclusion rejects the beef dish while the demo set stays feasible", async () => {
    const domain = await PrivatePlateDomain.create(":memory:");
    const candidates = domain.findDishCandidates({ dinerIds: DINERS });
    expect(candidates.candidates.some((c) => c.templateId === "tpl-tomato-beef")).toBe(
      false
    );
    const rejected = domain.finalizeMealPlan({
      sessionId: "beef-hard-avoid",
      dinerIds: DINERS,
      mealType: "lunch",
      candidateSetId: candidates.candidateSetId,
      selectedDishes: [
        { templateId: "tpl-tomato-beef", relativePortion: "standard" },
        { templateId: "tpl-garlic-spinach", relativePortion: "standard" },
        { templateId: "tpl-leftover-rice", relativePortion: "standard" }
      ],
      mealPortionScale: 1,
      mealStructure: STANDARD_STRUCTURE,
      selectionReason: "should hit mother beef exclusion"
    });
    expect(rejected.status).toBe("failed");
    if (rejected.status === "failed") {
      expect(rejected.code).toBe("SELECTION_NOT_IN_CANDIDATES");
    }
    const catalog = domain.getCatalog();
    const hard = evaluateSelection(catalog, {
      dinerIds: DINERS,
      mealType: "lunch",
      selectedDishes: [
        { templateId: "tpl-tomato-beef", relativePortion: "standard" },
        { templateId: "tpl-garlic-spinach", relativePortion: "standard" },
        { templateId: "tpl-leftover-rice", relativePortion: "standard" }
      ],
      mealPortionScale: 1,
      mealStructure: STANDARD_STRUCTURE
    });
    expect(hard.status).toBe("failed");
    if (hard.status === "failed") {
      expect(hard.code).toBe("HARD_CONSTRAINT_VIOLATION");
    }
    domain.db.close();
  });

  it("completing a meal reduces next-meal remaining without rewriting the budget function", async () => {
    const domain = await PrivatePlateDomain.create(":memory:");
    restockForSelection(domain);
    const before = domain.getSharedHouseholdDisplay({ dinerIds: DINERS });
    const result = finalizeLunch(domain, "after-meal-remaining");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const completed = domain.completeMealAsPlanned({ planId: result.plan.id });
    expect(completed.ok).toBe(true);
    const after = domain.getSharedHouseholdDisplay({ dinerIds: DINERS });
    expect(after.household.remaining.energyKcal).toBeLessThan(before.household.remaining.energyKcal);
    expect(after.household.consumed.energyKcal).toBeGreaterThan(before.household.consumed.energyKcal);
    for (const member of after.members) {
      const previous = before.members.find((row) => row.memberId === member.memberId)!;
      expect(member.intake.remaining.energyKcal).toBeLessThan(previous.intake.remaining.energyKcal);
      expect(member.mealCaps.dinner.max.energyKcal).toBeLessThanOrEqual(
        member.mealBudgets.dinner.max.energyKcal
      );
      expect(member.mealCaps.dinner.max.energyKcal).toBeLessThanOrEqual(
        member.intake.remaining.energyKcal
      );
      expect(member.dailyTarget.energyKcal).toBe(previous.dailyTarget.energyKcal);
    }
    domain.db.close();
  });
});
