import { ChevronLeft, ChevronRight, GripVertical, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { OrgNode } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { formatCollapsedNodePath } from "@/features/user-management/utils";
import {
  type BranchMeta,
  getNodeBadgeClass,
  getNodeBorderLeftClass,
  getNodeSubtitle,
  getNodeSurfaceClass,
  isRootOrgNode,
} from "../UserOnboardingStepAccessRights.utils";

type Props = {
  selectedNodes: OrgNode[];
  infoNodeId: string | null;
  branchMetaMap: Map<string, BranchMeta>;
  breadcrumbByNodeId: Map<string, string>;
  expandedAccessNodeIds: string[];
  onSetExpandedAccessNodeIds: (ids: string[] | ((current: string[]) => string[])) => void;
  onReorderSelectedNodes: (draggedNodeId: string, targetNodeId: string) => void;
  onSetInfoNodeId: (nodeId: string | null) => void;
  getAccessBadgeLabel: (nodeId: string) => string;
};

export function SelectedNodesPanel({
  selectedNodes,
  infoNodeId,
  branchMetaMap,
  breadcrumbByNodeId,
  expandedAccessNodeIds,
  onSetExpandedAccessNodeIds,
  onReorderSelectedNodes,
  onSetInfoNodeId,
  getAccessBadgeLabel,
}: Props) {
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTargetNodeId, setDropTargetNodeId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [selectedNodes.length]);

  const scrollListLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -300, behavior: "smooth" });
  };

  const scrollListRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 300, behavior: "smooth" });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Selected Nodes</h3>
          <p className="mt-0.5 text-xs text-slate-500">Drag to reorder or click to expand.</p>
        </div>
      </div>

      {selectedNodes.length > 0 ? (
        <div className="space-y-3">
          <div className="group relative">
            <div
              className={cn(
                "pointer-events-none absolute bottom-0 left-[-8px] top-0 z-10 flex w-20 items-center justify-start bg-gradient-to-r from-slate-50 via-slate-50/90 to-transparent pb-2 pl-2 transition-opacity duration-300",
                canScrollLeft ? "opacity-100" : "opacity-0",
              )}
            >
              <button
                type="button"
                onClick={scrollListLeft}
                disabled={!canScrollLeft}
                className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-[rgb(53,83,233)]/30 hover:bg-slate-50 hover:text-[rgb(53,83,233)] focus-visible:outline-none"
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            <div
              ref={scrollContainerRef}
              onScroll={checkScroll}
              className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide [&::-webkit-scrollbar]:hidden snap-x snap-mandatory scroll-pl-14 scroll-pr-14"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {selectedNodes.map((node) => {
                const isRoot = isRootOrgNode(node);
                return (
                  <div
                    key={node.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSetExpandedAccessNodeIds((current) => (current.includes(node.id) ? current : [...current, node.id]));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSetExpandedAccessNodeIds((current) => (current.includes(node.id) ? current : [...current, node.id]));
                      }
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (draggedNodeId && draggedNodeId !== node.id) {
                        setDropTargetNodeId(node.id);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggedNodeId && draggedNodeId !== node.id) {
                        onReorderSelectedNodes(draggedNodeId, node.id);
                      }
                      setDraggedNodeId(null);
                      setDropTargetNodeId(null);
                    }}
                    onDoubleClick={() => onSetInfoNodeId(infoNodeId === node.id ? null : node.id)}
                    className={cn(
                      "snap-start relative flex shrink-0 items-center gap-3 overflow-hidden rounded-xl border border-l-[4px] bg-white px-4 py-3 text-left shadow-sm transition-all",
                      getNodeBorderLeftClass(node, branchMetaMap),
                      getNodeSurfaceClass(node, branchMetaMap),
                      draggedNodeId === node.id ? "opacity-50" : "",
                      dropTargetNodeId === node.id ? "border-[rgb(53,83,233)] ring-2 ring-[rgb(53,83,233)]/10" : "",
                      expandedAccessNodeIds.includes(node.id) ? "ring-1 ring-[rgb(53,83,233)]/15" : "",
                    )}
                  >
                    <button
                      type="button"
                      draggable
                      aria-label={`Drag ${node.name} to reorder`}
                      onClick={(event) => event.stopPropagation()}
                      onDragStart={(event) => {
                        event.stopPropagation();
                        setDraggedNodeId(node.id);
                      }}
                      onDragEnd={() => {
                        setDraggedNodeId(null);
                        setDropTargetNodeId(null);
                      }}
                      className="inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600 active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <div className={cn("flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold", getNodeBadgeClass(node, branchMetaMap))}>
                      {getAccessBadgeLabel(node.id)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold text-slate-800">{node.name}</div>
                      </div>
                      {!isRoot ? <div className="truncate text-[11px] font-medium text-slate-500">{getNodeSubtitle(node, breadcrumbByNodeId)}</div> : null}
                      {!isRoot ? <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{node.nodeType}</div> : null}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </div>
                );
              })}
            </div>

            <div
              className={cn(
                "pointer-events-none absolute bottom-0 right-[-8px] top-0 z-10 flex w-20 items-center justify-end bg-gradient-to-l from-slate-50 via-slate-50/90 to-transparent pb-2 pr-2 transition-opacity duration-300",
                canScrollRight ? "opacity-100" : "opacity-0",
              )}
            >
              <button
                type="button"
                onClick={scrollListRight}
                disabled={!canScrollRight}
                className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-[rgb(53,83,233)]/30 hover:bg-slate-50 hover:text-[rgb(53,83,233)] focus-visible:outline-none"
                aria-label="Scroll right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {infoNodeId ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              {(() => {
                const infoNode = selectedNodes.find((node) => node.id === infoNodeId);
                if (!infoNode) return null;
                const infoIndex = selectedNodes.findIndex((node) => node.id === infoNodeId);
                const isInfoRoot = isRootOrgNode(infoNode);

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold", getNodeBadgeClass(infoNode, branchMetaMap))}>
                          {getAccessBadgeLabel(infoNode.id)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{infoNode.name}</div>
                          {!isInfoRoot ? <div className="text-[11px] font-medium text-slate-500">{getNodeSubtitle(infoNode, breadcrumbByNodeId)}</div> : null}
                          {!isInfoRoot ? <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{infoNode.nodeType}</div> : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSetInfoNodeId(null)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Close node info"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Preference</div>
                        <div className="mt-1 font-semibold text-slate-700">{infoIndex + 1}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Node Type</div>
                        <div className="mt-1 font-semibold text-slate-700">{isInfoRoot ? "-" : infoNode.nodeType}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Node Path</div>
                        <div className="mt-1 break-all font-semibold text-slate-700">{isInfoRoot ? "-" : (formatCollapsedNodePath(infoNode.nodePath || "") || "-")}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          No nodes selected yet.
        </div>
      )}
    </div>
  );
}
