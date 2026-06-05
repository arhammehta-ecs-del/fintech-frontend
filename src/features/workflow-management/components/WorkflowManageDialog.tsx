import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BadgeCheck, Calendar, CheckCircle2, GitBranch, History, Mail, Pencil, Settings2, Trash2, UserCheck, X } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import type { HistoryDetailViewModel } from "@/components/HistoryDetailDialog";

type WorkflowManageDialogProps = {
  open: boolean;
  workflow: WorkflowRecord | null;
  currentTab?: "Active" | "Pending" | "Inactive";
  onClose: () => void;
  onSubmitAction: (workflow: WorkflowRecord, action: "approve" | "reject", remark: string) => Promise<void>;
  onRequestStatusWorkflowOptions?: (workflow: WorkflowRecord) => Promise<Array<{ id: string; label: string }>>;
  onSubmitStatusUpdate?: (input: {
    workflow: WorkflowRecord;
    nextStatus: "active" | "inactive";
    remark: string;
    levelsHash: string | null;
  }) => Promise<void>;
  onDeleteRequestStart?: (workflow: WorkflowRecord) => Promise<void> | void;
  showDeleteActions?: boolean;
  deleteRemark?: string;
  deleteRemarkPlaceholder?: string;
  deleteRemarkError?: string;
  deleteWorkflow?: string;
  deleteWorkflowOptions?: Array<{ id: string; label: string }>;
  onDeleteWorkflowChange?: (value: string) => void;
  onDeleteRemarkChange?: (value: string) => void;
  onConfirmDelete?: (workflow: WorkflowRecord) => void;
  onCancelDeleteActions?: () => void;
  onToggleHistory?: () => void;
  onEdit?: (workflow: WorkflowRecord) => void;
  isHistoryOpen?: boolean;
  overlayClassName?: string;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  preventOutsideClose?: boolean;
  historyDetailOverride?: HistoryDetailViewModel | null;
  initialAction?: "delete" | null;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const toNestedHistoryRecord = (
  source: Record<string, unknown>,
  keys: string[],
) => {
  for (const key of keys) {
    const candidate = toRecord(source[key]);
    if (Object.keys(candidate).length > 0) {
      return candidate;
    }
  }
  return {} as Record<string, unknown>;
};

const toHistoryWorkflowSource = (detail: HistoryDetailViewModel | null) => {
  if (!detail) return {} as Record<string, unknown>;
  if (detail.mode === "comparison") return toRecord(detail.newData);
  if (detail.mode === "single") {
    const nested = toNestedHistoryRecord(detail.record, ["newData", "currentData", "pendingNewData"]);
    return Object.keys(nested).length > 0 ? nested : toRecord(detail.record);
  }
  return {} as Record<string, unknown>;
};

const toHistoryWorkflowPreviousSource = (detail: HistoryDetailViewModel | null) => {
  if (!detail) return {} as Record<string, unknown>;
  if (detail.mode === "comparison") return toRecord(detail.oldData);
  if (detail.mode === "single") {
    return toNestedHistoryRecord(detail.record, ["oldData", "previousData", "pendingOldData"]);
  }
  return {} as Record<string, unknown>;
};

const mergeWorkflowLevels = (baseLevels: unknown, incomingLevels: unknown) => {
  const baseRecord =
    typeof baseLevels === "object" && baseLevels !== null && !Array.isArray(baseLevels)
      ? (baseLevels as Record<string, unknown>)
      : {};
  const incomingRecord =
    typeof incomingLevels === "object" && incomingLevels !== null && !Array.isArray(incomingLevels)
      ? (incomingLevels as Record<string, unknown>)
      : null;

  if (!incomingRecord) {
    return incomingLevels ?? baseLevels;
  }

  return Object.entries(incomingRecord).reduce<Record<string, unknown>>((merged, [levelKey, incomingValue]) => {
    const baseLevel =
      typeof merged[levelKey] === "object" && merged[levelKey] !== null && !Array.isArray(merged[levelKey])
        ? (merged[levelKey] as Record<string, unknown>)
        : {};
    const incomingLevel =
      typeof incomingValue === "object" && incomingValue !== null && !Array.isArray(incomingValue)
        ? (incomingValue as Record<string, unknown>)
        : null;

    merged[levelKey] = incomingLevel ? { ...baseLevel, ...incomingLevel } : incomingValue;
    return merged;
  }, { ...baseRecord });
};

const applyPendingDataView = (
  base: WorkflowRecord,
  source: Record<string, unknown>,
): WorkflowRecord => {
  const next = { ...base };
  const target = toRecord(source.target);
  const statusRaw = readString(source.status).toUpperCase();
  const workflowTypeRaw = readString(source.workflowType);
  const levelsHashRaw = readString(source.levelsHash);
  const nodePathRaw = readString(source.nodePath);

  if ("name" in source) next.name = readString(source.name) || next.name;
  if ("alias" in source) next.alias = readString(source.alias) || next.alias;
  if ("module" in source) next.rawModule = readString(source.module) || next.rawModule;
  if ("subModule" in source) next.subModule = readString(source.subModule) || next.subModule;
  if ("workflowType" in source) next.workflowType = workflowTypeRaw || next.workflowType;
  if ("nodePath" in source) next.nodePath = nodePathRaw || next.nodePath;
  if ("levels" in source) next.levels = mergeWorkflowLevels(next.levels, source.levels);
  if ("levelsHash" in source) next.levelsHash = levelsHashRaw || next.levelsHash;
  if (statusRaw === "ACTIVE") next.status = "Active";
  if (statusRaw === "INACTIVE") next.status = "Inactive";
  if (statusRaw === "PENDING") next.status = "Pending";

  if ("module" in target) next.rawModule = readString(target.module) || next.rawModule;
  if ("subModule" in target) next.subModule = readString(target.subModule) || next.subModule;
  if ("nodePath" in target) next.nodePath = readString(target.nodePath) || next.nodePath;
  if ("levelsHash" in target) next.levelsHash = readString(target.levelsHash) || next.levelsHash;

  if (next.subModule || next.rawModule) {
    next.module = formatSnakeCaseLabel(next.subModule || next.rawModule || next.module || "");
  }

  return next;
};


export default function WorkflowManageDialog({
  open,
  workflow,
  currentTab = "Active",
  onClose,
  onSubmitAction,
  onRequestStatusWorkflowOptions,
  onSubmitStatusUpdate,
  onDeleteRequestStart,
  showDeleteActions = false,
  deleteRemark = "",
  deleteRemarkPlaceholder = "Enter remark",
  deleteRemarkError = "",
  deleteWorkflow = "__none__",
  deleteWorkflowOptions = [],
  onDeleteWorkflowChange,
  onDeleteRemarkChange,
  onConfirmDelete,
  onCancelDeleteActions,
  onToggleHistory,
  onEdit,
  isHistoryOpen = false,
  overlayClassName,
  contentClassName,
  contentStyle,
  preventOutsideClose = false,
  historyDetailOverride = null,
  initialAction = null,
}: WorkflowManageDialogProps) {
  const { toast } = useToast();

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
    }
  }, [open, workflow?.id]);

  useEffect(() => {
    if (!pendingDecision) return;
    requestAnimationFrame(() => {
      remarkCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      remarkInputRef.current?.focus();
    });
  }, [pendingDecision]);

  useEffect(() => {
    if (!open || !workflow || initialAction !== "delete" || showDeleteActions || workflow.status === "Inactive") return;
    void onDeleteRequestStart?.(workflow);
  }, [initialAction, onDeleteRequestStart, open, showDeleteActions, workflow]);

  const isHistoryPreviewActive = Boolean(historyDetailOverride);
  const historyOldData = toHistoryWorkflowPreviousSource(historyDetailOverride);
  const historyNewData = toHistoryWorkflowSource(historyDetailOverride);
  const displayWorkflow = useMemo(() => {
    if (!workflow) return null;
    const pendingOldData = isHistoryPreviewActive ? historyOldData : toRecord(workflow.pendingOldData);
    const pendingNewData = isHistoryPreviewActive ? historyNewData : toRecord(workflow.pendingNewData);
    const hasPendingDataDiff = Object.keys(pendingOldData).length > 0 || Object.keys(pendingNewData).length > 0;
    const isUpdateRequest = isHistoryPreviewActive
      ? historyDetailOverride?.mode === "comparison"
      : isWorkflowUpdateRequest(workflow) || hasPendingDataDiff;
    if (!isUpdateRequest) {
      if (isHistoryPreviewActive && Object.keys(pendingNewData).length > 0) {
        return applyPendingDataView(workflow, pendingNewData);
      }
      return workflow;
    }
    if (isHistoryPreviewActive && Object.keys(pendingOldData).length > 0) {
      const historyBase = applyPendingDataView(workflow, pendingOldData);
      if (Object.keys(pendingNewData).length > 0) {
        return applyPendingDataView(historyBase, pendingNewData);
      }
      return historyBase;
    }
    const source = pendingNewData;
    if (!Object.keys(source).length) {
      if (isHistoryPreviewActive && Object.keys(pendingOldData).length > 0) {
        return applyPendingDataView(workflow, pendingOldData);
      }
      return workflow;
    }
    return applyPendingDataView(workflow, source);
  }, [workflow, isHistoryPreviewActive, historyOldData, historyNewData, historyDetailOverride?.mode]);
  const previousWorkflow = useMemo(() => {
    if (!workflow) return null;
    const pendingOldData = isHistoryPreviewActive ? historyOldData : toRecord(workflow.pendingOldData);
    if (!Object.keys(pendingOldData).length) return null;
    return applyPendingDataView(workflow, pendingOldData);
  }, [workflow, isHistoryPreviewActive, historyOldData]);
  if (!workflow || !displayWorkflow) return null;
  const pendingOldData = isHistoryPreviewActive ? historyOldData : toRecord(workflow.pendingOldData);
  const pendingNewData = isHistoryPreviewActive ? historyNewData : toRecord(workflow.pendingNewData);
  const hasPendingDataDiff = Object.keys(pendingOldData).length > 0 || Object.keys(pendingNewData).length > 0;
  const isUpdateRequest = isHistoryPreviewActive
    ? historyDetailOverride?.mode === "comparison"
    : isWorkflowUpdateRequest(workflow) || hasPendingDataDiff;
  const isPending = workflow.status === "Pending" || isUpdateRequest || Boolean(workflow.isPending);
  const normalizedRequestImpact = (workflow.pendingRequestImpact || "").trim().toUpperCase();
  const normalizedRequestType = isHistoryPreviewActive
    ? historyDetailOverride?.mode === "comparison"
      ? "UPDATE"
      : "INITIATE"
    : (workflow.pendingRequestType || "").trim().toUpperCase();
  const pendingNewBasicDetails = toRecord(pendingNewData.basicDetails);
  const normalizedRequestStatus = (
    readString(pendingNewBasicDetails.status) ||
    readString(pendingNewData.status) ||
    readString(pendingNewData.type)
  ).toUpperCase();
  const isInactiveImpact = normalizedRequestImpact === "INACTIVE";
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
  const hiddenImpactTokens = new Set(["", "NO_ISSUES", "NO ISSUES", "NONE", "NA", "N/A"]);
  const canShowPendingActions = isPending && currentTab === "Pending" && !isHistoryPreviewActive;
  const isManageActionLocked = !canShowPendingActions && (Boolean(workflow.isPending) || isUpdateRequest);
  const isPendingInactiveRequest =
    canShowPendingActions && (
      normalizedRequestType === "INACTIVE" ||
      normalizedRequestStatus === "INACTIVE" ||
      normalizedRequestImpact === "INACTIVE"
    );
  const isPendingActiveRequest =
    canShowPendingActions && (
      normalizedRequestType === "ACTIVE" ||
      normalizedRequestStatus === "ACTIVE" ||
      normalizedRequestImpact === "ACTIVE"
    );
  const isPendingUpdateRequest = canShowPendingActions && normalizedRequestType === "UPDATE";
  const pendingApprovalLabel = isPendingActiveRequest
    ? "Re-activation Approval"
    : isPendingInactiveRequest
      ? "Deactivation Approval"
      : isPendingUpdateRequest
        ? "Edit Request Approval"
        : "";
  const formattedImpactLabel = hiddenImpactTokens.has(normalizedRequestImpact)
    ? ""
    : formatSnakeCaseLabel(normalizedRequestImpact || "");
  const hasImpactBadge = Boolean(pendingApprovalLabel) || !hiddenImpactTokens.has(normalizedRequestImpact);
  const impactBadgeCls = pendingApprovalLabel
    ? "border-amber-200 bg-amber-100 text-amber-700"
    : impactBadgeMap[normalizedRequestImpact] || "border-slate-200 bg-slate-100 text-slate-700";
  const impactBadgeLabel = pendingApprovalLabel
    ? formattedImpactLabel
      ? `${pendingApprovalLabel} - ${formattedImpactLabel}`
      : pendingApprovalLabel
    : formattedImpactLabel;

  const currentWorkflowStatus = workflow.status === "Inactive" ? "inactive" : "active";
  const canDeleteWorkflow = workflow.status !== "Pending" && workflow.status !== "Inactive";
  const isRemarkValid = Boolean(remark.trim());
  const showRemarkError = remarkTouched && !isRemarkValid;
  const initiatorName = workflow.initiatorName?.trim() || "";
  const initiatorEmail = workflow.initiatorEmail?.trim() || "";
  const initiatedOn = formatToIst(workflow.initiatedDate);
  const pendingWorkflowName = workflow.workflowName?.trim() || "";
  const pendingWorkflowAlias = workflow.workflowAlias?.trim() || "";
  const historyPreviewEvent = historyDetailOverride?.previewEvent;
  const displayTitle =
    (
      (previousWorkflow?.name && isUpdateRequest ? previousWorkflow.name : "") ||
      pendingWorkflowName ||
      displayWorkflow.name
    ).trim();
  const getHistoryEventTone = (action: string, fallbackStatus?: "pending" | "approved") => {
    const normalized = action.trim().toLowerCase();
    if (normalized.includes("reject")) return "rejected" as const;
    if (normalized.includes("inactive") || normalized.includes("archive")) return "inactive" as const;
    if (
      normalized.includes("modify") ||
      normalized.includes("update") ||
      normalized.includes("edit")
    ) {
      return "modified" as const;
    }
    if (normalized.includes("initiate")) return "initiation" as const;
    if (normalized.includes("pending")) return "pending" as const;
    if (normalized.includes("approve") || normalized.includes("active")) return "approved" as const;
    return fallbackStatus === "pending" ? "pending" : "approved";
  };
  const historyEventTone = historyPreviewEvent ? getHistoryEventTone(historyPreviewEvent.action, historyPreviewEvent.status) : null;
  const historyEventStripClassName =
    historyEventTone === "pending"
      ? "border-amber-200/50 bg-amber-50 text-amber-700"
      : historyEventTone === "initiation"
        ? "border-sky-200/60 bg-sky-50 text-sky-700"
    : historyEventTone === "modified"
      ? "border-orange-200/60 bg-orange-50 text-orange-700"
      : historyEventTone === "rejected"
        ? "border-rose-200/50 bg-rose-50 text-rose-700"
        : historyEventTone === "inactive"
          ? "border-rose-200/50 bg-rose-50 text-rose-700"
          : "border-emerald-200/50 bg-emerald-50 text-emerald-700";
  const HistoryEventIcon = historyEventTone === "pending"
    ? Calendar
    : historyEventTone === "initiation" || historyEventTone === "modified"
      ? History
      : historyEventTone === "rejected"
        ? X
        : BadgeCheck;

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
    try {
      const options = await onRequestStatusWorkflowOptions(workflow);
      setPendingStatus(resolvedNextStatus);
      setStatusRemark("");
      setStatusWorkflowHash("");
      setStatusWorkflowOptions(options);
    } catch (error) {
      setStatusWorkflowOptions([]);
      toast({
        title: "Edit unavailable",
        description: error instanceof Error ? error.message : "Unable to lock workflow for edit.",
        variant: "destructive",
      });
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
                <DialogTitle className="text-xl text-slate-900">{displayTitle}</DialogTitle>
                {historyPreviewEvent ? (
                  <span className={cn("inline-flex items-center gap-1.5 rounded border px-2 py-1", historyEventStripClassName)}>
                    <HistoryEventIcon className="h-3 w-3" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">{historyPreviewEvent.action}</span>
                    {historyPreviewEvent.levelCount ? (
                      <span className={cn("inline-flex h-4 min-w-4 items-center justify-center rounded-sm border px-1 text-[9px] font-bold leading-none", historyEventStripClassName)}>
                        {historyPreviewEvent.levelCount}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </div>
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
              {onToggleHistory ? (
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
              {onEdit && !isHistoryPreviewActive && workflow.status === "Active" ? (
                <TooltipProvider delayDuration={120}>
                  <Tooltip open={isEditTooltipOpen}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={isManageActionLocked}
                        onClick={() => {
                          if (isManageActionLocked) return;
                          onEdit(workflow);
                        }}
                        onMouseEnter={() => setIsEditTooltipOpen(true)}
                        onMouseLeave={() => setIsEditTooltipOpen(false)}
                        onFocus={() => setIsEditTooltipOpen(false)}
                        onBlur={() => setIsEditTooltipOpen(false)}
                        className={cn(
                          "inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50",
                          "disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-40",
                        )}
                        aria-label="Edit workflow"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Edit</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              {!isHistoryPreviewActive && canDeleteWorkflow && onConfirmDelete ? (
                <TooltipProvider delayDuration={120}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={isManageActionLocked}
                        onClick={() => {
                          if (isManageActionLocked) return;
                          void onDeleteRequestStart?.(workflow);
                        }}
                        className={cn(
                          "inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-500 transition hover:bg-rose-100",
                          "disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-40",
                        )}
                        aria-label="Delete workflow"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Delete</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              {!isHistoryPreviewActive && workflow.status !== "Pending" && onSubmitStatusUpdate ? (
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    disabled={isManageActionLocked}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      currentWorkflowStatus === "active"
                        ? "bg-[#3553e9] text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100",
                      "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-40",
                    )}
                    onClick={() => {
                      if (isManageActionLocked) return;
                      void handleStatusToggle("active");
                    }}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    disabled={isManageActionLocked}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      currentWorkflowStatus === "inactive"
                        ? "bg-[#3553e9] text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100",
                      "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-40",
                    )}
                    onClick={() => {
                      if (isManageActionLocked) return;
                      void handleStatusToggle("inactive");
                    }}
                  >
                    Inactive
                  </button>
                </div>
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
          {canShowPendingActions ? (
            <div className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2">
              <div className="space-y-2 text-[12px]">
                <div className="flex w-full flex-wrap items-center gap-2">
                  {initiatorName ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                      <UserCheck size={12} className="text-slate-400" />
                      <span className="shrink-0 text-slate-500">By</span>
                      <span className="font-medium text-slate-700">{initiatorName}</span>
                    </span>
                  ) : null}
                  {initiatorEmail ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                      <Mail size={12} className="text-slate-400" />
                      <span className="shrink-0 text-slate-500">Email</span>
                      <span className="font-medium text-slate-700">{initiatorEmail}</span>
                    </span>
                  ) : null}
                  {initiatedOn ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                      <Calendar size={12} className="text-slate-400" />
                      <span className="shrink-0 text-slate-500">Initiated</span>
                      <span className="font-medium text-slate-700">{initiatedOn}</span>
                    </span>
                  ) : null}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2">
                  {pendingWorkflowName ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                      <span className="shrink-0 text-slate-500">Workflow</span>
                      <span className="font-medium text-slate-700">{pendingWorkflowName}</span>
                    </span>
                  ) : null}
                  {pendingWorkflowAlias ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                      <span className="shrink-0 text-slate-500">Alias</span>
                      <span className="font-medium text-slate-700">{pendingWorkflowAlias}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <SummaryPreview workflow={{ ...displayWorkflow, previousWorkflow }} />

          {!isPending && !isHistoryPreviewActive && pendingStatus && onSubmitStatusUpdate ? (
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

          {canDeleteWorkflow && !isPending && !isHistoryPreviewActive && showDeleteActions ? (
            <div className="rounded-xl border border-rose-200 bg-white p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-rose-600">
                Submit Delete Request
              </div>
              <div className="space-y-3">
                <Textarea
                  value={deleteRemark}
                  onChange={(event) => onDeleteRemarkChange?.(event.target.value)}
                  placeholder={deleteRemarkPlaceholder}
                  maxLength={250}
                  className={cn("h-11 min-h-0 resize-none", deleteRemarkError ? "border-rose-500 focus-visible:ring-rose-500/30" : "")}
                />
                {deleteRemarkError ? <p className="text-xs text-rose-600">{deleteRemarkError}</p> : null}
              </div>
            </div>
          ) : null}

          {canShowPendingActions && pendingDecision ? (
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
          {canShowPendingActions ? (
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
              {canDeleteWorkflow && showDeleteActions ? (
                <>
                  <Select value={deleteWorkflow} onValueChange={onDeleteWorkflowChange}>
                    <SelectTrigger className="h-10 min-w-[16rem]">
                      <SelectValue placeholder="Select workflow" />
                    </SelectTrigger>
                    <SelectContent side="top">
                      <SelectItem value="__none__">No Workflow</SelectItem>
                      {deleteWorkflowOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="rounded-full border-rose-600 bg-rose-600 px-6 text-white hover:bg-rose-700"
                    onClick={() => onConfirmDelete?.(workflow)}
                    disabled={!deleteRemark.trim()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Workflow
                  </Button>
                </>
              ) : pendingStatus && onSubmitStatusUpdate ? (
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
