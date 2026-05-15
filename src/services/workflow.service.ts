import { apiFetch } from "@/services/client";


const WORKFLOW_INITIATE_PATH = "/api/v1/company-settings/workflow/initiate";
const WORKFLOW_FETCH_PATH = "/api/v1/company-settings/workflow/fetch";
const WORKFLOW_ACTION_PATH = "/api/v1/company-settings/workflow/action";
const WORKFLOW_HISTORY_PATH = "/api/v1/company-settings/workflow/fetch-history";

export type CreateWorkflowPayload = {
  companyCode: string;
  name: string;
  alias?: string;
  module: string;
  subModule: string;
  nodePath?: string | null;
  levels: Record<string, unknown>;
  levelsHash?: string | null;
};

type WorkflowApiResponse = {
  message?: string;
  code?: number;
  success?: boolean;
  data?: unknown;
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
