import { z } from "zod";
import { MealRoleSchema, MealTypeSchema } from "./enums.js";

export const NutritionSnapshotSchema = z.object({
  energyKcal: z.number().nonnegative(),
  carbohydrateG: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  sodiumMg: z.number().nonnegative()
});

export type NutritionSnapshot = z.infer<typeof NutritionSnapshotSchema>;

export const MealBudgetBoundsSchema = z.object({
  target: NutritionSnapshotSchema,
  min: NutritionSnapshotSchema,
  max: NutritionSnapshotSchema,
  reserve: NutritionSnapshotSchema
});

export type MealBudgetBounds = z.infer<typeof MealBudgetBoundsSchema>;

export const NutritionCalculationSchema = z.object({
  method: z.enum(["mifflin_st_jeor", "fallback_demo_estimate"]),
  bmrKcal: z.number().nonnegative(),
  tdeeKcal: z.number().nonnegative(),
  activityFactor: z.number().positive(),
  goalAdjustment: z.number().positive()
});

export type NutritionCalculation = z.infer<typeof NutritionCalculationSchema>;

export const NutritionConfidenceSchema = z.enum(["medium", "low"]);
export type NutritionConfidence = z.infer<typeof NutritionConfidenceSchema>;

/** Absolute per-meal guardrails copied from meal policy. Not scaled by mealPortionScale. */
export const MealHardLimitsSchema = z.object({
  energyKcalMin: z.number(),
  energyKcalMax: z.number(),
  carbohydrateGMin: z.number(),
  carbohydrateGMax: z.number(),
  proteinGMin: z.number().optional(),
  proteinGMax: z.number().optional(),
  sodiumMgMax: z.number(),
  staplePortion: z.number()
});

export type MealHardLimits = z.infer<typeof MealHardLimitsSchema>;

export const MemberHardLimitsSchema = z.object({
  lunch: MealHardLimitsSchema.optional(),
  dinner: MealHardLimitsSchema.optional()
});

export type MemberHardLimits = z.infer<typeof MemberHardLimitsSchema>;

export const MemberNutritionBudgetSchema = z.object({
  memberId: z.string().min(1),
  dailyTarget: NutritionSnapshotSchema,
  mealBudgets: z.object({
    breakfast: MealBudgetBoundsSchema,
    lunch: MealBudgetBoundsSchema,
    dinner: MealBudgetBoundsSchema,
    snack: MealBudgetBoundsSchema
  }),
  calculation: NutritionCalculationSchema,
  source: z.literal("engineering_estimate"),
  version: z.string().min(1),
  applicability: z.object({
    fullySupportedMealTypes: z.array(MealTypeSchema).min(1),
    extensionMealSlots: z.array(z.enum(["breakfast", "snack"])),
    boundary: z.string().min(1)
  }),
  confidence: NutritionConfidenceSchema.optional(),
  hardLimits: MemberHardLimitsSchema.optional(),
  operationalCues: z.array(z.string().min(1)).optional(),
  reasonCodes: z.array(z.string().min(1)).optional()
});

export type MemberNutritionBudget = z.infer<typeof MemberNutritionBudgetSchema>;

export const SharedMealCapSchema = z.object({
  min: NutritionSnapshotSchema,
  max: NutritionSnapshotSchema,
  target: NutritionSnapshotSchema,
  reserve: NutritionSnapshotSchema
});

export type SharedMealCap = z.infer<typeof SharedMealCapSchema>;

export const SharedPlannedIntakeItemSchema = z.object({
  templateId: z.string().min(1),
  role: MealRoleSchema,
  foodId: z.string().min(1),
  quantityG: z.number().nonnegative()
});

export type SharedPlannedIntakeItem = z.infer<typeof SharedPlannedIntakeItemSchema>;

export const SharedMemberDisplaySchema = z.object({
  memberId: z.string().min(1),
  displayName: z.string().min(1),
  roleLabel: z.string().nullable(),
  operationalCues: z.array(z.string().min(1)),
  reasonCodes: z.array(z.string().min(1)),
  reasonLines: z.array(z.string().min(1)),
  confidence: NutritionConfidenceSchema,
  source: z.literal("engineering_estimate"),
  version: z.string().min(1),
  applicability: z.object({
    fullySupportedMealTypes: z.array(MealTypeSchema).min(1),
    extensionMealSlots: z.array(z.enum(["breakfast", "snack"])),
    boundary: z.string().min(1)
  }),
  dailyTarget: NutritionSnapshotSchema,
  mealBudgets: z.object({
    breakfast: MealBudgetBoundsSchema,
    lunch: MealBudgetBoundsSchema,
    dinner: MealBudgetBoundsSchema,
    snack: MealBudgetBoundsSchema
  }),
  hardLimits: MemberHardLimitsSchema,
  intake: z.object({
    target: NutritionSnapshotSchema,
    consumed: NutritionSnapshotSchema,
    remaining: NutritionSnapshotSchema
  }),
  mealCaps: z.object({
    lunch: SharedMealCapSchema,
    dinner: SharedMealCapSchema
  }),
  plannedIntake: z
    .object({
      mealType: MealTypeSchema,
      planId: z.string().min(1),
      planVersion: z.number().int().positive(),
      mealPortionScale: z.number().positive().optional(),
      remainingBudgetRole: z.literal("upper_cap_only"),
      nutrition: NutritionSnapshotSchema,
      items: z.array(SharedPlannedIntakeItemSchema)
    })
    .optional()
});

export type SharedMemberDisplay = z.infer<typeof SharedMemberDisplaySchema>;

export const SharedHouseholdDisplaySchema = z.object({
  serviceDate: z.string().min(1),
  algorithm: z.object({
    source: z.literal("engineering_estimate"),
    version: z.string().min(1),
    confidence: NutritionConfidenceSchema,
    boundary: z.string().min(1),
    remainingBudgetRole: z.literal("upper_cap_only")
  }),
  household: z.object({
    target: NutritionSnapshotSchema,
    consumed: NutritionSnapshotSchema,
    remaining: NutritionSnapshotSchema,
    mealBudgets: z.object({
      breakfast: MealBudgetBoundsSchema,
      lunch: MealBudgetBoundsSchema,
      dinner: MealBudgetBoundsSchema,
      snack: MealBudgetBoundsSchema
    })
  }),
  members: z.array(SharedMemberDisplaySchema),
  completedMeals: z.array(
    z.object({
      id: z.string().min(1),
      mealType: z.string().min(1),
      planId: z.string().nullable(),
      planVersion: z.number().nullable(),
      completedAt: z.string().nullable(),
      dinerIds: z.array(z.string().min(1))
    })
  )
});

export type SharedHouseholdDisplay = z.infer<typeof SharedHouseholdDisplaySchema>;
