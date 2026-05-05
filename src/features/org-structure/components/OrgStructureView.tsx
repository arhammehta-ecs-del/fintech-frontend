import { startTransition } from "react";
import { Building2 } from "lucide-react";
import { DepartmentSidebar } from "@/features/org-structure/components/DepartmentSidebar";
import { NewNodePopup } from "@/features/org-structure/components/NewNodePopup";
import { OrgTreeCanvas } from "@/features/org-structure/components/OrgTreeCanvas";
import { PendingNodePopup } from "@/features/org-structure/components/PendingNodePopup";
import { useOrgStructure } from "@/features/org-structure/hooks/useOrgStructure";
import { collectNodeTrail } from "@/features/org-structure/orgNode.utils";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { NewNodeType } from "@/features/org-structure/types";

function filterPendingNodes(node: OrgNode | null): OrgNode | null {
  if (!node) return null;
  if (node.status === "Pending") return null;
  return {
    ...node,
    children: node.children
      .map(filterPendingNodes)
      .filter((n): n is OrgNode => n !== null),
  };
}

function countNodes(node: OrgNode | null): number {
  if (!node) return 0;
  return 1 + node.children.reduce((acc, child) => acc + countNodes(child), 0);
}

function countPendingNodes(node: OrgNode | null): number {
  if (!node) return 0;
  const own = node.status === "Pending" ? 1 : 0;
  return own + node.children.reduce((acc, child) => acc + countPendingNodes(child), 0);
}

function hasPendingNodes(node: OrgNode | null): boolean {
  if (!node) return false;
  if (node.status === "Pending") return true;
  return node.children.some(hasPendingNodes);
}

export function OrgStructureView({ embedded = false }: { embedded?: boolean }) {
  const newNodeTypeOptions: NewNodeType[] = ["Division", "Department", "Team", "Plant", "Location"];
  const {
    orgStructure,
    selectedDepartment,
    sidebarOpen,
    orgLoading,
    orgError,
    canvasWidth,
    bottomScrollContentWidth,
    hasHorizontalOverflow,
    zoom,
    isNewNodePopupOpen,
    newNodeParent,
    treeScrollRef,
    bottomScrollRef,
    graphContentRef,
    companyName,
    nodeCount,
    canZoomOut,
    canZoomIn,
    setCanvasWidth,
    setIsNewNodePopupOpen,
    setNewNodeParent,
    handleOpenNewNodePopup,
    handleCreateNode,
    handleDepartmentClick,
    handleSidebarOpenChange,
    zoomOut,
    zoomIn,
    pendingNodeForReview,
    setPendingNodeForReview,
    handleApproveNode,
    handleRejectNode,
  } = useOrgStructure();

  const [showPending, setShowPending] = useState(true);

  const displayedStructure = useMemo(() => {
    if (showPending || !orgStructure) return orgStructure;
    return filterPendingNodes(orgStructure);
  }, [orgStructure, showPending]);

  const displayedCount = useMemo(() => {
    return countNodes(displayedStructure);
  }, [displayedStructure]);

  const hasPending = useMemo(() => hasPendingNodes(orgStructure), [orgStructure]);
  const approvedBaseCount = useMemo(() => countNodes(filterPendingNodes(orgStructure)), [orgStructure]);
  const pendingCount = useMemo(() => countPendingNodes(orgStructure), [orgStructure]);
  const newNodeParentTrail = useMemo(() => {
    if (!orgStructure || !newNodeParent?.id) return [];
    return collectNodeTrail(orgStructure, newNodeParent.id);
  }, [orgStructure, newNodeParent]);

  return (
    <div
      className={cn(
        "flex overflow-hidden bg-[#fcfcfd]",
        embedded ? "h-[calc(100vh-220px)] min-h-[640px] rounded-lg border border-slate-200" : "h-[calc(100vh-56px)]",
      )}
    >
      <div className={cn("relative flex w-full items-stretch overflow-hidden", hasHorizontalOverflow ? "pb-12" : "pb-0")}>
        <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden border-r border-slate-200/80">
          <div
            className={cn(
              "min-h-0 flex-1 overflow-x-hidden",
              embedded ? (zoom > 1 ? "overflow-y-auto" : "overflow-y-hidden") : "overflow-y-auto",
            )}
          >
            <div className={cn("px-9", embedded ? "pt-[10px]" : "pt-10")}>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-slate-900">Organisation Structure</h1>
                  <div className="mt-1 flex items-center gap-1.5 overflow-hidden text-[13px] text-slate-400">
                    <span className="transition-all duration-300 hover:text-slate-600">{companyName}</span>
                    <span className="opacity-40">·</span>
                    <span
                      key={`${displayedCount}-${pendingCount}-${showPending ? "show" : "hide"}`}
                      className="inline-flex items-center gap-1 animate-[fadeInUp_0.3s_ease-out] font-medium"
                    >
                      {showPending && pendingCount > 0 ? (
                        <>
                          <span className="text-slate-500">{approvedBaseCount}</span>
                          <span className="text-amber-500">{`+ ${pendingCount} nodes`}</span>
                        </>
                      ) : (
                        <span className="text-slate-500">{`${displayedCount} nodes`}</span>
                      )}
                    </span>
                    {!showPending && pendingCount > 0 && (
                      <span className="ml-1 text-[11px] font-normal text-amber-500/80 italic animate-pulse">
                        (+{pendingCount} Pending)
                      </span>
                    )}
                  </div>
                </div>

                {hasPending ? (
                  <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPending(!showPending)}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                        showPending
                          ? "border-amber-200 bg-amber-50/50 text-amber-700 shadow-[0_2px_10px_rgba(245,158,11,0.1)]"
                          : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
                      )}
                    >
                      {showPending ? (
                        <span className="flex items-center gap-2">
                          <Eye size={13} className="shrink-0 transition-transform group-hover:scale-110" />
                          Pending Nodes
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <EyeOff size={13} className="shrink-0 transition-transform group-hover:scale-110" />
                          Pending Nodes
                        </span>
                      )}
                    </button>
                  </div>
                ) : null}
              </div>

              {orgError ? (
                <div className="mb-8 rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                  {orgError}
                </div>
              ) : null}
            </div>

            <div
              ref={graphContentRef}
              className="relative px-9 pb-10"
            >
              {orgStructure ? (
                <div className="absolute right-9 top-1 z-10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={zoomOut}
                    disabled={!canZoomOut}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Zoom out organisation structure"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={zoomIn}
                    disabled={!canZoomIn}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Zoom in organisation structure"
                  >
                    +
                  </button>
                </div>
              ) : null}
              {orgStructure ? (
                <OrgTreeCanvas
                  root={displayedStructure!}
                  selectedId={selectedDepartment?.id}
                  remeasureKey={`${selectedDepartment?.id ?? "none"}-${sidebarOpen ? "open" : "closed"}`}
                  onSelect={handleDepartmentClick}
                  onCreateNode={handleOpenNewNodePopup}
                  scrollContainerRef={treeScrollRef}
                  onCanvasWidthChange={setCanvasWidth}
                  zoom={zoom}
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
          </div>
          <div
            className={cn(
              "absolute inset-y-0 right-0 z-20 w-full max-w-[360px] overflow-hidden bg-white shadow-[-18px_0_32px_rgba(15,23,42,0.08)] transition-[transform,opacity] duration-500 lg:hidden",
              sidebarOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0",
            )}
            style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
            aria-hidden={!sidebarOpen}
          >
            <DepartmentSidebar
              open={sidebarOpen}
              onOpenChange={handleSidebarOpenChange}
              department={selectedDepartment}
            />
          </div>
        </section>

        <div
          className={cn(
            "hidden shrink-0 overflow-hidden border-l border-slate-200 bg-white transition-[width,opacity] duration-500 lg:block",
            sidebarOpen ? "w-[360px] opacity-100" : "w-0 opacity-0",
          )}
          style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
          aria-hidden={!sidebarOpen}
        >
          <DepartmentSidebar
            open={sidebarOpen}
            onOpenChange={handleSidebarOpenChange}
            department={selectedDepartment}
          />
        </div>

        {orgStructure && hasHorizontalOverflow ? (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-[#fcfcfd]/95 px-6 py-3 backdrop-blur",
              sidebarOpen ? "lg:right-[360px]" : "lg:right-0",
            )}
          >
            <div
              ref={bottomScrollRef}
              className="w-full overflow-x-auto overflow-y-hidden"
            >
              <div style={{ width: `${bottomScrollContentWidth || canvasWidth || 1}px`, height: "1px" }} />
            </div>
          </div>
        ) : null}
      </div>

      <NewNodePopup
        open={isNewNodePopupOpen}
        parentNodeName={newNodeParent?.name ?? ""}
        parentNodeTrail={newNodeParentTrail}
        nodeTypes={newNodeTypeOptions}
        onOpenChange={(open) => {
          startTransition(() => {
            setIsNewNodePopupOpen(open);
            if (!open) {
              setNewNodeParent(null);
            }
          });
        }}
        onConfirm={handleCreateNode}
      />

      <PendingNodePopup
        open={!!pendingNodeForReview}
        node={pendingNodeForReview}
        onClose={() => setPendingNodeForReview(null)}
        onApprove={handleApproveNode}
        onReject={handleRejectNode}
      />
    </div>
  );
}

export default function OrgStructureViewPage() {
  return <OrgStructureView />;
}
