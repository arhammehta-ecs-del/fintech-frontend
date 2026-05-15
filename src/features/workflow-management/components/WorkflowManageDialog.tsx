import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BadgeCheck, Calendar, CheckCircle2, GitBranch, History, Mail, Settings2, UserCheck, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { WorkflowRecord } from "@/features/workflow-management/types/workflow.types";
import { APPROVAL_OPTIONS } from "@/features/workflow-management/constants";
import { formatSnakeCaseLabel } from "@/features/workflow-management/utils/workflowRecord.utils";
import { cn } from "@/lib/utils";
import { formatToIst, SummaryPreview } from "@/features/workflow-management/components/WorkflowManageDialogSummary";

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
  preventOutsideClose?: boolean;
};


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
  preventOutsideClose = false,
}: WorkflowManageDialogProps) {
  const remarkCardRef = useRef<HTMLDivElement | null>(null);
  const remarkInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [remark, setRemark] = useState("");
  const [remarkTouched, setRemarkTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    if (!open) {
      setRemark("");
      setRemarkTouched(false);
      setIsSubmitting(false);
      setPendingDecision(null);
    }
  }, [open, workflow?.id]);

  useEffect(() => {
    if (!pendingDecision) return;
    requestAnimationFrame(() => {
      remarkCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      remarkInputRef.current?.focus();
    });
  }, [pendingDecision]);

  if (!workflow) return null;

  const isPending = workflow.status === "Pending";
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
        className={cn("flex max-h-[88vh] w-[min(92vw,44rem)] max-w-[44rem] flex-col overflow-hidden p-0", contentClassName)}
        style={contentStyle}
      >
        <DialogDescription className="sr-only">
          Review workflow details, approval chain, history, and submit approve or reject actions.
        </DialogDescription>
        <DialogHeader className="border-b border-slate-200 bg-slate-50/40 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <DialogTitle className="text-xl text-slate-900">{workflow.name}</DialogTitle>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider",
                  workflow.status === "Pending"
                    ? "border-amber-200 bg-amber-100 text-amber-700"
                    : workflow.status === "Inactive"
                      ? "border-rose-200 bg-rose-100 text-rose-700"
                      : "border-emerald-200 bg-emerald-100 text-emerald-700",
                )}>
                  {workflow.status || "Active"}
                </span>
              </div>
              {isPending ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2">
                  {isHistoryOpen ? (
                    <div className="overflow-x-auto text-[12px]">
                      <div className="flex w-max min-w-full flex-nowrap items-center gap-2">
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
                  ) : (
                    <div className="space-y-2 text-[12px]">
                      <div className="overflow-x-auto">
                        <div className="flex w-max min-w-full flex-nowrap items-center gap-2">
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
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <div className="flex w-max min-w-full flex-nowrap items-center gap-2">
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
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {isPending && onToggleHistory ? (
                <TooltipProvider delayDuration={120}>
                  <Tooltip>
                    <TooltipTrigger asChild>
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
                    </TooltipTrigger>
                    <TooltipContent side="top">Workflow History</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
          <SummaryPreview workflow={workflow} />

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
                className="min-h-[90px]"
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
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
