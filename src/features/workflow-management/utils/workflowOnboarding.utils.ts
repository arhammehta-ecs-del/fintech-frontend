import type { OrgNode } from "@/contexts/AppContext";
import type { WorkflowLevel } from "@/features/workflow-management/components/onboarding/types";

export const formatTokenLabel = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

export const getCategoryLabel = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "TRANSACTIONAL") return "Transactional";
  if (normalized === "OPERATIONAL") return "Operational";
  if (normalized === "SYSTEM_ACCESS") return "System Access";
  return formatTokenLabel(normalized);
};

export const INITIAL_LEVELS: WorkflowLevel[] = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  approvals: [{ option: "" }],
  type: "AND",
}));

export const createResetLevels = () => INITIAL_LEVELS.map((level) => ({ ...level, approvals: [{ option: "" }] }));

export const toApiApprover = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "reporting_manager") return "REPORTING_MANAGER";
  if (normalized === "node_approver") return "NODE_APPROVER";
  if (normalized === "hierarchy_approver") return "HIERARCHY_APPROVER";
  return value.trim().toUpperCase();
};

export const collectNodeOptions = (node: OrgNode | null): Array<{ label: string; value: string }> => {
  if (!node) return [];

  const nodes: Array<{ label: string; value: string }> = [];
  const walk = (current: OrgNode) => {
    const normalized = current.name.trim();
    const normalizedPath = current.nodePath.trim();
    if (normalized && normalizedPath && current.nodeType.toUpperCase() !== "ROOT") {
      nodes.push({ label: normalized, value: normalizedPath });
    }
    current.children.forEach(walk);
  };

  walk(node);
  return Array.from(
    nodes.reduce((acc, item) => {
      if (!acc.has(item.value)) acc.set(item.value, item);
      return acc;
    }, new Map<string, { value: string; label: string }>())
      .values(),
  );
};
