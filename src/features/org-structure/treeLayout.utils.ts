import type { OrgNode } from "@/contexts/AppContext";
import type { LayoutNode, PositionedNode } from "@/features/org-structure/types";

export const countOrgNodes = (root: OrgNode | null): number => {
  if (!root) return 0;
  return 1 + root.children.reduce((acc, child) => acc + countOrgNodes(child), 0);
};

export const HORIZONTAL_GAP = 40;
export const VERTICAL_GAP = 80;
export const CANVAS_PADDING_X = 60;
export const CANVAS_PADDING_Y = 60;
export const LEVEL_STEP = 140;
export const LEAF_SLOT_WIDTH = 220;
export const VIEWPORT_EDGE_PADDING = 96;

export const getNodeBoxSize = (node: OrgNode) => {
  const isRoot = node.nodeType.trim().toUpperCase() === "ROOT";
  const isLeaf = node.children.length === 0 && !isRoot;

  if (isRoot) return { width: 108, height: 48 };
  if (isLeaf) return { width: 160, height: 58 };
  return { width: 168, height: 62 };
};

export const buildTreeLayout = (node: OrgNode, depth = 0): LayoutNode => {
  const { width, height } = getNodeBoxSize(node);
  const childLayouts = node.children.map((child) => buildTreeLayout(child, depth + 1));
  const childrenWidth =
    childLayouts.length > 0
      ? childLayouts.reduce((total, child) => total + child.subtreeWidth, 0) + HORIZONTAL_GAP * (childLayouts.length - 1)
      : 0;
  const leafDrivenWidth = childLayouts.length === 0 ? Math.max(width, LEAF_SLOT_WIDTH) : childrenWidth;
  const subtreeWidth = Math.max(width, leafDrivenWidth);
  const nodeLeft = (subtreeWidth - width) / 2;
  const centeredChildrenWidth =
    childLayouts.reduce((total, child) => total + child.subtreeWidth, 0) + HORIZONTAL_GAP * Math.max(childLayouts.length - 1, 0);
  let cursorX = (subtreeWidth - centeredChildrenWidth) / 2;

  const children = childLayouts.map((layout) => {
    const child = {
      subtreeLeft: cursorX,
      layout,
    };
    cursorX += layout.subtreeWidth + HORIZONTAL_GAP;
    return child;
  });

  return {
    node,
    depth,
    width,
    height,
    subtreeWidth,
    nodeLeft,
    children,
  };
};

export const collectAbsoluteNodes = (
  layout: LayoutNode,
  topLevelBranchIndexMap: Map<string, number>,
  subtreeOriginX = 0,
  inheritedBranchIndex: number | null = null,
  inheritedBranchDepth = 0,
): PositionedNode[] => {
  const x = subtreeOriginX + layout.nodeLeft;
  const y = layout.depth * LEVEL_STEP;
  const isRoot = layout.node.nodeType.trim().toUpperCase() === "ROOT";
  const branchIndex = isRoot ? null : layout.depth === 1 ? (topLevelBranchIndexMap.get(layout.node.id) ?? null) : inheritedBranchIndex;
  const branchDepth = isRoot ? 0 : layout.depth <= 1 ? 0 : inheritedBranchDepth + 1;
  const absoluteChildren = layout.children.flatMap((child) =>
    collectAbsoluteNodes(child.layout, topLevelBranchIndexMap, subtreeOriginX + child.subtreeLeft, branchIndex, branchDepth),
  );
  const childIds = new Set(layout.children.map((child) => child.layout.node.id));
  const directChildren = absoluteChildren.filter((child) => childIds.has(child.node.id));

  const absoluteNode: PositionedNode = {
    node: layout.node,
    depth: layout.depth,
    branchIndex,
    branchDepth,
    width: layout.width,
    height: layout.height,
    x,
    y,
    children: directChildren,
  };

  return [absoluteNode, ...absoluteChildren];
};
