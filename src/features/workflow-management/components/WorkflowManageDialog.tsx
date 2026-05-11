import { useEffect, useState, type CSSProperties } from "react";
import { BadgeCheck, Briefcase, Building2, Calendar, CheckCircle2, GitBranch, History, Layers, Mail, Settings2, UserCheck, X, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { WorkflowRecord } from "@/features/workflow-management/types/workflow.types";
import type { WorkflowLevel } from "@/features/workflow-management/components/onboarding/types";
import { APPROVAL_OPTIONS } from "@/features/workflow-management/constants";
import { formatSnakeCaseLabel, formatWorkflowPath } from "@/features/workflow-management/utils/workflowRecord.utils";
import { cn } from "@/lib/utils";

type WorkflowManageDialogProps = {
  open: boolean;
  workflow: WorkflowRecord | null;
  onClose: () => void;
  onSubmitAction: (workflow: WorkflowRecord, action: "approve" | "reject", remark: string) => Promise<void>;
  onToggleHistory?: () => void;
  isHistoryOpen?: boolean;
  overlayClassName?: string;
  contentClassName?: string;
  contentStyle?: CSSProperties;
};

const formatToIst = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(parsed);
};

const fromApiApprover = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "REPORTING_MANAGER") return "reporting_manager";
  if (normalized === "NODE_APPROVER") return "node_approver";
  if (normalized === "HIERARCHY_APPROVER") return "hierarchy_approver";
  return value.trim().toLowerCase();
};

const toSummaryLevels = (levels: unknown): WorkflowLevel[] => {
  if (Array.isArray(levels)) {
    return levels
      .map((entry, index) => {
        const levelRecord = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
        const approver1Raw = typeof levelRecord.approver1 === "string" ? levelRecord.approver1 : "";
        const approver2Raw = typeof levelRecord.approver2 === "string" ? levelRecord.approver2 : "";
        const typeRaw = typeof levelRecord.approverType === "string"
          ? levelRecord.approverType.toUpperCase()
          : typeof levelRecord.type === "string"
            ? levelRecord.type.toUpperCase()
            : "AND";
        const type = typeRaw === "OR" ? "OR" : "AND";

        const approvals = [{ option: fromApiApprover(approver1Raw) }];
        if (approver2Raw.trim()) approvals.push({ option: fromApiApprover(approver2Raw) });

        return {
          id: typeof levelRecord.level === "number" ? levelRecord.level : index + 1,
          type,
          approvals,
        };
      })
      .filter((level) => level.approvals.some((approval) => approval.option));
  }

  if (!levels || typeof levels !== "object") return [];

  const levelEntries = Object.entries(levels as Record<string, unknown>)
    .sort(([left], [right]) => Number(left.replace(/[^\d]/g, "")) - Number(right.replace(/[^\d]/g, "")));

  return levelEntries.map(([key, value], index) => {
    const levelRecord = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    const approver1Raw = typeof levelRecord.approver1 === "string" ? levelRecord.approver1 : "";
    const approver2Raw = typeof levelRecord.approver2 === "string" ? levelRecord.approver2 : "";
    const typeRaw = typeof levelRecord.type === "string" ? levelRecord.type.toUpperCase() : "AND";
    const type = typeRaw === "OR" ? "OR" : "AND";

    const approvals = [{ option: fromApiApprover(approver1Raw) }];
    if (approver2Raw.trim()) approvals.push({ option: fromApiApprover(approver2Raw) });

    return {
      id: Number(key.replace(/[^\d]/g, "")) || index + 1,
      type,
      approvals,
    };
  }).filter((level) => level.approvals.some((approval) => approval.option));
};

function SummaryPreview({ workflow }: { workflow: WorkflowRecord }) {
  const summaryLevels = toSummaryLevels(workflow.levels);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Zap className="h-3.5 w-3.5" />
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Workflow Name</span>
          </div>
          <div className="mt-2 min-h-[2.5rem] pl-8 text-sm font-semibold leading-snug text-slate-900 break-words">
            {workflow.name || "-"}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Layers className="h-3.5 w-3.5" />
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Process Alias</span>
          </div>
          <div className="mt-2 min-h-[2.5rem] pl-8 text-sm font-semibold leading-snug text-slate-900 break-words">
            {workflow.alias || "-"}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Briefcase className="h-3.5 w-3.5" />
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Module</span>
          </div>
          <div className="mt-2 min-h-[2.5rem] pl-8 text-sm font-semibold leading-snug text-slate-900 break-words">
            {formatSnakeCaseLabel(workflow.subModule || workflow.module || "-")}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Node Name</span>
          </div>
          <div className="mt-2 min-h-[2.5rem] pl-8 text-sm font-semibold leading-snug text-slate-900 break-words">
            {workflow.nodeName || "-"}
          </div>
          {workflow.nodePath ? (
            <div className="mt-2 pl-8">
              <div className="inline-flex max-w-full rounded-md border border-sky-100 bg-sky-50/70 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.02em] text-sky-700">
                {formatWorkflowPath(workflow.nodePath)}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <h4 className="mb-3 px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Logic Chain</h4>
        <div className="space-y-2 pr-1 pb-1">
          {summaryLevels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              No level details available.
            </div>
          ) : (
            summaryLevels.map((level) => (
              <div
                key={level.id}
                className="flex min-h-[64px] items-center gap-4 rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm"
              >
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-600">
                  L{level.id}
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-4">
                  {level.approvals.map((approval, idx) => (
                    <div key={`${level.id}-${idx}`} className="flex items-center gap-4">
                      {idx > 0 ? <span className="text-[10px] font-black uppercase text-slate-300">{level.type}</span> : null}
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Approver {idx + 1}</span>
                        <span className="text-xs font-semibold text-slate-800">
                          {APPROVAL_OPTIONS.find((option) => option.id === approval.option)?.label || approval.option || "Not Assigned"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
              </div>
            ))
          )}
        </div>
      </div>

     
    </div>
  );
}

export default function WorkflowManageDialog({
  open,
  workflow,
  onClose,
  onSubmitAction,
  onToggleHistory,
  isHistoryOpen = false,
  overlayClassName,
  contentClassName,
  contentStyle,
}: WorkflowManageDialogProps) {
  const [remark, setRemark] = useState("");
  const [remarkTouched, setRemarkTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setRemark("");
      setRemarkTouched(false);
      setIsSubmitting(false);
    }
  }, [open, workflow?.id]);

  if (!workflow) return null;

  const isPending = workflow.status === "Pending";
  const isRemarkValid = Boolean(remark.trim());
  const showRemarkError = remarkTouched && !isRemarkValid;
  const initiatorName = workflow.initiatorName?.trim() || "";
  const initiatorEmail = workflow.initiatorEmail?.trim() || "";
  const initiatedOn = formatToIst(workflow.initiatedDate);
  const pendingWorkflowName = workflow.workflowName?.trim() || "";
  const pendingWorkflowAlias = workflow.workflowAlias?.trim() || "";

  const handleAction = async (action: "approve" | "reject") => {
    setRemarkTouched(true);
    if (!isRemarkValid) return;
    setIsSubmitting(true);
    try {
      await onSubmitAction(workflow, action, remark.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName={overlayClassName}
        className={cn("w-[min(92vw,44rem)] max-w-[44rem] p-0", contentClassName)}
        style={contentStyle}
      >
        <DialogHeader className="border-b border-slate-200 bg-slate-50/40 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl text-slate-900">{workflow.name}</DialogTitle>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {workflow.status}
                </span>
              </div>
              {isPending ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    {initiatorName ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                        <UserCheck size={12} className="text-slate-400" />
                        <span className="text-slate-500">By</span>
                        <span className="font-medium text-slate-700">{initiatorName}</span>
                      </span>
                    ) : null}
                    {initiatorEmail ? (
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                        <Mail size={12} className="text-slate-400" />
                        <span className="text-slate-500">Email</span>
                        <span className="truncate font-medium text-slate-700">{initiatorEmail}</span>
                      </span>
                    ) : null}
                    {initiatedOn ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                        <Calendar size={12} className="text-slate-400" />
                        <span className="text-slate-500">Initiated</span>
                        <span className="font-medium text-slate-700">{initiatedOn}</span>
                      </span>
                    ) : null}
                    {pendingWorkflowName ? (
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                        <span className="text-slate-500">Workflow</span>
                        <span className="truncate font-medium text-slate-700">{pendingWorkflowName}</span>
                      </span>
                    ) : null}
                    {pendingWorkflowAlias ? (
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                        <span className="text-slate-500">Alias</span>
                        <span className="truncate font-medium text-slate-700">{pendingWorkflowAlias}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {isPending && onToggleHistory ? (
                <button
                  type="button"
                  onClick={onToggleHistory}
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

        <div className="space-y-4 px-6 py-5">
          <SummaryPreview workflow={workflow} />

          {isPending ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <GitBranch className="h-4 w-4" />
                Action Remark
              </div>
              <Textarea
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                onBlur={() => setRemarkTouched(true)}
                maxLength={100}
                placeholder="Enter remark for approval or rejection"
                className="min-h-[90px]"
              />
              {showRemarkError ? <p className="mt-2 text-xs text-rose-600">Please enter a remark.</p> : null}
              <div className="mt-1 text-right text-[11px] text-slate-500">{remark.length}/100</div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/40 px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Close
          </Button>
          {isPending ? (
            <>
              <Button variant="outline" onClick={() => void handleAction("reject")} disabled={isSubmitting}>
                Reject
              </Button>
              <Button onClick={() => void handleAction("approve")} disabled={isSubmitting}>
                Approve
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
