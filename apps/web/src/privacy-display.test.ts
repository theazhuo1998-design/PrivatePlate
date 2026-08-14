import { describe, expect, it } from "vitest";
import { isSharedSafeDisplayText } from "./privacy-display";

describe("shared-screen display privacy", () => {
  it("keeps operational cooking cues", () => {
    expect(isSharedSafeDisplayText("主食小份")).toBe(true);
    expect(isSharedSafeDisplayText("少盐")).toBe(true);
    expect(isSharedSafeDisplayText("避鸡蛋")).toBe(true);
  });

  it("drops disease and clinical labels (fail closed)", () => {
    expect(isSharedSafeDisplayText("糖尿病")).toBe(false);
    expect(isSharedSafeDisplayText("高血压")).toBe(false);
    expect(isSharedSafeDisplayText("血糖管理")).toBe(false);
    expect(isSharedSafeDisplayText("血压管理")).toBe(false);
    expect(isSharedSafeDisplayText("体重管理")).toBe(false);
    expect(isSharedSafeDisplayText("stable_type2_diabetes_demo")).toBe(false);
    expect(isSharedSafeDisplayText("hypertension_demo")).toBe(false);
    expect(isSharedSafeDisplayText("weight_management")).toBe(false);
    expect(isSharedSafeDisplayText("")).toBe(false);
    expect(isSharedSafeDisplayText("   ")).toBe(false);
  });
});
