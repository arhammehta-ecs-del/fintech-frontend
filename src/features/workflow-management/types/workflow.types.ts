export type WorkflowStatus = "Active" | "Pending";

export type WorkflowRecord = {
  id: string;
  name: string;
  alias: string;
  module: string;
  nodeName: string;
  nodeType: string;
  subModule: string;
  nodePath: string;
  levels: unknown;
  approvalRemark?: string;
  status: WorkflowStatus;
};

export const WORKFLOW_PAGE_SIZE_OPTIONS = [10, 15, 25] as const;
export type WorkflowPageSize = (typeof WORKFLOW_PAGE_SIZE_OPTIONS)[number];
