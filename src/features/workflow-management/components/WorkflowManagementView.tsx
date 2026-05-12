import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Filter, Plus, Search, Settings, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import WorkflowOnboardingView from "@/features/workflow-management/components/WorkflowOnboardingView";
import WorkflowHistorySidebar from "./WorkflowHistorySidebar";
import { History } from "lucide-react";
import WorkflowManageDialog from "./WorkflowManageDialog";
import type { WorkflowPageSize } from "@/features/workflow-management/types/workflow.types";
import { useWorkflowManagement } from "@/features/workflow-management/hooks/useWorkflowManagement";
import { cn } from "@/lib/utils";
import { getWorkflowPathPreview } from "@/features/workflow-management/utils/workflowRecord.utils";

const tabClassName =
  "rounded-full px-5 py-2 text-sm font-semibold transition-all data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm";

const statusBadgeClassName: Record<string, string> = {
  Active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  Inactive: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function WorkflowManagementView() {
  const {
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
  const activeFilterCount =
    workflowFilters.length + aliasFilters.length + moduleFilters.length + nodeNameFilters.length + typeFilters.length;
  const hasAnyFilter = activeFilterCount > 0;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [manageHistoryOpen, setManageHistoryOpen] = useState(false);
  const [shellOffset, setShellOffset] = useState({ top: 56, left: 0 });
  const [viewportWidth, setViewportWidth] = useState(0);
  const [draftWorkflowFilters, setDraftWorkflowFilters] = useState<string[]>(workflowFilters);
  const [draftAliasFilters, setDraftAliasFilters] = useState<string[]>(aliasFilters);
  const [draftModuleFilters, setDraftModuleFilters] = useState<string[]>(moduleFilters);
  const [draftNodeNameFilters, setDraftNodeNameFilters] = useState<string[]>(nodeNameFilters);
  const [draftTypeFilters, setDraftTypeFilters] = useState<string[]>(typeFilters);

  const toggleValue = (current: string[], value: string) =>
    current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

  const syncDraftFromApplied = () => {
    setDraftWorkflowFilters(workflowFilters);
    setDraftAliasFilters(aliasFilters);
    setDraftModuleFilters(moduleFilters);
    setDraftNodeNameFilters(nodeNameFilters);
    setDraftTypeFilters(typeFilters);
  };

  const clearDraftFilters = () => {
    setDraftWorkflowFilters([]);
    setDraftAliasFilters([]);
    setDraftModuleFilters([]);
    setDraftNodeNameFilters([]);
    setDraftTypeFilters([]);
  };

  useEffect(() => {
    if (!manageWorkflow) {
      setManageHistoryOpen(false);
    }
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

  const availableContentWidth = Math.max(0, viewportWidth - shellOffset.left);
  const MIN_DIALOG_SPLIT_WIDTH = 860;
  const MIN_HISTORY_WIDTH = 420;
  const MAX_HISTORY_WIDTH = 560;
  const computedHistoryPanelWidth = Math.max(
    MIN_HISTORY_WIDTH,
    Math.min(MAX_HISTORY_WIDTH, availableContentWidth - MIN_DIALOG_SPLIT_WIDTH),
  );
  const canUseSplitManageHistory =
    manageWorkflow?.status === "Pending" &&
    manageHistoryOpen &&
    availableContentWidth >= MIN_DIALOG_SPLIT_WIDTH + MIN_HISTORY_WIDTH;
  const splitWorkflowDockOffset = canUseSplitManageHistory
    ? { top: shellOffset.top, left: shellOffset.left }
    : shellOffset;

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

            <Popover
              open={filtersOpen}
              onOpenChange={(nextOpen) => {
                if (nextOpen) syncDraftFromApplied();
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
                        {hasAnyFilter ? `${activeFilterCount} filters applied` : "No filters applied"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-lg px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      onClick={clearDraftFilters}
                    >
                      Clear all
                    </Button>
                  </div>
                </div>

                <div className="max-h-[62vh] space-y-3.5 overflow-y-auto bg-white px-5 py-3.5">
                  <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/45 p-3 shadow-[0_2px_8px_rgba(148,163,184,0.1)]">
                    <p className="border-b border-slate-200 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      Workflow Filters
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <WorkflowFilterDropdown
                        title="Workflow"
                        placeholder="All workflows"
                        options={workflowOptions}
                        selected={draftWorkflowFilters}
                        onToggle={(value) => setDraftWorkflowFilters((current) => toggleValue(current, value))}
                      />
                      <WorkflowFilterDropdown
                        title="Alias"
                        placeholder="All aliases"
                        options={aliasOptions}
                        selected={draftAliasFilters}
                        onToggle={(value) => setDraftAliasFilters((current) => toggleValue(current, value))}
                      />
                      <WorkflowFilterDropdown
                        title="Module"
                        placeholder="All modules"
                        options={moduleOptions}
                        selected={draftModuleFilters}
                        onToggle={(value) => setDraftModuleFilters((current) => toggleValue(current, value))}
                      />
                      <WorkflowFilterDropdown
                        title="Node Name"
                        placeholder="All node names"
                        options={nodeNameOptions}
                        selected={draftNodeNameFilters}
                        onToggle={(value) => setDraftNodeNameFilters((current) => toggleValue(current, value))}
                      />
                      <div className="md:col-span-2">
                        <WorkflowFilterDropdown
                          title="Type"
                          placeholder="All types"
                          options={typeOptions}
                          selected={draftTypeFilters}
                          onToggle={(value) => setDraftTypeFilters((current) => toggleValue(current, value))}
                        />
                      </div>
                    </div>
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
                      setWorkflowFilters(draftWorkflowFilters);
                      setAliasFilters(draftAliasFilters);
                      setModuleFilters(draftModuleFilters);
                      setNodeNameFilters(draftNodeNameFilters);
                      setTypeFilters(draftTypeFilters);
                      if (
                        draftWorkflowFilters.length === 0 &&
                        draftAliasFilters.length === 0 &&
                        draftModuleFilters.length === 0 &&
                        draftNodeNameFilters.length === 0 &&
                        draftTypeFilters.length === 0
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
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <h3 className="text-xl font-semibold text-slate-800">
            {activeStatus} Workflows ({filteredWorkflows.length})
          </h3>
          <Button className="w-full lg:w-auto" onClick={() => void handleOpenAddWorkflowDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Workflow
          </Button>
        </div>

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
                  <div className="min-w-0 text-sm text-slate-700">
                    <p className="truncate text-sm text-slate-700">{workflow.nodeName || "—"}</p>
                    {workflow.nodePath ? (() => {
                      const pathPreview = getWorkflowPathPreview(workflow.nodePath, 3);
                      return pathPreview ? (
                        <p className="mt-1 inline-flex max-w-full truncate rounded-md border border-sky-100 bg-sky-50/70 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.02em] text-sky-700">
                          {pathPreview}
                        </p>
                      ) : null;
                    })() : null}
                  </div>
                  <div className="text-sm text-slate-700">{workflow.nodeType}</div>
                  <div>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                        statusBadgeClassName[workflow.status] ?? "border-slate-200 bg-slate-50 text-slate-700",
                      )}
                    >
                      {workflow.status}
                    </span>
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
      {manageWorkflow && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[49] bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
              style={
                canUseSplitManageHistory
                  ? {
                      top: `${shellOffset.top}px`,
                      left: `${shellOffset.left}px`,
                      width: `calc(100vw - ${shellOffset.left}px - ${computedHistoryPanelWidth}px)`,
                      height: `calc(100vh - ${shellOffset.top}px)`,
                    }
                  : {
                      top: "0px",
                      left: "0px",
                      width: "100vw",
                      height: "100vh",
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
            return;
          }
          setHistoryWorkflow(null);
        }}
        workflow={manageHistoryOpen ? manageWorkflow : historyWorkflow}
        dockOffset={canUseSplitManageHistory ? splitWorkflowDockOffset : shellOffset}
        splitView={canUseSplitManageHistory}
        panelWidth={computedHistoryPanelWidth}
      />
      <WorkflowManageDialog
        open={!!manageWorkflow}
        workflow={manageWorkflow}
        onClose={() => {
          setManageHistoryOpen(false);
          setManageWorkflow(null);
        }}
        onSubmitAction={handleWorkflowAction}
        onToggleHistory={manageWorkflow?.status === "Pending" ? () => setManageHistoryOpen((current) => !current) : undefined}
        isHistoryOpen={canUseSplitManageHistory}
        overlayClassName="hidden"
        contentClassName={
          canUseSplitManageHistory
            ? "flex h-full max-h-none w-auto max-w-none flex-col overflow-hidden rounded-none p-0"
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
              }
            : undefined
        }
      />
    </div>
  );
}

function WorkflowFilterDropdown({
  title,
  placeholder,
  options,
  selected,
  onToggle,
}: {
  title: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const summaryLabel = selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</Label>
      <DropdownMenu
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setSearchTerm("");
            setIsSearchExpanded(false);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-10 w-full justify-between rounded-lg border-slate-200 bg-white px-3 text-left text-[12px] font-medium hover:border-slate-300",
              selected.length > 0 ? "border-blue-200 bg-blue-50/40 text-blue-800" : "text-slate-700",
            )}
          >
            <span className="truncate">{summaryLabel}</span>
            <span className="ml-2 inline-flex items-center gap-1.5">
              {selected.length > 0 ? (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  {selected.length}
                </span>
              ) : null}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[260px] border border-slate-200 bg-white p-2 shadow-[0_16px_34px_rgba(15,23,42,0.12)]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="mt-1 flex items-center justify-between gap-2 px-1">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{title}</div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                if (isSearchExpanded) {
                  setSearchTerm("");
                  setIsSearchExpanded(false);
                  return;
                }
                setIsSearchExpanded(true);
              }}
              className="h-9 w-9 rounded-lg border-slate-200 bg-slate-50 text-slate-600 shadow-none hover:border-slate-300 hover:bg-white"
              aria-label={isSearchExpanded ? `Close ${title.toLowerCase()} search` : `Open ${title.toLowerCase()} search`}
            >
              {isSearchExpanded ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <div
            className={cn(
              "overflow-hidden px-1 transition-all duration-250 ease-out",
              isSearchExpanded ? "mt-2 max-h-12 opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Escape") {
                    setSearchTerm("");
                    setIsSearchExpanded(false);
                  }
                }}
                placeholder={`Search ${title.toLowerCase()}...`}
                className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] shadow-none"
                autoComplete="off"
                autoFocus={isSearchExpanded}
              />
            </div>
          </div>
          {filteredOptions.length === 0 ? (
            <div className="px-2 py-2 text-[12px] text-slate-400">No options available</div>
          ) : (
            <div className="mt-2 max-h-56 overflow-y-auto">
              {filteredOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option}
                  checked={selected.includes(option)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={() => onToggle(option)}
                  className="text-[13px]"
                >
                  {option}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
