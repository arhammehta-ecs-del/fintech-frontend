import { useEffect, useRef, useState } from "react";
import { X, CheckCircle2, XCircle, Building2, MapPin, Layers3, Briefcase, Boxes, Info, User, Mail, Clock3, History, Users, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgNode } from "@/contexts/AppContext";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type PendingNodePopupProps = {
  open: boolean;
  node: OrgNode | null;
  onClose: () => void;
  onApprove: (node: OrgNode, remark: string) => void;
  onReject: (node: OrgNode, remark: string) => void;
  onOpenHistory?: (node: OrgNode) => void;
  onToggleHistory?: () => void;
  isHistoryOpen?: boolean;
  dockOffset?: {
    top: number;
    left: number;
  };
  historyPanelWidth?: number;
};

const getNodeIcon = (nodeType: string) => {
  const normalized = nodeType.trim().toUpperCase();
  if (normalized === "ROOT") return Building2;
  if (normalized === "DIVISION") return Layers3;
  if (normalized === "LOCATION") return MapPin;
  if (normalized === "DEPARTMENT") return Briefcase;
  return Boxes;
};

const formatRequestedAtToIst = (value?: string) => {
  if (!value?.trim()) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(parsed);
};

const REMARK_MAX_LENGTH = 100;

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const formatDiffValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

const getNodeDisplayNameFromPath = (value: string) => {
  const segments = value.split(".").map((segment) => segment.trim()).filter(Boolean);
  return segments[segments.length - 1] || value;
};

const buildOrgDiffRows = (node: OrgNode) => {
  const oldData = toRecord(node.pendingOldData);
  const newData = toRecord(node.pendingNewData);
  const pendingType = (node.pendingRequestType || "").trim().toUpperCase();
  const parentFromNew = toRecord(newData.parentNode);
  const parentFromOld = toRecord(oldData.parentNode);

  const oldValues: Record<string, string> = {
    nodeName: formatDiffValue(oldData.nodeName) || formatDiffValue(oldData.newNodeName),
    nodeType: formatDiffValue(oldData.nodeType),
    status: formatDiffValue(oldData.status),
    parentNodeName: formatDiffValue(parentFromOld.nodeName),
    parentNodePath: formatDiffValue(parentFromOld.nodePath),
    workflowName: formatDiffValue(oldData.workflowName),
    alias: formatDiffValue(oldData.alias),
  };

  const targetNodePath = formatDiffValue(newData.targetNodePath);
  const newValues: Record<string, string> = {
    nodeName:
      formatDiffValue(newData.nodeName) ||
      formatDiffValue(newData.newNodeName) ||
      (targetNodePath ? getNodeDisplayNameFromPath(targetNodePath) : ""),
    nodeType: formatDiffValue(newData.nodeType),
    status: formatDiffValue(newData.status),
    parentNodeName: formatDiffValue(parentFromNew.nodeName),
    parentNodePath: formatDiffValue(parentFromNew.nodePath),
    workflowName: formatDiffValue(newData.workflowName),
    alias: formatDiffValue(newData.alias),
  };

  const labels: Array<{ key: keyof typeof newValues; label: string }> = [
    { key: "nodeName", label: "Node Name" },
    { key: "nodeType", label: "Node Type" },
    { key: "status", label: "Status" },
    { key: "parentNodeName", label: "Parent Node" },
    { key: "parentNodePath", label: "Parent Path" },
    { key: "workflowName", label: "Workflow Name" },
    { key: "alias", label: "Workflow Alias" },
  ];

  const hasOldValues = Object.values(oldValues).some(Boolean);
  const hasNewValues = Object.values(newValues).some(Boolean);

  if (pendingType === "INITIATE" && !hasOldValues) {
    return [];
  }

  return labels
    .map(({ key, label }) => ({
      key,
      label,
      oldValue: oldValues[key] || "",
      newValue: newValues[key] || "",
    }))
    .filter((row) => row.oldValue || row.newValue)
    .filter((row) => row.oldValue !== row.newValue || (row.oldValue && row.newValue));
};

function DiffValue({
  nextValue,
  previousValue,
}: {
  nextValue: string;
  previousValue: string;
}) {
  const next = (nextValue || "").trim();
  const prev = (previousValue || "").trim();

  if (!prev && !next) {
    return <span className="font-semibold text-slate-900">-</span>;
  }
  if (!prev || prev === next) {
    return <span className="font-semibold text-slate-900">{next || prev || "-"}</span>;
  }

  return (
    <span className="font-semibold text-slate-900">
      <span className="rounded border border-rose-100 bg-rose-50 px-1 py-0.5 text-rose-600 line-through">{prev}</span>
      <span className="px-1 text-slate-400">→</span>
      <span className="rounded border border-emerald-100 bg-emerald-50 px-1 py-0.5 text-emerald-700">{next || "-"}</span>
    </span>
  );
}

export function PendingNodePopup({
  open,
  node,
  onClose,
  onApprove,
  onReject,
  onOpenHistory,
  onToggleHistory,
  isHistoryOpen = false,
  dockOffset,
  historyPanelWidth = 560,
}: PendingNodePopupProps) {
  const [remark, setRemark] = useState("");
  const [remarkError, setRemarkError] = useState("");
  const remarkInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setRemark("");
      setRemarkError("");
    }
  }, [open, node?.id]);

  if (!open || !node) return null;

  const Icon = getNodeIcon(node.nodeType);
  const requesterName = node.requestedByName?.trim() || "Not available";
  const requesterEmail = node.requestedByEmail?.trim() || "Not available";
  const requestedOn = formatRequestedAtToIst(node.requestedAt);
  const workflowName = node.workflowName?.trim() || "";
  const workflowAlias = node.alias?.trim() || "";
  const impactedUsers = node.impactSummary?.userAccess ?? [];
  const impactedWorkflows = node.impactSummary?.workflow ?? [];
  const affectedUsersCount = node.affectedUserAccessCount ?? impactedUsers.length;
  const affectedWorkflowsCount = node.affectedWorkflowCount ?? impactedWorkflows.length;
  const hasLongWorkflowLabel = workflowName.length > 24;
  const pendingRequestType = (node.pendingRequestType || "").trim().toUpperCase();
  const nextStatusFromRequest =
    typeof node.pendingNewData?.status === "string" ? node.pendingNewData.status.trim().toUpperCase() : "";
  const isStatusUpdateRequest = pendingRequestType === "UPDATE";
  const isInactiveUpdateRequest = isStatusUpdateRequest && nextStatusFromRequest === "INACTIVE";
  const isActiveUpdateRequest = isStatusUpdateRequest && nextStatusFromRequest === "ACTIVE";
  const useUpdateTheme = isStatusUpdateRequest;
  const isStandaloneDialog = !isHistoryOpen;
  const showRequestMetadata =
    isStatusUpdateRequest || Boolean(requesterName !== "Not available" || requesterEmail !== "Not available" || workflowName || workflowAlias);
  const approvalHeading = isInactiveUpdateRequest
    ? "Deactivation Approval"
    : isActiveUpdateRequest
      ? "Activation Approval"
      : "New Node Approval";
  const nodePathSegments = node.nodePath.split(".").filter(Boolean);
  const diffRows = buildOrgDiffRows(node);

  const validateAndRun = (action: "approve" | "reject") => {
    const cleanedRemark = remark.trim();
    if (!cleanedRemark) {
      setRemarkError("Remark is required before submitting this action.");
      if (remarkInputRef.current) {
        remarkInputRef.current.focus();
        remarkInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setRemarkError("");
    if (action === "approve") {
      onApprove(node, cleanedRemark);
      return;
    }
    onReject(node, cleanedRemark);
  };

  const topOffset = dockOffset?.top ?? 56;
  const leftOffset = dockOffset?.left ?? 0;

  return (
    <div
      className={cn("fixed z-[100] flex", isHistoryOpen ? "items-stretch justify-start p-0" : "inset-0 items-center justify-center p-4 sm:p-6")}
      style={
        isHistoryOpen
          ? {
            top: `${topOffset}px`,
            left: `${leftOffset}px`,
            width: `calc(100vw - ${leftOffset}px - ${historyPanelWidth}px)`,
            height: `calc(100vh - ${topOffset}px)`,
          }
          : undefined
      }
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div
        className={cn(
          "relative flex flex-col bg-white animate-in zoom-in-95 fade-in duration-300 overflow-hidden",
          useUpdateTheme && "ring-1 ring-amber-200/80",
          isHistoryOpen
            ? "h-full w-full max-w-none rounded-none border-r border-slate-200 transition-[width] duration-300 will-change-[width]"
            : cn(
                "w-full rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.2)]",
                isStandaloneDialog
                  ? hasLongWorkflowLabel
                    ? "max-h-[min(92vh,980px)] max-w-[980px]"
                    : "max-h-[min(92vh,940px)] max-w-[920px]"
                  : hasLongWorkflowLabel
                    ? "max-h-full max-w-[620px]"
                    : "max-h-full max-w-[480px]",
              ),
        )}
      >
        {/* Header Section */}
        <div
          className={cn(
            "relative shrink-0 pb-5 pt-5",
            isStandaloneDialog ? "px-8" : "px-6",
            useUpdateTheme ? "bg-gradient-to-b from-amber-100/80 to-orange-50" : "bg-amber-50/50",
          )}
        >
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      if (onToggleHistory) {
                        onToggleHistory();
                      } else if (onOpenHistory) {
                        onOpenHistory(node);
                      }
                    }}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full transition shadow-sm",
                      isHistoryOpen
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md border border-blue-600"
                        : "bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700 border border-transparent"
                    )}
                    aria-label={isHistoryOpen ? "Close node history" : "View node history"}
                  >
                    <History size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Node History</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-400 transition hover:bg-white hover:text-slate-600 shadow-sm"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-2.5 text-center">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.13em]",
                useUpdateTheme ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700",
              )}
            >
              {approvalHeading}
            </span>
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl bg-white",
                useUpdateTheme
                  ? "shadow-[0_6px_16px_rgba(249,115,22,0.16)]"
                  : "shadow-[0_6px_16px_rgba(245,158,11,0.14)]",
              )}
            >
              <Icon className={cn("h-6 w-6", useUpdateTheme ? "text-orange-500" : "text-amber-500")} />
            </div>
            <h2 className="text-[2rem] font-bold leading-none tracking-tight text-slate-900">{node.name}</h2>
          </div>
        </div>

        {/* Details Section */}
        <div className={cn("flex-1 min-h-0 space-y-4 overflow-y-auto py-6", isStandaloneDialog ? "px-8" : "px-6")}>
          <div className={cn("rounded-2xl border bg-white p-4 shadow-sm", useUpdateTheme ? "border-orange-200/80" : "border-slate-200")}>
            <div className="mb-3 flex items-center gap-2">
              <div className={cn("h-1.5 w-1.5 rounded-full", useUpdateTheme ? "bg-orange-500" : "bg-amber-500")} />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">Node Details</p>
            </div>
            <div className="space-y-2.5">
              <div className="grid grid-cols-[18px_96px_1fr] items-start gap-2 text-sm">
                <Info size={14} className="mt-0.5 text-slate-400" />
                <span className="text-slate-500">Node Type</span>
                <span className="font-semibold text-slate-900">{node.nodeType}</span>
              </div>
              <div className="grid grid-cols-[18px_96px_1fr] items-start gap-2 text-sm">
                <Info size={14} className="mt-0.5 text-slate-400" />
                <span className="text-slate-500">Node Path</span>
                <span className="font-mono text-[12px] font-semibold text-slate-700 break-words">
                  {nodePathSegments.length > 0
                    ? nodePathSegments.map((segment, index) => (
                      <span key={`${segment}-${index}`}>
                        {segment}
                        {index < nodePathSegments.length - 1 ? "." : ""}
                        <wbr />
                      </span>
                    ))
                    : node.nodePath}
                </span>
              </div>
            </div>
          </div>

          {showRequestMetadata ? (
            <div className={cn("rounded-2xl border bg-white p-4 shadow-sm", useUpdateTheme ? "border-orange-200/80" : "border-slate-200")}>
              <div
                className={cn(
                  "grid gap-4",
                  isStandaloneDialog
                    ? hasLongWorkflowLabel
                      ? "lg:grid-cols-[0.92fr_1.08fr]"
                      : "lg:grid-cols-[1fr_0.95fr]"
                    : hasLongWorkflowLabel
                      ? "md:grid-cols-[0.9fr_1.3fr]"
                      : "md:grid-cols-[1fr_0.85fr]",
                )}
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Initiator Info</p>
                  <div className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed">
                    <div className="flex items-center gap-2">
                      <User size={13} className="shrink-0 text-slate-400" />
                      <p className="truncate text-slate-600">{requesterName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="shrink-0 text-slate-400" />
                      <p className="truncate text-slate-500">{requesterEmail}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 size={13} className="shrink-0 text-slate-400" />
                      <p className="text-slate-500">{requestedOn}</p>
                    </div>
                  </div>
                </div>

                {workflowName || workflowAlias ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Workflow</p>
                    <div className="mt-2.5 space-y-1 text-[13px]">
                      <div className="grid grid-cols-[52px_10px_1fr] items-start">
                        <span className="text-slate-500">Name</span>
                        <span className="text-slate-400">:</span>
                        <span
                          className="font-medium leading-5 text-slate-700 break-words [overflow-wrap:anywhere]"
                          title={workflowName || "—"}
                        >
                          {workflowName || "—"}
                        </span>
                      </div>
                      <div className="grid grid-cols-[52px_10px_1fr] items-start">
                        <span className="text-slate-500">Alias</span>
                        <span className="text-slate-400">:</span>
                        <span
                          className="font-medium leading-5 text-slate-700 break-words [overflow-wrap:anywhere]"
                          title={workflowAlias || "—"}
                        >
                          {workflowAlias || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {!isStatusUpdateRequest && diffRows.length > 0 ? (
            <div className={cn("rounded-2xl border bg-white p-4 shadow-sm", useUpdateTheme ? "border-orange-200/80" : "border-slate-200")}>
              <div className="mb-3 flex items-center gap-2">
                <div className={cn("h-1.5 w-1.5 rounded-full", useUpdateTheme ? "bg-orange-500" : "bg-amber-500")} />
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">Requested Changes</p>
              </div>
              <div className="space-y-2.5 text-sm">
                {diffRows.map((row) => (
                  <div key={row.key} className="grid grid-cols-[110px_10px_1fr] items-start gap-x-2">
                    <span className="text-slate-500">{row.label}</span>
                    <span className="text-slate-400">:</span>
                    <DiffValue nextValue={row.newValue} previousValue={row.oldValue} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-[11px]",
              useUpdateTheme ? "bg-orange-50 text-orange-700" : "bg-slate-50 text-slate-500",
            )}
          >
            <CheckCircle2 size={13} className={useUpdateTheme ? "text-orange-500" : "text-emerald-500"} />
            <p>
              {isInactiveUpdateRequest
                ? "Approving this node will delete it from the Organization Structure."
                : isActiveUpdateRequest
                  ? "Approving this node will activate it in the Organization Structure."
                  : "Approving this node will add it to the Organization Structure."}
            </p>
          </div>

          {(affectedUsersCount > 0 || affectedWorkflowsCount > 0) ? (
            <div className={cn("grid items-start gap-4", isStandaloneDialog ? "lg:grid-cols-2" : "xl:grid-cols-2")}>
              {affectedUsersCount > 0 ? (
                <div
                  className={cn(
                    "h-fit self-start overflow-hidden rounded-2xl border",
                    "border-sky-200/80 bg-sky-50/80",
                  )}
                >
                  <div className="border-b border-sky-100 bg-sky-100/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <Users size={14} className="text-sky-600" />
                      Impacted Users
                    </div>
                    <p className="mt-2 text-2xl font-bold leading-none text-sky-700">{affectedUsersCount}</p>
                  </div>
                  {impactedUsers.length > 0 ? (
                    <>
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-b border-slate-200/80 bg-white/80 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        <span>Name</span>
                        <span className="text-right">Email</span>
                      </div>
                      <div className="divide-y divide-slate-100/80 bg-white">
                        {impactedUsers.map((user, index) => (
                          <div
                            key={`${user.email || user.name || "user"}-${index}`}
                            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 px-4 py-3 text-sm hover:bg-slate-50/70"
                          >
                            <span className="truncate font-medium text-slate-800" title={user.name || "—"}>
                              {user.name || "—"}
                            </span>
                            <span className="truncate text-right text-slate-500" title={user.email || "—"}>
                              {user.email || "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {affectedWorkflowsCount > 0 ? (
                <div
                  className={cn(
                    "h-fit self-start overflow-hidden rounded-2xl border",
                    "border-sky-200/80 bg-sky-50/80",
                  )}
                >
                  <div className="border-b border-sky-100 bg-sky-100/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <Workflow size={14} className="text-sky-600" />
                      Impacted Workflows
                    </div>
                    <p className="mt-2 text-2xl font-bold leading-none text-sky-700">{affectedWorkflowsCount}</p>
                  </div>
                  {impactedWorkflows.length > 0 ? (
                    <>
                      <div className="grid grid-cols-[minmax(0,1fr)_140px] border-b border-slate-200/80 bg-white/80 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        <span>Workflow Name</span>
                        <span className="text-right">Alias</span>
                      </div>
                      <div className="divide-y divide-slate-100/80 bg-white">
                        {impactedWorkflows.map((item, index) => (
                          <div
                            key={`${item.workflowName || item.alias || "workflow"}-${index}`}
                            className="grid grid-cols-[minmax(0,1fr)_140px] gap-3 px-4 py-3 text-sm hover:bg-slate-50/70"
                          >
                            <span className="truncate font-medium text-slate-800" title={item.workflowName || "—"}>
                              {item.workflowName || "—"}
                            </span>
                            <span className="truncate text-right text-slate-500" title={item.alias || "—"}>
                              {item.alias || "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Actions Section */}
        <div
          className={cn(
            "shrink-0 border-t border-slate-100 bg-gradient-to-b from-white/95 to-slate-50/90 py-5 backdrop-blur supports-[backdrop-filter]:bg-white/90",
            isStandaloneDialog ? "px-8" : "px-6",
          )}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Remark</label>
              <span className={cn("text-[11px] tabular-nums text-slate-500", remark.length >= REMARK_MAX_LENGTH && "font-semibold text-amber-600")}>
                {remark.length}/{REMARK_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              ref={remarkInputRef}
              value={remark}
              onChange={(event) => {
                setRemark(event.target.value);
                if (remarkError && event.target.value.trim()) {
                  setRemarkError("");
                }
              }}
              maxLength={REMARK_MAX_LENGTH}
              placeholder="Enter approval or rejection remark"
              className={cn("h-11 min-h-11 resize-none overflow-hidden rounded-xl py-3 shadow-sm", remarkError ? "border-rose-300 focus-visible:ring-rose-400" : "border-slate-200 focus-visible:ring-sky-400/30")}
            />
            {remarkError ? <p className="text-xs font-medium text-rose-600">{remarkError}</p> : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => validateAndRun("reject")}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 shadow-sm"
            >
              <XCircle size={16} />
              Reject
            </button>
            <button
              onClick={() => validateAndRun("approve")}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#3553E9] to-[#4f74ff] py-2.5 text-sm font-bold text-white transition hover:from-[#2f49cf] hover:to-[#3f66f6] hover:shadow-lg shadow-md active:scale-[0.98]"
            >
              <CheckCircle2 size={16} />
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
