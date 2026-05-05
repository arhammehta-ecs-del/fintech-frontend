import type { OrgNode } from "@/contexts/AppContext";

export type OrgTreeNode = OrgNode;

export type NewNodeType = "" | "ROOT" | "DEPARTMENT" | "TEAM" | "PLANT" | "LOCATION";

export type DepartmentSidebarDepartment = {
  id: string;
  name: string;
  parentId?: string | null;
  nodeType?: string;
  nodePath?: string;
  companyId?: string;
  childCount?: number;
  breadcrumbs?: string[];
  parentName?: string | null;
  children?: Array<{ id: string; name: string; nodeType?: string; childCount?: number }>;
  siblings?: Array<{ id: string; name: string; nodeType?: string; childCount?: number }>;
};

export type LayoutNode = {
  node: OrgNode;
  depth: number;
  width: number;
  height: number;
  subtreeWidth: number;
  nodeLeft: number;
  children: Array<{
    subtreeLeft: number;
    layout: LayoutNode;
  }>;
};

export type PositionedNode = {
  node: OrgNode;
  depth: number;
  branchIndex: number | null;
  branchDepth: number;
  width: number;
  height: number;
  x: number;
  y: number;
  children: PositionedNode[];
};
