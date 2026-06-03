import { apiFetch } from "@/services/client";

const HISTORY_DETAIL_PATH = "/api/v1/company-settings/history/detail";

export type HistoryDetailResponse = {
  message?: string;
  code?: number;
  success?: boolean;
  data?: unknown;
  oldData?: unknown;
  newData?: unknown;
  previousData?: unknown;
  currentData?: unknown;
};

export type HistoryDetailRequest = {
  id: string;
  type: "user" | "org" | "workflow";
};

export async function fetchHistoryDetail(payload: HistoryDetailRequest) {
  return apiFetch<HistoryDetailResponse>(HISTORY_DETAIL_PATH, {
    method: "POST",
    body: JSON.stringify({
      id: payload.id.trim(),
      type: payload.type,
    }),
  });
}
