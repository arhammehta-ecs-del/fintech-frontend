import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { connectNotificationStream } from "@/services/notification.service";
import { createWorkflow, fetchWorkflowsPaginated, updateWorkflowAction } from "@/services/workflow.service";
import { fetchCompanyNodes } from "@/services/user.service";
import { fetchCompanyNodesWithAccess } from "@/services/user.service";
import type { WorkflowPageSize, WorkflowRecord, WorkflowStatus } from "@/features/workflow-management/types/workflow.types";
import { WORKFLOW_PAGE_SIZE_OPTIONS } from "@/features/workflow-management/types/workflow.types";
import { mapWorkflowRecord } from "@/features/workflow-management/utils/workflowRecord.utils";

const WORKFLOW_SEARCH_DEBOUNCE_MS = 500;

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

export function useWorkflowManagement() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const isFetchingRef = useRef(false);
  const [activeStatus, setActiveStatus] = useState<WorkflowStatus>("Active");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [workflowFilters, setWorkflowFilters] = useState<string[]>([]);
  const [aliasFilters, setAliasFilters] = useState<string[]>([]);
  const [moduleFilters, setModuleFilters] = useState<string[]>([]);
  const [nodeNameFilters, setNodeNameFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
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
          limit: pageSize,
          cursor: params.cursor,
          topCursor: params.topCursor,
          page: params.page,
          direction: params.direction,
          query: debouncedSearch || "",
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
    [activeStatus, debouncedSearch, pageSize],
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

  const statusScopedWorkflows = useMemo(() => workflows, [workflows]);

  const workflowOptions = useMemo(
    () => Array.from(new Set(workflows.map((workflow) => workflow.name).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [workflows],
  );
  const aliasOptions = useMemo(
    () => Array.from(new Set(workflows.map((workflow) => workflow.alias).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [workflows],
  );
  const moduleOptions = useMemo(
    () => Array.from(new Set(workflows.map((workflow) => workflow.module).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [workflows],
  );
  const nodeNameOptions = useMemo(
    () => Array.from(new Set(workflows.map((workflow) => workflow.nodeName).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [workflows],
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(workflows.map((workflow) => workflow.nodeType).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [workflows],
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
    setWorkflowFilters([]);
    setAliasFilters([]);
    setModuleFilters([]);
    setNodeNameFilters([]);
    setTypeFilters([]);
  };

  const filteredWorkflows = useMemo(() => {
    return workflows.filter((workflow) => {
      const matchesWorkflow = workflowFilters.length === 0 || workflowFilters.includes(workflow.name);
      const matchesAlias = aliasFilters.length === 0 || aliasFilters.includes(workflow.alias);
      const matchesModule = moduleFilters.length === 0 || moduleFilters.includes(workflow.module);
      const matchesNodeName = nodeNameFilters.length === 0 || nodeNameFilters.includes(workflow.nodeName);
      const matchesType = typeFilters.length === 0 || typeFilters.includes(workflow.nodeType);
      return matchesWorkflow && matchesAlias && matchesModule && matchesNodeName && matchesType;
    });
  }, [aliasFilters, moduleFilters, nodeNameFilters, typeFilters, workflowFilters, workflows]);

  useEffect(() => {
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
  }, [activeStatus, statusCounts.active, statusCounts.pending, statusCounts.inactive]);

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
  }, [activeStatus, debouncedSearch, pageSize, fetchPage]);

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
    workflowFilters,
    setWorkflowFilters,
    aliasFilters,
    setAliasFilters,
    moduleFilters,
    setModuleFilters,
    nodeNameFilters,
    setNodeNameFilters,
    typeFilters,
    setTypeFilters,
    workflowOptions,
    aliasOptions,
    moduleOptions,
    nodeNameOptions,
    typeOptions,
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
    hasNewWorkflowEvent,
    setHasNewWorkflowEvent,
    hasLoadedWorkflowsOnce,
  };
}
