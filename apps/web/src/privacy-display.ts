const DISEASE_OR_CLINICAL_RE =
  /糖尿病|高血压|diabetes|hypertension|stable_type2_diabetes_demo|hypertension_demo|weight_management|血糖管理|血压管理|体重管理/i;

/** Fail-closed filter for shared-screen or confirmation preview text. */
export function isSharedSafeDisplayText(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !DISEASE_OR_CLINICAL_RE.test(trimmed);
}
