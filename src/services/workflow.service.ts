import { apiFetch } from "@/services/client";
import type { WorkflowRecord, WorkflowStatus } from "@/features/workflow-management/types/workflow.types";
import { mapWorkflowRecord } from "@/features/workflow-management/utils/workflowRecord.utils";


const WORKFLOW_INITIATE_PATH = "/api/v1/company-settings/workflow/initiate";
const WORKFLOW_FETCH_PATH = "/api/v1/company-settings/workflow/fetch";
const WORKFLOW_DETAILS_PATH = "/api/v1/company-settings/workflow/details";
const WORKFLOW_ACTION_PATH = "/api/v1/company-settings/workflow/action";
const WORKFLOW_HISTORY_PATH = "/api/v1/company-settings/workflow/fetch-history";
const COMPANY_NODES_PATH = "/api/v1/company-settings/user/fetch-company-nodes";

export type CreateWorkflowPayload = {
  type?: "initiate" | "update" | "active" | "inactive" | "archive" | string;
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

type WorkflowDetailsApiResponse = WorkflowApiResponse & {
  data?: unknown;
};

type WorkflowFilterDropdownsResponse = WorkflowApiResponse & {
  dropdowns?: {
    nodeName?: Array<{ value?: string; path?: string } | string>;
    nodeType?: Array<{ value?: string; count?: number } | string>;
    category?: string[];
    subCategory?: string[];
  };
  nodeName?: Array<{ value?: string; path?: string } | string>;
  nodeType?: Array<{ value?: string; count?: number } | string>;
  category?: string[];
  subCategory?: string[];
};

export type WorkflowFetchType = "active" | "pending" | "inactive";

export type WorkflowPaginatedRequest = {
  filter?: boolean;
  applied?: WorkflowAppliedFilters | null;
  limit: number;
  cursor: string | null;
  topCursor: string | null;
  page?: number | null;
  direction?: "NEXT" | "PREV";
  query?: string | null;
};

export type WorkflowAppliedFilters = {
  nodeName: { values: string[] | null } | null;
  nodeType: string[] | null;
  workflowType: string[] | null;
  module: string[] | null;
  subModule: string[] | null;
  workflowLevels: number | null;
  levels: Array<{ count: number; approverType: string }> | null;
  approverType: string[] | null;
  onboardingDate: {
    dateRange: string | null;
    fromDate: string | null;
    toDate: string | null;
  } | null;
  hasLinkedOrg: "Yes" | "No" | null;
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

export type FetchWorkflowDetailsInput = {
  id: string;
  status?: WorkflowStatus;
};

export type WorkflowFilterDropdowns = {
  nodeName: Array<{ value: string; label: string; path: string; description?: string }>;
  nodeType: Array<{ value: string; label: string; count?: number; description?: string }>;
  module: Array<{ value: string; label: string; description?: string }>;
};

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const toNullableString = (value: unknown): string | null => {
  const parsed = readString(value);
  return parsed || null;
};
const formatFilterLabel = (value: string) =>
  value
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
const toApiToken = (value: string) => value.trim().replace(/\s+/g, "_").toUpperCase();

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
      filter: Boolean(payload.filter),
      pagination: {
        statusType: type,
        limit: payload.limit,
        cursor: payload.cursor ?? null,
        topCursor: payload.topCursor ?? null,
        page: payload.page ?? null,
        direction: payload.direction ?? "NEXT",
        query: readString(payload.query) || null,
      },
      applied: payload.filter ? payload.applied ?? null : null,
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
  id: string;
};

export async function fetchWorkflowHistory(payload: FetchWorkflowHistoryPayload) {
  return apiFetch<WorkflowApiResponse>(WORKFLOW_HISTORY_PATH, {
    method: "POST",
    body: JSON.stringify({ id: payload.id.trim() }),
  });
}

export async function fetchWorkflowDetails(payload: FetchWorkflowDetailsInput): Promise<WorkflowRecord> {
  const response = await apiFetch<WorkflowDetailsApiResponse>(WORKFLOW_DETAILS_PATH, {
    method: "POST",
    body: JSON.stringify({ id: payload.id.trim() }),
  });

  const derivedStatusRaw =
    readString((response.data as Record<string, unknown> | null | undefined)?.status).toUpperCase() ||
    readString((response.data as Record<string, unknown> | null | undefined)?.isPending ? "PENDING" : "");
  const derivedStatus: WorkflowStatus =
    payload.status ||
    (derivedStatusRaw === "PENDING" ? "Pending" : derivedStatusRaw === "INACTIVE" ? "Inactive" : "Active");

  return mapWorkflowRecord(response.data, derivedStatus);
}

export async function fetchWorkflowFilterDropdowns(): Promise<WorkflowFilterDropdowns> {
  const response = await apiFetch<WorkflowFilterDropdownsResponse>(COMPANY_NODES_PATH, {
    method: "POST",
    body: JSON.stringify({
      filter: true,
      subCategory: "WORK_FLOW",
    }),
  });

  const dropdowns = response.dropdowns ?? {
    nodeName: response.nodeName,
    nodeType: response.nodeType,
    category: response.category,
    subCategory: response.subCategory,
  };

  if (!dropdowns.nodeName && !dropdowns.nodeType && !dropdowns.subCategory) {
    throw new Error("Invalid workflow filter response: missing dropdowns");
  }

  return {
    nodeName: Array.isArray(dropdowns.nodeName)
      ? dropdowns.nodeName
        .map((item) => {
          if (typeof item === "string") {
            const value = readString(item);
            return value ? { value, label: value, path: "" } : null;
          }

          const value = readString(item?.value);
          const path = readString(item?.path);
          if (!value) return null;
          return {
            value,
            path,
            label: value,
            description: path || undefined,
          };
        })
        .filter((item): item is { value: string; label: string; path: string; description?: string } => Boolean(item))
      : [],
    nodeType: Array.isArray(dropdowns.nodeType)
      ? dropdowns.nodeType
        .map((item) => {
          if (typeof item === "string") {
            const value = formatFilterLabel(readString(item));
            return value ? { value, label: value } : null;
          }

          const value = formatFilterLabel(readString(item?.value));
          if (!value) return null;
          const count = typeof item?.count === "number" ? item.count : undefined;
          return {
            value,
            count,
            label: value,
            description: typeof count === "number" ? `${count} available` : undefined,
          };
        })
        .filter((item): item is { value: string; label: string; count?: number; description?: string } => Boolean(item))
      : [],
    module: Array.isArray(dropdowns.subCategory)
      ? dropdowns.subCategory
        .map(readString)
        .filter((value) => Boolean(value) && value.trim().toLowerCase() !== "all")
        .map((value) => ({
          value: toApiToken(value),
          label: formatFilterLabel(value),
        }))
      : [],
  };
}
