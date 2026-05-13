import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { fetchWorkflows, updateWorkflowAction } from "@/services/workflow.service";
import type { WorkflowPageSize, WorkflowRecord, WorkflowStatus } from "@/features/workflow-management/types/workflow.types";
import { WORKFLOW_PAGE_SIZE_OPTIONS } from "@/features/workflow-management/types/workflow.types";
import { mapWorkflowRecord } from "@/features/workflow-management/utils/workflowRecord.utils";

const normalizeLoose = (value: string) => value.toLowerCase().trim().replace(/\s+/g, " ");
const extractDigits = (value: string) => value.match(/\d+/g) ?? [];
const splitAlphaNumericTokens = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);

const isWithinTwoEdits = (left: string, right: string) => {
  if (!left || !right) return false;
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  const aLen = a.length;
  const bLen = b.length;
  if (Math.abs(aLen - bLen) > 2) return false;

  const prev = Array.from({ length: bLen + 1 }, (_, idx) => idx);
  for (let i = 1; i <= aLen; i += 1) {
    let diagonal = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= bLen; j += 1) {
      const temp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diagonal + cost,
      );
      diagonal = temp;
      if (prev[j] < rowMin) rowMin = prev[j];
    }
    if (rowMin > 2) return false;
  }
  return prev[bLen] <= 2;
};

export function useWorkflowManagement() {
  const { toast } = useToast();
  const [activeStatus, setActiveStatus] = useState<WorkflowStatus>("Active");
  const [search, setSearch] = useState("");
  const [workflowFilters, setWorkflowFilters] = useState<string[]>([]);
  const [aliasFilters, setAliasFilters] = useState<string[]>([]);
  const [moduleFilters, setModuleFilters] = useState<string[]>([]);
  const [nodeNameFilters, setNodeNameFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<WorkflowPageSize>(15);
  const [historyWorkflow, setHistoryWorkflow] = useState<WorkflowRecord | null>(null);
  const [manageWorkflow, setManageWorkflow] = useState<WorkflowRecord | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);

  const loadWorkflows = async () => {
    const response = await fetchWorkflows();
    if (!response?.data) return;

    const activeWorkflows = Array.isArray(response.data.active)
      ? response.data.active.map((w: unknown) => mapWorkflowRecord(w, "Active"))
      : [];

    const pendingWorkflows = Array.isArray(response.data.pending)
      ? response.data.pending.map((w: unknown) => mapWorkflowRecord(w, "Pending"))
      : [];

    setWorkflows([...activeWorkflows, ...pendingWorkflows]);
  };

  useEffect(() => {
    let isMounted = true;
    const safeLoadWorkflows = async () => {
      try {
        await loadWorkflows();
      } catch (error) {
        if (!isMounted) return;
        toast({
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
  }, [toast]);

  const handleWorkflowAction = async (workflow: WorkflowRecord, action: "approve" | "reject", remark: string) => {
    const levelsHash = workflow.levelsHash?.trim() || workflow.workflowId?.trim() || workflow.id?.trim();
    if (!levelsHash) {
      console.error("Missing workflow levels hash for action:", workflow);
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

  const handleOpenAddWorkflowDialog = () => {
    setAddDialogOpen(true);
  };

  const statusScopedWorkflows = useMemo(
    () => workflows.filter((workflow) => workflow.status === activeStatus),
    [activeStatus, workflows],
  );

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

  const clearColumnFilters = () => {
    setWorkflowFilters([]);
    setAliasFilters([]);
    setModuleFilters([]);
    setNodeNameFilters([]);
    setTypeFilters([]);
  };

  const baseFilteredWorkflows = useMemo(() => {
    const query = normalizeLoose(search);
    const queryTokens = splitAlphaNumericTokens(query).filter((token) => token.length >= 3);
    const queryDigits = extractDigits(query);
    return workflows.filter((workflow) => {
      const matchesWorkflow = workflowFilters.length === 0 || workflowFilters.includes(workflow.name);
      const matchesAlias = aliasFilters.length === 0 || aliasFilters.includes(workflow.alias);
      const matchesModule = moduleFilters.length === 0 || moduleFilters.includes(workflow.module);
      const matchesNodeName = nodeNameFilters.length === 0 || nodeNameFilters.includes(workflow.nodeName);
      const matchesType = typeFilters.length === 0 || typeFilters.includes(workflow.nodeType);
      if (!(matchesWorkflow && matchesAlias && matchesModule && matchesNodeName && matchesType)) return false;
      if (!query) return true;

      const rawFields = [workflow.name, workflow.alias, workflow.module, workflow.nodeName];
      const normalizedFields = rawFields.map((field) => normalizeLoose(field));
      const candidateDigits = extractDigits(normalizedFields.join(" "));
      const hasAllDigits =
        queryDigits.length === 0 || queryDigits.every((digit) => candidateDigits.includes(digit));
      if (!hasAllDigits) return false;

      const directMatch = normalizedFields.some((field) => field.includes(query));
      if (directMatch) return true;

      if (queryTokens.length === 0) return false;
      const candidateTokens = splitAlphaNumericTokens(normalizedFields.join(" "));
      return queryTokens.every((queryToken) =>
        candidateTokens.some((candidateToken) => isWithinTwoEdits(queryToken, candidateToken)),
      );
    });
  }, [aliasFilters, moduleFilters, nodeNameFilters, search, typeFilters, workflowFilters, workflows]);

  const filteredWorkflows = useMemo(
    () => baseFilteredWorkflows.filter((workflow) => workflow.status === activeStatus),
    [baseFilteredWorkflows, activeStatus],
  );

  const statusCounts = useMemo(
    () =>
      baseFilteredWorkflows.reduce(
        (counts, workflow) => {
          if (workflow.status === "Active") counts.active += 1;
          if (workflow.status === "Pending") counts.pending += 1;
          return counts;
        },
        { active: 0, pending: 0 },
      ),
    [baseFilteredWorkflows],
  );

  useEffect(() => {
    if (activeStatus === "Pending" && statusCounts.pending === 0) {
      setActiveStatus("Active");
    }
  }, [activeStatus, statusCounts.pending]);

  useEffect(() => {
    if (activeStatus === "Active" && statusCounts.active === 0 && statusCounts.pending > 0) {
      setActiveStatus("Pending");
      return;
    }
    if (activeStatus === "Pending" && statusCounts.pending === 0 && statusCounts.active > 0) {
      setActiveStatus("Active");
    }
  }, [activeStatus, statusCounts.active, statusCounts.pending]);

  useEffect(() => {
    setPage(1);
  }, [activeStatus, search, pageSize, workflowFilters, aliasFilters, moduleFilters, nodeNameFilters, typeFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredWorkflows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedWorkflows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredWorkflows.slice(start, start + pageSize);
  }, [filteredWorkflows, safePage, pageSize]);

  return {
    WORKFLOW_PAGE_SIZE_OPTIONS,
    activeStatus,
    setActiveStatus,
    search,
    setSearch,
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
    handleWorkflowAction,
  };
}
