import { apiFetch } from "@/services/client";

const EDIT_LOCK_PATH = "/api/v1/company-settings/edit-lock";

type EditLockResponse = {
  message?: string;
  code?: number;
  success?: boolean;
  data?: unknown;
};

export type EditLockWorkflowTarget = {
  nodePath?: string;
  levelsHash: string;
  subModule?: string;
  module?: string;
};

export type EditLockPayload =
  | { type: "user"; target: { email: string }; subtype?: "lock" | "release"; addMin?: number | null }
  | { type: "org"; target: { nodePath: string }; subtype?: "lock" | "release"; addMin?: number | null }
  | { type: "workflow"; target: EditLockWorkflowTarget; subtype?: "lock" | "release"; addMin?: number | null };

export async function acquireEditLock(payload: EditLockPayload) {
  const normalizedType = payload.type.trim().toUpperCase();
  const normalizedSubtype = (payload.subtype || "lock").trim().toLowerCase();
  const normalizedAddMin =
    typeof payload.addMin === "number"
      ? payload.addMin
      : normalizedSubtype === "lock"
        ? 10
        : null;
  const normalizedPayload =
    payload.type === "workflow"
      ? {
          ...payload,
          target: Object.fromEntries(
            Object.entries(payload.target).filter(([, value]) => typeof value !== "string" || value.trim() !== ""),
          ) as EditLockWorkflowTarget,
        }
      : payload;
  const requestBody = {
    ...normalizedPayload,
    type: normalizedType,
    subtype: normalizedSubtype,
    addMin: normalizedAddMin,
  };

  return apiFetch<EditLockResponse>(EDIT_LOCK_PATH, {
    body: JSON.stringify(requestBody),
  });
}

export async function releaseEditLock(payload: Omit<EditLockPayload, "subtype" | "addMin">) {
  return acquireEditLock({
    ...payload,
    subtype: "release",
    addMin: 0,
  } as EditLockPayload);
}
