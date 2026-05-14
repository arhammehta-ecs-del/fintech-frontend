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

export const buildWorkflowOptions = (nodes: Array<{ workflows: Array<{ levelsHash: string; name: string; alias?: string }> }>) => {
  const options = nodes
    .flatMap((node) => node.workflows)
    .map((workflow) => {
      const levelsHash = workflow.levelsHash.trim();
      const name = workflow.name.trim();
      const alias = workflow.alias?.trim();
      if (!levelsHash || !name) return null;
      return {
        levelsHash,
        label: alias ? `${name} (${alias})` : name,
      };
    })
    .filter((option): option is { levelsHash: string; label: string } => Boolean(option));

  return Array.from(new Map(options.map((option) => [option.levelsHash, option])).values());
};
