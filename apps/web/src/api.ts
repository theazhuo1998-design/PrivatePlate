export type RuntimeStatus = {
  providerMode: string;
  appMode?: "demo" | "production" | string;
  agentKind?: "model_agent" | "scripted_mock" | string;
  modelReady?: boolean;
  modelDetail?: string;
  operable?: boolean;
  ragReady?: boolean;
  rag?: {
    ready: boolean;
    mode: string;
    embeddingModel?: string;
    note?: string;
  };
  cameraSource?: "current_browser" | string;
  microphoneSource?: "current_browser" | string;
  databaseStorageClass?: "local_sqlite_file" | "memory" | string;
  remoteApi: boolean;
  capabilityBoundary?: string;
  householdId: string;
  sessionId: string;
  agentPhase: string;
  activePlanId: string | null;
  activePlanVersion: number | null;
  dinerIds: string[];
  llm: {
    mode: string;
    model: string | null;
    ready?: boolean;
    commitToolsRegistered: boolean;
  };
};

export type InventoryDraftItem = {
  id: string;
  rawName: string;
  quantity: number | null;
  unit: string | null;
  packageSize: string | null;
  confidence: "high" | "medium" | "low";
  evidence: string;
};

export type InventoryImageIntakeResult = {
  items: InventoryDraftItem[];
  limitations: string[];
};

export type AudioFormat = "webm" | "ogg" | "wav" | "mp4" | "mpeg" | "m4a";

export type MealRole = "shared_main" | "shared_side" | "staple";

export type NutritionSnapshot = {
  energyKcal: number;
  carbohydrateG: number;
  proteinG: number;
  fatG: number;
  sodiumMg: number;
};

export type MealAllocationItem = {
  templateId: string;
  role: MealRole | string;
  foodId: string;
  quantityG: number;
};

export type MealMemberAllocation = {
  memberId: string;
  nutrition: NutritionSnapshot;
  items?: MealAllocationItem[];
  portionUnitsByRole: Record<string, number>;
};

export type PreparedBatchItem = {
  templateId?: string;
  foodId: string;
  quantityG?: number;
};

export type HouseholdContext = {
  householdId: string;
  householdContextVersion: number;
  inventoryVersion: number;
  mealPolicyVersion: string;
  members: Array<{
    id: string;
    displayName: string;
    roleLabel: string;
    operationalCues?: string[];
  }>;
  constraints: Array<{
    id: string;
    memberId: string;
    kind: string;
    targetId: string;
  }>;
  inventory: Array<{
    id: string;
    foodId: string;
    priorityConsume: boolean;
    quantity: {
      rawExpression: string;
      normalized: {
        confidence: string;
        estimateG: number | null;
        minG: number | null;
        maxG: number | null;
      };
    };
  }>;
};

export type MealPlan = {
  id: string;
  version: number;
  status: string;
  bundleId: string;
  mealType?: string;
  dinerIds?: string[];
  sharedTemplates: Array<{
    templateId: string;
    name: string;
    role: MealRole | string;
    coversRoles?: Array<MealRole | string>;
  }>;
  memberAllocations: MealMemberAllocation[];
  /** Planned food actually assigned to members; old plans may omit this field. */
  plannedIntake?: {
    byMember: MealMemberAllocation[];
    householdTotal: NutritionSnapshot;
  };
  /** Prepared/采购量; old plans may only expose batchIngredients. */
  preparedBatch?: PreparedBatchItem[];
  batchIngredients?: PreparedBatchItem[];
  prepBuffer?: number;
  nutritionSummary?: {
    byMember: Record<string, NutritionSnapshot>;
    householdTotal: NutritionSnapshot;
  };
  shoppingGap: Array<{
    foodId: string;
    status: string;
    required: { estimateG: number | null };
    available: {
      confidence: string;
      estimateG: number | null;
      minG: number | null;
      maxG: number | null;
    };
    purchase: {
      estimateG: number | null;
      minG: number | null;
      maxG: number | null;
      confidence: string;
    };
  }>;
  rejectedFoodIds: string[];
  rejectedTemplateIds: string[];
  selectionTrace?: {
    selectedBundleId: string | null;
    agentSelection?: {
      mealPortionScale: number;
      mealStructure?: {
        mode: "standard" | "simple" | "one_pot";
        requiredRoles: string[];
        omittedRoles: string[];
        reason?: string;
      };
    };
  };
};

export type GramRange = {
  estimateG: number | null;
  minG: number | null;
  maxG: number | null;
  confidence: string;
  conversionRuleId: string | null;
};

export type CaregiverTaskCard = {
  planId: string;
  planVersion: number;
  recipientLabel: string;
  serveAt: string;
  menu: Array<{ templateId: string; displayName: string }>;
  useFromInventory: Array<{ foodId: string; quantity: GramRange }>;
  shoppingItems: Array<{
    foodId: string;
    purchase: GramRange;
    status: string;
  }>;
  executionNotes: string[];
  disclosurePolicyVersion: string;
};

export type UiOnly = {
  pendingActionId: string;
  confirmationToken: string;
  payloadHash: string;
  expiresAt: string;
  actionType?: string;
  confirmLabel?: string;
  taskCard?: CaregiverTaskCard;
  preview?: Record<string, unknown>;
};

export type AgentEvent =
  | { type: "run_started"; runId: string }
  | { type: "action_started"; label: string; tool: string }
  | {
      type: "action_completed";
      label: string;
      durationMs: number;
      ok: boolean;
    }
  | { type: "plan_ready"; planId: string; version: number; menu: string[] }
  | { type: "plan_infeasible" }
  | { type: "answer_delta"; text: string }
  | { type: "run_failed"; code: string; message: string }
  | { type: "run_completed"; auditRef: string }
  | ({ type: "confirmation_required" } & UiOnly);

export type AgentSessionSnapshot = {
  sessionId: string;
  state: {
    sessionId: string;
    activePlanId: string | null;
    activePlanVersion: number | null;
    pendingActionId: string | null;
    rejectedFoodIds: string[];
    rejectedTemplateIds: string[];
    phase: string;
    dinerIds: string[];
  };
  plan: MealPlan | null;
  pendingConfirmationExists: boolean;
};

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = null;
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "message" in parsed &&
      typeof parsed.message === "string" &&
      parsed.message
    ) {
      throw new Error(parsed.message);
    }
    throw new Error(`${response.status}: ${body}`);
  }
  return response.json() as Promise<T>;
}

/** Map browser/network failures (esp. Safari "Load failed") to actionable text. */
export function humanizeNetworkError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /load failed|failed to fetch|networkerror|network request failed|the network connection was lost|econnreset|econnrefused|socket hang up/i.test(
      message
    )
  ) {
    return (
      "网络中断或本机模型无响应。" +
      "请确认本机 127.0.0.1:8000 上的 OpenAI 兼容模型仍在运行，然后重试；若刚生成过计划，可直接再发「预览任务卡」。"
    );
  }
  return message;
}

function sessionHeader(sessionId: string): HeadersInit {
  return { "X-PrivatePlate-Session": sessionId };
}

export async function fetchRuntime(
  sessionId: string
): Promise<RuntimeStatus> {
  return json(
    await fetch("/api/runtime/status", {
      headers: sessionHeader(sessionId)
    })
  );
}

export async function recognizeInventoryImage(
  imageDataUrl: string
): Promise<InventoryImageIntakeResult> {
  return json(
    await fetch("/api/intake/inventory-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl })
    })
  );
}

export async function transcribeAudio(input: {
  audioDataUrl: string;
  format: AudioFormat;
  durationMs: number;
}): Promise<{ transcript: string }> {
  return json(
    await fetch("/api/intake/audio-transcription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function fetchContext(
  householdId: string
): Promise<HouseholdContext> {
  return json(await fetch(`/api/households/${householdId}/context`));
}

export type SharedPlannedIntakeItem = {
  templateId: string;
  role: string;
  foodId: string;
  quantityG: number;
};

export type SharedMemberDisplay = {
  memberId: string;
  displayName: string;
  roleLabel?: string | null;
  operationalCues: string[];
  reasonCodes?: string[];
  reasonLines?: string[];
  confidence?: string;
  source?: string;
  version?: string;
  dailyTarget?: NutritionSnapshot;
  intake?: {
    target: NutritionSnapshot;
    consumed: NutritionSnapshot;
    remaining: NutritionSnapshot;
  };
  plannedIntake?: {
    mealType: string;
    planId: string;
    planVersion: number;
    mealPortionScale?: number;
    remainingBudgetRole?: string;
    nutrition: NutritionSnapshot;
    items: SharedPlannedIntakeItem[];
  };
};

export type CompletedMeal = {
  id: string;
  mealType: string;
  planId?: string | null;
  planVersion?: number | null;
  completedAt: string | null;
  dinerIds?: string[];
};

export type DayContext = {
  householdId?: string;
  serviceDate: string;
  timeZone?: string;
  householdContextVersion?: number;
  inventoryVersion?: number;
  intakeVersion?: number;
  mealPolicyVersion?: string;
  householdIntake: {
    target: NutritionSnapshot;
    consumed: NutritionSnapshot;
    remaining: NutritionSnapshot;
  };
  memberIntake: Array<{
    memberId: string;
    target?: NutritionSnapshot;
    consumed?: NutritionSnapshot;
    remaining: NutritionSnapshot;
  }>;
  completedMeals: CompletedMeal[];
  inventory: Array<{
    id?: string;
    foodId: string | null;
    rawName: string;
    priorityUse?: boolean;
    quantity: {
      estimateG: number | null;
      minG?: number | null;
      maxG?: number | null;
      confidence?: string;
    };
  }>;
  members?: Array<{
    id: string;
    displayName: string;
    roleLabel?: string | null;
    preferences?: Array<{
      id: string;
      kind: string;
      note: string;
      polarity: string;
      targetType: string;
      targetId: string | null;
    }>;
    hardConstraints?: Array<{
      id: string;
      kind: string;
      targetId: string;
    }>;
  }>;
  /** Shared-screen projection. Browser only receives operationalCues / intake / plannedIntake. */
  sharedDisplay?: {
    serviceDate: string;
    algorithm?: {
      source?: string;
      version?: string;
      confidence?: string;
      boundary?: string;
      remainingBudgetRole?: string;
    };
    household: {
      target?: NutritionSnapshot;
      consumed?: NutritionSnapshot;
      remaining: NutritionSnapshot;
    };
    members: SharedMemberDisplay[];
    completedMeals?: CompletedMeal[];
  };
};

export async function fetchDayContext(
  householdId: string
): Promise<DayContext> {
  return json(await fetch(`/api/households/${householdId}/day-context`));
}

/** Preview meal completion (pending + token). Does not write inventory yet. */
export async function previewMealComplete(input: {
  householdId: string;
  planId: string;
}): Promise<{
  status: "preview";
  actionType: string;
  preview: Record<string, unknown>;
  confirmation: {
    pendingActionId: string;
    confirmationToken: string;
    payloadHash: string;
    expiresAt: string;
  };
}> {
  return json(
    await fetch(`/api/households/${input.householdId}/meal-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: input.planId })
    })
  );
}

/** Confirm a pending meal completion (or other pending) write. */
export async function completeMealAsPlanned(input: {
  householdId: string;
  planId: string;
  sessionId: string;
}) {
  const preview = await previewMealComplete({
    householdId: input.householdId,
    planId: input.planId
  });
  return json(
    await fetch(
      `/api/pending-actions/${preview.confirmation.pendingActionId}/confirm`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...sessionHeader(input.sessionId)
        },
        body: JSON.stringify({
          sessionId: input.sessionId,
          confirmationToken: preview.confirmation.confirmationToken,
          idempotencyKey: `web-meal-${preview.confirmation.pendingActionId}`,
          expectedPayloadHash: preview.confirmation.payloadHash
        })
      }
    )
  );
}

export async function fetchAgentSession(
  sessionId: string
): Promise<AgentSessionSnapshot> {
  return json(
    await fetch(`/api/agent/sessions/${sessionId}`, {
      headers: sessionHeader(sessionId)
    })
  );
}

export async function runAgentStream(input: {
  sessionId: string;
  text: string;
  dinerIds?: string[];
  onEvent: (event: AgentEvent) => void;
}): Promise<string> {
  const accepted = await json<{ runId: string; sessionId: string }>(
    await fetch("/api/agent/runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...sessionHeader(input.sessionId)
      },
      body: JSON.stringify({
        sessionId: input.sessionId,
        text: input.text,
        ...(input.dinerIds ? { dinerIds: input.dinerIds } : {})
      })
    })
  );

  const response = await fetch(`/api/agent/runs/${accepted.runId}/events`, {
    headers: sessionHeader(input.sessionId)
  });
  if (!response.ok || !response.body) {
    throw new Error(`${response.status}: 无法建立 Agent 事件流`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminalEventSeen = false;
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = emitEventBlock(block, input.onEvent);
      terminalEventSeen ||= isTerminalEvent(event);
      boundary = buffer.indexOf("\n\n");
    }
    if (done) break;
  }
  if (buffer.trim()) {
    const event = emitEventBlock(buffer, input.onEvent);
    terminalEventSeen ||= isTerminalEvent(event);
  }
  if (!terminalEventSeen) {
    throw new Error("Agent 事件流提前结束，请重试。");
  }
  return accepted.runId;
}

function emitEventBlock(
  block: string,
  onEvent: (event: AgentEvent) => void
): AgentEvent | null {
  const lines = block.split("\n");
  const eventName = lines
    .find((line) => line.startsWith("event: "))
    ?.slice("event: ".length);
  if (!eventName || eventName === "stream_end") return null;
  const data = lines
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice("data: ".length))
    .join("\n");
  if (!data) return null;
  const event = JSON.parse(data) as AgentEvent;
  onEvent(event);
  return event;
}

function isTerminalEvent(event: AgentEvent | null): boolean {
  return event?.type === "run_completed" || event?.type === "run_failed";
}

export async function confirmPending(input: {
  sessionId: string;
  pendingActionId: string;
  confirmationToken: string;
  idempotencyKey: string;
  expectedPayloadHash: string;
}) {
  return json(
    await fetch(`/api/pending-actions/${input.pendingActionId}/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...sessionHeader(input.sessionId)
      },
      body: JSON.stringify({
        sessionId: input.sessionId,
        confirmationToken: input.confirmationToken,
        idempotencyKey: input.idempotencyKey,
        expectedPayloadHash: input.expectedPayloadHash
      })
    })
  );
}

export async function cancelPending(
  sessionId: string,
  pendingActionId: string
) {
  return json(
    await fetch(`/api/pending-actions/${pendingActionId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...sessionHeader(sessionId)
      },
      body: JSON.stringify({ sessionId })
    })
  );
}

export async function fetchInbox() {
  return json<{
    simulated: boolean;
    channel: string;
    appMode?: "demo" | "production" | string;
    capability?: string;
    saveMessage?: string;
    items: Array<{
      id: string;
      status: string;
      channel: string;
      plan_id: string;
      plan_version: number;
      recipient_label: string;
      created_at: string;
      taskCard: {
        planId: string;
        planVersion: number;
        recipientLabel: string;
        serveAt: string;
        menu: Array<{ displayName: string }>;
        useFromInventory: Array<{ foodId: string; quantity: GramRange }>;
        shoppingItems: Array<{
          foodId: string;
          purchase: GramRange;
          status: string;
        }>;
        executionNotes: string[];
      };
    }>;
  }>(await fetch("/api/caregiver-inbox"));
}

/** POST target for 新对话. Does not wipe household memory, inventory, or ledger. */
export function sessionClearUrl(sessionId: string): string {
  return `/api/agent/sessions/${sessionId}/clear`;
}

export async function resetSession(sessionId: string) {
  return json(
    await fetch(sessionClearUrl(sessionId), {
      method: "POST",
      headers: sessionHeader(sessionId)
    })
  );
}

/**
 * @deprecated Use resetSession. This only clears the Agent conversation;
 * it does not wipe household memory, inventory, or ledger.
 * Developer data reset remains POST /api/demo/reset and is not called from the UI.
 */
export async function resetDemo(sessionId: string) {
  return resetSession(sessionId);
}
