import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeftRight, BadgeCheck, Calendar, CheckCircle2, CircleX, Clock, GitBranch, History, Mail, Pencil, Settings2, ShieldCheck, Trash2, UserCheck, X } from "lucide-react";
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
import type { HistoryDetailPreviewEvent, HistoryDetailViewModel } from "@/components/HistoryDetailDialog";

type WorkflowManageDialogProps = {
  open: boolean;
  workflow: WorkflowRecord | null;
  currentTab?: "Active" | "Pending" | "Inactive";
  onClose: () => void;
  onSubmitAction: (workflow: WorkflowRecord, action: "approve" | "reject", remark: string) => Promise<void>;
  onStartPendingAction?: (workflow: WorkflowRecord, action: "approve" | "reject") => Promise<boolean | void> | boolean | void;
  onCancelPendingAction?: (workflow: WorkflowRecord) => Promise<void> | void;
  onRequestStatusWorkflowOptions?: (workflow: WorkflowRecord) => Promise<{
    options: Array<{ id: string; label: string }>;
    selectedLevelsHash: string;
  }>;
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
  historyPreviewEvent?: HistoryDetailPreviewEvent | null;
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

const isHistoryComparisonUpdate = (detail: HistoryDetailViewModel | null) => {
  if (!detail || detail.mode !== "comparison") return false;
  return Object.keys(toRecord(detail.oldData)).length > 0;
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

const removeWorkflowLevelsFromDiff = (
  mergedLevels: unknown,
  previousLevels: unknown,
  nextLevelsDelta: unknown,
  expectedLevelCount: number | null,
) => {
  const mergedRecord =
    typeof mergedLevels === "object" && mergedLevels !== null && !Array.isArray(mergedLevels)
      ? { ...(mergedLevels as Record<string, unknown>) }
      : {};
  const previousRecord =
    typeof previousLevels === "object" && previousLevels !== null && !Array.isArray(previousLevels)
      ? (previousLevels as Record<string, unknown>)
      : {};
  const nextRecord =
    typeof nextLevelsDelta === "object" && nextLevelsDelta !== null && !Array.isArray(nextLevelsDelta)
      ? (nextLevelsDelta as Record<string, unknown>)
      : {};

  if (expectedLevelCount !== null) {
    Object.keys(previousRecord)
      .sort((left, right) => Number(left.replace(/[^\d]/g, "")) - Number(right.replace(/[^\d]/g, "")))
      .slice(expectedLevelCount)
      .forEach((levelKey) => {
        delete mergedRecord[levelKey];
      });
    return mergedRecord;
  }

  Object.keys(previousRecord).forEach((levelKey) => {
    if (!(levelKey in nextRecord)) return;
    const mergedLevel = mergedRecord[levelKey];
    if (mergedLevel === undefined) {
      delete mergedRecord[levelKey];
    }
  });

  return mergedRecord;
};

const parseWorkflowAliasLevelCount = (value: unknown) => {
  const alias = readString(value).toUpperCase();
  const match = alias.match(/(?:^|_)C_(\d+)(?:$|_)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const countWorkflowLevels = (value: unknown) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return Object.keys(value as Record<string, unknown>).length;
};

const hasCompleteWorkflowLevelsSnapshot = (value: unknown) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const levelNumbers = Object.keys(value as Record<string, unknown>)
    .map((key) => Number(key.replace(/[^\d]/g, "")))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (levelNumbers.length === 0) return false;

  return levelNumbers.every((value, index) => value === index + 1);
};

const applyWorkflowDiffData = (
  base: WorkflowRecord,
  previousSource: Record<string, unknown>,
  nextSource: Record<string, unknown>,
  options?: {
    previousWorkflowOverride?: WorkflowRecord;
    expectedLevelCount?: number | null;
  },
) => {
  const previousWorkflow =
    options?.previousWorkflowOverride ??
    (Object.keys(previousSource).length > 0 ? applyPendingDataView(base, previousSource, true) : base);
  if (Object.keys(nextSource).length === 0) {
    return { previousWorkflow, currentWorkflow: previousWorkflow };
  }

  const currentWorkflow = applyPendingDataView(previousWorkflow, nextSource);
  const currentWorkflowLevels = removeWorkflowLevelsFromDiff(
    currentWorkflow.levels,
    previousWorkflow.levels,
    nextSource.levels,
    options?.expectedLevelCount ?? null,
  );

  return {
    previousWorkflow,
    currentWorkflow: {
      ...currentWorkflow,
      levels: currentWorkflowLevels,
    },
  };
};

const createHistoryPreviewBase = (workflow: WorkflowRecord): WorkflowRecord => ({
  ...workflow,
  name: "",
  alias: "",
  module: "",
  rawModule: "",
  workflowType: undefined,
  subModule: "",
  nodePath: "",
  levels: {},
  levelsHash: "",
});

const applyPendingDataView = (
  base: WorkflowRecord,
  source: Record<string, unknown>,
  overwriteLevels = false,
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
  if ("levels" in source) next.levels = overwriteLevels ? (source.levels ?? next.levels) : mergeWorkflowLevels(next.levels, source.levels);
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

const deriveWorkflowAliasFromLevels = (levels: unknown) => {
  const levelEntries =
    typeof levels === "object" && levels !== null && !Array.isArray(levels)
      ? Object.entries(levels as Record<string, unknown>)
      : [];

  const normalizedLevels = levelEntries
    .sort(([left], [right]) => Number(left.replace(/[^\d]/g, "")) - Number(right.replace(/[^\d]/g, "")))
    .map(([, value]) => toRecord(value))
    .filter((level) => Boolean(readString(level.approver1) || readString(level.approver2)));

  if (normalizedLevels.length === 0) return "";

  const conditionCount = normalizedLevels.reduce((total, level) => {
    const approverCount = [readString(level.approver1), readString(level.approver2)].filter(Boolean).length;
    if (approverCount === 0) return total;
    return total + (readString(level.type).toUpperCase() === "AND" ? approverCount : 1);
  }, 0);

  return `1M_${conditionCount}C_${normalizedLevels.length}`;
};

const getRequestedWorkflowStatus = (
  pendingNewData: Record<string, unknown>,
  pendingRequestType?: string,
  pendingRequestImpact?: string,
) => {
  const pendingNewBasicDetails = toRecord(pendingNewData.basicDetails);
  const candidates = [
    readString(pendingNewBasicDetails.status),
    readString(pendingNewData.status),
    readString(pendingNewData.type),
    readString(pendingRequestType),
    readString(pendingRequestImpact),
  ]
    .map((value) => value.toUpperCase())
    .filter(Boolean);

  if (candidates.includes("ARCHIVE")) return "ARCHIVE";
  if (candidates.includes("ACTIVE")) return "ACTIVE";
  if (candidates.includes("INACTIVE")) return "INACTIVE";
  return "";
};
const hasNonStatusWorkflowChanges = (pendingNewData: Record<string, unknown>) => {
  const entries = Object.entries(pendingNewData).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(toRecord(value)).length > 0;
    return true;
  });

  return entries.some(([key, value]) => {
    if (key === "status") return false;
    if (key === "type") return false;
    if (key === "impact") return false;
    if (key === "basicDetails") {
      const basicDetails = toRecord(value);
      return Object.entries(basicDetails).some(([basicKey, basicValue]) => {
        if (basicKey === "status") return false;
        if (basicValue === undefined || basicValue === null) return false;
        if (typeof basicValue === "string") return basicValue.trim().length > 0;
        if (Array.isArray(basicValue)) return basicValue.length > 0;
        if (typeof basicValue === "object") return Object.keys(toRecord(basicValue)).length > 0;
        return true;
      });
    }
    return true;
  });
};
export default function WorkflowManageDialog({
  open,
  workflow,
  currentTab = "Active",
  onClose,
  onSubmitAction,
  onStartPendingAction,
  onCancelPendingAction,
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
  historyPreviewEvent = null,
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
  const [statusRemarkTouched, setStatusRemarkTouched] = useState(false);
  const [statusWorkflowHash, setStatusWorkflowHash] = useState("");
  const [statusWorkflowOptions, setStatusWorkflowOptions] = useState<Array<{ id: string; label: string }>>([]);
  const safeDeleteWorkflowOptions = Array.isArray(deleteWorkflowOptions) ? deleteWorkflowOptions : [];

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
      setStatusRemarkTouched(false);
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
  const isHistoryUpdatePreview = isHistoryComparisonUpdate(historyDetailOverride);
  const comparisonWorkflows = useMemo(() => {
    if (!workflow) return null;
    const pendingOldData = isHistoryPreviewActive ? historyOldData : toRecord(workflow.pendingOldData);
    const pendingNewData = isHistoryPreviewActive ? historyNewData : toRecord(workflow.pendingNewData);
    const hasPendingDataDiff = Object.keys(pendingOldData).length > 0 || Object.keys(pendingNewData).length > 0;
    const requestedStatus = getRequestedWorkflowStatus(
      pendingNewData,
      workflow.pendingRequestType,
      workflow.pendingRequestImpact,
    );
    const isStatusTransitionRequest =
      !isHistoryPreviewActive &&
      Object.keys(pendingOldData).length === 0 &&
      Boolean(requestedStatus);
    const isUpdateRequest = isHistoryPreviewActive
      ? isHistoryUpdatePreview
      : isWorkflowUpdateRequest(workflow) || (hasPendingDataDiff && !isStatusTransitionRequest);
    if (!isUpdateRequest) {
      if (Object.keys(pendingNewData).length > 0) {
        const previewBase =
          Object.keys(pendingOldData).length > 0
            ? applyPendingDataView(workflow, pendingOldData, true)
            : isHistoryPreviewActive
              ? createHistoryPreviewBase(workflow)
              : workflow;
        return {
          previousWorkflow: isStatusTransitionRequest ? null : Object.keys(pendingOldData).length > 0 ? previewBase : null,
          currentWorkflow: applyPendingDataView(previewBase, pendingNewData, true),
        };
      }
      return {
        previousWorkflow: Object.keys(pendingOldData).length > 0 ? applyPendingDataView(workflow, pendingOldData, true) : null,
        currentWorkflow: workflow,
      };
    }
    const expectedLevelCount =
      parseWorkflowAliasLevelCount(pendingNewData.alias) ??
      (hasCompleteWorkflowLevelsSnapshot(pendingNewData.levels)
        ? countWorkflowLevels(pendingNewData.levels)
        : null);
    const previewBase = createHistoryPreviewBase(workflow);
    const previousWorkflowOverride =
      !isHistoryPreviewActive && hasPendingDataDiff
        ? (Object.keys(pendingOldData).length > 0
          ? applyPendingDataView(previewBase, pendingOldData, true)
          : previewBase)
        : undefined;
    return applyWorkflowDiffData(
      !isHistoryPreviewActive && hasPendingDataDiff ? previewBase : workflow,
      pendingOldData,
      pendingNewData,
      {
        previousWorkflowOverride,
        expectedLevelCount,
      },
    );
  }, [workflow, isHistoryPreviewActive, historyOldData, historyNewData, isHistoryUpdatePreview]);
  const displayWorkflow = comparisonWorkflows?.currentWorkflow ?? null;
  const previousWorkflow = comparisonWorkflows?.previousWorkflow ?? null;
  if (!workflow || !displayWorkflow) return null;
  const pendingOldData = isHistoryPreviewActive ? historyOldData : toRecord(workflow.pendingOldData);
  const pendingNewData = isHistoryPreviewActive ? historyNewData : toRecord(workflow.pendingNewData);
  const hasPendingDataDiff = Object.keys(pendingOldData).length > 0 || Object.keys(pendingNewData).length > 0;
  const isUpdateRequest = isHistoryPreviewActive
    ? isHistoryUpdatePreview
    : isWorkflowUpdateRequest(workflow) || hasPendingDataDiff;
  const requestedStatus = getRequestedWorkflowStatus(
    pendingNewData,
    workflow.pendingRequestType,
    workflow.pendingRequestImpact,
  );
  const isPending = workflow.status === "Pending" || isUpdateRequest || Boolean(workflow.isPending);
  const normalizedRequestImpact = (workflow.pendingRequestImpact || "").trim().toUpperCase();
  const normalizedRequestType = isHistoryPreviewActive
    ? isHistoryUpdatePreview
      ? "UPDATE"
      : "INITIATE"
    : (workflow.pendingRequestType || "").trim().toUpperCase();
  const normalizedRequestStatus = requestedStatus;
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
  const previewEventAction = readString(historyDetailOverride?.previewEvent?.action).toUpperCase();
  const isPendingApprovalHistoryPreview =
    previewEventAction.includes("PENDING APPROVAL") &&
    /^L\d+\s+PENDING APPROVAL$/.test(previewEventAction);
  const isModifyHistoryPreview = previewEventAction === "MODIFY";
  const canShowPendingActionsInHistoryPreview =
    isHistoryPreviewActive && (isPendingApprovalHistoryPreview || isModifyHistoryPreview);
  const canShowPendingActions =
    isPending && currentTab === "Pending" && (!isHistoryPreviewActive || canShowPendingActionsInHistoryPreview);
  const isManageActionLocked = !canShowPendingActions && (Boolean(workflow.isPending) || isUpdateRequest);
  const pendingOldBasicDetails = toRecord(pendingOldData.basicDetails);
  const pendingOldStatus = (
    readString(pendingOldBasicDetails.status) ||
    readString(pendingOldData.status)
  ).toUpperCase();
  const hasExplicitPendingOldStatus = Boolean(pendingOldStatus);
  const isExplicitStatusToggleRequest =
    normalizedRequestType === "ACTIVE" ||
    normalizedRequestType === "INACTIVE" ||
    normalizedRequestType === "ARCHIVE" ||
    normalizedRequestImpact === "ACTIVE" ||
    normalizedRequestImpact === "INACTIVE" ||
    normalizedRequestImpact === "ARCHIVE" ||
    normalizedRequestStatus === "ACTIVE" ||
    normalizedRequestStatus === "INACTIVE" ||
    normalizedRequestStatus === "ARCHIVE";
  const isPendingInactiveRequest =
    canShowPendingActions && (
      normalizedRequestType === "INACTIVE" ||
      normalizedRequestImpact === "INACTIVE" ||
      (hasExplicitPendingOldStatus && normalizedRequestStatus === "INACTIVE")
    );
  const isPendingActiveRequest =
    canShowPendingActions && (
      normalizedRequestType === "ACTIVE" ||
      normalizedRequestImpact === "ACTIVE" ||
      (hasExplicitPendingOldStatus && normalizedRequestStatus === "ACTIVE")
    );
  const isPendingArchiveRequest =
    canShowPendingActions && (
      normalizedRequestType === "ARCHIVE" ||
      normalizedRequestImpact === "ARCHIVE" ||
      normalizedRequestStatus === "ARCHIVE"
    );
  const isPendingUpdateRequest = canShowPendingActions && normalizedRequestType === "UPDATE";
  const pendingApprovalLabel = isPendingActiveRequest
    ? "Re-activation Approval"
    : isPendingInactiveRequest
      ? "Deactivation Approval"
      : isPendingArchiveRequest
        ? "Archive Approval"
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
  const shouldUseCompactInitiatorStrip = preventOutsideClose;
  const pendingWorkflowName = workflow.workflowName?.trim() || "";
  const previousWorkflowAlias = previousWorkflow?.alias?.trim() || "";
  const derivedDisplayWorkflowAlias = deriveWorkflowAliasFromLevels(displayWorkflow.levels);
  const explicitDisplayWorkflowAlias = displayWorkflow.alias?.trim() || "";
  const pendingWorkflowAlias =
    workflow.workflowAlias?.trim() ||
    explicitDisplayWorkflowAlias ||
    derivedDisplayWorkflowAlias ||
    previousWorkflowAlias;
  const previousStatusLabel = (() => {
    if (isPending && !isHistoryPreviewActive) {
      if (pendingOldStatus) return pendingOldStatus;
      // Infer from request direction only for explicit activate/inactivate requests.
      if (isExplicitStatusToggleRequest && isPendingInactiveRequest) return "ACTIVE";
      if (isExplicitStatusToggleRequest && isPendingActiveRequest) return "INACTIVE";
    }
    return (previousWorkflow?.status || "").trim().toUpperCase();
  })();
  const nextStatusLabel = (() => {
    if (isPending && !isHistoryPreviewActive) {
      if (normalizedRequestStatus === "ACTIVE" || normalizedRequestStatus === "INACTIVE" || normalizedRequestStatus === "ARCHIVE") {
        return normalizedRequestStatus;
      }
      return (workflow.status || "").trim().toUpperCase();
    }
    return (displayWorkflow.status || "").trim().toUpperCase();
  })();
  const displayTitle =
    (
      (previousWorkflow?.name && isUpdateRequest ? previousWorkflow.name : "") ||
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
  const hasStatusOnlyPendingChange =
    isExplicitStatusToggleRequest &&
    !hasNonStatusWorkflowChanges(pendingNewData) &&
    (normalizedRequestStatus === "ACTIVE" || normalizedRequestStatus === "INACTIVE" || normalizedRequestStatus === "ARCHIVE");
  const shouldShowStatusTransition =
    hasStatusOnlyPendingChange &&
    Boolean(previousStatusLabel) &&
    Boolean(nextStatusLabel) &&
    previousStatusLabel !== nextStatusLabel;
  const shouldSuppressHistoryPreviewEvent = Boolean(showDeleteActions || pendingStatus);
  const effectiveHistoryPreviewEvent = shouldSuppressHistoryPreviewEvent
    ? null
    : historyDetailOverride?.previewEvent ?? (currentTab === "Pending" && isHistoryOpen ? historyPreviewEvent : null);
  const historyEventTone = effectiveHistoryPreviewEvent ? getHistoryEventTone(effectiveHistoryPreviewEvent.action, effectiveHistoryPreviewEvent.status) : null;
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
    ? Clock
    : historyEventTone === "initiation" || historyEventTone === "modified"
      ? History
      : historyEventTone === "rejected"
        ? CircleX
        : ShieldCheck;
  const formatStatusLabel = (value: string) =>
    value
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  const viewContextTitle = effectiveHistoryPreviewEvent
  ? effectiveHistoryPreviewEvent.action
  : showDeleteActions
    ? "Delete Workflow"
    : canShowPendingActions && impactBadgeLabel
      ? impactBadgeLabel
      : pendingDecision
        ? pendingDecision === "approve"
          ? "Approval Remark"
          : "Rejection Remark"
        : shouldShowStatusTransition
          ? `${formatStatusLabel(previousStatusLabel)} to ${formatStatusLabel(nextStatusLabel)}`
          : "";
const viewContextClassName = effectiveHistoryPreviewEvent
  ? historyEventStripClassName
  : showDeleteActions
    ? "border-rose-200/60 bg-rose-50 text-rose-700"
    : canShowPendingActions && impactBadgeLabel
      ? impactBadgeCls || "border-amber-200/60 bg-amber-50 text-amber-700"
      : pendingDecision
        ? pendingDecision === "approve"
          ? "border-emerald-200/60 bg-emerald-50 text-emerald-700"
          : "border-rose-200/60 bg-rose-50 text-rose-700"
        : shouldShowStatusTransition
          ? "border-sky-200/60 bg-sky-50 text-sky-700"
          : "border-slate-200 bg-slate-50 text-slate-700";
const ViewContextIcon = effectiveHistoryPreviewEvent
  ? HistoryEventIcon
  : showDeleteActions
    ? Trash2
    : canShowPendingActions && impactBadgeLabel
      ? Clock
      : pendingDecision
        ? pendingDecision === "approve"
          ? ShieldCheck
          : CircleX
        : shouldShowStatusTransition
          ? ArrowLeftRight
          : Settings2;
const viewContextLevelCount = effectiveHistoryPreviewEvent?.levelCount;

  const handleStartPendingAction = async (action: "approve" | "reject") => {
    const shouldOpen = await onStartPendingAction?.(workflow, action);
    if (shouldOpen === false) return;
    setPendingDecision(action);
    setRemarkTouched(false);
  };

  const handleClosePendingAction = () => {
    void onCancelPendingAction?.(workflow);
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
      const { options, selectedLevelsHash } = await onRequestStatusWorkflowOptions(workflow);
      setPendingStatus(resolvedNextStatus);
      setStatusRemark("");
      setStatusRemarkTouched(false);
      setStatusWorkflowHash(selectedLevelsHash);
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
    setStatusRemarkTouched(true);
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
        className={cn("flex h-[92vh] max-h-[92vh] w-[min(96vw,64rem)] max-w-[64rem] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-xl", contentClassName)}
        style={contentStyle}
      >
        <DialogDescription className="sr-only">
          Review workflow details, approval chain, history, and submit approve or reject actions.
        </DialogDescription>
        <DialogHeader className="border-b border-slate-100 bg-white px-6 pb-4 pt-5">
          {viewContextTitle ? (
            <div className={cn("-mx-6 -mt-5 mb-4 flex min-h-[2.75rem] items-center justify-center gap-3 px-6 py-2 text-center", viewContextClassName)}>
              <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/70 ring-1 ring-black/5">
                <ViewContextIcon className="h-3.5 w-3.5" />
              </div>
              <div className="flex min-w-0 flex-nowrap items-center justify-center gap-2 whitespace-nowrap">
                <p className="whitespace-nowrap text-[13px] font-extrabold uppercase tracking-[0.18em] leading-none">{viewContextTitle}</p>
                {viewContextLevelCount ? (
                  <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded border border-current/20 bg-white/60 px-1.5 text-[9px] font-bold leading-none">
                    {viewContextLevelCount}
                  </span>
                ) : null}
                {shouldShowStatusTransition ? (
                  <span className="inline-flex h-4 shrink-0 items-center justify-center rounded border border-sky-200/70 bg-white/60 px-1.5 text-[9px] font-bold uppercase leading-none text-sky-700">
                    {formatStatusLabel(previousStatusLabel)} <span className="px-0.5 text-sky-400">{"->"}</span> {formatStatusLabel(nextStatusLabel)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <DialogTitle className="text-xl font-bold text-slate-900 capitalize">{displayTitle}</DialogTitle>
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
            <div className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-1.5">
              <div className="text-[12px]">
                {shouldUseCompactInitiatorStrip ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {initiatorName ? (
                      <span className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[13px] text-slate-600 ring-1 ring-slate-200/70">
                        <UserCheck size={12} className="text-slate-400" />
                        <span className="shrink-0 text-slate-500">By</span>
                        <span className="font-medium text-slate-700">{initiatorName}</span>
                      </span>
                    ) : null}
                    {initiatorEmail ? (
                      <span className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[13px] text-slate-600 ring-1 ring-slate-200/70">
                        <Mail size={12} className="text-slate-400" />
                        <span className="shrink-0 text-slate-500">Email</span>
                        <span className="font-medium text-slate-700">{initiatorEmail}</span>
                      </span>
                    ) : null}
                    {initiatedOn ? (
                      <span className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[13px] text-slate-600 ring-1 ring-slate-200/70">
                        <Calendar size={12} className="text-slate-400" />
                        <span className="shrink-0 text-slate-500">Initiated</span>
                        <span className="font-medium text-slate-700">{initiatedOn}</span>
                      </span>
                    ) : null}
                    {pendingWorkflowName ? (
                      <span className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[13px] text-slate-600 ring-1 ring-slate-200/70">
                        <span className="shrink-0 text-slate-500">Workflow</span>
                        <span className="font-medium text-slate-700">{pendingWorkflowName}</span>
                      </span>
                    ) : null}
                    {pendingWorkflowAlias ? (
                      <span className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[13px] text-slate-600 ring-1 ring-slate-200/70">
                        <span className="shrink-0 text-slate-500">Alias</span>
                        <span className="font-medium text-slate-700">{pendingWorkflowAlias}</span>
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-nowrap items-center gap-2">
                      {initiatorName ? (
                        <span className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[13px] text-slate-600 ring-1 ring-slate-200/70">
                          <UserCheck size={12} className="text-slate-400" />
                          <span className="shrink-0 text-slate-500">By</span>
                          <span className="font-medium text-slate-700">{initiatorName}</span>
                        </span>
                      ) : null}
                      {initiatorEmail ? (
                        <span className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[13px] text-slate-600 ring-1 ring-slate-200/70">
                          <Mail size={12} className="text-slate-400" />
                          <span className="shrink-0 text-slate-500">Email</span>
                          <span className="font-medium text-slate-700">{initiatorEmail}</span>
                        </span>
                      ) : null}
                      {initiatedOn ? (
                        <span className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[13px] text-slate-600 ring-1 ring-slate-200/70">
                          <Calendar size={12} className="text-slate-400" />
                          <span className="shrink-0 text-slate-500">Initiated</span>
                          <span className="font-medium text-slate-700">{initiatedOn}</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-nowrap items-center gap-2">
                      {pendingWorkflowName ? (
                        <span className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[13px] text-slate-600 ring-1 ring-slate-200/70">
                          <span className="shrink-0 text-slate-500">Workflow</span>
                          <span className="font-medium text-slate-700">{pendingWorkflowName}</span>
                        </span>
                      ) : null}
                      {pendingWorkflowAlias ? (
                        <span className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[13px] text-slate-600 ring-1 ring-slate-200/70">
                          <span className="shrink-0 text-slate-500">Alias</span>
                          <span className="font-medium text-slate-700">{pendingWorkflowAlias}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/30 px-5 pb-5 pt-2">
          <SummaryPreview workflow={{ ...displayWorkflow, previousWorkflow }} />


          {canShowPendingActions && pendingDecision ? (
            <div ref={remarkCardRef} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
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

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          {!isPending && !isHistoryPreviewActive && pendingStatus && onSubmitStatusUpdate ? (
            <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                {pendingStatus === "inactive" ? "Submit Inactive Request" : "Submit Active Request"}
              </div>
              <Textarea
                value={statusRemark}
                onChange={(event) => setStatusRemark(event.target.value)}
                placeholder="Add remark"
                maxLength={250}
                className="h-11 min-h-0 resize-none"
              />
            </div>
          ) : null}

          {canDeleteWorkflow && !isPending && !isHistoryPreviewActive && showDeleteActions ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-600">
                Submit Delete Request
              </div>
              <Textarea
                value={deleteRemark}
                onChange={(event) => onDeleteRemarkChange?.(event.target.value)}
                placeholder={deleteRemarkPlaceholder}
                maxLength={250}
                className={cn("h-11 min-h-0 resize-none", deleteRemarkError ? "border-rose-500 focus-visible:ring-rose-500/30" : "")}
              />
              {deleteRemarkError ? <p className="mt-2 text-xs text-rose-600">{deleteRemarkError}</p> : null}
            </div>
          ) : null}

          <div className="flex w-full items-center justify-end gap-2">
            {canShowPendingActions ? (
              pendingDecision === "approve" ? (
                <>
                  <Button variant="outline" onClick={handleClosePendingAction} disabled={isSubmitting} className="rounded-xl border-slate-200 bg-white px-4 text-slate-600 hover:bg-slate-50">
                    Cancel
                  </Button>
                  <Button
                    className="rounded-xl bg-emerald-600 px-4 text-white hover:bg-emerald-700"
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
                    className="rounded-xl border-[rgb(220,38,38)] bg-[rgb(220,38,38)] px-4 text-white hover:bg-[rgb(220,38,38)] hover:text-white"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button variant="outline" onClick={handleClosePendingAction} disabled={isSubmitting} className="rounded-xl border-slate-200 bg-white px-4 text-slate-600 hover:bg-slate-50">
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => handleStartPendingAction("reject")} className="rounded-xl border-slate-200 bg-white px-4 text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600">
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button className="rounded-xl bg-[rgb(53,83,233)] px-4 text-white shadow-sm hover:bg-[rgb(45,71,210)]" onClick={() => handleStartPendingAction("approve")}>
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
                        {safeDeleteWorkflowOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      className="rounded-full border-rose-600 bg-rose-600 px-6 text-white hover:bg-rose-700"
                      onClick={() => onConfirmDelete?.(workflow)}
                      disabled={false}
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
                      className="rounded-xl bg-[rgb(53,83,233)] px-4 text-white shadow-sm hover:bg-[rgb(45,71,210)]"
                      onClick={() => void handleSubmitStatusUpdate()}
                      disabled={statusSubmitting}
                    >
                      {pendingStatus === "inactive" ? "Set Inactive" : "Set Active"}
                    </Button>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}























