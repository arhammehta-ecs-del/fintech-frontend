import type { WorkflowTypeScope } from "./types";

export const WORKFLOW_TYPE_SCOPE_OPTIONS: Array<{ value: WorkflowTypeScope; label: string }> = [
  { value: "ALL CHILD", label: "ALL CHILD" },
  { value: "IMMEDIATE CHILD", label: "IMMEDIATE CHILD" },
  { value: "NODE", label: "NODE" },
];
