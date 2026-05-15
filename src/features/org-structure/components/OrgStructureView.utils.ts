import type { OrgNode } from "@/contexts/AppContext";

export function filterPendingNodes(node: OrgNode | null): OrgNode | null {
  if (!node) return null;
  if (node.status === "Pending") return null;
  return {
    ...node,
    children: node.children
      .map(filterPendingNodes)
      .filter((nextNode): nextNode is OrgNode => nextNode !== null),
  };
}

export function countNodes(node: OrgNode | null): number {
  if (!node) return 0;
  return 1 + node.children.reduce((acc, child) => acc + countNodes(child), 0);
}

export function countPendingNodes(node: OrgNode | null): number {
  if (!node) return 0;
  const own = node.status === "Pending" ? 1 : 0;
  return own + node.children.reduce((acc, child) => acc + countPendingNodes(child), 0);
}

export function hasPendingNodes(node: OrgNode | null): boolean {
  if (!node) return false;
  if (node.status === "Pending") return true;
  return node.children.some(hasPendingNodes);
}
