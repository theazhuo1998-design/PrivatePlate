import { describe, expect, it } from "vitest";
import { isSharedSafeCue } from "./device-surface";

describe("privacy execution cues", () => {
  it("keeps operational cooking cues", () => {
    expect(isSharedSafeCue("主食小份")).toBe(true);
    expect(isSharedSafeCue("少盐")).toBe(true);
    expect(isSharedSafeCue("避鸡蛋")).toBe(true);
  });

  it("drops disease and clinical labels (fail closed)", () => {
    expect(isSharedSafeCue("糖尿病")).toBe(false);
    expect(isSharedSafeCue("高血压")).toBe(false);
    expect(isSharedSafeCue("血糖管理")).toBe(false);
    expect(isSharedSafeCue("血压管理")).toBe(false);
    expect(isSharedSafeCue("体重管理")).toBe(false);
    expect(isSharedSafeCue("stable_type2_diabetes_demo")).toBe(false);
    expect(isSharedSafeCue("hypertension_demo")).toBe(false);
    expect(isSharedSafeCue("weight_management")).toBe(false);
    expect(isSharedSafeCue("")).toBe(false);
    expect(isSharedSafeCue("   ")).toBe(false);
  });
});
