import { describe, expect, it } from "vitest";
import { GramRangeSchema } from "./quantity.js";
import { MealBundleTemplateSchema, MealTemplateSchema } from "./meal.js";
import { FoodSchema } from "./food.js";
import {
  MemberNutritionBudgetSchema,
  SharedHouseholdDisplaySchema
} from "./nutrition-budget.js";
import {
  CaregiverRecipientLabelSchema,
  CaregiverServeAtSchema
} from "./task-card.js";

describe("GramRangeSchema", () => {
  it("accepts exact equal grams", () => {
    const parsed = GramRangeSchema.parse({
      estimateG: 100,
      minG: 100,
      maxG: 100,
      confidence: "exact",
      conversionRuleId: "rule-1"
    });
    expect(parsed.confidence).toBe("exact");
  });

  it("rejects exact with mismatched bounds", () => {
    const result = GramRangeSchema.safeParse({
      estimateG: 100,
      minG: 90,
      maxG: 110,
      confidence: "exact",
      conversionRuleId: null
    });
    expect(result.success).toBe(false);
  });

  it("accepts approximate ranges", () => {
    const parsed = GramRangeSchema.parse({
      estimateG: 250,
      minG: 200,
      maxG: 300,
      confidence: "approximate",
      conversionRuleId: "cabbage-half"
    });
    expect(parsed.minG).toBe(200);
  });

  it.each([
    { estimateG: -1, minG: 0, maxG: 10 },
    { estimateG: 5, minG: -1, maxG: 10 },
    { estimateG: 5, minG: 0, maxG: -1 }
  ])("rejects negative grams: %j", (range) => {
    expect(
      GramRangeSchema.safeParse({
        ...range,
        confidence: "approximate",
        conversionRuleId: null
      }).success
    ).toBe(false);
  });

  it("rejects reversed bounds", () => {
    const result = GramRangeSchema.safeParse({
      estimateG: 100,
      minG: 110,
      maxG: 90,
      confidence: "approximate",
      conversionRuleId: null
    });
    expect(result.success).toBe(false);
  });

  it.each([
    { estimateG: 80, minG: 90, maxG: 110 },
    { estimateG: 120, minG: 90, maxG: 110 }
  ])("rejects estimates outside their bounds: %j", (range) => {
    expect(
      GramRangeSchema.safeParse({
        ...range,
        confidence: "approximate",
        conversionRuleId: null
      }).success
    ).toBe(false);
  });

  it("accepts an unknown range with only a known lower bound", () => {
    const parsed = GramRangeSchema.parse({
      estimateG: null,
      minG: 100,
      maxG: null,
      confidence: "unknown",
      conversionRuleId: null
    });
    expect(parsed.minG).toBe(100);
  });
});

describe("caregiver preview boundaries", () => {
  it.each(["家庭保姆", "保姆", "阿姨"])(
    "accepts the generic caregiver label %s",
    (label) => {
      expect(CaregiverRecipientLabelSchema.parse(label)).toBe(label);
    }
  );

  it("rejects labels that disclose household health information", () => {
    expect(
      CaregiverRecipientLabelSchema.safeParse("需要控血糖的爸爸").success
    ).toBe(false);
  });

  it.each([
    "unspecified",
    "今天 12:30",
    "2026-07-26T18:30:00+08:00"
  ])("accepts the supported serve time %s", (serveAt) => {
    expect(CaregiverServeAtSchema.parse(serveAt)).toBe(serveAt);
  });

  it("rejects invalid or free-form serve times", () => {
    expect(CaregiverServeAtSchema.safeParse("高血压用餐时间").success).toBe(
      false
    );
    expect(
      CaregiverServeAtSchema.safeParse("2026-99-99T18:30:00+08:00").success
    ).toBe(false);
  });
});

describe("nutrition budget optional display fields", () => {
  const snapshot = {
    energyKcal: 1800,
    carbohydrateG: 200,
    proteinG: 80,
    fatG: 55,
    sodiumMg: 2000
  };
  const bounds = {
    target: snapshot,
    min: snapshot,
    max: snapshot,
    reserve: snapshot
  };
  const baseBudget = {
    memberId: "mem-admin",
    dailyTarget: snapshot,
    mealBudgets: {
      breakfast: bounds,
      lunch: bounds,
      dinner: bounds,
      snack: bounds
    },
    calculation: {
      method: "mifflin_st_jeor" as const,
      bmrKcal: 1400,
      tdeeKcal: 1960,
      activityFactor: 1.4,
      goalAdjustment: 0.9
    },
    source: "engineering_estimate" as const,
    version: "engineering-demo-1.0.0",
    applicability: {
      fullySupportedMealTypes: ["lunch" as const, "dinner" as const],
      extensionMealSlots: ["breakfast" as const, "snack" as const],
      boundary: "克级建议区间；不是医疗诊断、治疗建议或个体化处方。"
    }
  };

  it("still parses the existing required budget fields", () => {
    expect(MemberNutritionBudgetSchema.parse(baseBudget).memberId).toBe("mem-admin");
  });

  it("accepts optional hardLimits, operationalCues, reasonCodes and confidence", () => {
    const parsed = MemberNutritionBudgetSchema.parse({
      ...baseBudget,
      confidence: "medium",
      hardLimits: {
        dinner: {
          energyKcalMin: 250,
          energyKcalMax: 700,
          carbohydrateGMin: 20,
          carbohydrateGMax: 65,
          sodiumMgMax: 1200,
          staplePortion: 0.6
        }
      },
      operationalCues: ["主食小份"],
      reasonCodes: ["carb_cap", "mifflin_st_jeor"]
    });
    expect(parsed.operationalCues).toEqual(["主食小份"]);
    expect(parsed.hardLimits?.dinner?.carbohydrateGMax).toBe(65);
    expect(parsed.confidence).toBe("medium");
  });

  it("parses the shared household display projection", () => {
    const display = SharedHouseholdDisplaySchema.parse({
      serviceDate: "2026-08-13",
      algorithm: {
        source: "engineering_estimate",
        version: "engineering-demo-1.0.0",
        confidence: "medium",
        boundary: "克级建议区间；方向性合理的工程估算；不是医疗诊断、治疗建议或个体化处方。",
        remainingBudgetRole: "upper_cap_only"
      },
      household: {
        target: snapshot,
        consumed: snapshot,
        remaining: snapshot,
        mealBudgets: {
          breakfast: bounds,
          lunch: bounds,
          dinner: bounds,
          snack: bounds
        }
      },
      members: [
        {
          memberId: "mem-father",
          displayName: "父亲",
          roleLabel: "father",
          operationalCues: ["主食小份"],
          reasonCodes: ["carb_cap"],
          reasonLines: ["晚餐碳水上限 65g，主食份量 0.6"],
          confidence: "medium",
          source: "engineering_estimate",
          version: "engineering-demo-1.0.0",
          applicability: baseBudget.applicability,
          dailyTarget: snapshot,
          mealBudgets: baseBudget.mealBudgets,
          hardLimits: {
            dinner: {
              energyKcalMin: 250,
              energyKcalMax: 700,
              carbohydrateGMin: 20,
              carbohydrateGMax: 65,
              sodiumMgMax: 1200,
              staplePortion: 0.6
            }
          },
          intake: {
            target: snapshot,
            consumed: snapshot,
            remaining: snapshot
          },
          mealCaps: {
            lunch: bounds,
            dinner: bounds
          }
        }
      ],
      completedMeals: []
    });
    expect(display.members[0]?.operationalCues).toEqual(["主食小份"]);
    expect(display.algorithm.remainingBudgetRole).toBe("upper_cap_only");
  });
});

describe("Food and meal contracts", () => {
  it("parses a food record", () => {
    const food = FoodSchema.parse({
      id: "food-tofu",
      canonicalName: "北豆腐",
      aliases: ["豆腐"],
      nutritionPer100g: {
        energyKcal: 80,
        carbohydrateG: 2,
        proteinG: 8,
        fatG: 4,
        sodiumMg: 7
      },
      allergenTags: ["soy"],
      sourceId: "src-synthetic-demo",
      licenseId: "lic-privateplate-synthetic-1",
      dataVersion: "1.0.0"
    });
    expect(food.id).toBe("food-tofu");
  });

  it("parses a template and bundle", () => {
    const template = MealTemplateSchema.parse({
      id: "tpl-tofu-cabbage",
      name: "白菜豆腐煲",
      role: "shared_main",
      ingredientsPerStandardServing: [{ foodId: "food-tofu", edibleQuantityG: 120 }],
      tags: {
        cuisine: ["home"],
        cookingMethods: ["braise"],
        effortLevel: "low",
        oilLevel: "low",
        lowSodiumVariant: true
      },
      instructionsSummary: "豆腐与白菜一起炖。",
      sourceId: "src-synthetic-demo",
      licenseId: "lic-privateplate-synthetic-1",
      templateVersion: "1.0.0"
    });
    expect(template.role).toBe("shared_main");

    const bundle = MealBundleTemplateSchema.parse({
      id: "bundle-1",
      templateIds: ["a", "b", "c"],
      bundleVersion: "1.0.0",
      sourceId: "src-synthetic-demo",
      licenseId: "lic-privateplate-synthetic-1"
    });
    expect(bundle.templateIds).toHaveLength(3);
  });
});
