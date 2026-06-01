import { useEffect, useState } from "react";
import { X, CheckCircle2, XCircle, Building2, MapPin, Layers3, Briefcase, Boxes, Info, User, Mail, Clock3, History } from "lucide-react";
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

export function PendingNodePopup({
  open,
  node,
  onClose,
  onApprove,
  onReject,
  onOpenHistory,
  isHistoryOpen = false,
  dockOffset,
  historyPanelWidth = 560,
}: PendingNodePopupProps) {
  const [remark, setRemark] = useState("");
  const [remarkError, setRemarkError] = useState("");

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
  const hasLongWorkflowLabel = workflowName.length > 24;
  const pendingRequestType = (node.pendingRequestType || "").trim().toUpperCase();
  const nextStatusFromRequest =
    typeof node.pendingNewData?.status === "string" ? node.pendingNewData.status.trim().toUpperCase() : "";
  const isStatusUpdateRequest = pendingRequestType === "UPDATE";
  const isInactiveUpdateRequest = isStatusUpdateRequest && nextStatusFromRequest === "INACTIVE";
  const isActiveUpdateRequest = isStatusUpdateRequest && nextStatusFromRequest === "ACTIVE";
  const approvalHeading = isInactiveUpdateRequest
    ? "Deactivation Approval"
    : isActiveUpdateRequest
      ? "Activation Approval"
      : "New Node Approval";
  const nodePathSegments = node.nodePath.split(".").filter(Boolean);

  const validateAndRun = (action: "approve" | "reject") => {
    const cleanedRemark = remark.trim();
    if (!cleanedRemark) {
      setRemarkError("Remark is required before submitting this action.");
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
      className={cn("fixed inset-0 z-[100] flex p-4 sm:p-6", isHistoryOpen ? "items-stretch justify-start" : "items-center justify-center")}
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
          "relative w-full overflow-hidden rounded-[28px] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] animate-in zoom-in-95 fade-in duration-300",
          isHistoryOpen
            ? cn("mx-auto my-auto max-h-full", hasLongWorkflowLabel ? "max-w-[620px]" : "max-w-[480px]")
            : hasLongWorkflowLabel
              ? "max-w-[620px]"
              : "max-w-[480px]",
        )}
      >
        {/* Header Section */}
        <div className="relative bg-amber-50/50 px-6 pb-5 pt-5">
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenHistory) onOpenHistory(node);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-500 transition hover:bg-white hover:text-slate-700 shadow-sm"
                    aria-label="View node history"
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
            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.13em] text-amber-700">
              {approvalHeading}
            </span>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-[0_6px_16px_rgba(245,158,11,0.14)]">
              <Icon className="h-6 w-6 text-amber-500" />
            </div>
            <h2 className="text-[2rem] font-bold leading-none tracking-tight text-slate-900">{node.name}</h2>
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-4 px-6 py-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">Node Details</p>
              </div>
              {isInactiveUpdateRequest ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm">
                  {requestedOn}
                </span>
              ) : null}
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

          {!isInactiveUpdateRequest ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className={cn("grid gap-3", hasLongWorkflowLabel ? "md:grid-cols-[0.9fr_1.3fr]" : "md:grid-cols-[1fr_0.85fr]")}>
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

          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3.5 py-2 text-[11px] text-slate-500">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <p>
              {isInactiveUpdateRequest
                ? "Approving this node will delete it from the Organization Structure."
                : isActiveUpdateRequest
                  ? "Approving this node will activate it in the Organization Structure."
                : "Approving this node will add it to the Organization Structure."}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Remark</label>
              <span className={cn("text-[11px] tabular-nums text-slate-500", remark.length >= REMARK_MAX_LENGTH && "font-semibold text-amber-600")}>
                {remark.length}/{REMARK_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              value={remark}
              onChange={(event) => {
                setRemark(event.target.value);
                if (remarkError && event.target.value.trim()) {
                  setRemarkError("");
                }
              }}
              maxLength={REMARK_MAX_LENGTH}
              placeholder="Enter approval or rejection remark"
              className={cn("min-h-[96px] resize-none", remarkError ? "border-rose-300 focus-visible:ring-rose-400" : "")}
            />
            {remarkError ? <p className="text-xs font-medium text-rose-600">{remarkError}</p> : null}
          </div>
        </div>

        {/* Actions Section */}
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50/30 px-6 py-5">
          <button
            onClick={() => validateAndRun("reject")}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-rose-600 hover:border-rose-200 shadow-sm"
          >
            <XCircle size={16} />
            Reject
          </button>
          <button
            onClick={() => validateAndRun("approve")}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#3553E9] py-2.5 text-sm font-bold text-white transition hover:bg-[#2f49cf] hover:shadow-lg shadow-md active:scale-[0.98]"
          >
            <CheckCircle2 size={16} />
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
