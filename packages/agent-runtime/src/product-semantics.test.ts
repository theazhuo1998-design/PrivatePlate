import { describe, expect, it } from "vitest";
import {
  canonicalizeCaregiverServeAt,
  resolveHandoffRecipient
} from "./product-semantics.js";

describe("canonicalizeCaregiverServeAt", () => {
  it("keeps supported explicit values", () => {
    expect(
      canonicalizeCaregiverServeAt("今天 12:30", "生成任务卡")
    ).toBe("今天 12:30");
    expect(
      canonicalizeCaregiverServeAt(
        "2026-08-04T18:30:00+08:00",
        "生成任务卡"
      )
    ).toBe("2026-08-04T18:30:00+08:00");
  });

  it("falls back to user-text resolution for under-specified clocks", () => {
    expect(
      canonicalizeCaregiverServeAt("18:00", "今晚六点开饭，给阿姨生成任务卡")
    ).toBe("今天 18:00");
  });

  it("prefers knownServeAt when model clock is invalid", () => {
    expect(
      canonicalizeCaregiverServeAt("晚饭时间", "生成任务卡", "今天 19:00")
    ).toBe("今天 19:00");
  });
});

describe("resolveHandoffRecipient fail-closed", () => {
  it("asks instead of inventing a recipient for 执行者 / 护工 / 家政", () => {
    expect(resolveHandoffRecipient("把任务发给执行者")).toEqual({
      status: "needs_clarification",
      reason: "recipient_label_ambiguous"
    });
    expect(resolveHandoffRecipient("发给护工")).toEqual({
      status: "needs_clarification",
      reason: "recipient_label_ambiguous"
    });
    expect(resolveHandoffRecipient("交给家政")).toEqual({
      status: "needs_clarification",
      reason: "recipient_label_ambiguous"
    });
  });

  it("asks when no recipient is named", () => {
    expect(resolveHandoffRecipient("预览任务卡并发送")).toEqual({
      status: "needs_clarification",
      reason: "recipient_label_missing"
    });
  });

  it("accepts an allowed label from user text", () => {
    expect(resolveHandoffRecipient("发给保姆")).toMatchObject({
      status: "ok",
      value: "保姆"
    });
  });
});
