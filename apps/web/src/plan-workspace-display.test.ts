import { describe, expect, it } from "vitest";
import { displayFoodName } from "./components/PlanWorkspace";

describe("plan workspace food labels", () => {
  it("keeps mapped fixture ids in Chinese", () => {
    expect(displayFoodName("food-tofu")).toBe("豆腐");
    expect(displayFoodName("food-fish-fillet")).toBe("鱼片");
    expect(displayFoodName("food-rice-cooked")).toBe("熟米饭");
    expect(displayFoodName("food-egg")).toBe("鸡蛋");
  });

  it("does not show raw fish or rice ids", () => {
    expect(displayFoodName("fish")).toBe("鱼片");
    expect(displayFoodName("rice")).toBe("米饭");
    expect(displayFoodName("food-fish")).toBe("鱼片");
    expect(displayFoodName("food-rice")).toBe("米饭");
    expect(displayFoodName("fish")).not.toMatch(/^[a-z]+$/);
    expect(displayFoodName("rice")).not.toMatch(/^[a-z]+$/);
  });
});
