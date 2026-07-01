import { startTransition } from "react";
import { Building2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import type { OrgNode } from "@/contexts/AppContext";
import { NodeSidebar } from "@/features/org-structure/components/NodeSidebar";
import { NewNodePopup } from "@/features/org-structure/components/NewNodePopup";
import { OrgTreeCanvas } from "@/features/org-structure/components/OrgTreeCanvas";
import { PendingNodePopup } from "@/features/org-structure/components/PendingNodePopup";
import { OrgStatusUpdatePopup } from "@/features/org-structure/components/OrgStatusUpdatePopup";
import OrgHistorySidebar from "@/features/org-structure/components/OrgHistorySidebar";
import { useOrgStructure } from "@/features/org-structure/hooks/useOrgStructure";
import { collectNodeTrail } from "@/features/org-structure/orgNode.utils";
import { countNodes, countPendingNodes, filterPendingNodes, hasPendingNodes } from "@/features/org-structure/components/OrgStructureView.utils";
import { getApiErrorMessage } from "@/services/client";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect, useRef } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import type { NewNodeType } from "@/features/org-structure/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import EditLockWarningDialog from "@/components/EditLockWarningDialog";
import { useRefreshTimestamp } from "@/hooks/useRefreshTimestamp";
import { useNotificationsPanelOpen } from "@/hooks/useNotificationsPanelOpen";
import { useToast } from "@/hooks/use-toast";

const getPendingHistoryContext = (node: OrgNode) => {
  const pendingNodePath =
    typeof node.pendingNewData?.nodePath === "string" && node.pendingNewData.nodePath.trim()
      ? node.pendingNewData.nodePath.trim()
      : "";
  const targetNodePath =
    pendingNodePath ||
    (typeof node.pendingNewData?.targetNodePath === "string" && node.pendingNewData.targetNodePath.trim()
      ? node.pendingNewData.targetNodePath.trim()
      : (node.nodePath || "").trim());
  const parentNodePath = targetNodePath.includes(".")
    ? targetNodePath.split(".").slice(0, -1).join(".").trim()
    : targetNodePath;

  return {
    nodeName: node.name.trim(),
    nodePath: targetNodePath,
    parentNodePath,
  };
};

const getOrgLockErrorMessage = (error: unknown, fallback: string) => {
  const rawMessage =
    typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.trim()
      : "";
  return rawMessage || getApiErrorMessage(error, fallback);
};

export function OrgStructureView({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const newNodeTypeOptions: NewNodeType[] = ["DEPARTMENT", "DIVISION", "TEAM", "PLANT", "LOCATION"];
  const {
    companyCode,
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
    newNodeWorkflowOptions,
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
    nodePermissionSections,
    nodePermissionLoading,
    setPendingNodeForReview,
    handleApproveNode,
    handleRejectNode,
    startPendingNodeAction,
    cancelPendingNodeAction,
    hasNewOrgEvent,
    setHasNewOrgEvent,
    refreshOrgStructure,
    statusUpdateNode,
    statusUpdateTargetStatus,
    statusUpdateWorkflowHash,
    statusUpdateWorkflowOptions,
    statusUpdateRemarks,
    setStatusUpdateWorkflowHash,
    setStatusUpdateRemarks,
    handleRequestNodeStatusChange,
    submitNodeStatusUpdate,
    orgLockWarningOpen,
    orgLockSecondsRemaining,
    continueOrgEditing,
    closeOrgEditingByTimeout,
    closeOrgStatusUpdatePopup,
  } = useOrgStructure();

  const [showPending, setShowPending] = useState(true);
  const [isOrgHistoryOpen, setIsOrgHistoryOpen] = useState(false);
  const [historyNodeName, setHistoryNodeName] = useState("");
  const [historyNodePath, setHistoryNodePath] = useState("");
  const [historyParentNodePath, setHistoryParentNodePath] = useState("");
  const [historyViewContext, setHistoryViewContext] = useState<"active" | "pending">("active");
  const [shellOffset, setShellOffset] = useState({ top: 56, left: 0 });
  const [isRefreshTooltipOpen, setIsRefreshTooltipOpen] = useState(false);
  const [isRefreshTriggerVisible, setIsRefreshTriggerVisible] = useState(true);
  const [isSidebarTransitioning, setIsSidebarTransitioning] = useState(false);
  const refreshTriggerRef = useRef<HTMLButtonElement | null>(null);
  const previousSidebarOpenRef = useRef(sidebarOpen);
  const isNotificationsPanelOpen = useNotificationsPanelOpen();
  const { refreshLabel, lastRefreshedAt, markRefreshed } = useRefreshTimestamp();
  const isAnyOrgDialogOpen = isNewNodePopupOpen || Boolean(pendingNodeForReview) || Boolean(statusUpdateNode);
  const historyLayoutOffset =
    isOrgHistoryOpen && historyViewContext === "pending" ? { top: 0, left: 0 } : shellOffset;

  const handleClosePendingNodePopup = () => {
    setPendingNodeForReview(null);
    setIsOrgHistoryOpen(false);
    setHistoryNodeName("");
    setHistoryNodePath("");
    setHistoryParentNodePath("");
    setHistoryViewContext("active");
  };

  useEffect(() => {
    const refreshTrigger = refreshTriggerRef.current;
    if (!refreshTrigger || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsRefreshTriggerVisible(entry?.isIntersecting ?? false);
      },
      { threshold: 0.1 },
    );

    observer.observe(refreshTrigger);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const wasSidebarOpen = previousSidebarOpenRef.current;
    previousSidebarOpenRef.current = sidebarOpen;

    if (wasSidebarOpen === sidebarOpen) return;

    setIsSidebarTransitioning(true);
    setIsRefreshTooltipOpen(false);

    const sideBar = document.querySelector("aside");
    const handleSidebarTransitionEnd = (event: Event) => {
      const transitionEvent = event as TransitionEvent;
      if (transitionEvent.target !== sideBar) return;
      if (transitionEvent.propertyName && transitionEvent.propertyName !== "width") return;
      setIsSidebarTransitioning(false);
    };

    sideBar?.addEventListener("transitionend", handleSidebarTransitionEnd);
    const fallbackTimer = window.setTimeout(() => {
      setIsSidebarTransitioning(false);
    }, 360);

    return () => {
      sideBar?.removeEventListener("transitionend", handleSidebarTransitionEnd);
      window.clearTimeout(fallbackTimer);
    };
  }, [sidebarOpen]);
  useEffect(() => {
    const syncShellOffset = () => {
      const topBar = document.querySelector("header");
      const sideBar = document.querySelector("aside");
      const top = topBar ? Math.ceil(topBar.getBoundingClientRect().height) : 56;
      const left = sideBar ? Math.ceil(sideBar.getBoundingClientRect().width) : 0;
      setShellOffset({ top, left });
    };

    syncShellOffset();
    window.addEventListener("resize", syncShellOffset);
    const topBar = document.querySelector("header");
    const sideBar = document.querySelector("aside");
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncShellOffset) : null;

    if (resizeObserver && topBar) resizeObserver.observe(topBar);
    if (resizeObserver && sideBar) resizeObserver.observe(sideBar);
    topBar?.addEventListener("transitionend", syncShellOffset);
    sideBar?.addEventListener("transitionend", syncShellOffset);

    return () => {
      window.removeEventListener("resize", syncShellOffset);
      topBar?.removeEventListener("transitionend", syncShellOffset);
      sideBar?.removeEventListener("transitionend", syncShellOffset);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (orgLoading) return;
    if (!orgStructure) return;
    if (lastRefreshedAt) return;
    markRefreshed();
  }, [orgLoading, orgStructure, lastRefreshedAt, markRefreshed]);

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

  useEffect(() => {
    if (!pendingNodeForReview) return;
    const historyContext = getPendingHistoryContext(pendingNodeForReview);
    setHistoryNodeName(historyContext.nodeName);
    setHistoryNodePath(historyContext.nodePath);
    setHistoryParentNodePath(historyContext.parentNodePath);
    setHistoryViewContext("pending");
    setIsOrgHistoryOpen(true);
  }, [pendingNodeForReview]);

  useEffect(() => {
    if ((searchParams.get("tab") || "").trim() !== "org") return;
    if ((searchParams.get("notif_ref_type") || "").trim().toUpperCase() !== "ORG") return;
    if (!orgStructure) return;

    const notificationAction = (searchParams.get("notif_action") || "").trim().toLowerCase();
    const referenceId = (searchParams.get("notif_ref_id") || "").trim();
    const notificationTarget = (searchParams.get("notif_target") || "").trim().toLowerCase();
    const entityName = (searchParams.get("notif_entity_name") || "").trim().toLowerCase();
    const notificationType = (searchParams.get("notif_type") || "").trim().toUpperCase();
    const nodes: OrgNode[] = [];
    const stack: OrgNode[] = [orgStructure];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      nodes.push(current);
      current.children.forEach((child) => stack.push(child));
    }

    const pendingNodes = nodes.filter((node) => {
      const normalizedStatus = (node.status || "").trim().toUpperCase();
      const pendingRequestType = (node.pendingRequestType || "").trim().toUpperCase();
      return Boolean(node.isPending) || normalizedStatus === "PENDING" || pendingRequestType === "UPDATE";
    });
    const candidateNodes = notificationAction === "approve" ? pendingNodes : nodes;

    const matchesNodeByPath = (node: OrgNode) => {
      const nodePath = (node.nodePath || "").trim().toLowerCase();
      return Boolean(notificationTarget) && nodePath === notificationTarget;
    };

    const matchesNodeByIdentity = (node: OrgNode) => {
      const nodeId = (node.id || "").trim();
      const nodeUuid = (node.uuid || "").trim();
      return Boolean(referenceId) && (nodeId === referenceId || nodeUuid === referenceId);
    };

    const matchesNodeByEntityName = (node: OrgNode) => {
      if (!entityName) return false;
      const nodeName = (node.name || "").trim().toLowerCase();
      const nodePath = (node.nodePath || "").trim().toLowerCase();
      const nodePathLeaf = nodePath.split(".").filter(Boolean).pop() || "";
      return (
        nodeName === entityName ||
        nodePath === entityName ||
        nodePath.endsWith(`.${entityName}`) ||
        nodePathLeaf === entityName
      );
    };

    const pendingTargetMatch =
      notificationAction !== "approve" && notificationTarget
        ? candidateNodes.find((node) => matchesNodeByPath(node) && (Boolean(node.isPending) || (node.pendingRequestType || "").trim().toUpperCase() === "UPDATE")) ?? null
        : null;

    const matchedNode =
      pendingTargetMatch ??
      candidateNodes.find((node) => {
        if (matchesNodeByIdentity(node)) return true;
        if (matchesNodeByPath(node)) return true;
        if (notificationAction === "approve" && referenceId) return false;
        if (!entityName && !notificationTarget) return false;
        return matchesNodeByEntityName(node);
      }) ??
      null;

    if (!matchedNode) return;

    const isModificationNotification =
      notificationType.includes("MODIF") || (matchedNode.pendingRequestType || "").trim().toUpperCase() === "UPDATE";

    if (notificationAction === "approve") {
      handleDepartmentClick(matchedNode);
    } else if (
      notificationTarget ||
      isModificationNotification ||
      matchedNode.status === "Pending" ||
      matchedNode.isPending ||
      (matchedNode.pendingRequestType || "").trim().toUpperCase() === "UPDATE"
    ) {
      setPendingNodeForReview(matchedNode);
    } else {
      handleDepartmentClick(matchedNode);
    }

    const nextParams = new URLSearchParams(searchParams);
    [
      "notif_action",
      "notif_ref_type",
      "notif_ref_id",
      "notif_target",
      "notif_type",
      "notif_email",
      "notif_entity_name",
      "notif_target_status",
    ].forEach((key) => nextParams.delete(key));
    setSearchParams(nextParams, { replace: true });
  }, [handleDepartmentClick, orgStructure, searchParams, setPendingNodeForReview, setSearchParams]);

  const handleNavigateToUsers = ({
    nodeName,
    nodePath,
    category,
    subCategory,
    action,
  }: {
    nodeName: string;
    nodePath: string;
    category: string;
    subCategory: string;
    action: "checker" | "maker" | "viewer";
  }) => {
    setSearchParams({
      tab: "users",
      um_node: nodeName,
      um_node_path: nodePath,
      um_category: category,
      um_subcategory: subCategory,
      um_action: action,
    });
  };

  const handleNavigateToImpactedUsers = (node: OrgNode) => {
    const impactedEmails = Array.from(
      new Set(
        (node.impactSummary?.userAccess ?? [])
          .map((user) => (user.email || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    if (impactedEmails.length === 0) return;

    setSearchParams({
      tab: "users",
      um_impact_users: impactedEmails.join(","),
      um_impact_label: node.name.trim() || "Org Impact",
      um_impact_node_path: node.nodePath.trim(),
    });
    handleClosePendingNodePopup();
  };

  return (
    <div
      className={cn(
        "flex overflow-hidden bg-[#fcfcfd]",
        embedded ? "md:h-[calc(100dvh-10.5rem)] md:min-h-[680px] rounded-lg border border-slate-200" : "h-[calc(100vh-56px)]",
      )}
    >
      <div className={cn("relative isolate flex w-full items-stretch overflow-hidden", hasHorizontalOverflow ? "pb-12" : "pb-0")}>
        <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden border-r border-slate-200/80">
          <div
            className={cn(
              "min-h-0 flex-1 overflow-x-hidden",
              embedded ? "overflow-y-auto overscroll-contain" : "overflow-y-auto",
            )}
          >
            <div className={cn("px-9", embedded ? "pt-3" : "pt-8")}>
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 overflow-hidden text-[13px] text-slate-400">
                    <span className="truncate text-sm font-semibold text-slate-700 transition-all duration-300 hover:text-slate-900">{companyName}</span>
                    <span className="opacity-40">·</span>
                    <span
                      key={`${displayedCount}-${pendingCount}-${showPending ? "show" : "hide"}`}
                      className="inline-flex items-center gap-1 whitespace-nowrap animate-[fadeInUp_0.3s_ease-out] font-medium"
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
                      <span className="ml-1 whitespace-nowrap text-[11px] font-normal text-amber-500/80 italic animate-pulse">
                        (+{pendingCount} Pending)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {hasPending ? (
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
                  ) : null}
                  <div className="relative flex h-10 w-10 items-center justify-center">
                    <TooltipProvider delayDuration={120}>
                      <Tooltip open={(!isSidebarTransitioning && (((!isAnyOrgDialogOpen && !isNotificationsPanelOpen && hasNewOrgEvent && isRefreshTriggerVisible) || isRefreshTooltipOpen)))}>
                        <TooltipTrigger asChild>
                          <button
                            ref={refreshTriggerRef}
                            type="button"
                            aria-label="Refresh organisation structure"
                            onMouseEnter={() => setIsRefreshTooltipOpen(true)}
                            onMouseLeave={() => setIsRefreshTooltipOpen(false)}
                            onFocus={() => setIsRefreshTooltipOpen(true)}
                            onBlur={() => setIsRefreshTooltipOpen(false)}
                            onClick={async () => {
                              await refreshOrgStructure();
                              setHasNewOrgEvent(false);
                              markRefreshed();
                            }}
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900",
                              hasNewOrgEvent &&
                                "border-[#3553e9] bg-[#3553e9] text-white shadow-[0_10px_24px_rgba(53,83,233,0.22)] hover:bg-[#3553e9] hover:text-white",
                            )}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {hasNewOrgEvent ? "New event occurred" : "Refresh organisation structure"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {refreshLabel ? (
                      <p className="pointer-events-none absolute top-full right-0 mt-1 whitespace-nowrap text-right text-[11px] font-medium leading-none text-muted-foreground">
                        {refreshLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {orgError ? (
                <div className="mb-8 rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                  {orgError}
                </div>
              ) : null}
            </div>

            <div
              ref={graphContentRef}
              className="relative z-0 px-9 pb-10"
            >
              {orgStructure ? (
                <div className="absolute right-9 top-1 z-20 flex items-center gap-2">
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
                  <div className="min-w-0">
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
              "absolute inset-y-0 right-0 z-40 w-full max-w-[420px] overflow-hidden bg-white shadow-[-18px_0_32px_rgba(15,23,42,0.08)] transition-[transform,opacity] duration-500 lg:hidden",
              sidebarOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0",
            )}
            style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
            aria-hidden={!sidebarOpen}
          >
            <NodeSidebar
              open={sidebarOpen}
              onOpenChange={handleSidebarOpenChange}
              department={selectedDepartment}
              permissionSections={nodePermissionSections}
              countsLoading={nodePermissionLoading}
              onNavigateToUsers={handleNavigateToUsers}
              onOpenHistory={(input) => {
                setHistoryNodeName((input?.nodeName || selectedDepartment?.name || companyName || "").trim());
                setHistoryNodePath((input?.nodePath || selectedDepartment?.nodePath || "").trim());
                setHistoryParentNodePath("");
                setHistoryViewContext("active");
                setIsOrgHistoryOpen(true);
              }}
              onRequestStatusChange={handleRequestNodeStatusChange}
            />
          </div>
        </section>

        <div
          className={cn(
            "relative z-30 hidden shrink-0 overflow-hidden border-l border-slate-200 bg-white transition-[width,opacity] duration-500 lg:block",
            sidebarOpen ? "w-[420px] opacity-100" : "w-0 opacity-0",
          )}
          style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
          aria-hidden={!sidebarOpen}
        >
          <NodeSidebar
            open={sidebarOpen}
            onOpenChange={handleSidebarOpenChange}
            department={selectedDepartment}
            permissionSections={nodePermissionSections}
            countsLoading={nodePermissionLoading}
            onNavigateToUsers={handleNavigateToUsers}
            onOpenHistory={(input) => {
              setHistoryNodeName((input?.nodeName || selectedDepartment?.name || companyName || "").trim());
              setHistoryNodePath((input?.nodePath || selectedDepartment?.nodePath || "").trim());
              setHistoryParentNodePath("");
              setHistoryViewContext("active");
              setIsOrgHistoryOpen(true);
            }}
            onRequestStatusChange={handleRequestNodeStatusChange}
          />
        </div>

        {orgStructure && hasHorizontalOverflow ? (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 z-20 border-t border-slate-200/80 bg-[#fcfcfd]/95 px-6 py-3 backdrop-blur",
              sidebarOpen ? "lg:right-[420px]" : "lg:right-0",
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
        workflowOptions={newNodeWorkflowOptions}
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

      <OrgStatusUpdatePopup
        open={Boolean(statusUpdateNode)}
        nodeName={statusUpdateNode?.name || ""}
        nodeTrail={statusUpdateNode?.breadcrumbs || []}
        nodeType={statusUpdateNode?.nodeType || ""}
        selectedLevelsHash={statusUpdateWorkflowHash}
        remarks={statusUpdateRemarks}
        workflowOptions={statusUpdateWorkflowOptions}
        submitLabel={statusUpdateTargetStatus === "inactive" ? "Submit Inactive Request" : "Submit Active Request"}
        onOpenChange={(open) => {
          if (!open) {
            void closeOrgStatusUpdatePopup();
          }
        }}
        onWorkflowChange={setStatusUpdateWorkflowHash}
        onRemarksChange={setStatusUpdateRemarks}
        onSubmit={() => void submitNodeStatusUpdate()}
      />
      <EditLockWarningDialog
        open={orgLockWarningOpen}
        secondsRemaining={orgLockSecondsRemaining}
        onContinue={() => void continueOrgEditing()}
        onCloseAndRelease={() => void closeOrgEditingByTimeout()}
      />

      <PendingNodePopup
        open={!!pendingNodeForReview}
        node={pendingNodeForReview}
        onClose={() => {
          void (async () => {
            await cancelPendingNodeAction();
            handleClosePendingNodePopup();
          })();
        }}
        onStartPendingAction={async (node, action) => {
          try {
            await startPendingNodeAction(node);
            return true;
          } catch (error) {
            toast({
              title: action === "reject" ? "Reject unavailable" : "Approve unavailable",
              description: getOrgLockErrorMessage(
                error,
                action === "reject"
                  ? "Unable to lock org request for rejection."
                  : "Unable to lock org request for approval.",
              ),
              variant: "destructive",
            });
            return false;
          }
        }}
        onCancelPendingAction={async () => {
          await cancelPendingNodeAction();
        }}
        onApprove={async (node, remark) => {
          await handleApproveNode(node, remark);
          handleClosePendingNodePopup();
          setHasNewOrgEvent(false);
        }}
        onReject={async (node, remark) => {
          await handleRejectNode(node, remark);
          handleClosePendingNodePopup();
          setHasNewOrgEvent(false);
        }}
        isHistoryOpen={isOrgHistoryOpen}
        dockOffset={historyLayoutOffset}
        onOpenHistory={(node) => {
          const historyContext = getPendingHistoryContext(node);
          setHistoryNodeName(historyContext.nodeName);
          setHistoryNodePath(historyContext.nodePath);
          setHistoryParentNodePath(historyContext.parentNodePath);
          setHistoryViewContext("pending");
          setIsOrgHistoryOpen(true);
        }}
        onToggleHistory={() => {
          if (isOrgHistoryOpen) {
            setIsOrgHistoryOpen(false);
          } else if (pendingNodeForReview) {
            const historyContext = getPendingHistoryContext(pendingNodeForReview);
            setHistoryNodeName(historyContext.nodeName);
            setHistoryNodePath(historyContext.nodePath);
            setHistoryParentNodePath(historyContext.parentNodePath);
            setHistoryViewContext("pending");
            setIsOrgHistoryOpen(true);
          }
        }}
        onNavigateToImpactedUsers={handleNavigateToImpactedUsers}
      />

      <OrgHistorySidebar
        isOpen={isOrgHistoryOpen}
        onClose={() => {
          setIsOrgHistoryOpen(false);
          setHistoryViewContext("active");
          setHistoryParentNodePath("");
        }}
        companyCode={companyCode}
        subtitle={historyNodeName || companyName}
        nodeName={historyNodeName}
        nodePath={historyNodePath}
        isPending={historyViewContext === "pending"}
        parentNodePath={historyParentNodePath}
        dockOffset={historyLayoutOffset}
        splitView
        closeOnOutsideClick={historyViewContext !== "pending"}
      />
    </div>
  );
}

export default function OrgStructureViewPage() {
  return <OrgStructureView />;
}










