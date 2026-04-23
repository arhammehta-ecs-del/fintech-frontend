import type { OrgNode } from "@/contexts/AppContext";

export const findOrgNodeById = (root: OrgNode | null, nodeId: string): OrgNode | null => {
  if (!root) return null;
  if (root.id === nodeId) return root;
  for (const child of root.children) {
    const match = findOrgNodeById(child, nodeId);
    if (match) return match;
  }
  return null;
};

export const flattenOrg = (node: OrgNode | null): OrgNode[] => {
  if (!node) return [];
  return [node, ...node.children.flatMap((child) => flattenOrg(child))];
};

export const findParentNodeById = (root: OrgNode | null, targetId: string): OrgNode | null => {
  if (!root) return null;

  for (const child of root.children) {
    if (child.id === targetId) return root;
    const match = findParentNodeById(child, targetId);
    if (match) return match;
  }

  return null;
};

export const insertNodeUnderParent = (root: OrgNode, parentId: string, newNode: OrgNode): OrgNode => {
  if (root.id === parentId) {
    return {
      ...root,
      children: [...root.children, newNode],
    };
  }

  return {
    ...root,
    children: root.children.map((child) => insertNodeUnderParent(child, parentId, newNode)),
  };
};

export const getNodeAncestors = (node: OrgNode | null): string[] => {
  if (!node) return [];

  const pathSegments = node.nodePath
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment.toUpperCase() !== "ROOT");

  if (pathSegments.length > 0) {
    return pathSegments;
  }

  return [node.name].filter(Boolean);
};

export const collectNodeTrail = (root: OrgNode | null, targetId: string): string[] => {
  const breadcrumbs: string[] = [];

  const walk = (branch: OrgNode | null): boolean => {
    if (!branch) return false;

    breadcrumbs.push(branch.name);
    if (branch.id === targetId) return true;

    for (const child of branch.children) {
      if (walk(child)) return true;
    }

    breadcrumbs.pop();
    return false;
  };

  walk(root);
  return breadcrumbs;
};
