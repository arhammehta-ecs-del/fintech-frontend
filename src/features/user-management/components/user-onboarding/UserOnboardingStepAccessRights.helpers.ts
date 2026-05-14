import type { OrgNode } from "@/contexts/AppContext";
import { getNodeAccentBackground, getNodeAccentBorderLeft } from "@/features/org-structure/nodeTheme.utils";
import { formatCollapsedNodePath } from "@/features/user-management/utils";

export type BranchMeta = {
  branchIndex: number | null;
  branchDepth: number;
};

const BRANCH_BADGE_BY_ACCENT: Record<string, string> = {
  "bg-slate-400": "border-indigo-300 bg-indigo-50 text-indigo-700",
  "bg-orange-500": "border-orange-300 bg-orange-50 text-orange-700",
  "bg-orange-300": "border-orange-200 bg-orange-50 text-orange-600",
  "bg-orange-200": "border-orange-200 bg-orange-50 text-orange-600",
  "bg-orange-100": "border-orange-200 bg-orange-50 text-orange-600",
  "bg-sky-500": "border-sky-300 bg-sky-50 text-sky-700",
  "bg-sky-300": "border-sky-200 bg-sky-50 text-sky-600",
  "bg-sky-200": "border-sky-200 bg-sky-50 text-sky-600",
  "bg-sky-100": "border-sky-200 bg-sky-50 text-sky-600",
  "bg-emerald-500": "border-emerald-300 bg-emerald-50 text-emerald-700",
  "bg-emerald-300": "border-emerald-200 bg-emerald-50 text-emerald-600",
  "bg-emerald-200": "border-emerald-200 bg-emerald-50 text-emerald-600",
  "bg-emerald-100": "border-emerald-200 bg-emerald-50 text-emerald-600",
  "bg-rose-500": "border-rose-300 bg-rose-50 text-rose-700",
  "bg-rose-300": "border-rose-200 bg-rose-50 text-rose-600",
  "bg-rose-200": "border-rose-200 bg-rose-50 text-rose-600",
  "bg-rose-100": "border-rose-200 bg-rose-50 text-rose-600",
  "bg-amber-500": "border-amber-300 bg-amber-50 text-amber-700",
  "bg-amber-300": "border-amber-200 bg-amber-50 text-amber-600",
  "bg-amber-200": "border-amber-200 bg-amber-50 text-amber-600",
  "bg-amber-100": "border-amber-200 bg-amber-50 text-amber-600",
  "bg-cyan-500": "border-cyan-300 bg-cyan-50 text-cyan-700",
  "bg-cyan-300": "border-cyan-200 bg-cyan-50 text-cyan-600",
  "bg-cyan-200": "border-cyan-200 bg-cyan-50 text-cyan-600",
  "bg-cyan-100": "border-cyan-200 bg-cyan-50 text-cyan-600",
};

const BRANCH_SURFACE_BY_ACCENT: Record<string, string> = {
  "bg-slate-400": "border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50/70",
  "bg-orange-500": "border-orange-200 bg-orange-50/50 hover:bg-orange-50/70",
  "bg-orange-300": "border-orange-200 bg-orange-50/50 hover:bg-orange-50/70",
  "bg-orange-200": "border-orange-200 bg-orange-50/50 hover:bg-orange-50/70",
  "bg-orange-100": "border-orange-200 bg-orange-50/50 hover:bg-orange-50/70",
  "bg-sky-500": "border-sky-200 bg-sky-50/50 hover:bg-sky-50/70",
  "bg-sky-300": "border-sky-200 bg-sky-50/50 hover:bg-sky-50/70",
  "bg-sky-200": "border-sky-200 bg-sky-50/50 hover:bg-sky-50/70",
  "bg-sky-100": "border-sky-200 bg-sky-50/50 hover:bg-sky-50/70",
  "bg-emerald-500": "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50/70",
  "bg-emerald-300": "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50/70",
  "bg-emerald-200": "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50/70",
  "bg-emerald-100": "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50/70",
  "bg-rose-500": "border-rose-200 bg-rose-50/50 hover:bg-rose-50/70",
  "bg-rose-300": "border-rose-200 bg-rose-50/50 hover:bg-rose-50/70",
  "bg-rose-200": "border-rose-200 bg-rose-50/50 hover:bg-rose-50/70",
  "bg-rose-100": "border-rose-200 bg-rose-50/50 hover:bg-rose-50/70",
  "bg-amber-500": "border-amber-200 bg-amber-50/50 hover:bg-amber-50/70",
  "bg-amber-300": "border-amber-200 bg-amber-50/50 hover:bg-amber-50/70",
  "bg-amber-200": "border-amber-200 bg-amber-50/50 hover:bg-amber-50/70",
  "bg-amber-100": "border-amber-200 bg-amber-50/50 hover:bg-amber-50/70",
  "bg-cyan-500": "border-cyan-200 bg-cyan-50/50 hover:bg-cyan-50/70",
  "bg-cyan-300": "border-cyan-200 bg-cyan-50/50 hover:bg-cyan-50/70",
  "bg-cyan-200": "border-cyan-200 bg-cyan-50/50 hover:bg-cyan-50/70",
  "bg-cyan-100": "border-cyan-200 bg-cyan-50/50 hover:bg-cyan-50/70",
};

export const isRootOrgNode = (node: OrgNode) => node.nodeType.trim().toUpperCase() === "ROOT";

export const buildNodeBreadcrumbMap = (root: OrgNode | null) => {
  const map = new Map<string, string>();
  if (!root) return map;

  const nodeLabel = (node: OrgNode) => {
    const name = typeof node.name === "string" ? node.name.trim() : "";
    if (name) return name;
    const type = typeof node.nodeType === "string" ? node.nodeType.trim() : "";
    return type || "Unnamed Node";
  };

  const walk = (node: OrgNode, trail: string[]) => {
    const nextTrail = [...trail, nodeLabel(node)].filter(Boolean);
    map.set(node.id, nextTrail.join(" > "));
    node.children.forEach((child) => walk(child, nextTrail));
  };

  walk(root, []);
  return map;
};

export const getNodeSubtitle = (node: OrgNode, breadcrumbByNodeId: Map<string, string>) => {
  if (isRootOrgNode(node)) return "";
  const breadcrumb = breadcrumbByNodeId.get(node.id) || "";
  return formatCollapsedNodePath(breadcrumb);
};

export const buildBranchMetaMap = (root: OrgNode | null): Map<string, BranchMeta> => {
  const branchMap = new Map<string, BranchMeta>();
  if (!root) return branchMap;

  const walk = (node: OrgNode, branchIndex: number | null, branchDepth: number) => {
    branchMap.set(node.id, { branchIndex, branchDepth });

    const isRootNode = isRootOrgNode(node);
    node.children.forEach((child, childIdx) => {
      const nextBranchIndex = isRootNode ? childIdx : (branchIndex ?? 0);
      const nextBranchDepth = isRootNode ? 0 : branchDepth + 1;
      walk(child, nextBranchIndex, nextBranchDepth);
    });
  };

  walk(root, isRootOrgNode(root) ? null : 0, 0);
  return branchMap;
};

const getNodeAccentClass = (node: OrgNode, branchMetaMap: Map<string, BranchMeta>) => {
  const isRoot = isRootOrgNode(node);
  const meta = branchMetaMap.get(node.id) ?? { branchIndex: null, branchDepth: 0 };
  return getNodeAccentBackground(meta.branchIndex, meta.branchDepth, isRoot);
};

export const getNodeBorderLeftClass = (node: OrgNode, branchMetaMap: Map<string, BranchMeta>) => {
  const isRoot = isRootOrgNode(node);
  const meta = branchMetaMap.get(node.id) ?? { branchIndex: null, branchDepth: 0 };
  return isRoot ? "border-l-indigo-500" : getNodeAccentBorderLeft(meta.branchIndex, meta.branchDepth, isRoot);
};

export const getNodeBadgeClass = (node: OrgNode, branchMetaMap: Map<string, BranchMeta>) =>
  BRANCH_BADGE_BY_ACCENT[getNodeAccentClass(node, branchMetaMap)] ?? "border-slate-200 bg-slate-50 text-slate-700";

export const getNodeSurfaceClass = (node: OrgNode, branchMetaMap: Map<string, BranchMeta>) =>
  BRANCH_SURFACE_BY_ACCENT[getNodeAccentClass(node, branchMetaMap)] ?? "border-slate-200 bg-white hover:bg-slate-50/60";
