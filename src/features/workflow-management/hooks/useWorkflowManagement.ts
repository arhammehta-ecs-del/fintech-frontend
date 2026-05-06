import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { fetchWorkflows, updateWorkflowAction } from "@/services/workflow.service";
import type { WorkflowPageSize, WorkflowRecord, WorkflowStatus } from "@/features/workflow-management/types/workflow.types";
import { WORKFLOW_PAGE_SIZE_OPTIONS } from "@/features/workflow-management/types/workflow.types";
import { mapWorkflowRecord } from "@/features/workflow-management/utils/workflowRecord.utils";

export function useWorkflowManagement() {
  const { toast } = useToast();
  const [activeStatus, setActiveStatus] = useState<WorkflowStatus>("Active");
  const [search, setSearch] = useState("");
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
    if (!workflow.id) {
      console.error("Missing workflow id for action:", workflow);
      return;
    }
    try {
      await updateWorkflowAction(workflow.id, action, remark);
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

  const filteredWorkflows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return workflows.filter((workflow) => {
      if (workflow.status !== activeStatus) return false;
      if (!query) return true;
      return [workflow.name, workflow.alias, workflow.module, workflow.nodeName, workflow.nodeType]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [activeStatus, search, workflows]);

  const statusCounts = useMemo(
    () =>
      workflows.reduce(
        (counts, workflow) => {
          if (workflow.status === "Active") counts.active += 1;
          if (workflow.status === "Pending") counts.pending += 1;
          return counts;
        },
        { active: 0, pending: 0 },
      ),
    [workflows],
  );

  useEffect(() => {
    if (activeStatus === "Pending" && statusCounts.pending === 0) {
      setActiveStatus("Active");
    }
  }, [activeStatus, statusCounts.pending]);

  useEffect(() => {
    setPage(1);
  }, [activeStatus, search, pageSize]);

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
    addDialogOpen,
    setAddDialogOpen,
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
