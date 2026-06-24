import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Filter, Info, Plus, RefreshCw, Search, Settings, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import WorkflowOnboardingView from "@/features/workflow-management/components/WorkflowOnboardingView";
import WorkflowHistorySidebar from "./WorkflowHistorySidebar";
import WorkflowPreferenceDialog from "./WorkflowPreferenceDialog";
import { History } from "lucide-react";
import WorkflowManageDialog from "./WorkflowManageDialog";
import type { HistoryDetailPreviewEvent, HistoryDetailViewModel } from "@/components/HistoryDetailDialog";
import { useWorkflowManagement } from "@/features/workflow-management/hooks/useWorkflowManagement";
import { cn } from "@/lib/utils";
import {
  mapWorkflowRecord,
  getWorkflowNodeDisplayName,
  getWorkflowPathPreview,
  isRootWorkflowNode,
  isWorkflowUpdateRequest,
} from "@/features/workflow-management/utils/workflowRecord.utils";
import { useToast } from "@/hooks/use-toast";
import { useEditLockSession } from "@/hooks/useEditLockSession";
import EditLockWarningDialog from "@/components/EditLockWarningDialog";
import { useRefreshTimestamp } from "@/hooks/useRefreshTimestamp";
import PaginationFooter from "@/components/PaginationFooter";
import { formatCollapsedNodePath } from "@/features/user-management/utils";
import { useNotificationsPanelOpen } from "@/hooks/useNotificationsPanelOpen";
import { getApiErrorMessage } from "@/services/client";
import { fetchWorkflowDetails, fetchWorkflowsPaginated } from "@/services/workflow.service";
import {
  SearchableMultiSelectMenu,
  SearchableSingleSelectMenu,
} from "@/components/filter-search-dropdown";

const tabClassName =
  "rounded-full px-5 py-2 text-sm font-semibold transition-all data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm";

const statusBadgeClassName: Record<string, string> = {
  Active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  Inactive: "border-rose-200 bg-rose-50 text-rose-700",
};

const tabCountBadgeClassName: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Pending: "bg-amber-100 text-amber-700",
  Inactive: "bg-rose-100 text-rose-700",
};

// Configurable thresholds and table templates.
const WORKFLOW_NAME_WRAP_THRESHOLD = 40;
const MODULE_NAME_ADAPT_THRESHOLD = 20;
const NODE_NAME_TRUNCATE_THRESHOLD = 20;
const DEFAULT_WORKFLOW_TABLE_GRID =
  "md:grid-cols-[minmax(16ch,1.65fr)_minmax(9ch,0.95fr)_minmax(10ch,0.95fr)_minmax(13ch,1.2fr)_minmax(7ch,0.7fr)_minmax(9ch,0.8fr)_minmax(72px,0.45fr)]";
const ADAPTIVE_PENDING_WORKFLOW_TABLE_GRID =
  "md:grid-cols-[minmax(18ch,1.85fr)_minmax(9ch,0.95fr)_minmax(10ch,0.95fr)_minmax(12ch,1.15fr)_minmax(7ch,0.7fr)_minmax(9ch,0.8fr)_minmax(72px,0.45fr)]";

const getLockErrorMessage = (error: unknown, fallback: string) => {
  const rawMessage =
    typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.trim()
      : "";
  return rawMessage || getApiErrorMessage(error, fallback);
};

const readWorkflowString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const resolveWorkflowLockModuleValues = (workflow: NonNullable<typeof manageWorkflow>) => {
  const pendingOldData = (workflow.pendingOldData ?? {}) as Record<string, unknown>;
  const pendingNewData = (workflow.pendingNewData ?? {}) as Record<string, unknown>;
  const pendingOldTarget =
    typeof pendingOldData.target === "object" && pendingOldData.target !== null
      ? (pendingOldData.target as Record<string, unknown>)
      : {};
  const pendingNewTarget =
    typeof pendingNewData.target === "object" && pendingNewData.target !== null
      ? (pendingNewData.target as Record<string, unknown>)
      : {};

  return {
    module:
      readWorkflowString(pendingOldData.module) ||
      readWorkflowString(pendingOldTarget.module) ||
      readWorkflowString(pendingNewData.module) ||
      readWorkflowString(pendingNewTarget.module) ||
      readWorkflowString(workflow.rawModule) ||
      readWorkflowString(workflow.module),
    subModule:
      readWorkflowString(pendingOldData.subModule) ||
      readWorkflowString(pendingOldTarget.subModule) ||
      readWorkflowString(pendingNewData.subModule) ||
      readWorkflowString(pendingNewTarget.subModule) ||
      readWorkflowString(workflow.subModule),
  };
};

const resolveWorkflowLockLevelsHash = (workflow: NonNullable<typeof manageWorkflow>) => {
  const pendingOldData = (workflow.pendingOldData ?? {}) as Record<string, unknown>;
  const pendingOldTarget =
    typeof pendingOldData.target === "object" && pendingOldData.target !== null
      ? (pendingOldData.target as Record<string, unknown>)
      : {};
  const pendingNewData = (workflow.pendingNewData ?? {}) as Record<string, unknown>;
  const pendingNewTarget =
    typeof pendingNewData.target === "object" && pendingNewData.target !== null
      ? (pendingNewData.target as Record<string, unknown>)
      : {};

  return (
    readWorkflowString(pendingOldData.levelsHash) ||
    readWorkflowString(pendingOldTarget.levelsHash) ||
    readWorkflowString(workflow.levelsHash) ||
    readWorkflowString(pendingNewData.levelsHash) ||
    readWorkflowString(pendingNewTarget.levelsHash) ||
    readWorkflowString(workflow.workflowId) ||
    readWorkflowString(workflow.id)
  );
};

const resolveWorkflowNodePath = (workflow: NonNullable<typeof manageWorkflow>) => {
  const pendingOldData = (workflow.pendingOldData ?? {}) as Record<string, unknown>;
  const pendingOldTarget = typeof pendingOldData.target === "object" && pendingOldData.target !== null
    ? (pendingOldData.target as Record<string, unknown>)
    : {};
  const pendingNewData = (workflow.pendingNewData ?? {}) as Record<string, unknown>;
  const pendingTarget = typeof pendingNewData.target === "object" && pendingNewData.target !== null
    ? (pendingNewData.target as Record<string, unknown>)
    : {};

  return (
    readWorkflowString(workflow.orgStructure?.nodePath) ||
    readWorkflowString(workflow.linkedOrgStructure?.[0]?.nodePath) ||
    readWorkflowString(workflow.autoGenerated?.[0]?.orgStructure?.nodePath) ||
    readWorkflowString(pendingOldData.nodePath) ||
    readWorkflowString(pendingOldTarget.nodePath) ||
    readWorkflowString(pendingNewData.nodePath) ||
    readWorkflowString(pendingTarget.nodePath) ||
    readWorkflowString(workflow.nodePath)
  );
};

function NodePathMarquee({ text }: { text: string }) {
  const MARQUEE_DURATION_SECONDS = 6;
  const MARQUEE_GAP_PX = 24;
  const viewportRef = useRef<HTMLSpanElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [overflowPx, setOverflowPx] = useState(0);
  const [textWidthPx, setTextWidthPx] = useState(0);

  useEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current;
      const label = textRef.current;
      if (!viewport || !label) return;
      const fullTextWidth = Math.ceil(label.scrollWidth);
      const nextOverflow = Math.max(0, Math.ceil(fullTextWidth - viewport.clientWidth));
      setTextWidthPx(fullTextWidth);
      setOverflowPx(nextOverflow);
    };

    measure();
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    if (textRef.current) observer.observe(textRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [text]);

  const shouldAnimate = isHovered && overflowPx > 0;
  const marqueeTravelPx = textWidthPx + MARQUEE_GAP_PX;

  return (
    <span className="mt-1 inline-flex max-w-full items-center gap-1.5">
      {overflowPx > 0 ? (
        <span
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-600 transition hover:border-sky-300 hover:bg-sky-100"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label="Preview full node path"
          role="img"
        >
          <Info className="h-3 w-3" />
        </span>
      ) : null}
      <span className="inline-flex min-w-0 max-w-full rounded-md border border-sky-100 bg-sky-50/70 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.02em] text-sky-700">
        <span ref={viewportRef} className="block max-w-full overflow-hidden whitespace-nowrap">
          <span
            className="inline-flex items-center whitespace-nowrap will-change-transform"
            style={
              shouldAnimate
                ? {
                  animation: `workflow-node-path-marquee ${MARQUEE_DURATION_SECONDS}s linear infinite`,
                  ["--node-path-shift" as string]: `${marqueeTravelPx}px`,
                  transform: "translate3d(0,0,0)",
                }
                : undefined
            }
          >
            <span ref={textRef} className="inline-block whitespace-nowrap">
              {text}
            </span>
            {overflowPx > 0 ? (
              <span aria-hidden className="inline-flex items-center whitespace-nowrap">
                <span className="inline-block" style={{ width: `${MARQUEE_GAP_PX}px` }} />
                <span className="inline-block whitespace-nowrap">{text}</span>
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </span>
  );
}

export default function WorkflowManagementView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const lastNotificationKeyRef = useRef<string | null>(null);
  const notificationFetchKeyRef = useRef<string | null>(null);
  const workflowLockSession = useEditLockSession();
  const {
    WORKFLOW_PAGE_SIZE_OPTIONS,
    activeStatus,
    setActiveStatus,
    search,
    setSearch,
    searchSuggestions,
    moduleFilters,
    setModuleFilters,
    statusFilters,
    setStatusFilters,
    subStatusFilters,
    setSubStatusFilters,
    nodeNameFilters,
    setNodeNameFilters,
    nodeTypeFilters,
    setNodeTypeFilters,
    workflowLevelFilters,
    setWorkflowLevelFilters,
    approverTypeFilters,
    setApproverTypeFilters,
    approverLevelFilters,
    setApproverLevelFilters,
    linkedOrgStructureFilters,
    setLinkedOrgStructureFilters,
    approverCountFilters,
    setApproverCountFilters,
    setIsFilterRequestActive,
    moduleOptions,
    statusOptions,
    nodeNameOptions,
    nodeTypeOptions,
    approverCountOptions,
    workflowLevelOptions,
    approverLevelOptions,
    approverTypeOptions,
    linkedOrgStructureOptions,
    loadWorkflowFilterOptions,
    isFilterLoading,
    clearColumnFilters,
    addDialogOpen,
    setAddDialogOpen,
    handleOpenAddWorkflowDialog,
    pageSize,
    setPageSize,
    historyWorkflow,
    setHistoryWorkflow,
    manageWorkflow,
    setManageWorkflow,
    filteredWorkflows,
    paginatedWorkflows,
    safePage,
    totalPages,
    statusCounts,
    loadWorkflows,
    handlePrevPage,
    handleNextPage,
    handleJumpToPage,
    handleWorkflowAction,
    requestStatusWorkflowOptions,
    submitWorkflowStatusUpdate,
    submitWorkflowArchiveRequest,
    hasNewWorkflowEvent,
    setHasNewWorkflowEvent,
    hasLoadedWorkflowsOnce,
  } = useWorkflowManagement();

  const visibleTabs = [
    { id: "Active" as const, label: "Active", count: statusCounts.active },
    ...(statusCounts.pending > 0 ? [{ id: "Pending" as const, label: "Pending", count: statusCounts.pending }] : []),
    ...(statusCounts.inactive > 0 ? [{ id: "Inactive" as const, label: "Inactive", count: statusCounts.inactive }] : []),
  ];
  const activeFilterCount =
    moduleFilters.length +
    statusFilters.length +
    subStatusFilters.length +
    nodeNameFilters.length +
    nodeTypeFilters.length +
    workflowLevelFilters.length +
    approverTypeFilters.length +
    approverLevelFilters.length +
    linkedOrgStructureFilters.length +
    approverCountFilters.length;
  const hasAnyFilter = activeFilterCount > 0;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [manageHistoryOpen, setManageHistoryOpen] = useState(false);
  const [workflowHistoryPreviewDetail, setWorkflowHistoryPreviewDetail] = useState<HistoryDetailViewModel | null>(null);
  const [workflowHistoryPreviewEvent, setWorkflowHistoryPreviewEvent] = useState<HistoryDetailPreviewEvent | null>(null);
  const [shellOffset, setShellOffset] = useState({ top: 56, left: 0 });
  const [viewportWidth, setViewportWidth] = useState(0);
  const [draftModuleFilters, setDraftModuleFilters] = useState<string[]>(moduleFilters);
  const [draftStatusFilters, setDraftStatusFilters] = useState<string[]>(statusFilters);
  const [draftSubStatusFilters, setDraftSubStatusFilters] = useState<("initiate" | "modify")[]>(subStatusFilters);
  const [draftNodeNameFilters, setDraftNodeNameFilters] = useState<string[]>(nodeNameFilters);
  const [draftNodeTypeFilters, setDraftNodeTypeFilters] = useState<string[]>(nodeTypeFilters);
  const [draftWorkflowLevelFilters, setDraftWorkflowLevelFilters] = useState<string[]>(workflowLevelFilters);
  const [draftApproverTypeFilters, setDraftApproverTypeFilters] = useState<string[]>(approverTypeFilters);
  const [draftApproverLevelFilters, setDraftApproverLevelFilters] = useState<string[]>(approverLevelFilters);
  const [draftLinkedOrgStructureFilters, setDraftLinkedOrgStructureFilters] = useState<string[]>(linkedOrgStructureFilters);
  const [draftApproverCountFilters, setDraftApproverCountFilters] = useState<string[]>(approverCountFilters);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<"create" | "edit">("create");
  const [workflowSeedForEdit, setWorkflowSeedForEdit] = useState<(typeof manageWorkflow) | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [manageLockArmed, setManageLockArmed] = useState(false);
  const [manageInitialAction, setManageInitialAction] = useState<"delete" | null>(null);
  const [showDeleteActions, setShowDeleteActions] = useState(false);
  const [deleteWorkflow, setDeleteWorkflow] = useState("__none__");
  const [deleteWorkflowOptions, setDeleteWorkflowOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [deleteRemark, setDeleteRemark] = useState("");
  const [deleteRemarkError, setDeleteRemarkError] = useState("");
  const [isOpeningWorkflowPreview, setIsOpeningWorkflowPreview] = useState(false);
  const [isRefreshTooltipOpen, setIsRefreshTooltipOpen] = useState(false);
  const [workflowPreferenceDialogOpen, setWorkflowPreferenceDialogOpen] = useState(false);
  const isNotificationsPanelOpen = useNotificationsPanelOpen();
  const isAnyWorkflowDialogOpen = addDialogOpen || Boolean(manageWorkflow);
  const { refreshLabel, lastRefreshedAt, markRefreshed } = useRefreshTimestamp();
  const shouldUseAdaptivePendingLayout = useMemo(
    () =>
      filteredWorkflows.some(
        (workflow) =>
          (workflow.name || "").trim().length > WORKFLOW_NAME_WRAP_THRESHOLD ||
          (workflow.module || "").trim().length > MODULE_NAME_ADAPT_THRESHOLD,
      ),
    [filteredWorkflows],
  );
  const workflowGridTemplateClass = shouldUseAdaptivePendingLayout
    ? ADAPTIVE_PENDING_WORKFLOW_TABLE_GRID
    : DEFAULT_WORKFLOW_TABLE_GRID;
  const totalWorkflowsForTab =
    activeStatus === "Pending"
      ? statusCounts.pending
      : activeStatus === "Inactive"
        ? statusCounts.inactive
        : statusCounts.active;
  const workflowRangeSummary = useMemo(() => {
    if (totalWorkflowsForTab <= 0 || paginatedWorkflows.length === 0) return "Range: 0-0 of 0";
    const start = Math.max(1, (safePage - 1) * pageSize + 1);
    const end = Math.min(totalWorkflowsForTab, start + paginatedWorkflows.length - 1);
    return `Range: ${start}-${end} of ${totalWorkflowsForTab}`;
  }, [pageSize, paginatedWorkflows.length, safePage, totalWorkflowsForTab]);
  const clearNotificationIntentParams = (params: URLSearchParams) => {
    const nextParams = new URLSearchParams(params);
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
    return nextParams;
  };

  const openManageWorkflowPreview = useCallback(
    async (
      workflow: NonNullable<typeof manageWorkflow>,
      statusOverride?: "Active" | "Pending" | "Inactive",
      initialAction?: "delete" | null,
      preserveHistory?: boolean,
    ) => {
      try {
        setIsOpeningWorkflowPreview(true);
        const detailedWorkflow = await fetchWorkflowDetails({
          id: (workflow.id || workflow.referenceId || workflow.workflowId || workflow.levelsHash || "").trim(),
          status: statusOverride ?? activeStatus,
        });
        if (!preserveHistory) {
          setWorkflowHistoryPreviewDetail(null);
          setManageHistoryOpen(false);
        }
        setManageInitialAction(initialAction ?? null);
        setManageWorkflow(detailedWorkflow);
        return true;
      } catch (error) {
        toast({
          title: "Unable to load workflow details",
          description: getApiErrorMessage(error, "Failed to fetch the selected workflow details."),
          variant: "destructive",
        });
        return false;
      } finally {
        setIsOpeningWorkflowPreview(false);
      }
    },
    [activeStatus, toast, setManageWorkflow],
  );

  useEffect(() => {
    if ((searchParams.get("tab") || "").trim() !== "workflows") return;
    if ((searchParams.get("notif_ref_type") || "").trim().toUpperCase() !== "WORKFLOW") return;

    const notificationAction = (searchParams.get("notif_action") || "").trim().toLowerCase();
    const notificationTargetStatus = (searchParams.get("notif_target_status") || "").trim().toLowerCase();
    const notificationType = (searchParams.get("notif_type") || "").trim().toUpperCase();
    const referenceId = (searchParams.get("notif_ref_id") || "").trim();
    const notificationTarget = (searchParams.get("notif_target") || "").trim();
    const entityName = (searchParams.get("notif_entity_name") || "").trim().toLowerCase();
    const notificationKey = [notificationAction, notificationTargetStatus, notificationType, referenceId, notificationTarget, entityName].join("|");

    if (!notificationAction && !notificationType && !referenceId && !notificationTarget && !entityName) {
      lastNotificationKeyRef.current = null;
      notificationFetchKeyRef.current = null;
      return;
    }
    if (lastNotificationKeyRef.current === notificationKey) return;
    const targetStatus =
      notificationAction === "approve"
        ? "Pending"
        : notificationTargetStatus === "inactive"
          ? "Inactive"
          : notificationTargetStatus === "pending"
            ? "Pending"
            : notificationType.includes("INACTIV") || notificationType.includes("ARCHIVE")
              ? "Inactive"
              : "Active";

    if (activeStatus !== targetStatus) {
      notificationFetchKeyRef.current = null;
      setActiveStatus(targetStatus as typeof activeStatus);
      return;
    }

    let isMounted = true;
    const openWorkflowFromNotification = async () => {
      const fetchType = targetStatus === "Pending" ? "pending" : targetStatus === "Inactive" ? "inactive" : "active";
      const mapStatus = targetStatus as "Active" | "Pending" | "Inactive";

      try {
        notificationFetchKeyRef.current = notificationKey;
        const response = await fetchWorkflowsPaginated(fetchType, {
          limit: 15,
          cursor: null,
          topCursor: null,
          page: null,
          direction: "NEXT",
          query: "",
        });
        const workflows = response.rows.map((row) => mapWorkflowRecord(row, mapStatus));
        const [targetNodePathRaw = "", targetLevelsHashRaw = "", targetModuleRaw = "", targetSubModuleRaw = ""] =
          notificationTarget.split(",").map((part) => part.trim());
        const targetNodePath = targetNodePathRaw.toUpperCase();
        const targetLevelsHash = targetLevelsHashRaw.toUpperCase();
        const targetModule = targetModuleRaw.toUpperCase();
        const targetSubModule = targetSubModuleRaw.toUpperCase();

        const findWorkflowByReference = () =>
          workflows.find((workflow) => {
            const workflowId = (workflow.id || "").trim();
            const workflowReferenceId = (workflow.referenceId || "").trim();
            const workflowUuid = (workflow.workflowId || "").trim();
            const workflowHash = (workflow.levelsHash || "").trim();

            return (
              workflowId === referenceId ||
              workflowReferenceId === referenceId ||
              workflowUuid === referenceId ||
              workflowHash === referenceId
            );
          }) ?? null;

        const findWorkflowByTarget = () =>
          workflows.find((workflow) => {
            const workflowNodePath = (workflow.nodePath || "").trim().toUpperCase();
            const workflowLevelsHash = (workflow.levelsHash || "").trim().toUpperCase();
            const workflowModule = (workflow.rawModule || workflow.module || "").trim().toUpperCase();
            const workflowSubModule = (workflow.subModule || "").trim().toUpperCase();

            return (
              (!targetNodePath || workflowNodePath === targetNodePath) &&
              (!targetLevelsHash || workflowLevelsHash === targetLevelsHash) &&
              (!targetModule || workflowModule === targetModule) &&
              (!targetSubModule || workflowSubModule === targetSubModule)
            );
          }) ?? null;

        const findWorkflowByName = () =>
          workflows.find((workflow) => (workflow.name || "").trim().toLowerCase() === entityName) ?? null;

        const matchedWorkflowByReference = referenceId ? findWorkflowByReference() : null;
        const matchedWorkflowByTarget =
          !matchedWorkflowByReference && (targetNodePath || targetLevelsHash || targetModule || targetSubModule)
            ? findWorkflowByTarget()
            : null;
        const matchedWorkflowByName = !matchedWorkflowByReference && !matchedWorkflowByTarget && entityName ? findWorkflowByName() : null;

        const matchedWorkflow = matchedWorkflowByReference ?? matchedWorkflowByTarget ?? matchedWorkflowByName;

        if (!isMounted) return;

        if (!matchedWorkflow) {
          toast({
            title: "Request not found",
            description: "The workflow request is no longer available.",
            variant: "destructive",
          });
          setSearchParams(clearNotificationIntentParams(searchParams), { replace: true });
          lastNotificationKeyRef.current = notificationKey;
          return;
        }

        void openManageWorkflowPreview(matchedWorkflow, targetStatus as "Active" | "Pending" | "Inactive");
        setSearchParams(clearNotificationIntentParams(searchParams), { replace: true });
        lastNotificationKeyRef.current = notificationKey;
      } catch (error) {
        if (!isMounted) return;
        toast({
          title: `Unable to load ${fetchType} workflows`,
          description: getApiErrorMessage(error, `Failed to fetch ${fetchType} workflows.`),
          variant: "destructive",
        });
        setSearchParams(clearNotificationIntentParams(searchParams), { replace: true });
      }
    };

    if (notificationFetchKeyRef.current === notificationKey) return;
    void openWorkflowFromNotification();
    return () => {
      isMounted = false;
    };
  }, [
    activeStatus,
    searchParams,
    setActiveStatus,
    setManageWorkflow,
    setSearchParams,
    toast,
    openManageWorkflowPreview,
  ]);

  const toggleValue = (current: string[], value: string) =>
    current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

  const syncDraftFromApplied = () => {
    setDraftModuleFilters(moduleFilters);
    setDraftStatusFilters(statusFilters);
    setDraftSubStatusFilters(subStatusFilters);
    setDraftNodeNameFilters(nodeNameFilters);
    setDraftNodeTypeFilters(nodeTypeFilters);
    setDraftWorkflowLevelFilters(workflowLevelFilters);
    setDraftApproverTypeFilters(approverTypeFilters);
    setDraftApproverLevelFilters(approverLevelFilters);
    setDraftLinkedOrgStructureFilters(linkedOrgStructureFilters);
    setDraftApproverCountFilters(approverCountFilters);
  };

  const clearDraftFilters = () => {
    setDraftModuleFilters([]);
    setDraftStatusFilters([]);
    setDraftSubStatusFilters([]);
    setDraftNodeNameFilters([]);
    setDraftNodeTypeFilters([]);
    setDraftWorkflowLevelFilters([]);
    setDraftApproverTypeFilters([]);
    setDraftApproverLevelFilters([]);
    setDraftLinkedOrgStructureFilters([]);
    setDraftApproverCountFilters([]);
  };

  const closeOnboardingDialog = async () => {
    await workflowLockSession.stopSession(true);
    setAddDialogOpen(false);
    setOnboardingMode("create");
    setWorkflowSeedForEdit(null);
    setOnboardingStep(1);
  };
  const getWorkflowLockTarget = (workflow: NonNullable<typeof manageWorkflow>) => {
    const lockModules = resolveWorkflowLockModuleValues(workflow);
    return {
      type: "workflow" as const,
      target: {
        nodePath: resolveWorkflowNodePath(workflow),
        levelsHash: resolveWorkflowLockLevelsHash(workflow),
        subModule: lockModules.subModule,
        module: lockModules.module,
      },
    };
  };

  const closeManageWorkflowDialog = async () => {
    const shouldReleaseLock = manageLockArmed;
    await workflowLockSession.stopSession(shouldReleaseLock);
    setManageLockArmed(false);
    setManageHistoryOpen(false);
    setWorkflowHistoryPreviewDetail(null);
    setManageInitialAction(null);
    setShowDeleteActions(false);
    setDeleteWorkflow("__none__");
    setDeleteWorkflowOptions([]);
    setDeleteRemark("");
    setDeleteRemarkError("");
    setManageWorkflow(null);
  };

  const startPendingWorkflowAction = useCallback(async (workflow: NonNullable<typeof manageWorkflow>) => {
    return workflow;
  }, []);

  const cancelPendingWorkflowAction = useCallback(async () => {
    return;
  }, []);

  useEffect(() => {
    if (!manageWorkflow) {
      setManageLockArmed(false);
      setManageHistoryOpen(false);
      setWorkflowHistoryPreviewDetail(null);
      setManageInitialAction(null);
      setShowDeleteActions(false);
      setDeleteWorkflow("__none__");
      setDeleteWorkflowOptions([]);
      setDeleteRemark("");
      setDeleteRemarkError("");
    }
  }, [manageWorkflow]);

  const handleStartWorkflowDeleteRequest = useCallback(async (workflow: NonNullable<typeof manageWorkflow>) => {
    try {
      await workflowLockSession.startSession(
        getWorkflowLockTarget(workflow),
        () => {
          setManageHistoryOpen(false);
          setManageLockArmed(false);
          setManageInitialAction(null);
          setShowDeleteActions(false);
          setDeleteWorkflow("__none__");
          setDeleteWorkflowOptions([]);
          setDeleteRemark("");
          setDeleteRemarkError("");
          setManageWorkflow(null);
          toast({
            title: "Edit lock expired",
            description: "No activity detected. Workflow delete request was closed.",
            variant: "destructive",
          });
        },
      );
      setManageLockArmed(true);
      const { options, selectedLevelsHash } = await requestStatusWorkflowOptions(workflow);
      setDeleteWorkflowOptions(Array.isArray(options) ? options : []);
      setDeleteWorkflow(selectedLevelsHash.trim() || "__none__");
      setDeleteRemark("");
      setDeleteRemarkError("");
      setShowDeleteActions(true);
    } catch (error) {
      setDeleteWorkflowOptions([]);
      setDeleteWorkflow("__none__");
      setDeleteRemark("");
      setDeleteRemarkError("");
      setShowDeleteActions(false);
      toast({
        title: "Delete unavailable",
        description: getLockErrorMessage(error, "Unable to lock workflow for delete."),
        variant: "destructive",
      });
      return;
    }
  }, [requestStatusWorkflowOptions, toast, workflowLockSession]);

  const handleConfirmWorkflowDelete = useCallback(async (workflow: NonNullable<typeof manageWorkflow>) => {
    const remark = deleteRemark.trim();
    if (!remark) {
      setDeleteRemarkError("Remark is required.");
      return;
    }

    try {
      await submitWorkflowArchiveRequest({
        workflow,
        remark,
        levelsHash: deleteWorkflow === "__none__" ? null : deleteWorkflow,
      });
      await workflowLockSession.stopSession(true);
      setManageLockArmed(false);
      setManageInitialAction(null);
      setShowDeleteActions(false);
      setDeleteWorkflow("__none__");
      setDeleteWorkflowOptions([]);
      setDeleteRemark("");
      setDeleteRemarkError("");
      setManageHistoryOpen(false);
      setWorkflowHistoryPreviewDetail(null);
      setManageWorkflow(null);
    } catch (error) {
      setDeleteRemarkError(getApiErrorMessage(error, "Failed to submit workflow delete request."));
    }
  }, [deleteRemark, deleteWorkflow, submitWorkflowArchiveRequest, workflowLockSession]);

  useEffect(() => {
    if (!manageWorkflow) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [manageWorkflow]);

  useEffect(() => {
    const syncShellOffset = () => {
      const topBar = document.querySelector("header");
      const sideBar = document.querySelector("aside");
      const top = topBar ? Math.max(0, Math.floor(topBar.getBoundingClientRect().bottom)) : 56;
      const left = sideBar ? Math.max(0, Math.floor(sideBar.getBoundingClientRect().right)) : 0;
      setShellOffset({ top, left });
      setViewportWidth(window.innerWidth);
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
    if (!hasLoadedWorkflowsOnce && filteredWorkflows.length === 0) return;
    if (lastRefreshedAt) return;
    markRefreshed();
  }, [filteredWorkflows.length, hasLoadedWorkflowsOnce, lastRefreshedAt, markRefreshed]);

  const availableContentWidth = Math.max(0, viewportWidth - shellOffset.left);
  const MIN_DIALOG_SPLIT_WIDTH = 860;
  const MIN_HISTORY_WIDTH = 420;
  const MAX_HISTORY_WIDTH = 560;
  const computedHistoryPanelWidth = Math.max(
    MIN_HISTORY_WIDTH,
    Math.min(MAX_HISTORY_WIDTH, availableContentWidth - MIN_DIALOG_SPLIT_WIDTH),
  );
  const manageWorkflowIsPendingLike =
    !!manageWorkflow &&
    (manageWorkflow.status === "Pending" || isWorkflowUpdateRequest(manageWorkflow));
  const hasOpenManageWorkflowHistory = Boolean(manageWorkflow) && manageHistoryOpen;
  const canSplitManageHistoryLayout =
    hasOpenManageWorkflowHistory &&
    availableContentWidth >= MIN_DIALOG_SPLIT_WIDTH + MIN_HISTORY_WIDTH;
  const canUseSplitManageHistory =
    hasOpenManageWorkflowHistory &&
    availableContentWidth >= MIN_DIALOG_SPLIT_WIDTH + MIN_HISTORY_WIDTH;
  const splitHistoryTopOverlap = 2;
  const splitWorkflowDockOffset = canSplitManageHistoryLayout
    ? { top: Math.max(0, shellOffset.top - splitHistoryTopOverlap), left: shellOffset.left }
    : shellOffset;

  useEffect(() => {
    if (!manageWorkflow) return;
    if (!(manageWorkflow.status === "Pending" || isWorkflowUpdateRequest(manageWorkflow))) return;
    setManageHistoryOpen(true);
  }, [manageWorkflow]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl xl:max-w-2xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by workflow name, alias, or module..."
              className="pl-9 pr-9"
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setShowSuggestions(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            {showSuggestions && searchSuggestions.length > 0 ? (
              <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-lg">
                {searchSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setSearch(suggestion);
                      setShowSuggestions(false);
                    }}
                    className="block w-full rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  data-active={activeStatus === tab.id}
                  className={tabClassName}
                  onClick={() => setActiveStatus(tab.id)}
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        "inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        activeStatus === tab.id
                          ? "bg-white/15 text-white ring-1 ring-white/20"
                          : tabCountBadgeClassName[tab.id] || "bg-white text-slate-500 border border-slate-200",
                      )}
                    >
                      {tab.count}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <Popover
              open={filtersOpen}
              onOpenChange={async (nextOpen) => {
                if (nextOpen) {
                  syncDraftFromApplied();
                  await loadWorkflowFilterOptions();
                }
                setFiltersOpen(nextOpen);
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-12 rounded-xl border-slate-200 bg-white px-4 text-[15px] font-medium shadow-sm transition-all hover:border-slate-300",
                    hasAnyFilter && "border-primary/40 bg-primary/[0.04] text-primary",
                  )}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                  {hasAnyFilter ? (
                    <span className="ml-2 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-[520px] rounded-2xl border border-slate-200 bg-white p-0 shadow-[0_26px_60px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/80"
              >
                <div className="border-b border-slate-200 bg-white px-5 py-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-semibold tracking-[0.01em] text-slate-900">Filter Workflows</p>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        {isFilterLoading ? "Loading filter options..." : activeFilterCount > 0 ? `${activeFilterCount} filters applied` : "No filters applied"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-lg px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      onClick={() => {
                        clearDraftFilters();
                        clearColumnFilters();
                      }}
                    >
                      Clear all
                    </Button>
                  </div>
                </div>

                <div className="max-h-[62vh] space-y-3.5 overflow-y-auto bg-white px-5 py-3.5">
                  <div className="border-b border-slate-100 pb-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Workflow Filters
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <WorkflowFilterDropdown
                      title="Node Name"
                      placeholder="Select node names"
                      options={nodeNameOptions}
                      selected={draftNodeNameFilters}
                      onClear={() => setDraftNodeNameFilters([])}
                      onToggle={(value) => setDraftNodeNameFilters((current) => toggleValue(current, value))}
                    />
                    <WorkflowFilterDropdown
                      title="Node Type"
                      placeholder="Select node type"
                      options={nodeTypeOptions}
                      selected={draftNodeTypeFilters}
                      onClear={() => setDraftNodeTypeFilters([])}
                      onToggle={(value) => setDraftNodeTypeFilters((current) => toggleValue(current, value))}
                    />
                    <WorkflowFilterDropdown
                      title="Module"
                      placeholder="Select modules"
                      options={moduleOptions}
                      selected={draftModuleFilters}
                      onClear={() => setDraftModuleFilters([])}
                      onToggle={(value) => setDraftModuleFilters((current) => toggleValue(current, value))}
                    />
                    <WorkflowFilterDropdown
                      title="Status"
                      placeholder="Select status"
                      options={statusOptions}
                      selected={draftStatusFilters}
                      onClear={() => setDraftStatusFilters([])}
                      onToggle={(value) => setDraftStatusFilters((current) => toggleValue(current, value))}
                    />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Sub Status (2)
                        </Label>
                        {draftSubStatusFilters.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setDraftSubStatusFilters([])}
                            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600 transition hover:text-blue-700"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                      <div className="rounded-lg border border-slate-200 px-3 py-2">
                        <div className="flex items-center gap-4">
                          {[
                            { id: "workflow-sub-status-initiate", value: "initiate" as const, label: "New track" },
                            { id: "workflow-sub-status-modify", value: "modify" as const, label: "In modification" },
                          ].map((option) => {
                            const isChecked = draftSubStatusFilters.includes(option.value);
                            return (
                              <label key={option.id} htmlFor={option.id} className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[13px] text-slate-700">
                                <input
                                  id={option.id}
                                  type="radio"
                                  name="workflow-sub-status"
                                  checked={isChecked}
                                  onChange={(event) => {
                                    if (!event.target.checked) return;
                                    setDraftSubStatusFilters([option.value]);
                                    if (option.value === "initiate") {
                                      setDraftStatusFilters(["Pending"]);
                                    }
                                  }}
                                  className="h-4 w-4 rounded-full border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                />
                                <span>{option.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <WorkflowFilterDropdown
                      title="Workflow Levels"
                      placeholder="Select workflow levels"
                      options={workflowLevelOptions.map((option) => ({
                        value: option.value,
                        label: `${option.label} ${option.label === "1" ? "Level" : "Levels"}`,
                        count: option.count,
                      }))}
                      selected={draftWorkflowLevelFilters}
                      onClear={() => setDraftWorkflowLevelFilters([])}
                      onToggle={(value) => setDraftWorkflowLevelFilters((current) => toggleValue(current, value))}
                    />
                    <div className="flex items-end gap-3">
                      <WorkflowCompactLevelDropdown
                        title="Level"
                        placeholder="No."
                        options={approverLevelOptions}
                        value={draftApproverLevelFilters[0] ?? ""}
                        onClear={() => setDraftApproverLevelFilters([])}
                        onSelect={(value) => setDraftApproverLevelFilters((current) => (current[0] === value ? [] : [value]))}
                      />
                      <div className="min-w-0 flex-1">
                        <WorkflowFilterDropdown
                          title="Approver Type"
                          placeholder="Select type"
                          options={approverTypeOptions.map((value) => ({ value, label: value }))}
                          selected={draftApproverTypeFilters}
                          onClear={() => setDraftApproverTypeFilters([])}
                          onToggle={(value) => setDraftApproverTypeFilters((current) => toggleValue(current, value))}
                        />
                      </div>
                    </div>
                    <WorkflowSingleSelectDropdown
                      title="Linked Org Structure"
                      placeholder="Select linked org structure"
                      options={linkedOrgStructureOptions.map((value) => ({ value, label: value }))}
                      value={draftLinkedOrgStructureFilters[0] ?? ""}
                      onClear={() => setDraftLinkedOrgStructureFilters([])}
                      onChange={(value) => setDraftLinkedOrgStructureFilters(value ? [value] : [])}
                    />
                    <WorkflowFilterDropdown
                      title="Approver Count"
                      placeholder="Select approver count"
                      options={approverCountOptions.map((option) => ({
                        value: option.value,
                        label: `${option.label} ${option.label === "1" ? "Approver" : "Approvers"}`,
                        count: option.count,
                      }))}
                      selected={draftApproverCountFilters}
                      onClear={() => setDraftApproverCountFilters([])}
                      onToggle={(value) =>
                        setDraftApproverCountFilters((current) => (current.includes(value) ? [] : [value]))
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      syncDraftFromApplied();
                      setFiltersOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setModuleFilters(draftModuleFilters);
                      setStatusFilters(draftStatusFilters);
                      setSubStatusFilters(draftSubStatusFilters);
                      setNodeNameFilters(draftNodeNameFilters);
                      setNodeTypeFilters(draftNodeTypeFilters);
                      setWorkflowLevelFilters(draftWorkflowLevelFilters);
                      setApproverTypeFilters(draftApproverTypeFilters);
                      setApproverLevelFilters(draftApproverLevelFilters);
                      setLinkedOrgStructureFilters(draftLinkedOrgStructureFilters);
                      setApproverCountFilters(draftApproverCountFilters);
                      const hasFilters =
                        draftModuleFilters.length > 0 ||
                        draftStatusFilters.length > 0 ||
                        draftSubStatusFilters.length > 0 ||
                        draftNodeNameFilters.length > 0 ||
                        draftNodeTypeFilters.length > 0 ||
                        draftWorkflowLevelFilters.length > 0 ||
                        draftApproverTypeFilters.length > 0 ||
                        draftApproverLevelFilters.length > 0 ||
                        draftLinkedOrgStructureFilters.length > 0 ||
                        draftApproverCountFilters.length > 0;
                      const hasRequestFilters =
                        draftModuleFilters.length > 0 ||
                        draftStatusFilters.length > 0 ||
                        draftSubStatusFilters.length > 0 ||
                        draftNodeNameFilters.length > 0 ||
                        draftNodeTypeFilters.length > 0 ||
                        draftWorkflowLevelFilters.length > 0 ||
                        draftApproverTypeFilters.length > 0 ||
                        draftApproverLevelFilters.length > 0 ||
                        draftLinkedOrgStructureFilters.length > 0 ||
                        draftApproverCountFilters.length > 0;
                      const selectedStatus = draftStatusFilters[0];
                      if (draftStatusFilters.length === 1 && (selectedStatus === "Active" || selectedStatus === "Pending" || selectedStatus === "Inactive")) {
                        setActiveStatus(selectedStatus);
                      }
                      setIsFilterRequestActive(hasRequestFilters);
                      if (
                        !hasFilters
                      ) {
                        clearColumnFilters();
                      }
                      setFiltersOpen(false);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <div className="relative flex h-12 w-12 items-center justify-center">
              <TooltipProvider delayDuration={120}>
                <Tooltip open={(!isAnyWorkflowDialogOpen && !isNotificationsPanelOpen && hasNewWorkflowEvent) || isRefreshTooltipOpen}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Refresh workflows"
                      onMouseEnter={() => setIsRefreshTooltipOpen(true)}
                      onMouseLeave={() => setIsRefreshTooltipOpen(false)}
                      onFocus={() => setIsRefreshTooltipOpen(true)}
                      onBlur={() => setIsRefreshTooltipOpen(false)}
                      onClick={async () => {
                        await loadWorkflows();
                        setHasNewWorkflowEvent(false);
                        markRefreshed();
                      }}
                      className={cn(
                        "h-12 w-12 rounded-xl border-slate-200 bg-white shadow-sm",
                        hasNewWorkflowEvent &&
                          "border-[#3553e9] bg-[#3553e9] text-white shadow-[0_10px_24px_rgba(53,83,233,0.22)] hover:bg-[#3553e9] hover:text-white",
                      )}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {hasNewWorkflowEvent ? "New event occurred" : "Refresh workflows"}
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
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm md:flex md:h-[calc(100dvh-19.5rem)] md:min-h-[500px] md:flex-col">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h3 className="text-xl font-semibold text-slate-800">
              {activeStatus} Workflows ({filteredWorkflows.length})
            </h3>
           
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end lg:w-auto">
              <Button
                variant="outline"
                className="w-full border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto"
                onClick={() => setWorkflowPreferenceDialogOpen(true)}
              >
                Set Preference
              </Button>
              <Button
                className="w-full lg:w-auto"
                onClick={() => {
                  setOnboardingMode("create");
                  setWorkflowSeedForEdit(null);
                  void handleOpenAddWorkflowDialog();
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Workflow
              </Button>
            </div>
          </div>

        {filteredWorkflows.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">No {activeStatus.toLowerCase()} workflows available.</div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className={cn("sticky top-0 z-20 grid grid-cols-1 gap-2 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur md:items-center md:gap-x-4", workflowGridTemplateClass)}>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Workflow</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Alias</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Module</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Node Name</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Type</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Status</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 md:text-center">Manage</div>
            </div>

            <div className="divide-y divide-slate-100">
              {paginatedWorkflows.map((workflow) => {
                const isModificationInProgress = Boolean(workflow.isPending);
                return (
                <div
                  key={workflow.id}
                  className={cn(
                    "grid grid-cols-1 gap-2 p-4 transition-colors duration-150 hover:bg-slate-100 md:items-center md:gap-x-4",
                    workflowGridTemplateClass,
                  )}
                >
                  <div className="min-w-0">
                    <div
                      className={cn(
                        "text-sm font-semibold text-slate-800",
                        shouldUseAdaptivePendingLayout
                          ? "[overflow-wrap:anywhere]"
                          : "truncate whitespace-nowrap",
                      )}
                      style={shouldUseAdaptivePendingLayout ? { maxWidth: `${WORKFLOW_NAME_WRAP_THRESHOLD}ch` } : undefined}
                      title={workflow.workflowName || workflow.name || workflow.alias || "-"}
                    >
                      {workflow.workflowName || workflow.name || workflow.alias || "—"}
                    </div>
                  </div>
                  <div className="truncate whitespace-nowrap text-sm text-slate-700" title={workflow.alias}>{workflow.alias}</div>
                  <div
                    className="truncate whitespace-nowrap text-sm text-slate-700"
                    title={workflow.module || workflow.rawModule || workflow.workflowAlias || workflow.workflowName || "-"}
                  >
                    {workflow.module || workflow.rawModule || workflow.workflowAlias || workflow.workflowName || "—"}
                  </div>
                  <div className="min-w-0 text-sm text-slate-700">
                    <p
                      className={cn(
                        "flex items-center gap-1.5 text-sm text-slate-700 [overflow-wrap:anywhere]",
                        typeof workflow.levelCount === "number" &&
                          "before:shrink-0 before:rounded before:bg-indigo-100 before:px-1 before:py-0.5 before:text-[9px] before:font-bold before:tracking-wider before:text-indigo-700 before:content-[attr(data-level)]",
                      )}
                      style={{ maxWidth: `${NODE_NAME_TRUNCATE_THRESHOLD}ch` }}
                      data-level={typeof workflow.levelCount === "number" ? `L${workflow.levelCount}` : undefined}
                      title={getWorkflowNodeDisplayName({
                        nodeName: workflow.nodeName,
                        nodePath: workflow.orgStructure?.nodePath || workflow.nodePath,
                        module: workflow.rawModule || workflow.module,
                        subModule: workflow.subModule,
                      }) || "—"}
                    >
                      {getWorkflowNodeDisplayName({
                        nodeName: workflow.nodeName,
                        nodePath: workflow.orgStructure?.nodePath || workflow.nodePath,
                        module: workflow.rawModule || workflow.module,
                        subModule: workflow.subModule,
                      }) || "—"}
                    </p>
                    {(() => {
                      const nodePath = workflow.nodePath || "";
                      const nodeType = (workflow.nodeType || "").toUpperCase();
                      const nodeDepth = nodePath.split(".").map((part) => part.trim()).filter(Boolean).length;
                      const isRootByType = nodeType === "ROOT";
                      const isRootByPath = nodeDepth <= 1;
                      const showPath = Boolean(nodePath) && !isRootByType && !isRootByPath;
                      if (!showPath) return null;
                      
                      const pathPreview = formatCollapsedNodePath(nodePath, 3);
                      return pathPreview ? <NodePathMarquee text={pathPreview} /> : null;
                    })()}
                  </div>
                  <div className="truncate whitespace-nowrap text-sm text-slate-700">{workflow.nodeType}</div>
                  <div>
                    <div className="flex flex-col items-start gap-1">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                          statusBadgeClassName[isWorkflowUpdateRequest(workflow) ? "Pending" : workflow.status]
                            ?? "border-slate-200 bg-slate-50 text-slate-700",
                        )}
                      >
                        {isWorkflowUpdateRequest(workflow) ? "Pending" : workflow.status}
                      </span>
                      {isModificationInProgress ? (
                        <div className="text-[12px] font-medium leading-4 text-amber-700">
                          <span className="block">Modification</span>
                          <span className="block">in progress</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex md:justify-center">
                    <div className="flex items-center gap-1">
                      {workflow.status !== "Pending" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          onClick={() => setHistoryWorkflow(workflow)}
                          aria-label={`View history for ${workflow.name}`}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                        onClick={() => {
                          void openManageWorkflowPreview(workflow);
                        }}
                        aria-label={`Manage ${workflow.name}`}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                      {workflow.status !== "Pending" && workflow.status !== "Inactive" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isModificationInProgress}
                          className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:text-slate-300 disabled:hover:bg-transparent disabled:hover:text-slate-300"
                          onClick={() => {
                            if (isModificationInProgress) return;
                            void openManageWorkflowPreview(workflow, activeStatus, "delete");
                          }}
                          aria-label={`Delete ${workflow.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
        {filteredWorkflows.length > 0 ? (
          <PaginationFooter
            currentCount={filteredWorkflows.length}
            recordCurrentCount={paginatedWorkflows.length}
            recordTotalCount={totalWorkflowsForTab}
            recordLabel="Records"
            summaryTextOverride={workflowRangeSummary}
            pageSize={pageSize}
            pageSizeOptions={WORKFLOW_PAGE_SIZE_OPTIONS}
            onPageSizeChange={(value) => setPageSize(value as typeof pageSize)}
            safePage={safePage}
            totalPages={totalPages}
            onPrevPage={() => void handlePrevPage()}
            onNextPage={() => void handleNextPage()}
            onJumpToPage={(value) => void handleJumpToPage(value)}
            className="shrink-0 flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          />
        ) : null}
      </div>

      <Dialog
        open={addDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            void (async () => {
              await closeOnboardingDialog();
            })();
            return;
          }
          setAddDialogOpen(true);
        }}
      >
        <DialogContent showCloseButton={false} className="flex h-[90vh] w-[min(94vw,72rem)] max-w-[72rem] flex-col gap-0 overflow-hidden rounded-lg p-0">
          <DialogTitle className="sr-only">{onboardingMode === "edit" ? "Edit Workflow" : "Add Workflow"}</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new workflow by configuring name, alias, module, node, and approval levels.
          </DialogDescription>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-600 p-1.5">
                <Settings className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900">{onboardingMode === "edit" ? "Edit Workflow" : "Add Workflow"}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void closeOnboardingDialog()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                aria-label="Close workflow onboarding dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <WorkflowOnboardingView
              isOpen={addDialogOpen}
              mode={onboardingMode}
              seedWorkflow={workflowSeedForEdit}
              onStepChange={setOnboardingStep}
              onPublished={async () => {
                await loadWorkflows();
                await closeOnboardingDialog();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
      {manageWorkflow && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[49] bg-slate-900/40 backdrop-blur-sm transition-[top,left,width,height,opacity] duration-300"
              style={
                canUseSplitManageHistory
                  ? {
                      top: `${shellOffset.top}px`,
                      left: `${shellOffset.left}px`,
                      width: `calc(100vw - ${shellOffset.left}px - ${computedHistoryPanelWidth}px)`,
                      height: `calc(100vh - ${shellOffset.top}px)`,
                      transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
                    }
                  : {
                      top: "0px",
                      left: "0px",
                      width: "100vw",
                      height: "100vh",
                      transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
                    }
              }
            />,
            document.body,
          )
        : null}
      <WorkflowHistorySidebar
        isOpen={!!historyWorkflow || manageHistoryOpen}
        onClose={() => {
          if (manageHistoryOpen) {
            setManageHistoryOpen(false);
            setWorkflowHistoryPreviewDetail(null);
            setWorkflowHistoryPreviewEvent(null);
            return;
          }
          setHistoryWorkflow(null);
        }}
        workflow={manageHistoryOpen ? manageWorkflow : historyWorkflow}
        onOpenHistoryDetail={(detail) => {
          setWorkflowHistoryPreviewDetail(detail);
          if (!manageWorkflow && historyWorkflow) {
            const targetWorkflow = historyWorkflow;
            void (async () => {
              const success = await openManageWorkflowPreview(targetWorkflow, activeStatus, null, true);
              if (success) {
                setManageHistoryOpen(true);
                setHistoryWorkflow(null);
              }
            })();
          } else {
            setManageHistoryOpen(true);
          }
        }}
        onLatestHistoryEventChange={setWorkflowHistoryPreviewEvent}
        dockOffset={splitWorkflowDockOffset}
        splitView={canSplitManageHistoryLayout}
        panelWidth={computedHistoryPanelWidth}
      />
      <WorkflowManageDialog
        open={!!manageWorkflow}
        workflow={manageWorkflow}
        currentTab={activeStatus}
        onClose={() => {
          void closeManageWorkflowDialog();
        }}
        onSubmitAction={handleWorkflowAction}
        onStartPendingAction={async (workflow) => {
          try {
            await startPendingWorkflowAction(workflow);
            return true;
          } catch (error) {
            toast({
              title: "Approve unavailable",
              description: getLockErrorMessage(error, "Unable to lock workflow for approval."),
              variant: "destructive",
            });
            return false;
          }
        }}
        onCancelPendingAction={async () => {
          await cancelPendingWorkflowAction();
        }}
        onRequestStatusWorkflowOptions={async (workflow) => {
          await workflowLockSession.startSession(
            getWorkflowLockTarget(workflow),
            () => {
              setManageHistoryOpen(false);
              setManageLockArmed(false);
              setManageWorkflow(null);
              toast({
                title: "Edit lock expired",
                description: "No activity detected. Workflow edit form was closed.",
                variant: "destructive",
              });
            },
          );
          setManageLockArmed(true);
          return requestStatusWorkflowOptions(workflow);
        }}
        onSubmitStatusUpdate={submitWorkflowStatusUpdate}
        onDeleteRequestStart={(workflow) => handleStartWorkflowDeleteRequest(workflow)}
        showDeleteActions={showDeleteActions}
        deleteRemark={deleteRemark}
        deleteRemarkPlaceholder="Enter remark for delete workflow request"
        deleteRemarkError={deleteRemarkError}
        deleteWorkflow={deleteWorkflow}
        deleteWorkflowOptions={deleteWorkflowOptions}
        onDeleteWorkflowChange={setDeleteWorkflow}
        onDeleteRemarkChange={(value) => {
          setDeleteRemark(value);
          if (deleteRemarkError) setDeleteRemarkError("");
        }}
        onConfirmDelete={(workflow) => {
          void handleConfirmWorkflowDelete(workflow);
        }}
        onCancelDeleteActions={() => {
          setManageInitialAction(null);
          setShowDeleteActions(false);
          setDeleteWorkflow("__none__");
          setDeleteWorkflowOptions([]);
          setDeleteRemark("");
          setDeleteRemarkError("");
        }}
        onEdit={(workflow) => {
          void (async () => {
            try {
              await workflowLockSession.startSession(
                getWorkflowLockTarget(workflow),
                () => {
                  setAddDialogOpen(false);
                  setWorkflowSeedForEdit(null);
                  setOnboardingMode("create");
                  toast({
                    title: "Edit lock expired",
                    description: "No activity detected. Workflow edit form was closed.",
                    variant: "destructive",
                  });
                },
              );
              setOnboardingMode("edit");
              setWorkflowSeedForEdit(workflow);
              setManageHistoryOpen(false);
              setManageWorkflow(null);
              setAddDialogOpen(true);
            } catch (error) {
              toast({
                title: "Edit unavailable",
                description: getLockErrorMessage(error, "Unable to lock workflow for edit."),
                variant: "destructive",
              });
            }
          })();
        }}
        onToggleHistory={() => setManageHistoryOpen((current) => {
          const next = !current;
          if (!next) {
            setWorkflowHistoryPreviewDetail(null);
            setWorkflowHistoryPreviewEvent(null);
          }
          return next;
        })}
        historyDetailOverride={workflowHistoryPreviewDetail}
        historyPreviewEvent={activeStatus === "Pending" ? workflowHistoryPreviewEvent : null}
        isHistoryOpen={manageHistoryOpen}
        overlayClassName="hidden"
        contentClassName={
          canUseSplitManageHistory
            ? "flex h-full max-h-none w-auto max-w-none flex-col overflow-hidden rounded-none p-0 transition-[top,left,width,height,transform] duration-300 will-change-[width] data-[state=open]:animate-none data-[state=closed]:animate-none"
            : undefined
        }
        contentStyle={
          canUseSplitManageHistory
            ? {
                top: `${shellOffset.top}px`,
                left: `${shellOffset.left}px`,
                width: `calc(100vw - ${shellOffset.left}px - ${computedHistoryPanelWidth}px)`,
                height: `calc(100vh - ${shellOffset.top}px)`,
                transform: "translate(0, 0)",
                transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
              }
            : undefined
        }
        preventOutsideClose={canUseSplitManageHistory}
        initialAction={manageInitialAction}
      />
      <WorkflowPreferenceDialog
        open={workflowPreferenceDialogOpen}
        onOpenChange={setWorkflowPreferenceDialogOpen}
        onPreferencesSaved={() => void loadWorkflows()}
      />
      <EditLockWarningDialog
        open={workflowLockSession.warningOpen}
        secondsRemaining={workflowLockSession.secondsRemaining}
        onContinue={() => void workflowLockSession.continueEditing()}
        onCloseAndRelease={() => void workflowLockSession.endEditingNow()}
      />
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@keyframes workflow-node-path-marquee{from{transform:translate3d(0,0,0)}to{transform:translate3d(calc(-1 * var(--node-path-shift, 0px)),0,0)}}",
        }}
      />
    </div>
  );
}

function WorkflowFilterDropdown({
  title,
  placeholder,
  options,
  selected,
  onClear,
  onToggle,
}: {
  title: string;
  placeholder: string;
  options: Array<{ value: string; label: string; description?: string; count?: number; level?: number; path?: string }>;
  selected: string[];
  onClear?: () => void;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          {title} ({options.length})
        </Label>
        {selected.length > 0 && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600 transition hover:text-blue-700"
          >
            Clear
          </button>
        ) : null}
      </div>
      <SearchableMultiSelectMenu
        title={title}
        placeholder={placeholder}
        options={options}
        selected={selected}
        onToggle={onToggle}
        onSelectAll={(values) => {
          values.forEach((value) => {
            if (!selected.includes(value)) onToggle(value);
          });
        }}
        contentClassName="md:max-w-[520px]"
      />
    </div>
  );
}

function WorkflowCompactLevelDropdown({
  title,
  placeholder,
  options,
  value,
  onSelect,
  onClear,
}: {
  title: string;
  placeholder: string;
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  onClear?: () => void;
}) {
  return (
    <div className="w-[84px] shrink-0 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          {title} ({options.length})
        </Label>
        {value && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
            aria-label={`Clear ${title.toLowerCase()}`}
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-10 w-full justify-between rounded-lg border-slate-200 bg-white px-3 text-left text-[12px] font-medium hover:border-slate-300",
              value ? "border-blue-200 bg-blue-50/40 text-blue-800" : "text-slate-700",
            )}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[84px] border border-slate-200 bg-white p-2 shadow-[0_16px_34px_rgba(15,23,42,0.12)]"
        >
          {options.map((option) => (
            <DropdownMenuItem
              key={option}
              onSelect={() => onSelect(option)}
              className="justify-center text-[13px]"
            >
              {option}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function WorkflowSingleSelectDropdown({
  title,
  placeholder,
  options,
  value,
  onChange,
  onClear,
}: {
  title: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          {title} ({options.length})
        </Label>
        {value && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600 transition hover:text-blue-700"
          >
            Clear
          </button>
        ) : null}
      </div>
      <SearchableSingleSelectMenu
        title={title}
        placeholder={placeholder}
        options={options}
        value={value || null}
        onChange={onChange}
        contentClassName="min-w-[260px]"
      />
    </div>
  );
}
