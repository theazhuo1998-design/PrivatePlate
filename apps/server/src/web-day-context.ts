/**
 * HTTP mapper for GET /api/households/:id/day-context.
 * Does not change Domain.getDayContext() used by Agent tools.
 * Browser JSON omits disease labels / healthFacts / healthTags / nutritionProfile.
 */
import type { DayContext } from "@privateplate/domain";

/** Broader than Domain sharedDisplay: also drop 血糖/血压/体重管理 copy. */
const BROWSER_FORBIDDEN_LABEL_RE =
  /糖尿病|高血压|diabetes|hypertension|stable_type2_diabetes_demo|hypertension_demo|weight_management|血糖管理|血压管理|体重管理/i;

export function toBrowserDayContext(day: DayContext): Record<string, unknown> {
  return {
    householdId: day.householdId,
    serviceDate: day.serviceDate,
    timeZone: day.timeZone,
    householdContextVersion: day.householdContextVersion,
    inventoryVersion: day.inventoryVersion,
    intakeVersion: day.intakeVersion,
    mealPolicyVersion: day.mealPolicyVersion,
    householdIntake: {
      target: day.householdIntake.target,
      consumed: day.householdIntake.consumed,
      remaining: day.householdIntake.remaining
    },
    memberIntake: day.memberIntake.map((row) => ({
      memberId: row.memberId,
      target: row.target,
      consumed: row.consumed,
      remaining: row.remaining
    })),
    completedMeals: day.completedMeals.map((meal) => ({
      id: meal.id,
      mealType: meal.mealType,
      planId: meal.planId,
      planVersion: meal.planVersion,
      completedAt: meal.completedAt,
      dinerIds: meal.dinerIds
    })),
    inventory: day.inventory.map((item) => ({
      id: item.id,
      foodId: item.foodId,
      rawName: item.rawName,
      priorityUse: item.priorityUse,
      quantity: item.quantity
    })),
    members: day.members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      roleLabel: member.roleLabel,
      preferences: member.preferences.filter((preference) =>
        isBrowserSafeText(preference.note)
      ),
      hardConstraints: member.hardConstraints
    })),
    sharedDisplay: day.sharedDisplay
  };
}

export function isBrowserSafeText(value: string): boolean {
  return value.trim().length > 0 && !BROWSER_FORBIDDEN_LABEL_RE.test(value);
}
