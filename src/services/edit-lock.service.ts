import { apiFetch } from "@/services/client";

const EDIT_LOCK_PATH = "/api/v1/company-settings/edit-lock";

type EditLockResponse = {
  message?: string;
  code?: number;
  success?: boolean;
  data?: unknown;
};

export type EditLockWorkflowTarget = {
  nodePath: string;
  levelsHash: string;
  subModule: string;
  module: string;
};

export type EditLockPayload =
  | { type: "user"; target: string }
  | { type: "org"; target: { nodePath: string } }
  | { type: "workflow"; target: EditLockWorkflowTarget };

export async function acquireEditLock(payload: EditLockPayload) {
  const normalizedType = payload.type.trim().toUpperCase();
  const requestBody = {
    ...payload,
    type: normalizedType,
  };

  return apiFetch<EditLockResponse>(EDIT_LOCK_PATH, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}
