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
  nodePath: string;
  levels: Record<string, any>;
  levelsHash?: string | null;
};

export async function createWorkflow(payload: CreateWorkflowPayload) {
  return apiFetch<any>(WORKFLOW_INITIATE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchWorkflows() {
  return apiFetch<any>(WORKFLOW_FETCH_PATH, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function updateWorkflowAction(levelsHash: string, action: string, remark: string) {
  return apiFetch<any>(WORKFLOW_ACTION_PATH, {
    method: "POST",
    body: JSON.stringify({
      levelsHash,
      action,
      remark,
    }),
  });
}

export async function fetchWorkflowHistory(levelsHash: string) {
  return apiFetch<any>(WORKFLOW_HISTORY_PATH, {
    method: "POST",
    body: JSON.stringify({ levelsHash }),
  });
}
