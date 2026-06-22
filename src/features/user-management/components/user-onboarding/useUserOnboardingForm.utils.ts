import type { OrgNode } from "@/contexts/AppContext";

const toNodeType = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "ROOT" || normalized === "DIVISION" || normalized === "DEPARTMENT" || normalized === "TEAM" || normalized === "PLANT" || normalized === "LOCATION") {
    return normalized;
  }
  return "DEPARTMENT";
};

export const buildOrgTreeFromCompanyNodes = (rows: Array<{ nodeName: string; nodePath: string; nodeType: string }>): OrgNode | null => {
  if (rows.length === 0) return null;

  const byPath = new Map<string, OrgNode>();
  rows.forEach((row) => {
    const nodePath = row.nodePath.trim();
    if (!nodePath) return;
    byPath.set(nodePath, {
      id: nodePath,
      name: row.nodeName.trim() || "Unnamed Node",
      nodePath,
      nodeType: toNodeType(row.nodeType),
      status: "Active",
      children: [],
    });
  });

  const roots: OrgNode[] = [];
  byPath.forEach((node, nodePath) => {
    const segments = nodePath.split(".").map((segment) => segment.trim()).filter(Boolean);
    const parentPath = segments.length > 1 ? segments.slice(0, -1).join(".") : null;
    if (!parentPath) {
      roots.push(node);
      return;
    }
    const parent = byPath.get(parentPath);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortBranch = (nodes: OrgNode[]) => {
    nodes.sort((a, b) => a.nodePath.localeCompare(b.nodePath, undefined, { numeric: true, sensitivity: "base" }));
    nodes.forEach((node) => sortBranch(node.children));
  };
  sortBranch(roots);
  return roots.find((node) => node.nodeType === "ROOT") ?? roots[0] ?? null;
};

type AccessDetailNode = {
  nodeName?: string;
  nodePath?: string;
  nodeType?: string;
};

const cloneOrgNode = (node: OrgNode): OrgNode => ({
  ...node,
  children: node.children.map(cloneOrgNode),
});

const sortOrgBranch = (nodes: OrgNode[]) => {
  nodes.sort((a, b) => a.nodePath.localeCompare(b.nodePath, undefined, { numeric: true, sensitivity: "base" }));
  nodes.forEach((node) => sortOrgBranch(node.children));
};

export const mergeOrgTreeWithAccessNodes = (
  root: OrgNode | null,
  accessRows: AccessDetailNode[],
): OrgNode | null => {
  if (!root) return null;
  if (accessRows.length === 0) return root;

  const clonedRoot = cloneOrgNode(root);
  const byPath = new Map<string, OrgNode>();

  const register = (node: OrgNode) => {
    byPath.set(node.nodePath.trim().toUpperCase(), node);
    node.children.forEach(register);
  };

  register(clonedRoot);

  accessRows.forEach((row) => {
    const nodePath = (row.nodePath || "").trim();
    if (!nodePath) return;

    const normalizedPath = nodePath.toUpperCase();
    if (byPath.has(normalizedPath)) return;

    const segments = nodePath.split(".").map((segment) => segment.trim()).filter(Boolean);
    const parentPath = segments.length > 1 ? segments.slice(0, -1).join(".").toUpperCase() : "";
    const parentNode = byPath.get(parentPath) ?? clonedRoot;

    const nextNode: OrgNode = {
      id: nodePath,
      name: (row.nodeName || "").trim() || segments[segments.length - 1] || "Unnamed Node",
      nodePath,
      nodeType: toNodeType((row.nodeType || "").trim() || "TEAM"),
      status: "Active",
      children: [],
    };

    parentNode.children.push(nextNode);
    byPath.set(normalizedPath, nextNode);
  });

  sortOrgBranch([clonedRoot]);
  return clonedRoot;
};

type WorkflowOptionSource = {
  levelsHash: string;
  name: string;
  alias?: string;
  selected?: boolean;
};

const toWorkflowOption = (workflow: WorkflowOptionSource) => {
  const levelsHash = workflow.levelsHash.trim();
  const name = workflow.name.trim();
  const alias = workflow.alias?.trim();
  if (!levelsHash || !name) return null;

  return {
    levelsHash,
    label: alias ? `${name} (${alias})` : name,
  };
};

export const buildWorkflowOptions = (nodes: Array<{ workflows: WorkflowOptionSource[] }>) => {
  const options = nodes
    .flatMap((node) => node.workflows)
    .map(toWorkflowOption)
    .filter((option): option is { levelsHash: string; label: string } => Boolean(option));

  return Array.from(new Map(options.map((option) => [`${option.levelsHash}::${option.label}`, option])).values());
};

export const findSelectedWorkflowOption = (
  nodes: Array<{ selectedWorkflow?: WorkflowOptionSource | null; workflows: WorkflowOptionSource[] }>,
) => {
  for (const node of nodes) {
    const selectedWorkflow = node.selectedWorkflow ?? node.workflows.find((workflow) => workflow.selected) ?? null;
    if (!selectedWorkflow) continue;

    const option = toWorkflowOption(selectedWorkflow);
    if (option) return option;
  }

  return null;
};
