/**
 * Presentation-only device surface. Changes title, entry priority, and
 * density. Must not affect Agent tools, Domain, DB schema, or invent
 * door / temperature / wake-word / appliance events.
 */
export type DeviceSurface = "web" | "smart_fridge" | "home_hub";

export type HubSampleState = "default" | "loading" | "offline" | "pending";

export const DEFAULT_DEVICE_SURFACE: DeviceSurface = "home_hub";

export const DEVICE_SIMULATOR_DISCLOSURE =
  "浏览器设备模拟器。相机和麦克风来自当前浏览器；未接入冰箱门控、温度、唤醒词或真实家电 API；识别结果需人工确认。";

export const INPUT_SOURCE_FRIDGE_SNAPSHOT = "用户上传的冰箱快照";
export const INPUT_SOURCE_BROWSER_MIC = "浏览器麦克风";
export const INPUT_SOURCE_MANUAL = "手动输入";
export const INPUT_SOURCE_FRIDGE_SIM = "智能冰箱模拟数据";

const DISEASE_OR_CLINICAL_RE =
  /糖尿病|高血压|diabetes|hypertension|stable_type2_diabetes_demo|hypertension_demo|weight_management|血糖管理|血压管理|体重管理/i;

export type SurfaceCopy = {
  productTitle: string;
  spaceLabel: string;
  primaryAction: string;
  snapshotAction: string;
  typeAction: string;
};

export function parseDeviceSurface(
  search: string = window.location.search
): DeviceSurface {
  const value = new URLSearchParams(search).get("surface");
  if (value === "web" || value === "smart_fridge" || value === "home_hub") {
    return value;
  }
  return DEFAULT_DEVICE_SURFACE;
}

export function parseHubSampleState(
  search: string = window.location.search
): HubSampleState {
  const value = new URLSearchParams(search).get("hubSample");
  if (value === "loading" || value === "offline" || value === "pending") {
    return value;
  }
  return "default";
}

export function surfaceCopy(surface: DeviceSurface): SurfaceCopy {
  if (surface === "smart_fridge") {
    return {
      productTitle: "冰箱面板",
      spaceLabel: "厨房冰箱",
      primaryAction: "按住说话",
      snapshotAction: "拍冰箱快照",
      typeAction: "输入需求"
    };
  }
  if (surface === "web") {
    return {
      productTitle: "家庭用餐",
      spaceLabel: "网页",
      primaryAction: "输入需求",
      snapshotAction: "上传库存照片",
      typeAction: "输入需求"
    };
  }
  return {
    productTitle: "家庭中控",
    spaceLabel: "Home Hub",
    primaryAction: "按住说话",
    snapshotAction: "拍冰箱快照",
    typeAction: "输入需求"
  };
}

export function isSharedSafeCue(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !DISEASE_OR_CLINICAL_RE.test(trimmed);
}

export function formatServeAt(serveAt: string | null | undefined): string {
  if (!serveAt || serveAt === "unspecified") return "开饭时间未定";
  return serveAt;
}
