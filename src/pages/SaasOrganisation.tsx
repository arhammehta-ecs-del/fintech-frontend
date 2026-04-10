import { startTransition, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { BriefcaseBusiness, Building2, CodeXml, Database, Megaphone, ReceiptText, SendHorizonal, WalletCards } from "lucide-react";
import DepartmentSidebar, { type DepartmentSidebarDepartment } from "@/components/DepartmentSidebar";
import { useAppContext, type OrgNode } from "@/contexts/AppContext";
import { getCompanyOrgStructure } from "@/lib/api";
import { cn } from "@/lib/utils";

const BRANCH_PALETTES = [
  {
    accentSteps: ["bg-orange-500", "bg-orange-300", "bg-orange-200", "bg-orange-100"],
    strongAccent: "bg-orange-500",
    softAccent: "bg-orange-300",
    hoverBorder: "hover:border-orange-200",
    activeBorder: "border-orange-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
  },
  {
    accentSteps: ["bg-sky-500", "bg-sky-300", "bg-sky-200", "bg-sky-100"],
    strongAccent: "bg-sky-500",
    softAccent: "bg-sky-300",
    hoverBorder: "hover:border-sky-200",
    activeBorder: "border-sky-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
  },
  {
    accentSteps: ["bg-emerald-500", "bg-emerald-300", "bg-emerald-200", "bg-emerald-100"],
    strongAccent: "bg-emerald-500",
    softAccent: "bg-emerald-300",
    hoverBorder: "hover:border-emerald-200",
    activeBorder: "border-emerald-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
  },
  {
    accentSteps: ["bg-rose-500", "bg-rose-300", "bg-rose-200", "bg-rose-100"],
    strongAccent: "bg-rose-500",
    softAccent: "bg-rose-300",
    hoverBorder: "hover:border-rose-200",
    activeBorder: "border-rose-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
  },
  {
    accentSteps: ["bg-amber-500", "bg-amber-300", "bg-amber-200", "bg-amber-100"],
    strongAccent: "bg-amber-500",
    softAccent: "bg-amber-300",
    hoverBorder: "hover:border-amber-200",
    activeBorder: "border-amber-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
  },
  {
    accentSteps: ["bg-cyan-500", "bg-cyan-300", "bg-cyan-200", "bg-cyan-100"],
    strongAccent: "bg-cyan-500",
    softAccent: "bg-cyan-300",
    hoverBorder: "hover:border-cyan-200",
    activeBorder: "border-cyan-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
  },
] as const;

function flattenOrg(node: OrgNode | null): OrgNode[] {
  if (!node) return [];

  return [node, ...node.children.flatMap((child) => flattenOrg(child))];
}

function findNode(root: OrgNode | null, targetId: string): OrgNode | null {
  if (!root) return null;
  if (root.id === targetId) return root;

  for (const child of root.children) {
    const match = findNode(child, targetId);
    if (match) return match;
  }

  return null;
}

function findParent(root: OrgNode | null, targetId: string): OrgNode | null {
  if (!root) return null;

  for (const child of root.children) {
    if (child.id === targetId) return root;
    const match = findParent(child, targetId);
    if (match) return match;
  }

  return null;
}

function getNodeTheme(nodeType: string) {
  const normalized = nodeType.trim().toUpperCase();

  if (normalized === "DIVISION") {
    return {
      accent: "border-l-[5px] border-l-sky-400",
      ring: "border-sky-300 shadow-[0_0_0_4px_rgba(96,165,250,0.08)]",
      icon: CodeXml,
      iconColor: "text-slate-500",
    };
  }

  if (normalized === "LOCATION") {
    return {
      accent: "border-l-[5px] border-l-emerald-400",
      ring: "border-emerald-300 shadow-[0_0_0_4px_rgba(52,211,153,0.08)]",
      icon: WalletCards,
      iconColor: "text-slate-500",
    };
  }

  if (normalized === "ROOT") {
    return {
      accent: "border border-slate-200",
      ring: "border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.06)]",
      icon: Building2,
      iconColor: "text-slate-500",
    };
  }

  if (normalized === "DEPARTMENT") {
    return {
      accent: "border-l-[5px] border-l-amber-400",
      ring: "border-amber-200 shadow-[0_0_0_4px_rgba(251,191,36,0.08)]",
      icon: BriefcaseBusiness,
      iconColor: "text-slate-500",
    };
  }

  return {
    accent: "border-l-[5px] border-l-slate-300",
    ring: "border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.04)]",
    icon: BriefcaseBusiness,
    iconColor: "text-slate-500",
  };
}

function getNodeIcon(node: OrgNode) {
  const normalized = node.name.trim().toUpperCase();

  if (normalized === "RJ FINTECH") return Building2;
  if (normalized === "TECHNOLOGY") return CodeXml;
  if (normalized === "MARKETING") return Megaphone;
  if (normalized === "FINANCE") return WalletCards;
  if (normalized === "FRONTEND") return BriefcaseBusiness;
  if (normalized === "BACKEND") return CodeXml;
  if (normalized === "DB") return Database;
  if (normalized === "CONTENT") return BriefcaseBusiness;
  if (normalized === "GROWTH") return SendHorizonal;
  if (normalized === "ACCOUNTS" || normalized === "AUDIT") return ReceiptText;
  return getNodeTheme(node.nodeType).icon;
}

function getNodeAccentBackground(branchIndex: number | null, branchDepth: number, isRoot: boolean) {
  if (isRoot || branchIndex === null) {
    return "bg-slate-400";
  }

  const palette = BRANCH_PALETTES[branchIndex % BRANCH_PALETTES.length];
  return palette.accentSteps[Math.min(branchDepth, palette.accentSteps.length - 1)];
}

function getBranchAppearance(branchIndex: number | null, branchDepth: number, isRoot: boolean) {
  if (isRoot || branchIndex === null) {
    return {
      accentClass: "bg-slate-200",
      hoverBorderClass: "hover:border-slate-300",
      defaultSurfaceClass: "border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]",
      activeBorderClass: "border-slate-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
    };
  }

  const palette = BRANCH_PALETTES[branchIndex % BRANCH_PALETTES.length];
  const isPrimaryBranchNode = branchDepth === 0;

  return {
    accentClass: isPrimaryBranchNode ? palette.strongAccent : palette.softAccent,
    hoverBorderClass: palette.hoverBorder,
    defaultSurfaceClass: "border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]",
    activeBorderClass: palette.activeBorder,
  };
}

function OrgCard({
  node,
  branchIndex,
  branchDepth,
  active = false,
  compact = false,
  onSelect,
}: {
  node: OrgNode;
  branchIndex: number | null;
  branchDepth: number;
  active?: boolean;
  compact?: boolean;
  onSelect: (node: OrgNode) => void;
}) {
  const theme = getNodeTheme(node.nodeType);
  const Icon = getNodeIcon(node);
  const isRoot = node.nodeType.trim().toUpperCase() === "ROOT";
  const appearance = getBranchAppearance(branchIndex, branchDepth, isRoot);
  const accentBackgroundClass = getNodeAccentBackground(branchIndex, branchDepth, isRoot);

  return (
    <button
      type="button"
      onClick={() => onSelect(node)}
      className={cn(
        "relative flex items-center gap-2.5 overflow-hidden rounded-[18px] px-4 text-left text-slate-900 transition hover:-translate-y-0.5",
        isRoot ? "min-h-[48px] min-w-[108px] rounded-2xl px-3 py-2.5" : compact ? "min-h-[58px] min-w-[160px] py-3" : "min-h-[62px] min-w-[168px] py-3.5",
        appearance.hoverBorderClass,
        active ? appearance.activeBorderClass : appearance.defaultSurfaceClass,
      )}
    >
      {!isRoot ? (
        <span
          className={cn(
            "absolute left-0 top-[10%] h-[80%] w-[4px] rounded-full",
            accentBackgroundClass,
          )}
          aria-hidden="true"
        />
      ) : null}
      <div className={cn("flex items-center justify-center rounded-full bg-white/75", isRoot ? "h-5 w-5" : "h-7 w-7")}>
        <Icon className={cn(isRoot ? "h-3 w-3" : "h-3.5 w-3.5", theme.iconColor)} />
      </div>
      <div className="min-w-0">
        <p className={cn("truncate font-semibold", isRoot ? "text-[11px]" : compact ? "text-[13px]" : "text-[14px]")}>{node.name}</p>
        {!compact && !isRoot ? <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-400">{node.nodeType}</p> : null}
      </div>
    </button>
  );
}

const HORIZONTAL_GAP = 24;
const VERTICAL_GAP = 60;
const CANVAS_PADDING_X = 40;
const CANVAS_PADDING_Y = 40;
const LEVEL_STEP = 122;
const LEAF_SLOT_WIDTH = 184;

type PositionedNode = {
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

type LayoutNode = {
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

function getNodeBoxSize(node: OrgNode) {
  const isRoot = node.nodeType.trim().toUpperCase() === "ROOT";
  const isLeaf = node.children.length === 0 && !isRoot;

  if (isRoot) return { width: 108, height: 48 };
  if (isLeaf) return { width: 160, height: 58 };
  return { width: 168, height: 62 };
}

function getSemanticDepth(nodeType: string) {
  const normalized = nodeType.trim().toUpperCase();

  if (normalized === "ROOT") return 0;
  if (normalized === "DIVISION") return 1;
  if (normalized === "LOCATION") return 2;
  if (normalized === "DEPARTMENT") return 3;
  return 4;
}

function buildTreeLayout(node: OrgNode, depth = 0): LayoutNode {
  const { width, height } = getNodeBoxSize(node);
  const childLayouts = node.children.map((child) => {
    const semanticDepth = getSemanticDepth(child.nodeType);
    const nextDepth = Math.max(depth + 1, semanticDepth);
    return buildTreeLayout(child, nextDepth);
  });
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
}

function collectAbsoluteNodes(
  layout: LayoutNode,
  topLevelBranchIndexMap: Map<string, number>,
  subtreeOriginX = 0,
  inheritedBranchIndex: number | null = null,
  inheritedBranchDepth = 0,
): PositionedNode[] {
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

  return [
    absoluteNode,
    ...absoluteChildren,
  ];
}

function OrgTreeCanvas({
  root,
  selectedId,
  onSelect,
  scrollContainerRef,
  onCanvasWidthChange,
}: {
  root: OrgNode;
  selectedId?: string;
  onSelect: (node: OrgNode) => void;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  onCanvasWidthChange?: (width: number) => void;
}) {
  const layout = buildTreeLayout(root);
  const topLevelBranchIndexMap = new Map(root.children.map((child, index) => [child.id, index] as const));
  const positionedNodes = collectAbsoluteNodes(layout, topLevelBranchIndexMap);
  const maxRight = positionedNodes.reduce((maximum, node) => Math.max(maximum, node.x + node.width), 0);
  const maxBottom = positionedNodes.reduce((maximum, node) => Math.max(maximum, node.y + node.height), 0);
  const minDiagramWidth = 920;
  const contentWidth = maxRight;
  const diagramWidth = Math.max(contentWidth + CANVAS_PADDING_X * 2, minDiagramWidth);
  const canvasWidth = diagramWidth;
  const canvasHeight = maxBottom + CANVAS_PADDING_Y * 2 + 24;
  const offsetX = (diagramWidth - (contentWidth + CANVAS_PADDING_X * 2)) / 2;

  useEffect(() => {
    onCanvasWidthChange?.(Math.max(canvasWidth, 980));
  }, [canvasWidth, onCanvasWidthChange]);

  return (
    <div
      ref={scrollContainerRef}
      className="relative w-full overflow-x-auto overflow-y-hidden bg-transparent [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex w-full justify-center">
        <div
          className="relative"
          style={{
            width: `${Math.max(canvasWidth, 980)}px`,
            height: `${canvasHeight}px`,
          }}
        >
          <svg
            className="absolute inset-0"
            width={canvasWidth}
            height={canvasHeight}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            aria-hidden="true"
          >
            {positionedNodes.flatMap((item) => {
              if (item.children.length === 0) return [];

              const parentCenterX = offsetX + CANVAS_PADDING_X + item.x + item.width / 2;
              const parentBottomY = CANVAS_PADDING_Y + item.y + item.height;
              const childTopY = CANVAS_PADDING_Y + item.children[0].y;
              const junctionY = parentBottomY + VERTICAL_GAP / 2;
              const childCenters = item.children.map((child) => offsetX + CANVAS_PADDING_X + child.x + child.width / 2);
              const leftMostChild = Math.min(...childCenters);
              const rightMostChild = Math.max(...childCenters);

              return [
                <line key={`${item.node.id}-stem`} x1={parentCenterX} y1={parentBottomY} x2={parentCenterX} y2={junctionY} stroke="#d8e0ec" strokeWidth="1.5" />,
                <line key={`${item.node.id}-branch`} x1={leftMostChild} y1={junctionY} x2={rightMostChild} y2={junctionY} stroke="#d8e0ec" strokeWidth="1.5" />,
                ...item.children.map((child) => {
                  const childCenterX = offsetX + CANVAS_PADDING_X + child.x + child.width / 2;
                  return (
                    <line
                      key={`${item.node.id}-${child.node.id}`}
                      x1={childCenterX}
                      y1={junctionY}
                      x2={childCenterX}
                      y2={childTopY}
                      stroke="#d8e0ec"
                      strokeWidth="1.5"
                    />
                  );
                }),
              ];
            })}
          </svg>

          {positionedNodes.map((item) => (
            <div
              key={item.node.id}
              className="absolute"
              style={{
                left: `${offsetX + CANVAS_PADDING_X + item.x}px`,
                top: `${CANVAS_PADDING_Y + item.y}px`,
              }}
            >
              <OrgCard
                node={item.node}
                branchIndex={item.branchIndex}
                branchDepth={item.branchDepth}
                compact={item.node.children.length === 0 && item.node.nodeType.trim().toUpperCase() !== "ROOT"}
                active={selectedId === item.node.id}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SaasOrganisation() {
  const { currentUser, orgStructure, setOrgStructure } = useAppContext();
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentSidebarDepartment | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [canvasWidth, setCanvasWidth] = useState(0);
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const graphContentRef = useRef<HTMLDivElement | null>(null);
  const syncSourceRef = useRef<"tree" | "bottom" | null>(null);

  const loadOrgForCompanyCode = async (companyCode: string) => {
    setOrgLoading(true);
    setOrgError("");

    try {
      const structure = await getCompanyOrgStructure(companyCode);
      setOrgStructure(structure);
    } catch {
      setOrgStructure(null);
      setOrgError("Unable to fetch organization structure.");
    } finally {
      setOrgLoading(false);
    }
  };

  useEffect(() => {
    const companyCode = currentUser?.companyCode?.trim().toUpperCase() ?? "";
    if (!companyCode) {
      setOrgStructure(null);
      setOrgError("No company code found for the logged-in user.");
      return;
    }

    let cancelled = false;

    const loadOrgStructure = async () => {
      setOrgLoading(true);
      setOrgError("");

      try {
        const structure = await getCompanyOrgStructure(companyCode);
        if (cancelled) return;

        setOrgStructure(structure);
      } catch {
        if (!cancelled) {
          setOrgStructure(null);
          setOrgError("Unable to fetch organization structure.");
        }
      } finally {
        if (!cancelled) {
          setOrgLoading(false);
        }
      }
    };

    void loadOrgStructure();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.companyCode, setOrgStructure]);

  useEffect(() => {
    if (!orgStructure) {
      startTransition(() => {
        setSelectedDepartment(null);
        setSidebarOpen(false);
      });
      return;
    }
  }, [orgStructure]);

  useEffect(() => {
    const treeElement = treeScrollRef.current;
    const bottomElement = bottomScrollRef.current;
    if (!treeElement || !bottomElement) return;

    const syncFromTree = () => {
      if (syncSourceRef.current === "bottom") return;
      syncSourceRef.current = "tree";
      bottomElement.scrollLeft = treeElement.scrollLeft;
      window.requestAnimationFrame(() => {
        if (syncSourceRef.current === "tree") syncSourceRef.current = null;
      });
    };

    const syncFromBottom = () => {
      if (syncSourceRef.current === "tree") return;
      syncSourceRef.current = "bottom";
      treeElement.scrollLeft = bottomElement.scrollLeft;
      window.requestAnimationFrame(() => {
        if (syncSourceRef.current === "bottom") syncSourceRef.current = null;
      });
    };

    treeElement.addEventListener("scroll", syncFromTree);
    bottomElement.addEventListener("scroll", syncFromBottom);

    return () => {
      treeElement.removeEventListener("scroll", syncFromTree);
      bottomElement.removeEventListener("scroll", syncFromBottom);
    };
  }, [canvasWidth, sidebarOpen]);

  const allNodes = useMemo(() => flattenOrg(orgStructure), [orgStructure]);
  const departmentCount = Math.max(allNodes.length - 1, 0);
  const companyName = currentUser?.company || currentUser?.brand || orgStructure?.name || "RJ Fintech";

  const handleDepartmentClick = (node: OrgNode) => {
    if (selectedDepartment?.id === node.id && sidebarOpen) {
      startTransition(() => {
        setSelectedDepartment(null);
        setSidebarOpen(false);
      });
      return;
    }

    const breadcrumbs: string[] = [];
    const parentNode = findParent(orgStructure, node.id);
    const currentNode = findNode(orgStructure, node.id);

    const collectTrail = (branch: OrgNode | null, targetId: string): boolean => {
      if (!branch) return false;

      breadcrumbs.push(branch.name);
      if (branch.id === targetId) return true;

      for (const child of branch.children) {
        if (collectTrail(child, targetId)) return true;
      }

      breadcrumbs.pop();
      return false;
    };

    collectTrail(orgStructure, node.id);
      startTransition(() => {
        setSelectedDepartment({
          id: node.id,
          name: node.name,
          parentId: parentNode?.id ?? null,
          nodeType: node.nodeType,
          nodePath: node.nodePath,
          companyId: node.companyId,
        childCount: node.children.length,
        breadcrumbs,
        parentName: parentNode?.name ?? null,
        children: (currentNode?.children ?? []).map((child) => ({
          id: child.id,
          name: child.name,
          nodeType: child.nodeType,
          childCount: child.children.length,
        })),
        siblings: (parentNode?.children ?? [])
          .filter((child) => child.id !== node.id)
          .map((child) => ({
            id: child.id,
            name: child.name,
            nodeType: child.nodeType,
            childCount: child.children.length,
          })),
      });
      setSidebarOpen(true);
    });
  };

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-stretch bg-[#fcfcfd]">
      <div
        className={cn(
          "flex w-full items-stretch overflow-hidden lg:grid",
          sidebarOpen ? "lg:grid-cols-[minmax(0,3fr)_minmax(320px,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_0px]",
        )}
        style={{ transition: "grid-template-columns 500ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <section className="relative min-w-0 border-r border-slate-200/80">
          <div className="px-9 pt-10">
            <div className="mb-8">
              <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-slate-900">Organisation Structure</h1>
              <p className="mt-1 text-[13px] text-slate-400">
                {companyName} · {departmentCount} departments
              </p>
            </div>

            {orgError ? (
              <div className="mb-8 rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                {orgError}
              </div>
            ) : null}
          </div>

          <div
            ref={graphContentRef}
            className={cn("relative px-9 transition-[padding] duration-500", sidebarOpen ? "pb-20" : "pb-10")}
            style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
          >
            {orgStructure ? (
              <OrgTreeCanvas
                root={orgStructure}
                selectedId={selectedDepartment?.id}
                onSelect={handleDepartmentClick}
                scrollContainerRef={treeScrollRef}
                onCanvasWidthChange={setCanvasWidth}
              />
            ) : (
              <div className="flex min-h-[520px] items-center justify-center text-center">
                <div>
                  <Building2 className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-4 text-base font-medium text-slate-700">
                    {orgLoading ? "Loading organisation structure..." : "No organisation structure available"}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">Once org data is available, the hierarchy will render here.</p>
                </div>
              </div>
            )}
          </div>
          {orgStructure ? (
            <div
              className={cn(
                "absolute bottom-0 left-9 right-9 z-10 border-t border-slate-200/80 bg-[#fcfcfd]/95 py-3 backdrop-blur transition-[opacity,transform] duration-500",
                sidebarOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
              )}
              style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
            >
              <div ref={bottomScrollRef} className="w-full overflow-x-auto overflow-y-hidden">
                <div style={{ width: `${canvasWidth || 1}px`, height: "1px" }} />
              </div>
            </div>
          ) : null}
        </section>

        <div
          className={cn(
            "hidden overflow-hidden bg-white transition-[width,opacity] duration-500 lg:block",
            sidebarOpen ? "w-full min-w-[320px] opacity-100" : "w-0 opacity-0",
          )}
          style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <DepartmentSidebar
            open={sidebarOpen}
            onOpenChange={(open) => {
              startTransition(() => {
                setSidebarOpen(open);
                if (!open) {
                  setSelectedDepartment(null);
                }
              });
            }}
            department={selectedDepartment}
          />
        </div>
      </div>
    </div>
  );
}
