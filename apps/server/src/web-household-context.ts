/**
 * HTTP mapper for GET /api/households/:id/context.
 * Domain.getMealContext() stays complete for Agent tools.
 * Browser JSON only has display fields and execution cues.
 */
import type { SharedHouseholdDisplay } from "@privateplate/contracts";
import { isBrowserSafeText } from "./web-day-context.js";

type MealContextMember = {
  id: string;
  displayName: string;
  roleLabel: string;
  healthTags?: string[];
  nutritionProfile?: unknown;
  notes?: string | undefined;
};

type MealContextInventoryItem = {
  id: string;
  foodId: string;
  priorityConsume?: boolean;
  quantity: unknown;
  notes?: string | undefined;
};

export type MealContextForBrowser = {
  householdId: string;
  householdContextVersion: number;
  inventoryVersion: number;
  mealPolicyVersion: string;
  members: MealContextMember[];
  constraints: Array<{
    id: string;
    memberId: string;
    kind: string;
    targetId: string;
  }>;
  inventory: MealContextInventoryItem[];
};

export function toBrowserHouseholdContext(
  context: MealContextForBrowser,
  sharedDisplay?: SharedHouseholdDisplay | null
): Record<string, unknown> {
  const cuesByMember = new Map(
    (sharedDisplay?.members ?? []).map((member) => [
      member.memberId,
      (member.operationalCues ?? []).filter(isBrowserSafeText)
    ])
  );
  return {
    householdId: context.householdId,
    householdContextVersion: context.householdContextVersion,
    inventoryVersion: context.inventoryVersion,
    mealPolicyVersion: context.mealPolicyVersion,
    members: context.members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      roleLabel: member.roleLabel,
      operationalCues: cuesByMember.get(member.id) ?? []
    })),
    constraints: context.constraints.map((constraint) => ({
      id: constraint.id,
      memberId: constraint.memberId,
      kind: constraint.kind,
      targetId: constraint.targetId
    })),
    inventory: context.inventory.map((item) => ({
      id: item.id,
      foodId: item.foodId,
      priorityConsume: Boolean(item.priorityConsume),
      quantity: item.quantity
    }))
  };
}
