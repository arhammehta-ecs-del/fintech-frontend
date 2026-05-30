import type { OrgNode } from "@/contexts/AppContext";

const isPendingNode = (node: OrgNode) => (node.status || "").trim().toUpperCase() === "PENDING";
const hasUpdateRequest = (node: OrgNode) => (node.pendingRequestType || "").trim().toUpperCase() === "UPDATE";

export function filterPendingNodes(node: OrgNode | null): OrgNode | null {
  if (!node) return null;
  // Keep update-request nodes visible even when pending view is turned off.
  if (isPendingNode(node) && !hasUpdateRequest(node)) return null;
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
  const own = isPendingNode(node) ? 1 : 0;
  return own + node.children.reduce((acc, child) => acc + countPendingNodes(child), 0);
}

export function hasPendingNodes(node: OrgNode | null): boolean {
  if (!node) return false;
  if (isPendingNode(node)) return true;
  return node.children.some(hasPendingNodes);
}
