import { ChevronLeft, ChevronRight, Plus, Search, Settings, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import WorkflowOnboardingView from "@/features/workflow-management/components/WorkflowOnboardingView";
import WorkflowHistorySidebar from "./WorkflowHistorySidebar";
import { History } from "lucide-react";
import WorkflowManageDialog from "./WorkflowManageDialog";
import type { WorkflowPageSize } from "@/features/workflow-management/types/workflow.types";
import { useWorkflowManagement } from "@/features/workflow-management/hooks/useWorkflowManagement";
import { cn } from "@/lib/utils";

const tabClassName =
  "rounded-full px-5 py-2 text-sm font-semibold transition-all data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm";

export default function WorkflowManagementView() {
  const {
    WORKFLOW_PAGE_SIZE_OPTIONS,
    activeStatus,
    setActiveStatus,
    search,
    setSearch,
    addDialogOpen,
    setAddDialogOpen,
    pageSize,
    setPageSize,
    setPage,
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
  } = useWorkflowManagement();

  const visibleTabs = [
    { id: "Active" as const, label: "Active", count: statusCounts.active },
    ...(statusCounts.pending > 0 ? [{ id: "Pending" as const, label: "Pending", count: statusCounts.pending }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl xl:max-w-2xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by workflow, alias, module, or node name..."
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
                        activeStatus === tab.id ? "bg-white/15 text-white ring-1 ring-white/20" : "bg-white text-slate-500 border border-slate-200",
                      )}
                    >
                      {tab.count}
                    </span>
                  </span>
                </button>
              ))}
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
            <div className="grid grid-cols-1 gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.75fr)_minmax(110px,0.55fr)_minmax(96px,0.45fr)] md:items-center md:gap-x-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Workflow</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Alias</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Module</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Node Name</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Type</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Status</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 md:text-center">Manage</div>
            </div>

            <div className="divide-y divide-slate-100">
              {paginatedWorkflows.map((workflow) => (
                <div key={workflow.id} className="grid grid-cols-1 gap-2 p-4 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.75fr)_minmax(110px,0.55fr)_minmax(96px,0.45fr)] md:items-center md:gap-x-4">
                  <div className="text-sm font-semibold text-slate-800">{workflow.name}</div>
                  <div className="text-sm text-slate-700">{workflow.alias}</div>
                  <div className="text-sm text-slate-700">{workflow.module}</div>
                  <div className="text-sm text-slate-700">{workflow.nodeName}</div>
                  <div className="text-sm text-slate-700">{workflow.nodeType}</div>
                  <div>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      {workflow.status}
                    </span>
                  </div>
                  <div className="flex md:justify-center">
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
            <WorkflowOnboardingView
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
