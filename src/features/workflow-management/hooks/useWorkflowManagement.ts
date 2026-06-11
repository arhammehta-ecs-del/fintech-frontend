import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { connectNotificationStream } from "@/services/notification.service";
import {
  createWorkflow,
  fetchWorkflowFilterDropdowns,
  fetchWorkflowsPaginated,
  updateWorkflowAction,
  type WorkflowAppliedFilters,
} from "@/services/workflow.service";
import { fetchCompanyNodes } from "@/services/user.service";
import { fetchCompanyNodesWithAccess } from "@/services/user.service";
import type { WorkflowPageSize, WorkflowRecord, WorkflowStatus } from "@/features/workflow-management/types/workflow.types";
import { WORKFLOW_PAGE_SIZE_OPTIONS } from "@/features/workflow-management/types/workflow.types";
import { mapWorkflowRecord } from "@/features/workflow-management/utils/workflowRecord.utils";

const WORKFLOW_SEARCH_DEBOUNCE_MS = 500;
const APPROVER_FILTER_OPTIONS = ["Reporting Manager", "Node Approver", "Hierarchy Approver"] as const;
const WORKFLOW_LEVEL_FILTER_OPTIONS = ["1", "2", "3", "4", "5"] as const;
const LINKED_ORG_STRUCTURE_OPTIONS = ["Yes", "No"] as const;

const fuzzyMatch = (text: string, query: string) => {
  const source = text.trim().toLowerCase().replace(/\s+/g, "");
  const target = query.trim().toLowerCase().replace(/\s+/g, "");
  if (!target) return true;
  if (source.includes(target)) return true;
  let index = 0;
  for (const ch of source) {
    if (ch === target[index]) index += 1;
    if (index === target.length) return true;
  }
  return false;
};

const toApiToken = (value: string) => value.trim().replace(/\s+/g, "_").toUpperCase();
const normalizeFilterValue = (value: string) => value.trim().toLowerCase().replace(/[_\s]+/g, " ");

const buildWorkflowAppliedFilters = (input: {
  nodeNameFilters: string[];
  nodeTypeFilters: string[];
  moduleFilters: string[];
  workflowLevelFilters: string[];
  approverTypeFilters: string[];
  linkedOrgStructureFilters: string[];
}): WorkflowAppliedFilters | null => {
  const workflowLevels = Number(input.workflowLevelFilters[0] ?? 0) || null;
  const approverType = input.approverTypeFilters.length > 0 ? input.approverTypeFilters : null;
  const levels =
    approverType && approverType.length > 0
      ? approverType.map((entry, index) => ({
        count: index + 1,
        approverType: entry,
      }))
      : null;

  const hasAnyFilter =
    input.nodeNameFilters.length > 0 ||
    input.nodeTypeFilters.length > 0 ||
    input.moduleFilters.length > 0 ||
    input.workflowLevelFilters.length > 0 ||
    input.approverTypeFilters.length > 0 ||
    input.linkedOrgStructureFilters.length > 0;

  if (!hasAnyFilter) return null;

  return {
    nodeName: input.nodeNameFilters.length > 0 ? { values: input.nodeNameFilters } : null,
    nodeType: input.nodeTypeFilters.length > 0 ? input.nodeTypeFilters : null,
    workflowType: null,
    module: input.moduleFilters.length > 0 ? input.moduleFilters.map(toApiToken) : null,
    subModule: input.moduleFilters.length > 0 ? input.moduleFilters.map(toApiToken) : null,
    workflowLevels,
    levels,
    approverType,
    onboardingDate: null,
    hasLinkedOrg: (input.linkedOrgStructureFilters[0] as "Yes" | "No" | undefined) ?? null,
  };
};

export function useWorkflowManagement() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const isFetchingRef = useRef(false);
  const [activeStatus, setActiveStatus] = useState<WorkflowStatus>("Active");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [moduleFilters, setModuleFilters] = useState<string[]>([]);
  const [nodeNameFilters, setNodeNameFilters] = useState<string[]>([]);
  const [nodeTypeFilters, setNodeTypeFilters] = useState<string[]>([]);
  const [workflowLevelFilters, setWorkflowLevelFilters] = useState<string[]>([]);
  const [approverTypeFilters, setApproverTypeFilters] = useState<string[]>([]);
  const [linkedOrgStructureFilters, setLinkedOrgStructureFilters] = useState<string[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<WorkflowPageSize>(15);
  const [resolvedTotalPages, setResolvedTotalPages] = useState(1);
  const [topCursor, setTopCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [pageCursors, setPageCursors] = useState<Record<number, string | null>>({ 1: null });
  const [statusCounts, setStatusCounts] = useState({ active: 0, pending: 0, inactive: 0 });
  const [historyWorkflow, setHistoryWorkflow] = useState<WorkflowRecord | null>(null);
  const [manageWorkflow, setManageWorkflow] = useState<WorkflowRecord | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [hasNewWorkflowEvent, setHasNewWorkflowEvent] = useState(false);
  const [hasLoadedWorkflowsOnce, setHasLoadedWorkflowsOnce] = useState(false);
  const [filterNodeNameOptions, setFilterNodeNameOptions] = useState<Array<{ value: string; label: string; path: string; description?: string }>>([]);
  const [filterNodeTypeOptions, setFilterNodeTypeOptions] = useState<Array<{ value: string; label: string; count?: number; description?: string }>>([]);
  const [filterModuleOptions, setFilterModuleOptions] = useState<Array<{ value: string; label: string; description?: string }>>([]);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [isFilterRequestActive, setIsFilterRequestActive] = useState(false);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) {
      setDebouncedSearch("");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(trimmedSearch);
    }, WORKFLOW_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const appliedFilters = useMemo(
    () =>
      buildWorkflowAppliedFilters({
        nodeNameFilters,
        nodeTypeFilters,
        moduleFilters,
        workflowLevelFilters,
        approverTypeFilters,
        linkedOrgStructureFilters,
      }),
    [approverTypeFilters, linkedOrgStructureFilters, moduleFilters, nodeNameFilters, nodeTypeFilters, workflowLevelFilters],
  );

  const fetchPage = useCallback(
    async (
      params: {
        cursor: string | null;
        topCursor: string | null;
        page: number | null;
        direction: "NEXT" | "PREV";
        targetPage: number;
      },
      showLoader = false,
    ) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (showLoader) setPage(params.targetPage);
      try {
        const type = activeStatus === "Pending" ? "pending" : activeStatus === "Inactive" ? "inactive" : "active";
        const response = await fetchWorkflowsPaginated(type, {
          filter: isFilterRequestActive,
          applied: appliedFilters,
          limit: pageSize,
          cursor: params.cursor,
          topCursor: params.topCursor,
          page: params.page,
          direction: params.direction,
          query: debouncedSearch || null,
        });
        const mapped = response.rows.map((row) => mapWorkflowRecord(row, activeStatus));
        setWorkflows(mapped);
        setHasLoadedWorkflowsOnce(true);
        setStatusCounts(response.counts);
        setPage(params.targetPage);
        setTopCursor(response.pageInfo.topCursor || params.topCursor || null);
        setNextCursor(response.pageInfo.nextCursor);
        setHasNext(response.pageInfo.hasNext);
        setPageCursors((current) => ({
          ...current,
          [params.targetPage]: params.cursor,
          [params.targetPage + 1]: response.pageInfo.nextCursor,
        }));
        const targetCount =
          activeStatus === "Pending"
            ? response.counts.pending
            : activeStatus === "Inactive"
              ? response.counts.inactive
              : response.counts.active;
        const fallbackTotalPages = Math.max(1, Math.ceil((targetCount || mapped.length) / pageSize));
        setResolvedTotalPages(Math.max(response.pageInfo.totalPages || 0, fallbackTotalPages));
      } finally {
        isFetchingRef.current = false;
      }
    },
    [activeStatus, appliedFilters, debouncedSearch, isFilterRequestActive, pageSize],
  );

  const loadWorkflows = useCallback(async () => {
    setPageCursors({ 1: null });
    setTopCursor(null);
    setNextCursor(null);
    setHasNext(false);
    await fetchPage({
      cursor: null,
      topCursor: null,
      page: null,
      direction: "NEXT",
      targetPage: 1,
    }, true);
  }, [fetchPage]);

  useEffect(() => {
    const disconnect = connectNotificationStream({
      onNotification: (packet) => {
        const refType = String(packet.refType ?? "").trim().toLowerCase();
        if (refType === "workflow") {
          setHasNewWorkflowEvent(true);
        }
      },
    });

    return disconnect;
  }, []);

  const handleWorkflowAction = async (workflow: WorkflowRecord, action: "approve" | "reject", remark: string) => {
    const levelsHash = workflow.levelsHash?.trim() || workflow.workflowId?.trim() || workflow.id?.trim();
    if (!levelsHash) {
      return;
    }
    try {
      await updateWorkflowAction(levelsHash, action, remark);
      await loadWorkflows();
    } catch (error) {
      toast({
        title: action === "approve" ? "Approval failed" : "Rejection failed",
        description: getApiErrorMessage(error, "Unable to update workflow request."),
        variant: "destructive",
      });
      throw error;
    }
  };

  const requestStatusWorkflowOptions = async (workflow: WorkflowRecord) => {
    const selectedNodePath = (workflow.nodePath || "").trim().toUpperCase();
    const nodes = await fetchCompanyNodes("WORK_FLOW");
    const options = nodes
      .flatMap((item) =>
        item.workflows.filter((entry) => {
          const nodePath = (item.nodePath || "").trim().toUpperCase();
          if (selectedNodePath && nodePath === selectedNodePath) return true;
          const alias = (entry.alias || "").trim().toUpperCase();
          return Boolean(alias && alias.endsWith("D"));
        }),
      )
      .map((entry) => {
        const id = (entry.levelsHash || "").trim();
        const name = (entry.name || "").trim();
        const alias = (entry.alias || "").trim();
        if (!id || !name) return null;
        return { id, label: alias ? `${name} (${alias})` : name };
      })
      .filter((item): item is { id: string; label: string } => Boolean(item));
    return Array.from(new Map(options.map((option) => [option.id, option])).values());
  };

  const submitWorkflowStatusUpdate = async (input: {
    workflow: WorkflowRecord;
    nextStatus: "active" | "inactive";
    remark: string;
    levelsHash: string | null;
  }) => {
    const target = {
      module: (input.workflow.rawModule || input.workflow.module || "").trim(),
      subModule: (input.workflow.subModule || "").trim(),
      nodePath: (input.workflow.nodePath || "").trim(),
      levelsHash: (input.workflow.levelsHash || "").trim(),
    };
    try {
      await createWorkflow({
        type: input.nextStatus,
        target,
        remarks: input.remark.trim(),
        levelsHash: input.levelsHash?.trim() || null,
      });
      await loadWorkflows();
    } catch (error) {
      toast({
        title: "Unable to update workflow status",
        description: getApiErrorMessage(error, "Failed to update workflow status."),
        variant: "destructive",
      });
      throw error;
    }
  };

  const submitWorkflowArchiveRequest = async (input: {
    workflow: WorkflowRecord;
    remark: string;
    levelsHash: string | null;
  }) => {
    const target = {
      module: (input.workflow.rawModule || input.workflow.module || "").trim(),
      subModule: (input.workflow.subModule || "").trim(),
      nodePath: (input.workflow.nodePath || "").trim(),
      levelsHash: (input.workflow.levelsHash || input.workflow.workflowId || input.workflow.id || "").trim(),
    };
    try {
      await createWorkflow({
        type: "archive",
        target,
        levelsHash: input.levelsHash?.trim() || null,
        remarks: input.remark.trim(),
      });
      await loadWorkflows();
      toast({
        title: "Delete initiated",
        description: "Delete workflow request has been submitted.",
      });
    } catch (error) {
      toast({
        title: "Unable to delete workflow",
        description: getApiErrorMessage(error, "Failed to submit workflow delete request."),
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleOpenAddWorkflowDialog = async () => {
    try {
      await fetchCompanyNodesWithAccess("WORK_FLOW");
      setAddDialogOpen(true);
    } catch (error) {
      setAddDialogOpen(false);
      toast({
        title: "Access denied",
        description: getApiErrorMessage(error, "You do not have permission to initiate WORK_FLOW."),
        variant: "destructive",
      });
    }
  };

  const loadWorkflowFilterOptions = useCallback(async () => {
    setIsFilterLoading(true);
    try {
      const dropdowns = await fetchWorkflowFilterDropdowns();
      setFilterNodeNameOptions(dropdowns.nodeName);
      setFilterNodeTypeOptions(dropdowns.nodeType);
      setFilterModuleOptions(dropdowns.module);
    } catch (error) {
      toast({
        title: "Unable to load workflow filters",
        description: getApiErrorMessage(error, "Failed to load workflow filter dropdowns."),
        variant: "destructive",
      });
    } finally {
      setIsFilterLoading(false);
    }
  }, [toast]);

  const statusScopedWorkflows = useMemo(() => workflows, [workflows]);

  const moduleOptions = useMemo(
    () =>
      Array.from(
        new Map(
          [...filterModuleOptions, ...workflows.map((workflow) => workflow.module).filter(Boolean).map((value) => ({ value, label: value }))]
            .map((option) => [normalizeFilterValue(option.value), option]),
        ).values(),
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [filterModuleOptions, workflows],
  );
  const nodeNameOptions = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...filterNodeNameOptions,
            ...workflows.map((workflow) => workflow.nodeName).filter(Boolean).map((value) => ({ value, label: value, path: "", description: undefined })),
          ].map((option) => [normalizeFilterValue(option.value), option]),
        ).values(),
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [filterNodeNameOptions, workflows],
  );
  const nodeTypeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...filterNodeTypeOptions,
            ...workflows.map((workflow) => workflow.nodeType).filter(Boolean).map((value) => ({ value, label: value, description: undefined })),
          ].map((option) => [normalizeFilterValue(option.value), option]),
        ).values(),
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [filterNodeTypeOptions, workflows],
  );

  const searchSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const values = new Set<string>();
    workflows.forEach((workflow) => {
      [workflow.name, workflow.alias, workflow.module].forEach((field) => {
        if (field && fuzzyMatch(field, q)) values.add(field);
      });
    });
    return Array.from(values).slice(0, 8);
  }, [search, workflows]);

  const clearColumnFilters = () => {
    setModuleFilters([]);
    setNodeNameFilters([]);
    setNodeTypeFilters([]);
    setWorkflowLevelFilters([]);
    setApproverTypeFilters([]);
    setLinkedOrgStructureFilters([]);
    setIsFilterRequestActive(false);
  };

  const getWorkflowLevelCount = (levels: unknown) => {
    if (Array.isArray(levels)) {
      return levels.filter((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const record = entry as Record<string, unknown>;
        return readString(record.approver1) || readString(record.approver2);
      }).length;
    }

    if (!levels || typeof levels !== "object") return 0;

    return Object.values(levels as Record<string, unknown>).filter((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const record = entry as Record<string, unknown>;
      return readString(record.approver1) || readString(record.approver2);
    }).length;
  };
  const getWorkflowApproverTypes = (levels: unknown) => {
    const labels = new Set<string>();
    const collectApprover = (value: unknown) => {
      const normalized = readString(value).toUpperCase();
      if (normalized === "REPORTING_MANAGER") labels.add("Reporting Manager");
      if (normalized === "NODE_APPROVER") labels.add("Node Approver");
      if (normalized === "HIERARCHY_APPROVER") labels.add("Hierarchy Approver");
    };

    const entries = Array.isArray(levels)
      ? levels
      : levels && typeof levels === "object"
        ? Object.values(levels as Record<string, unknown>)
        : [];

    entries.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const record = entry as Record<string, unknown>;
      collectApprover(record.approver1);
      collectApprover(record.approver2);
    });

    return labels;
  };

  const filteredWorkflows = useMemo(() => {
    if (isFilterRequestActive) {
      return workflows;
    }

    return workflows.filter((workflow) => {
      const workflowModuleValues = [workflow.module, workflow.rawModule].map(normalizeFilterValue).filter(Boolean);
      const workflowApproverTypes = getWorkflowApproverTypes(workflow.levels);
      const workflowLevelCount = String(getWorkflowLevelCount(workflow.levels));
      const hasLinkedOrgStructure =
        (Array.isArray(workflow.linkedOrgStructure) && workflow.linkedOrgStructure.length > 0) ||
        (Array.isArray(workflow.autoGenerated) && workflow.autoGenerated.length > 0);
      const matchesNodeName =
        nodeNameFilters.length === 0 ||
        nodeNameFilters.some((selected) => normalizeFilterValue(selected) === normalizeFilterValue(workflow.nodeName));
      const matchesNodeType =
        nodeTypeFilters.length === 0 ||
        nodeTypeFilters.some((selected) => normalizeFilterValue(selected) === normalizeFilterValue(workflow.nodeType));
      const matchesModule =
        moduleFilters.length === 0 ||
        moduleFilters.some((selected) => workflowModuleValues.includes(normalizeFilterValue(selected)));
      const matchesWorkflowLevels = workflowLevelFilters.length === 0 || workflowLevelFilters.includes(workflowLevelCount);
      const matchesApproverType =
        approverTypeFilters.length === 0 || approverTypeFilters.some((selected) => workflowApproverTypes.has(selected));
      const matchesLinkedOrgStructure =
        linkedOrgStructureFilters.length === 0 ||
        linkedOrgStructureFilters.some((selected) => (selected === "Yes" ? hasLinkedOrgStructure : !hasLinkedOrgStructure));
      return matchesNodeName && matchesNodeType && matchesModule && matchesWorkflowLevels && matchesApproverType && matchesLinkedOrgStructure;
    });
  }, [approverTypeFilters, isFilterRequestActive, linkedOrgStructureFilters, moduleFilters, nodeNameFilters, nodeTypeFilters, workflowLevelFilters, workflows]);

  useEffect(() => {
    if (!hasLoadedWorkflowsOnce) return;

    const currentCount =
      activeStatus === "Pending"
        ? statusCounts.pending
        : activeStatus === "Inactive"
          ? statusCounts.inactive
          : statusCounts.active;
    if (currentCount > 0) return;

    const fallbackStatus: WorkflowStatus =
      statusCounts.active > 0
        ? "Active"
        : statusCounts.pending > 0
          ? "Pending"
          : statusCounts.inactive > 0
            ? "Inactive"
            : "Active";
    if (fallbackStatus !== activeStatus) {
      setActiveStatus(fallbackStatus);
    }
  }, [activeStatus, hasLoadedWorkflowsOnce, statusCounts.active, statusCounts.pending, statusCounts.inactive]);

  useEffect(() => {
    let isMounted = true;
    const safeLoadWorkflows = async () => {
      try {
        setPageCursors({ 1: null });
        setTopCursor(null);
        setNextCursor(null);
        setHasNext(false);
        await fetchPage({
          cursor: null,
          topCursor: null,
          page: null,
          direction: "NEXT",
          targetPage: 1,
        }, true);
      } catch (error) {
        if (!isMounted) return;
        toastRef.current({
          title: "Unable to load workflows",
          description: getApiErrorMessage(error, "Failed to fetch workflows."),
          variant: "destructive",
        });
      }
    };
    void safeLoadWorkflows();
    return () => {
      isMounted = false;
    };
  }, [activeStatus, debouncedSearch, pageSize, fetchPage, appliedFilters, isFilterRequestActive]);

  const totalPages = Math.max(1, resolvedTotalPages);
  const safePage = page;
  const paginatedWorkflows = filteredWorkflows;

  const handlePrevPage = useCallback(async () => {
    if (page <= 1) return;
    const previousPage = page - 1;
    const prevCursor = pageCursors[previousPage] ?? null;
    try {
      await fetchPage({
        cursor: prevCursor,
        topCursor,
        page: null,
        direction: "PREV",
        targetPage: previousPage,
      }, true);
    } catch (error) {
      toast({
        title: "Unable to load previous page",
        description: getApiErrorMessage(error, "Unable to fetch previous workflows page."),
        variant: "destructive",
      });
    }
  }, [fetchPage, page, pageCursors, toast, topCursor]);

  const handleNextPage = useCallback(async () => {
    if (!hasNext) return;
    const upcomingPage = page + 1;
    const cursor = pageCursors[upcomingPage] ?? nextCursor;
    if (!cursor) return;

    try {
      await fetchPage({
        cursor,
        topCursor,
        page: null,
        direction: "NEXT",
        targetPage: upcomingPage,
      }, true);
    } catch (error) {
      toast({
        title: "Unable to load next page",
        description: getApiErrorMessage(error, "Unable to fetch next workflows page."),
        variant: "destructive",
      });
    }
  }, [fetchPage, hasNext, nextCursor, page, pageCursors, toast, topCursor]);

  const handleJumpToPage = useCallback(async (requestedPage: number) => {
    const targetPage = Math.max(1, Math.min(totalPages, requestedPage));
    if (targetPage === page) return;
    const direction: "NEXT" | "PREV" = targetPage > page ? "NEXT" : "PREV";
    const jumpCursor = pageCursors[targetPage] ?? (direction === "NEXT" ? nextCursor : topCursor) ?? null;
    try {
      await fetchPage({
        cursor: jumpCursor,
        topCursor,
        page: targetPage,
        direction,
        targetPage,
      }, true);
    } catch (error) {
      toast({
        title: "Unable to jump to page",
        description: getApiErrorMessage(error, "Unable to fetch selected workflows page."),
        variant: "destructive",
      });
    }
  }, [fetchPage, nextCursor, page, pageCursors, toast, topCursor, totalPages]);

  return {
    WORKFLOW_PAGE_SIZE_OPTIONS,
    activeStatus,
    setActiveStatus,
    search,
    setSearch,
    searchSuggestions,
    moduleFilters,
    setModuleFilters,
    nodeNameFilters,
    setNodeNameFilters,
    nodeTypeFilters,
    setNodeTypeFilters,
    workflowLevelFilters,
    setWorkflowLevelFilters,
    approverTypeFilters,
    setApproverTypeFilters,
    linkedOrgStructureFilters,
    setLinkedOrgStructureFilters,
    isFilterRequestActive,
    setIsFilterRequestActive,
    moduleOptions,
    nodeNameOptions,
    nodeTypeOptions,
    workflowLevelOptions: [...WORKFLOW_LEVEL_FILTER_OPTIONS],
    approverTypeOptions: [...APPROVER_FILTER_OPTIONS],
    linkedOrgStructureOptions: [...LINKED_ORG_STRUCTURE_OPTIONS],
    loadWorkflowFilterOptions,
    isFilterLoading,
    clearColumnFilters,
    addDialogOpen,
    setAddDialogOpen,
    handleOpenAddWorkflowDialog,
    page,
    setPage,
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
  };
}
