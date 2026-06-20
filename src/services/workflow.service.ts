import { apiFetch } from "@/services/client";
import type { WorkflowRecord, WorkflowStatus } from "@/features/workflow-management/types/workflow.types";
import { mapWorkflowRecord } from "@/features/workflow-management/utils/workflowRecord.utils";


const WORKFLOW_INITIATE_PATH = "/api/v1/company-settings/workflow/initiate";
const WORKFLOW_FETCH_PATH = "/api/v1/company-settings/workflow/fetch";
const WORKFLOW_DETAILS_PATH = "/api/v1/company-settings/workflow/details";
const WORKFLOW_ACTION_PATH = "/api/v1/company-settings/workflow/action";
const WORKFLOW_HISTORY_PATH = "/api/v1/company-settings/workflow/fetch-history";
const COMPANY_NODES_PATH = "/api/v1/company-settings/user/fetch-company-nodes";
const WORKFLOW_USER_PREFERENCE_PATH = "/api/v1/workflow/user-preference";
const WORKFLOW_PREFERENCE_UPDATE_PATH = "/api/v1/workflow-preference";

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

type WorkflowPreferenceRecordResponse = WorkflowApiResponse & {
  data?: unknown[];
};

type WorkflowFilterDropdownsResponse = WorkflowApiResponse & {
  dropdowns?: {
    nodeName?: Array<{ value?: string; path?: string; levelCount?: number; count?: number } | string>;
    nodeType?: Array<{ value?: string; count?: number } | string>;
    category?: string[];
    subCategory?: string[];
    workflowLevel?: Array<{ value?: number | string; count?: number }>;
    checker?: Array<{ value?: number | string; count?: number }>;
  };
  nodeName?: Array<{ value?: string; path?: string; levelCount?: number; count?: number } | string>;
  nodeType?: Array<{ value?: string; count?: number } | string>;
  category?: string[];
  subCategory?: string[];
  workflowLevel?: Array<{ value?: number | string; count?: number }>;
  checker?: Array<{ value?: number | string; count?: number }>;
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
  workflowLevels: number[] | null;
  levels: Array<{ count: number; approverType: string | null }> | null;
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
  nodeName: Array<{ value: string; label: string; path: string; description?: string; level?: number; count?: number }>;
  nodeType: Array<{ value: string; label: string; count?: number; description?: string }>;
  module: Array<{ value: string; label: string; description?: string }>;
  workflowLevel: Array<{ value: string; label: string; count: number }>;
  approverCount: Array<{ value: string; label: string; count: number }>;
};

export type WorkflowPreferenceOption = {
  levelsHash: string;
  name: string;
  alias: string;
  selected: boolean;
};

export type WorkflowPreferenceModule = {
  module: string;
  selectedWorkflow: {
    levelsHash: string;
    name: string;
    alias: string;
  } | null;
  workflows: WorkflowPreferenceOption[];
};

export type WorkflowPreferenceNode = {
  nodeName: string;
  nodePath: string;
  nodeType: string;
  levelCount?: number;
  modules: WorkflowPreferenceModule[];
};

export type WorkflowPreferenceUpdatePayload = {
  module: string;
  nodePath: string;
  levelsHash: string;
  type?: "ADDED" | "REMOVED" | string;
};

const WORKFLOW_PREFERENCE_MOCK_STORAGE_KEY = "workflow-preference-mock-response";

const DEFAULT_WORKFLOW_PREFERENCE_MOCK_RESPONSE: WorkflowPreferenceRecordResponse = {
  message: "User workflow preferences fetched successfully!",
  code: 200,
  data: [
    {
      nodeName: "TEST Tech Solutions Pvt Ltd",
      nodePath: "TEST28042026",
      nodeType: "ROOT",
      modules: {
        USER: {
          workflows: [
            {
              levelsHash: "DEFAULT_ORG_STR_1M_1C_1",
              name: "ORG_STR_WORKFLOW_DEFAULT",
              alias: "1M_1C_D",
              selected: false,
            },
            {
              levelsHash: "1f5a8efc581a1c5a1bd054764bd2b642",
              name: "sadfsdfsdf",
              alias: "1M_3C_3",
              selected: true,
            },
          ],
        },
        ORG: {
          workflows: [
            {
              levelsHash: "DEFAULT_ORG_STR_1M_1C_1",
              name: "ORG_STR_WORKFLOW_DEFAULT",
              alias: "1M_1C_D",
              selected: true,
            },
            {
              levelsHash: "1f5a8efc581a1c5a1bd054764bd2b642",
              name: "sadfsdfsdf",
              alias: "1M_3C_3",
              selected: false,
            },
          ],
        },
        WORKFLOW: {
          workflows: [
            {
              levelsHash: "DEFAULT_ORG_STR_1M_1C_1",
              name: "ORG_STR_WORKFLOW_DEFAULT",
              alias: "1M_1C_D",
              selected: false,
            },
          ],
        },
      },
    },
  ],
};

type WorkflowNodeNameOption = WorkflowFilterDropdowns["nodeName"][number];
type WorkflowNodeTypeOption = WorkflowFilterDropdowns["nodeType"][number];

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const cloneWorkflowPreferenceMockResponse = (): WorkflowPreferenceRecordResponse =>
  JSON.parse(JSON.stringify(DEFAULT_WORKFLOW_PREFERENCE_MOCK_RESPONSE)) as WorkflowPreferenceRecordResponse;
const isWorkflowPreferenceMockEnabled = () => import.meta.env.VITE_ENABLE_WORKFLOW_PREFERENCE_MOCK === "true";
const toNullableString = (value: unknown): string | null => {
  const parsed = readString(value);
  return parsed || null;
};
const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
const formatFilterLabel = (value: string) =>
  value
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
const toApiToken = (value: string) => value.trim().replace(/\s+/g, "_").toUpperCase();
const getLevelCountFromPath = (nodePath: string, nodeType?: string) => {
  if ((nodeType || "").trim().toUpperCase() === "ROOT") return 1;
  return nodePath.split(".").map((segment) => segment.trim()).filter(Boolean).length || undefined;
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

const readWorkflowPreferenceMockResponse = (): WorkflowPreferenceRecordResponse => {
  if (typeof window === "undefined") return cloneWorkflowPreferenceMockResponse();

  const stored = window.localStorage.getItem(WORKFLOW_PREFERENCE_MOCK_STORAGE_KEY);
  if (!stored) {
    const initialValue = cloneWorkflowPreferenceMockResponse();
    window.localStorage.setItem(WORKFLOW_PREFERENCE_MOCK_STORAGE_KEY, JSON.stringify(initialValue));
    return initialValue;
  }

  try {
    const parsed = JSON.parse(stored) as WorkflowPreferenceRecordResponse;
    if (Array.isArray(parsed.data)) return parsed;
  } catch {
    // Fall back to the seeded mock payload when storage becomes invalid.
  }

  const fallback = cloneWorkflowPreferenceMockResponse();
  window.localStorage.setItem(WORKFLOW_PREFERENCE_MOCK_STORAGE_KEY, JSON.stringify(fallback));
  return fallback;
};

const writeWorkflowPreferenceMockResponse = (response: WorkflowPreferenceRecordResponse) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WORKFLOW_PREFERENCE_MOCK_STORAGE_KEY, JSON.stringify(response));
};

const updateWorkflowPreferenceMockState = (payload: WorkflowPreferenceUpdatePayload): WorkflowApiResponse => {
  const response = readWorkflowPreferenceMockResponse();
  const nextData = Array.isArray(response.data) ? [...response.data] : [];
  const targetModule = payload.module.trim().toUpperCase();
  const targetNodePath = payload.nodePath.trim().toUpperCase();
  const targetLevelsHash = payload.levelsHash.trim();
  const targetType = readString(payload.type).toUpperCase();

  nextData.forEach((node) => {
    const nodeRecord = typeof node === "object" && node !== null ? (node as Record<string, unknown>) : null;
    if (!nodeRecord) return;
    const currentNodePath = readString(nodeRecord.nodePath).toUpperCase();
    if (currentNodePath !== targetNodePath) return;

    const modulesRecord =
      typeof nodeRecord.modules === "object" && nodeRecord.modules !== null
        ? (nodeRecord.modules as Record<string, unknown>)
        : null;
    const moduleRecord =
      modulesRecord && typeof modulesRecord[targetModule] === "object" && modulesRecord[targetModule] !== null
        ? (modulesRecord[targetModule] as Record<string, unknown>)
        : null;
    if (!moduleRecord || !Array.isArray(moduleRecord.workflows)) return;

    moduleRecord.workflows = moduleRecord.workflows.map((workflowValue) => {
      const workflowRecord =
        typeof workflowValue === "object" && workflowValue !== null ? { ...(workflowValue as Record<string, unknown>) } : null;
      if (!workflowRecord) return workflowValue;
      const currentLevelsHash = readString(workflowRecord.levelsHash);

      if (targetType === "ADDED") {
        workflowRecord.selected = currentLevelsHash === targetLevelsHash;
        return workflowRecord;
      }

      if (targetType === "REMOVED" && currentLevelsHash === targetLevelsHash) {
        workflowRecord.selected = false;
      }

      return workflowRecord;
    });
  });

  writeWorkflowPreferenceMockResponse({
    ...response,
    message: "Workflow preference updated successfully!",
    code: 200,
    data: nextData,
  });

  return {
    message: "Workflow preference updated successfully!",
    code: 200,
    success: true,
  };
};

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

const mapWorkflowPreferenceNode = (value: unknown): WorkflowPreferenceNode | null => {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  if (!record) return null;

  const nodeName = readString(record.nodeName);
  const nodePath = readString(record.nodePath);
  const nodeType = readString(record.nodeType);
  const modulesRecord =
    typeof record.modules === "object" && record.modules !== null ? (record.modules as Record<string, unknown>) : {};

  const modules = Object.entries(modulesRecord)
    .map(([moduleName, moduleValue]) => {
      const moduleRecord =
        typeof moduleValue === "object" && moduleValue !== null ? (moduleValue as Record<string, unknown>) : null;
      if (!moduleRecord) return null;

      const selectedWorkflowRecord =
        typeof moduleRecord.selectedWorkflow === "object" && moduleRecord.selectedWorkflow !== null
          ? (moduleRecord.selectedWorkflow as Record<string, unknown>)
          : null;
      const workflowsRaw = Array.isArray(moduleRecord.workflows) ? moduleRecord.workflows : [];
      const workflows = workflowsRaw
        .map((workflowValue) => {
          const workflowRecord =
            typeof workflowValue === "object" && workflowValue !== null ? (workflowValue as Record<string, unknown>) : null;
          if (!workflowRecord) return null;

          const levelsHash = readString(workflowRecord.levelsHash);
          const name = readString(workflowRecord.name);
          const alias = readString(workflowRecord.alias);
          if (!levelsHash || !name) return null;

          return {
            levelsHash,
            name,
            alias,
            selected: Boolean(workflowRecord.selected),
          };
        })
        .filter((item): item is WorkflowPreferenceOption => Boolean(item));

      return {
        module: moduleName.trim().toUpperCase(),
        selectedWorkflow: selectedWorkflowRecord
          ? {
              levelsHash: readString(selectedWorkflowRecord.levelsHash),
              name: readString(selectedWorkflowRecord.name),
              alias: readString(selectedWorkflowRecord.alias),
            }
          : null,
        workflows,
      } satisfies WorkflowPreferenceModule;
    })
    .filter((item): item is WorkflowPreferenceModule => Boolean(item))
    .sort((left, right) => left.module.localeCompare(right.module));

  if (!nodePath) return null;

  return {
    nodeName: nodeName || nodePath,
    nodePath,
    nodeType: nodeType || "NODE",
    levelCount: getLevelCountFromPath(nodePath, nodeType),
    modules,
  };
};

export async function fetchWorkflowUserPreferences(): Promise<WorkflowPreferenceNode[]> {
  let response: WorkflowPreferenceRecordResponse;
  if (isWorkflowPreferenceMockEnabled()) {
    response = readWorkflowPreferenceMockResponse();
  } else {
    try {
      response = await apiFetch<WorkflowPreferenceRecordResponse>(WORKFLOW_USER_PREFERENCE_PATH, {
        method: "GET",
      });
    } catch (error) {
      if (!import.meta.env.DEV) throw error;
      response = readWorkflowPreferenceMockResponse();
    }
  }

  if (!Array.isArray(response.data)) {
    throw new Error("Invalid workflow preference response: data must be an array");
  }

  return response.data
    .map(mapWorkflowPreferenceNode)
    .filter((item): item is WorkflowPreferenceNode => Boolean(item))
    .sort((left, right) => left.nodePath.localeCompare(right.nodePath, undefined, { numeric: true, sensitivity: "base" }));
}

export async function updateWorkflowPreference(payload: WorkflowPreferenceUpdatePayload) {
  const requestBody = {
    module: payload.module,
    nodePath: payload.nodePath,
    levelsHash: payload.levelsHash,
    type: payload.type,
  };

  if (isWorkflowPreferenceMockEnabled()) {
    return updateWorkflowPreferenceMockState(payload);
  }
  try {
    return await apiFetch<WorkflowApiResponse>(WORKFLOW_PREFERENCE_UPDATE_PATH, {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    if (!import.meta.env.DEV) throw error;
    return updateWorkflowPreferenceMockState(payload);
  }
}

export async function fetchWorkflowFilterDropdowns(applied: WorkflowAppliedFilters | null = null): Promise<WorkflowFilterDropdowns> {
  const response = await apiFetch<WorkflowFilterDropdownsResponse>(COMPANY_NODES_PATH, {
    method: "POST",
    body: JSON.stringify({
      filter: true,
      subCategory: "WORK_FLOW",
      applied,
    }),
  });

  const dropdowns = response.dropdowns ?? {
    nodeName: response.nodeName,
    nodeType: response.nodeType,
    category: response.category,
    subCategory: response.subCategory,
    workflowLevel: response.workflowLevel,
    checker: response.checker,
  };

  if (!dropdowns.nodeName && !dropdowns.nodeType && !dropdowns.subCategory) {
    throw new Error("Invalid workflow filter response: missing dropdowns");
  }

  const nodeNameOptions: WorkflowNodeNameOption[] = Array.isArray(dropdowns.nodeName)
    ? dropdowns.nodeName.reduce<WorkflowNodeNameOption[]>((accumulator, item) => {
        if (typeof item === "string") {
          const value = readString(item);
          if (value) {
            accumulator.push({ value, label: value, path: "" });
          }
          return accumulator;
        }

        const value = readString(item?.value);
        const path = readString(item?.path);
        const count = typeof item?.count === "number" ? item.count : undefined;
        if (!value) return accumulator;
        accumulator.push({
          value,
          path,
          label: value,
          description: path || undefined,
          level: typeof item?.levelCount === "number" ? item.levelCount : undefined,
          count,
        });
        return accumulator;
      }, []).sort((a, b) => (a.path || "").localeCompare(b.path || ""))
    : [];

  const nodeTypeOptions: WorkflowNodeTypeOption[] = Array.isArray(dropdowns.nodeType)
    ? dropdowns.nodeType.reduce<WorkflowNodeTypeOption[]>((accumulator, item) => {
        if (typeof item === "string") {
          const value = formatFilterLabel(readString(item));
          if (value) {
            accumulator.push({ value, label: value });
          }
          return accumulator;
        }

        const value = formatFilterLabel(readString(item?.value));
        if (!value) return accumulator;
        const count = typeof item?.count === "number" ? item.count : undefined;
        accumulator.push({
          value,
          count,
          label: value,
          description: typeof count === "number" ? `${count} available` : undefined,
        });
        return accumulator;
      }, [])
    : [];

  return {
    nodeName: nodeNameOptions,
    nodeType: nodeTypeOptions,
    module: Array.isArray(dropdowns.subCategory)
      ? dropdowns.subCategory
        .map(readString)
        .filter((value) => Boolean(value) && value.trim().toLowerCase() !== "all")
        .map((value) => ({
          value: toApiToken(value),
          label: formatFilterLabel(value),
        }))
      : [],
    workflowLevel: Array.isArray(dropdowns.workflowLevel)
      ? dropdowns.workflowLevel
          .map((item) => ({
            value: toNullableNumber(item?.value),
            count: toNullableNumber(item?.count),
          }))
          .filter((item): item is { value: number; count: number } => item.value !== null && item.count !== null)
          .map((item) => ({
            value: String(item.value),
            label: String(item.value),
            count: item.count,
          }))
          .sort((a, b) => Number(a.value) - Number(b.value))
      : [],
    approverCount: Array.isArray(dropdowns.checker)
      ? dropdowns.checker
          .map((item) => ({
            value: toNullableNumber(item?.value),
            count: toNullableNumber(item?.count),
          }))
          .filter((item): item is { value: number; count: number } => item.value !== null && item.count !== null)
          .map((item) => ({
            value: String(item.value),
            label: String(item.value),
            count: item.count,
          }))
          .sort((a, b) => Number(a.value) - Number(b.value))
      : [],
  };
}
