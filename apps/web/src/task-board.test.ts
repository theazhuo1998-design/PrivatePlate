import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CAPABILITY_LINE,
  COPIED,
  COPY_TASK_LABEL,
  SAVE_TASK_LABEL,
  SAVED_HOUSEHOLD_SPACE,
  SAVED_LOCAL_DEMO,
  SHARE_OPENED,
  SHARE_TASK_LABEL,
  TASK_BOARD_LABEL,
  canWebShare,
  copyTaskText,
  formatTaskCardPlainText,
  shareTaskText,
  taskSaveMessage
} from "./task-board";

describe("task-board save / copy / share copy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps local-demo vs household-space save copy distinct", () => {
    expect(TASK_BOARD_LABEL).toBe("家庭任务板");
    expect(SAVE_TASK_LABEL).toBe("保存任务");
    expect(COPY_TASK_LABEL).toBe("复制任务");
    expect(SHARE_TASK_LABEL).toBe("分享任务");
    expect(CAPABILITY_LINE).toBe("尚未连接家庭消息渠道");
    expect(taskSaveMessage("demo")).toBe(SAVED_LOCAL_DEMO);
    expect(taskSaveMessage(undefined)).toBe(SAVED_LOCAL_DEMO);
    expect(taskSaveMessage("production")).toBe(SAVED_HOUSEHOLD_SPACE);
    expect(SAVED_LOCAL_DEMO).not.toMatch(/已发送|消息已送达/);
    expect(CAPABILITY_LINE).not.toMatch(/已发送/);
  });

  it("formats a plain-text task card without claiming an external send", () => {
    const text = formatTaskCardPlainText({
      recipientLabel: "家庭保姆",
      serveAt: "今天 18:00",
      menu: [{ displayName: "白菜豆腐煲" }, { displayName: "昨日米饭" }],
      shoppingItems: [
        {
          foodId: "food-tofu",
          status: "needed",
          purchase: {
            estimateG: 350,
            minG: 350,
            maxG: 350,
            confidence: "exact"
          }
        },
        { foodId: "food-rice-cooked", status: "not_needed" }
      ],
      useFromInventory: [{ foodId: "food-cabbage" }],
      executionNotes: ["全餐少盐"]
    });
    expect(text).toContain("执行：家庭保姆");
    expect(text).toContain("菜单：白菜豆腐煲、昨日米饭");
    expect(text).toContain("采购：豆腐 350g");
    expect(text).toContain("家中已有：白菜");
    expect(text).toContain("- 全餐少盐");
    expect(text).not.toMatch(/已发送|模拟信箱/);
  });

  it("copyTaskText reports copied or failed from the clipboard API", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn(async () => undefined)
      }
    });
    expect(await copyTaskText("家庭任务")).toBe("copied");
    expect(COPIED).toBe("已复制");

    vi.stubGlobal("navigator", {});
    expect(await copyTaskText("家庭任务")).toBe("failed");
  });

  it("shareTaskText stays unsupported without navigator.share", async () => {
    vi.stubGlobal("navigator", {});
    expect(canWebShare()).toBe(false);
    expect(await shareTaskText("家庭任务")).toBe("unsupported");
    expect(SHARE_OPENED).toBe("已打开系统分享面板");
  });
});
