import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, Settings, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWorkflows, updateWorkflowAction } from "@/services/workflow.service";
import WorkflowConfigurationView from "@/features/workflow-management/components/WorkflowConfigurationView";
import WorkflowHistorySidebar from "./WorkflowHistorySidebar";
import { History } from "lucide-react";
import WorkflowManageDialog from "./WorkflowManageDialog";

type WorkflowStatus = "Active" | "Pending";

export type WorkflowRecord = {
  id: string;
  name: string;
  alias: string;
  module: string;
  department: string;
  subModule: string;
  nodePath: string;
  levels: unknown;
  approvalRemark?: string;
  status: WorkflowStatus;
};

type RawWorkflowRecord = Record<string, unknown>;

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const toRecord = (value: unknown): RawWorkflowRecord =>
  typeof value === "object" && value !== null ? (value as RawWorkflowRecord) : {};

const getNodeLabelFromPath = (nodePath: string) => {
  const segments = nodePath.split(".").map((segment) => segment.trim()).filter(Boolean);
  const last = segments[segments.length - 1] || "";
  return last
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatNodeType = (value: string) =>
  value
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const mapWorkflowRecord = (item: unknown, status: WorkflowStatus): WorkflowRecord => {
  const record = toRecord(item);
  const payload = toRecord(record.data);
  const orgStructure = toRecord(record.orgStructure);

  const id =
    readString(record.id) ||
    readString(record.workflowId) ||
    readString(record.requestId) ||
    readString(payload.id) ||
    readString(payload.workflowId);
  const name = readString(record.name) || readString(payload.name) || "Unknown";
  const alias = readString(record.alias) || readString(payload.alias) || "-";
  const moduleName = readString(record.module) || readString(payload.module) || "Unknown";
  const nodePath =
    readString(record.nodePath) ||
    readString(orgStructure.nodePath) ||
    readString(payload.nodePath);
  const subModule = readString(record.subModule) || readString(payload.subModule);
  const nodeType = readString(record.nodeType) || readString(orgStructure.nodeType) || readString(payload.nodeType);
  const department =
    readString(record.department) ||
    (nodeType ? formatNodeType(nodeType) : "") ||
    readString(orgStructure.nodeName) ||
    (nodePath ? getNodeLabelFromPath(nodePath) : subModule || "Unknown");
  const levels = record.levels ?? payload.levels ?? [];

  return {
    id,
    name,
    alias,
    module: moduleName,
    department,
    subModule,
    nodePath,
    levels,
    approvalRemark: readString(record.approvalRemark),
    status,
  };
};



const tabClassName =
  "rounded-full px-5 py-2 text-sm font-semibold transition-all data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm";
const WORKFLOW_PAGE_SIZE_OPTIONS = [10, 15, 25] as const;
type WorkflowPageSize = (typeof WORKFLOW_PAGE_SIZE_OPTIONS)[number];

export default function WorkflowManagementView() {
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
        console.error("Failed to fetch workflows:", error);
      }
    };
    void safeLoadWorkflows();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleWorkflowAction = async (workflow: WorkflowRecord, action: "approve" | "reject", remark: string) => {
    if (!workflow.id) {
      console.error("Missing workflow id for action:", workflow);
      return;
    }
    await updateWorkflowAction(workflow.id, action, remark);
    await loadWorkflows();
  };

  const filteredWorkflows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return workflows.filter((workflow) => {
      if (workflow.status !== activeStatus) return false;
      if (!query) return true;
      return [workflow.name, workflow.alias, workflow.module, workflow.department]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [activeStatus, search, workflows]);

  useEffect(() => {
    setPage(1);
  }, [activeStatus, search, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredWorkflows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedWorkflows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredWorkflows.slice(start, start + pageSize);
  }, [filteredWorkflows, safePage, pageSize]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl xl:max-w-2xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by workflow, alias, module, or department..."
              className="pl-9 pr-9"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                data-active={activeStatus === "Active"}
                className={tabClassName}
                onClick={() => setActiveStatus("Active")}
              >
                Active
              </button>
              <button
                type="button"
                data-active={activeStatus === "Pending"}
                className={tabClassName}
                onClick={() => setActiveStatus("Pending")}
              >
                Pending
              </button>
            </div>

            <Button className="w-full lg:w-auto" onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Workflow
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filteredWorkflows.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">No {activeStatus.toLowerCase()} workflows available.</div>
        ) : (
          <div>
            <div className="grid grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 md:grid-cols-6 md:items-center">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Workflow</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Alias</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Module</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Department</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 md:text-right">Status</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 text-center">Manage</div>
            </div>

            <div className="divide-y divide-slate-100">
              {paginatedWorkflows.map((workflow) => (
                <div key={workflow.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-6 md:items-center">
                  <div className="text-sm font-semibold text-slate-800">{workflow.name}</div>
                  <div className="text-sm text-slate-700">{workflow.alias}</div>
                  <div className="text-sm text-slate-700">{workflow.module}</div>
                  <div className="text-sm text-slate-700">{workflow.department}</div>
                  <div className="md:justify-self-end">
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      {workflow.status}
                    </span>
                  </div>
                  <div className="flex justify-center">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        onClick={() => setHistoryWorkflow(workflow)}
                        aria-label={`View history for ${workflow.name}`}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                        onClick={() => setManageWorkflow(workflow)}
                        aria-label={`Manage ${workflow.name}`}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {filteredWorkflows.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows/page</span>
              <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value) as WorkflowPageSize)}>
                <SelectTrigger className="h-9 w-[84px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_PAGE_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setPage((previous) => Math.max(1, previous - 1))} disabled={safePage === 1}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {safePage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                disabled={safePage === totalPages}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="flex h-[90vh] w-[min(94vw,72rem)] max-w-[72rem] flex-col gap-0 overflow-hidden rounded-lg p-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-600 p-1.5">
                <Settings className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900">Add Workflow</h2>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <WorkflowConfigurationView
              isOpen={addDialogOpen}
              onPublished={async () => {
                await loadWorkflows();
                setAddDialogOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
      <WorkflowHistorySidebar
        isOpen={!!historyWorkflow}
        onClose={() => setHistoryWorkflow(null)}
        workflow={historyWorkflow}
      />
      <WorkflowManageDialog
        open={!!manageWorkflow}
        workflow={manageWorkflow}
        onClose={() => setManageWorkflow(null)}
        onSubmitAction={handleWorkflowAction}
      />
    </div>
  );
}
