import { foodName, formatGrams } from "./formatters";

export const TASK_BOARD_LABEL = "家庭任务板";
export const SAVE_TASK_LABEL = "保存任务";
export const COPY_TASK_LABEL = "复制任务";
export const SHARE_TASK_LABEL = "分享任务";
export const CAPABILITY_LINE = "尚未连接家庭消息渠道";
export const SAVED_LOCAL_DEMO = "已保存到本地演示数据库";
export const SAVED_HOUSEHOLD_SPACE = "已保存到当前家庭空间";
export const SHARE_OPENED = "已打开系统分享面板";
export const COPIED = "已复制";

export type TaskBoardCard = {
  recipientLabel?: string;
  serveAt?: string;
  menu: Array<{ displayName: string }>;
  shoppingItems: Array<{
    foodId: string;
    purchase?: {
      estimateG: number | null;
      minG: number | null;
      maxG: number | null;
      confidence: string;
    };
    status?: string;
  }>;
  useFromInventory?: Array<{ foodId: string }>;
  executionNotes?: string[];
};

export function isReviewerMode(appMode: string | null | undefined): boolean {
  return appMode === "production";
}

export function taskSaveMessage(appMode: string | null | undefined): string {
  return isReviewerMode(appMode) ? SAVED_HOUSEHOLD_SPACE : SAVED_LOCAL_DEMO;
}

export function canWebShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function formatTaskCardPlainText(card: TaskBoardCard): string {
  const lines = ["家庭任务"];
  if (card.recipientLabel) lines.push(`执行：${card.recipientLabel}`);
  if (card.serveAt && card.serveAt !== "unspecified") {
    lines.push(`开饭：${card.serveAt}`);
  }
  const menu = card.menu.map((item) => item.displayName).filter(Boolean);
  lines.push(`菜单：${menu.length > 0 ? menu.join("、") : "见本餐方案"}`);
  const shopping = card.shoppingItems
    .filter((item) => item.status !== "not_needed")
    .map((item) => {
      const qty = item.purchase ? shoppingQuantity(item.purchase) : "";
      return qty ? `${foodName(item.foodId)} ${qty}` : foodName(item.foodId);
    });
  lines.push(
    shopping.length > 0 ? `采购：${shopping.join("、")}` : "采购：无需额外采购"
  );
  const inventory = (card.useFromInventory ?? []).map((item) =>
    foodName(item.foodId)
  );
  if (inventory.length > 0) {
    lines.push(`家中已有：${inventory.join("、")}`);
  }
  const notes = (card.executionNotes ?? []).map((note) => note.trim()).filter(Boolean);
  if (notes.length > 0) {
    lines.push("执行提示：");
    for (const note of notes) lines.push(`- ${note}`);
  }
  return lines.join("\n");
}

export async function copyTaskText(text: string): Promise<"copied" | "failed"> {
  try {
    if (!navigator.clipboard?.writeText) return "failed";
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

export async function shareTaskText(
  text: string
): Promise<"opened" | "unsupported" | "failed"> {
  if (!canWebShare()) return "unsupported";
  try {
    await navigator.share({ title: "家庭任务", text });
    return "opened";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return "opened";
    }
    return "failed";
  }
}

function shoppingQuantity(purchase: {
  estimateG: number | null;
  minG: number | null;
  maxG: number | null;
  confidence: string;
}): string {
  if (purchase.confidence === "exact" && purchase.estimateG != null) {
    return `${formatGrams(purchase.estimateG)}g`;
  }
  if (
    purchase.confidence === "approximate" &&
    purchase.minG != null &&
    purchase.maxG != null
  ) {
    return `约${formatGrams(purchase.minG)}–${formatGrams(purchase.maxG)}g`;
  }
  return "";
}
