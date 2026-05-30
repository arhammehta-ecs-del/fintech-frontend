import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BadgeCheck, Calendar, CheckCircle2, GitBranch, History, Mail, Pencil, Settings2, UserCheck, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { WorkflowRecord } from "@/features/workflow-management/types/workflow.types";
import { APPROVAL_OPTIONS } from "@/features/workflow-management/constants";
import { formatSnakeCaseLabel, isWorkflowUpdateRequest } from "@/features/workflow-management/utils/workflowRecord.utils";
import { cn } from "@/lib/utils";
import { formatToIst, SummaryPreview } from "@/features/workflow-management/components/WorkflowManageDialogSummary";

type WorkflowManageDialogProps = {
  open: boolean;
  workflow: WorkflowRecord | null;
  onClose: () => void;
  onSubmitAction: (workflow: WorkflowRecord, action: "approve" | "reject", remark: string) => Promise<void>;
  onRequestStatusWorkflowOptions?: (workflow: WorkflowRecord) => Promise<Array<{ id: string; label: string }>>;
  onSubmitStatusUpdate?: (input: {
    workflow: WorkflowRecord;
    nextStatus: "active" | "inactive";
    remark: string;
    levelsHash: string | null;
  }) => Promise<void>;
  onToggleHistory?: () => void;
  onEdit?: (workflow: WorkflowRecord) => void;
  isHistoryOpen?: boolean;
  overlayClassName?: string;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  preventOutsideClose?: boolean;
};


export default function WorkflowManageDialog({
  open,
  workflow,
  onClose,
  onSubmitAction,
  onRequestStatusWorkflowOptions,
  onSubmitStatusUpdate,
  onToggleHistory,
  onEdit,
  isHistoryOpen = false,
  overlayClassName,
  contentClassName,
  contentStyle,
  preventOutsideClose = false,
}: WorkflowManageDialogProps) {
  const toRecord = (value: unknown): Record<string, unknown> =>
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  const applyPendingDataView = (
    base: WorkflowRecord,
    source: Record<string, unknown>,
  ): WorkflowRecord => {
    const next = { ...base };
    const target = toRecord(source.target);

    if ("name" in source) next.name = readString(source.name) || next.name;
    if ("alias" in source) next.alias = readString(source.alias) || next.alias;
    if ("module" in source) next.rawModule = readString(source.module) || next.rawModule;
    if ("subModule" in source) next.subModule = readString(source.subModule) || next.subModule;
    if ("nodePath" in source) next.nodePath = readString(source.nodePath) || next.nodePath;
    if ("levels" in source) next.levels = source.levels ?? next.levels;

    if ("module" in target) next.rawModule = readString(target.module) || next.rawModule;
    if ("subModule" in target) next.subModule = readString(target.subModule) || next.subModule;
    if ("nodePath" in target) next.nodePath = readString(target.nodePath) || next.nodePath;
    if ("levelsHash" in target) next.levelsHash = readString(target.levelsHash) || next.levelsHash;

    return next;
  };

  const remarkCardRef = useRef<HTMLDivElement | null>(null);
  const remarkInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [remark, setRemark] = useState("");
  const [remarkTouched, setRemarkTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<"approve" | "reject" | null>(null);
  const [isEditTooltipOpen, setIsEditTooltipOpen] = useState(false);
  const [isHistoryTooltipOpen, setIsHistoryTooltipOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"active" | "inactive" | null>(null);
  const [statusRemark, setStatusRemark] = useState("");
  const [statusWorkflowHash, setStatusWorkflowHash] = useState("");
  const [statusWorkflowOptions, setStatusWorkflowOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [showPrevious, setShowPrevious] = useState(false);

  useEffect(() => {
    if (!open) {
      setRemark("");
      setRemarkTouched(false);
      setIsSubmitting(false);
      setPendingDecision(null);
      setIsEditTooltipOpen(false);
      setIsHistoryTooltipOpen(false);
      setPendingStatus(null);
      setStatusRemark("");
      setStatusWorkflowHash("");
      setStatusWorkflowOptions([]);
      setStatusSubmitting(false);
      setShowPrevious(false);
    }
  }, [open, workflow?.id]);

  useEffect(() => {
    if (!pendingDecision) return;
    requestAnimationFrame(() => {
      remarkCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      remarkInputRef.current?.focus();
    });
  }, [pendingDecision]);

  const displayWorkflow = useMemo(() => {
    if (!workflow) return null;
    const pendingOldData = toRecord(workflow.pendingOldData);
    const pendingNewData = toRecord(workflow.pendingNewData);
    const hasPendingDataDiff = Object.keys(pendingOldData).length > 0 || Object.keys(pendingNewData).length > 0;
    const isUpdateRequest = isWorkflowUpdateRequest(workflow) || hasPendingDataDiff;
    if (!isUpdateRequest) return workflow;
    const source = showPrevious ? pendingOldData : pendingNewData;
    if (!Object.keys(source).length) return workflow;
    return applyPendingDataView(workflow, source);
  }, [showPrevious, workflow]);
  if (!workflow || !displayWorkflow) return null;
  const pendingOldData = toRecord(workflow.pendingOldData);
  const pendingNewData = toRecord(workflow.pendingNewData);
  const hasPendingDataDiff = Object.keys(pendingOldData).length > 0 || Object.keys(pendingNewData).length > 0;
  const isUpdateRequest = isWorkflowUpdateRequest(workflow) || hasPendingDataDiff;
  const normalizedRequestImpact = (workflow.pendingRequestImpact || "").trim().toUpperCase();
  const isInactiveImpact = normalizedRequestImpact === "INACTIVE";
  const canTogglePreviousUpdated = isUpdateRequest && !isInactiveImpact;
  const impactBadgeMap: Record<string, string> = {
    ARCHIVE: "border-rose-200 bg-rose-100 text-rose-700",
    INACTIVE: "border-amber-200 bg-amber-100 text-amber-700",
    ACTIVE: "border-emerald-200 bg-emerald-100 text-emerald-700",
    DOWNGRADE: "border-rose-200 bg-rose-100 text-rose-700",
    UPGRADE: "border-emerald-200 bg-emerald-100 text-emerald-700",
    WORKFLOW_UPDATE: "border-sky-200 bg-sky-100 text-sky-700",
    RMUPDATED: "border-sky-200 bg-sky-100 text-sky-700",
    PROFILE_UPDATE: "border-sky-200 bg-sky-100 text-sky-700",
  };
  const hasImpactBadge = Boolean(normalizedRequestImpact);
  const impactBadgeCls = impactBadgeMap[normalizedRequestImpact] || "border-slate-200 bg-slate-100 text-slate-700";
  const impactBadgeLabel = formatSnakeCaseLabel(normalizedRequestImpact || "");

  const isPending = workflow.status === "Pending" || isUpdateRequest;
  const currentWorkflowStatus = workflow.status === "Inactive" ? "inactive" : "active";
  const isRemarkValid = Boolean(remark.trim());
  const showRemarkError = remarkTouched && !isRemarkValid;
  const initiatorName = workflow.initiatorName?.trim() || "";
  const initiatorEmail = workflow.initiatorEmail?.trim() || "";
  const initiatedOn = formatToIst(workflow.initiatedDate);
  const pendingWorkflowName = workflow.workflowName?.trim() || "";
  const pendingWorkflowAlias = workflow.workflowAlias?.trim() || "";

  const handleStartPendingAction = (action: "approve" | "reject") => {
    setPendingDecision(action);
    setRemarkTouched(false);
  };

  const handleClosePendingAction = () => {
    setPendingDecision(null);
    setRemark("");
    setRemarkTouched(false);
  };

  const handleSubmitPendingAction = async () => {
    setRemarkTouched(true);
    if (!isRemarkValid || !pendingDecision) return;
    setIsSubmitting(true);
    try {
      await onSubmitAction(workflow, pendingDecision, remark.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusToggle = async (nextStatus: "active" | "inactive") => {
    if (!onSubmitStatusUpdate || !onRequestStatusWorkflowOptions) return;
    const currentStatus = (pendingStatus ?? (workflow.status === "Inactive" ? "inactive" : "active"));
    const resolvedNextStatus =
      workflow.status === "Inactive" && nextStatus === "inactive" && currentStatus === "inactive"
        ? "active"
        : nextStatus;
    setPendingStatus(resolvedNextStatus);
    setStatusRemark("");
    setStatusWorkflowHash("");
    try {
      const options = await onRequestStatusWorkflowOptions(workflow);
      setStatusWorkflowOptions(options);
    } catch {
      setStatusWorkflowOptions([]);
    }
  };

  const handleSubmitStatusUpdate = async () => {
    if (!onSubmitStatusUpdate || !pendingStatus || !statusRemark.trim()) return;
    setStatusSubmitting(true);
    try {
      await onSubmitStatusUpdate({
        workflow,
        nextStatus: pendingStatus,
        remark: statusRemark.trim(),
        levelsHash: statusWorkflowHash.trim() || null,
      });
      onClose();
    } finally {
      setStatusSubmitting(false);
    }
  };

  return (
    <Dialog modal={false} open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName={overlayClassName}
        onInteractOutside={(event) => {
          if (preventOutsideClose) {
            event.preventDefault();
          }
        }}
        className={cn("flex max-h-[88vh] w-[min(96vw,56rem)] max-w-[56rem] flex-col overflow-hidden p-0", contentClassName)}
        style={contentStyle}
      >
        <DialogDescription className="sr-only">
          Review workflow details, approval chain, history, and submit approve or reject actions.
        </DialogDescription>
        <DialogHeader className="border-b border-slate-200 bg-slate-50/40 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <DialogTitle className="text-xl text-slate-900">{displayWorkflow.name}</DialogTitle>
              </div>
              {isPending ? (
                <div className="mt-3 min-w-0 overflow-x-hidden rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2">
                  <div className="space-y-2 text-[12px]">
                    <div>
                      <div className="min-w-0 flex flex-nowrap items-center gap-2 overflow-hidden">
                        {initiatorName ? (
                          <span className="inline-flex min-w-0 shrink items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 text-slate-600 ring-1 ring-slate-200/70">
                            <UserCheck size={12} className="text-slate-400" />
                            <span className="shrink-0 text-slate-500">By</span>
                            <span className="truncate font-medium text-slate-700">{initiatorName}</span>
                          </span>
                        ) : null}
                        {initiatorEmail ? (
                          <span className="inline-flex min-w-0 shrink items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 text-slate-600 ring-1 ring-slate-200/70">
                            <Mail size={12} className="text-slate-400" />
                            <span className="shrink-0 text-slate-500">Email</span>
                            <span className="truncate font-medium text-slate-700">{initiatorEmail}</span>
                          </span>
                        ) : null}
                        {initiatedOn ? (
                          <span className="inline-flex min-w-0 shrink items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 text-slate-600 ring-1 ring-slate-200/70">
                            <Calendar size={12} className="text-slate-400" />
                            <span className="shrink-0 text-slate-500">Initiated</span>
                            <span className="truncate font-medium text-slate-700">{initiatedOn}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <div className="min-w-0 flex flex-nowrap items-center gap-2 overflow-hidden">
                        {pendingWorkflowName ? (
                          <span className="inline-flex min-w-0 shrink items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 text-slate-600 ring-1 ring-slate-200/70">
                            <span className="shrink-0 text-slate-500">Workflow</span>
                            <span className="truncate font-medium text-slate-700">{pendingWorkflowName}</span>
                          </span>
                        ) : null}
                        {pendingWorkflowAlias ? (
                          <span className="inline-flex min-w-0 shrink items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 text-slate-600 ring-1 ring-slate-200/70">
                            <span className="shrink-0 text-slate-500">Alias</span>
                            <span className="truncate font-medium text-slate-700">{pendingWorkflowAlias}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {hasImpactBadge ? (
                <span
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-xs font-bold uppercase tracking-wide",
                    impactBadgeCls,
                  )}
                >
                  {impactBadgeLabel}
                </span>
              ) : null}
              {isPending && onToggleHistory ? (
                <TooltipProvider delayDuration={120}>
                  <Tooltip open={isHistoryTooltipOpen}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={onToggleHistory}
                        onMouseEnter={() => setIsHistoryTooltipOpen(true)}
                        onMouseLeave={() => setIsHistoryTooltipOpen(false)}
                        onFocus={() => setIsHistoryTooltipOpen(false)}
                        onBlur={() => setIsHistoryTooltipOpen(false)}
                        className={cn(
                          "inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white transition",
                          isHistoryOpen
                            ? "border-[rgb(53,83,233)] bg-[rgb(53,83,233)] text-white shadow-[0_4px_12px_rgba(53,83,233,0.24)]"
                            : "text-slate-500 hover:bg-slate-50",
                        )}
                        aria-label={isHistoryOpen ? "Close workflow history" : "Open workflow history"}
                        aria-pressed={isHistoryOpen}
                      >
                        <History className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Workflow History</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              {onEdit && !isPending && workflow.status !== "Inactive" ? (
                <TooltipProvider delayDuration={120}>
                  <Tooltip open={isEditTooltipOpen}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onEdit(workflow)}
                        onMouseEnter={() => setIsEditTooltipOpen(true)}
                        onMouseLeave={() => setIsEditTooltipOpen(false)}
                        onFocus={() => setIsEditTooltipOpen(false)}
                        onBlur={() => setIsEditTooltipOpen(false)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                        aria-label="Edit workflow"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Edit</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              {!isPending && onSubmitStatusUpdate ? (
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      currentWorkflowStatus === "active"
                        ? "bg-[#3553e9] text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100",
                    )}
                    onClick={() => void handleStatusToggle("active")}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      currentWorkflowStatus === "inactive"
                        ? "bg-[#3553e9] text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100",
                    )}
                    onClick={() => void handleStatusToggle("inactive")}
                  >
                    Inactive
                  </button>
                </div>
              ) : null}
              {canTogglePreviousUpdated ? (
                <button
                  type="button"
                  onClick={() => setShowPrevious((current) => !current)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                    showPrevious
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-emerald-300 bg-emerald-50 text-emerald-700",
                  )}
                >
                  {showPrevious ? "Updated" : "Previous"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                aria-label="Close manage dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <SummaryPreview workflow={displayWorkflow} />

          {!isPending && pendingStatus && onSubmitStatusUpdate ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                {pendingStatus === "inactive" ? "Submit Inactive Request" : "Submit Active Request"}
              </div>
              <div className="space-y-3">
                <Textarea
                  value={statusRemark}
                  onChange={(event) => setStatusRemark(event.target.value)}
                  placeholder="Add remark"
                  maxLength={250}
                  className="h-11 min-h-0 resize-none"
                />
              </div>
            </div>
          ) : null}

          {isPending && pendingDecision ? (
            <div ref={remarkCardRef} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <GitBranch className="h-4 w-4" />
                {pendingDecision === "approve" ? "Approve Remark" : "Reject Remark"}
              </div>
              <Textarea
                ref={remarkInputRef}
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                onBlur={() => setRemarkTouched(true)}
                maxLength={100}
                placeholder={`Enter remark for ${pendingDecision === "approve" ? "approval" : "rejection"}`}
                className="h-11 min-h-0 resize-none"
              />
              {showRemarkError ? <p className="mt-2 text-xs text-rose-600">Please enter a remark.</p> : null}
              <div className="mt-1 text-right text-[11px] text-slate-500">{remark.length}/100</div>
            </div>
          ) : null}
        </div>

        <div className="flex w-full items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/40 px-6 py-4">
          {isPending ? (
            pendingDecision === "approve" ? (
              <>
                <Button variant="outline" onClick={handleClosePendingAction} disabled={isSubmitting}>
                  Close
                </Button>
                <Button
                  className="rounded-full px-6 bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => void handleSubmitPendingAction()}
                  disabled={!isRemarkValid || isSubmitting}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </>
            ) : pendingDecision === "reject" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => void handleSubmitPendingAction()}
                  disabled={!isRemarkValid || isSubmitting}
                  className="rounded-full px-6 border-red-600 bg-red-600 text-white hover:bg-red-700 hover:text-white"
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button variant="outline" onClick={handleClosePendingAction} disabled={isSubmitting}>
                  Close
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => handleStartPendingAction("reject")} className="rounded-full px-6">
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button className="rounded-full px-6 bg-[#3553E9] text-white hover:bg-[#2f49cf]" onClick={() => handleStartPendingAction("approve")}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </>
            )
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={isSubmitting || statusSubmitting}>
                Close
              </Button>
              {pendingStatus && onSubmitStatusUpdate ? (
                <>
                  <Select
                    value={statusWorkflowHash || "__none__"}
                    onValueChange={(value) => setStatusWorkflowHash(value === "__none__" ? "" : value)}
                  >
                    <SelectTrigger className="h-10 min-w-[16rem]">
                      <SelectValue placeholder="Select workflow" />
                    </SelectTrigger>
                    <SelectContent side="top">
                      <SelectItem value="__none__">No Workflow</SelectItem>
                      {statusWorkflowOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="rounded-full px-6 bg-[#3553E9] text-white hover:bg-[#2f49cf]"
                    onClick={() => void handleSubmitStatusUpdate()}
                    disabled={!statusRemark.trim() || statusSubmitting}
                  >
                    {pendingStatus === "inactive" ? "Set Inactive" : "Set Active"}
                  </Button>
                </>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
