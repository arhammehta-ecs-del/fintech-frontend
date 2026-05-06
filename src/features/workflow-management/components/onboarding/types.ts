export type WorkflowStep = 1 | 2 | 3;

export type ApprovalEntry = {
  option: string;
};

export type WorkflowLevel = {
  id: number;
  type: "AND" | "OR";
  approvals: ApprovalEntry[];
};

export type ModuleOption = {
  value: string;
  label: string;
};

export type ModuleGroup = {
  categoryKey: string;
  categoryLabel: string;
  options: ModuleOption[];
};
