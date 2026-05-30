import { apiFetch } from "@/services/client";


const WORKFLOW_INITIATE_PATH = "/api/v1/company-settings/workflow/initiate";
const WORKFLOW_FETCH_PATH = "/api/v1/company-settings/workflow/fetch";
const WORKFLOW_ACTION_PATH = "/api/v1/company-settings/workflow/action";
const WORKFLOW_HISTORY_PATH = "/api/v1/company-settings/workflow/fetch-history";

export type CreateWorkflowPayload = {
  type?: "initiate" | "update" | "active" | "inactive" | string;
  companyCode?: string;
  name?: string;
  alias?: string;
  module?: string;
  subModule?: string;
  workflowType?: "ALL CHILD" | "IMMEDIATE CHILD" | "NODE" | string;
  nodePath?: string | null;
  levels?: Record<string, unknown>;
  levelsHash?: string | null;
  target?: {
    module: string;
    subModule: string;
    nodePath: string;
    levelsHash: string;
  };
  remarks?: string;
};

type WorkflowApiResponse = {
  message?: string;
  code?: number;
  success?: boolean;
  data?: unknown;
};

type WorkflowPageInfo = {
  page: number;
  totalPages: number;
  nextCursor: string | null;
  prevCursor: string | null;
  topCursor: string | null;
  hasNext: boolean;
  hasPrev: boolean;
};

type WorkflowPaginatedApiResponse = WorkflowApiResponse & {
  data?: unknown[] | { active?: unknown[]; pending?: unknown[]; inactive?: unknown[] };
  activeCount?: number;
  pendingCount?: number;
  inactiveCount?: number;
  pageInfo?: Partial<WorkflowPageInfo>;
};

export type WorkflowFetchType = "active" | "pending" | "inactive";

export type WorkflowPaginatedRequest = {
  limit: number;
  cursor: string | null;
  topCursor: string | null;
  page?: number | null;
  direction?: "NEXT" | "PREV";
  query?: string | null;
};

export type WorkflowPaginatedResult = {
  rows: unknown[];
  counts: {
    active: number;
    pending: number;
    inactive: number;
  };
  pageInfo: WorkflowPageInfo;
};

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const toNullableString = (value: unknown): string | null => {
  const parsed = readString(value);
  return parsed || null;
};

const mapWorkflowPageInfo = (pageInfo?: Partial<WorkflowPageInfo>): WorkflowPageInfo => ({
  page: Number(pageInfo?.page ?? 1) || 1,
  totalPages: Number(pageInfo?.totalPages ?? 0) || 0,
  nextCursor: toNullableString(pageInfo?.nextCursor),
  prevCursor: toNullableString(pageInfo?.prevCursor),
  topCursor: toNullableString(pageInfo?.topCursor),
  hasNext: Boolean(pageInfo?.hasNext),
  hasPrev: Boolean(pageInfo?.hasPrev),
});

export async function createWorkflow(payload: CreateWorkflowPayload) {
  return apiFetch<WorkflowApiResponse>(WORKFLOW_INITIATE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchWorkflows() {
  return apiFetch<WorkflowApiResponse>(WORKFLOW_FETCH_PATH, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchWorkflowsPaginated(
  type: WorkflowFetchType,
  payload: WorkflowPaginatedRequest,
): Promise<WorkflowPaginatedResult> {
  const response = await apiFetch<WorkflowPaginatedApiResponse>(WORKFLOW_FETCH_PATH, {
    method: "POST",
    body: JSON.stringify({
      type,
      limit: payload.limit,
      cursor: payload.cursor ?? null,
      topCursor: payload.topCursor ?? null,
      page: payload.page ?? null,
      direction: payload.direction ?? "NEXT",
      query: readString(payload.query),
    }),
  });

  const dataPacket = response.data;
  const rows = Array.isArray(dataPacket)
    ? dataPacket
    : Array.isArray(dataPacket?.[type])
      ? (dataPacket[type] as unknown[])
      : [];
  const packetGroups = !Array.isArray(dataPacket) && dataPacket ? dataPacket : undefined;
  const fallbackActiveCount = Array.isArray(packetGroups?.active) ? packetGroups.active.length : 0;
  const fallbackPendingCount = Array.isArray(packetGroups?.pending) ? packetGroups.pending.length : 0;
  const fallbackInactiveCount = Array.isArray(packetGroups?.inactive) ? packetGroups.inactive.length : 0;
  return {
    rows,
    counts: {
      active: Number(response.activeCount ?? fallbackActiveCount) || 0,
      pending: Number(response.pendingCount ?? fallbackPendingCount) || 0,
      inactive: Number(response.inactiveCount ?? fallbackInactiveCount) || 0,
    },
    pageInfo: mapWorkflowPageInfo(response.pageInfo),
  };
}

export async function updateWorkflowAction(levelsHash: string, action: string, remark: string) {
  return apiFetch<WorkflowApiResponse>(WORKFLOW_ACTION_PATH, {
    method: "POST",
    body: JSON.stringify({
      levelsHash,
      action,
      remark,
    }),
  });
}

export type FetchWorkflowHistoryPayload = {
  levelsHash: string;
  module?: string | null;
  subModule?: string | null;
  nodePath?: string | null;
};

export async function fetchWorkflowHistory(payload: FetchWorkflowHistoryPayload) {
  const cleanedPayload: Record<string, string> = {
    levelsHash: payload.levelsHash.trim(),
  };

  const moduleValue = payload.module?.trim();
  if (moduleValue) cleanedPayload.module = moduleValue;

  const subModuleValue = payload.subModule?.trim();
  if (subModuleValue) cleanedPayload.subModule = subModuleValue;

  const nodePathValue = payload.nodePath?.trim();
  if (nodePathValue) cleanedPayload.nodePath = nodePathValue;

  return apiFetch<WorkflowApiResponse>(WORKFLOW_HISTORY_PATH, {
    method: "POST",
    body: JSON.stringify(cleanedPayload),
  });
}
