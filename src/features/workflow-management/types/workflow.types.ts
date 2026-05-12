export type WorkflowStatus = "Active" | "Pending";

export type WorkflowRecord = {
  id: string;
  workflowId?: string;
  levelsHash?: string;
  name: string;
  alias: string;
  module: string;
  rawModule?: string;
  nodeName: string;
  nodeType: string;
  subModule: string;
  nodePath: string;
  levels: unknown;
  approvalRemark?: string;
  initiatorName?: string;
  initiatorEmail?: string;
  initiatedDate?: string;
  workflowName?: string;
  workflowAlias?: string;
  status: WorkflowStatus;
};

export const WORKFLOW_PAGE_SIZE_OPTIONS = [15, 25, 35, 50] as const;
export type WorkflowPageSize = (typeof WORKFLOW_PAGE_SIZE_OPTIONS)[number];
