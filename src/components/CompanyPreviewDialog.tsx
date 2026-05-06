import { useEffect, useRef, useState, type ReactNode } from "react";
import { format, isValid, parse, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Company } from "@/contexts/AppContext";
import { Building2, Check, Clock3, Mail, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";

// export interface ApprovalEvent {
//   name: string;
//   action: string;
//   at: string;
// }

// Internal helper types
type ApprovalStatusLabel = "Approved" | "Pending" | "Inactive" | "Rejected";

// Public props
interface CompanyPreviewDialogProps {
  company: Company | null;
  companyCode?: string;
  groupName: string;
  groupCode?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (company: Company) => void;
  onToggleActive?: (companyId: string, isActive: boolean) => void;
  // approvalHistory?: ApprovalEvent[];
  approvalStatusLabel?: ApprovalStatusLabel;
  defaultEditing?: boolean;
  // onAuditEvent?: (event: ApprovalEvent) => void;
}

// Shared constants and helpers
const statusColors = {
  Approved: "bg-success/10 text-success border-success/20",
  Pending: "bg-warning/10 text-warning border-warning/20",
  Inactive: "bg-destructive/10 text-destructive border-destructive/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
} as const satisfies Record<ApprovalStatusLabel, string>;

const fieldLabelClassName = "text-[12px] font-medium text-slate-500";
const fieldValueClassName = "text-[15px] font-semibold text-slate-900";
const sectionHeadingClassName = "text-[15px] font-semibold text-foreground";
const displayValue = (value?: string | null) => (value && value.trim() ? value : "—");

type InfoFieldProps = {
  label: string;
  value: ReactNode;
  className?: string;
};

function InfoField({ label, value, className }: InfoFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className={fieldLabelClassName}>{label}</p>
      <div className={fieldValueClassName}>{value}</div>
    </div>
  );
}

function CodePill({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1.5 text-xs font-semibold leading-none tracking-[0.03em] text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {value}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_14px_1fr] gap-2 py-1.5">
      <p className="text-sm text-slate-700">{label}</p>
      <span className="text-slate-400">:</span>
      <div className="text-[15px] font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SignatoryDetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_14px_1fr] gap-2 py-0.5">
      <p className="text-sm text-slate-700">{label}</p>
      <span className="text-slate-400">:</span>
      <div className="text-sm font-semibold text-slate-900 break-all">{value}</div>
    </div>
  );
}

const formatDisplayDate = (value?: string) => {
  if (!value) return "—";
  const isoDate = parseISO(value);
  if (isValid(isoDate)) return format(isoDate, "dd MMM yyyy");

  const parsedDate = parse(value, "dd/MM/yyyy", new Date());
  if (isValid(parsedDate)) return format(parsedDate, "dd MMM yyyy");

  return value;
};

const formatUtcToIstDateTime = (value?: string) => {
  if (!value) return "—";
  const utcDate = new Date(value);
  if (Number.isNaN(utcDate.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(utcDate);
};

export function CompanyPreviewDialog({
  company,
  companyCode,
  groupName,
  groupCode,
  open,
  onOpenChange,
  // onSave,
  onToggleActive,
  // approvalHistory,
  approvalStatusLabel,
  // defaultEditing = false,
  // onAuditEvent,
}: CompanyPreviewDialogProps) {
  const remarkCardRef = useRef<HTMLDivElement | null>(null);
  const remarkInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [pendingDecision, setPendingDecision] = useState<"approve" | "reject" | null>(null);
  const [pendingRemark, setPendingRemark] = useState("");
  const [remarkTouched, setRemarkTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setPendingDecision(null);
      setPendingRemark("");
      setRemarkTouched(false);
    }
  }, [open, company?.id]);
  useEffect(() => {
    if (!pendingDecision) return;
    requestAnimationFrame(() => {
      remarkCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      remarkInputRef.current?.focus();
    });
  }, [pendingDecision]);

  if (!company) return null;
  const headerCompanyName = company.companyName;
  const statusLabel = approvalStatusLabel ?? company.status;
  const isActive = company.status === "Approved";
  const showActiveToggle = Boolean(onToggleActive) && (company.status === "Approved" || company.status === "Inactive");
  const showPendingActions = Boolean(onToggleActive) && statusLabel === "Pending";
  const signatoriesForPreview = company.signatories;
  const pendingMetaName = displayValue(company.requesterName);
  const pendingMetaEmail = displayValue(company.requesterEmail);
  const pendingMetaInitiatedAt = formatUtcToIstDateTime(company.requestInitiatedAt);
  const isRemarkValid = Boolean(pendingRemark.trim());
  const showRemarkError = remarkTouched && !isRemarkValid;

  const handleStartPendingAction = (action: "approve" | "reject") => {
    setPendingDecision(action);
    setRemarkTouched(false);
  };

  const handleSubmitPendingAction = () => {
    setRemarkTouched(true);
    if (!isRemarkValid || !pendingDecision) return;
    onToggleActive?.(company.id, pendingDecision === "approve", pendingRemark.trim());
    setPendingDecision(null);
    setPendingRemark("");
    setRemarkTouched(false);
  };

  const handleClosePendingAction = () => {
    setPendingDecision(null);
    setPendingRemark("");
    setRemarkTouched(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[100dvh] w-[100vw] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[88vh] sm:w-[min(92vw,64rem)] sm:max-w-[64rem] sm:rounded-lg"
        showCloseButton={false}
      >
        <DialogHeader className="border-b border-border bg-muted/20 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl">{headerCompanyName}</DialogTitle>
                  <Badge variant="outline" className={cn("text-xs", statusColors[statusLabel])}>
                    {statusLabel}
                  </Badge>
                </div>
                {groupName ? <p className="mt-1 text-sm text-muted-foreground">{groupName}</p> : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {showActiveToggle ? (
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => onToggleActive?.(company.id, true)}
                    className={cn(
                      "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
                      isActive
                        ? "bg-[#3b5bdb] text-white shadow-[0_4px_12px_rgba(59,91,219,0.35)]"
                        : "text-slate-500 hover:text-slate-700",
                    )}
                    aria-pressed={isActive}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleActive?.(company.id, false)}
                    className={cn(
                      "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
                      !isActive
                        ? "bg-[#3b5bdb] text-white shadow-[0_4px_12px_rgba(59,91,219,0.35)]"
                        : "text-slate-500 hover:text-slate-700",
                    )}
                    aria-pressed={!isActive}
                  >
                    Inactive
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close dialog"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-slate-500 transition-colors hover:bg-muted hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-5">
            {showPendingActions ? (
              <div className="mb-4 rounded-xl border border-slate-200/90 bg-gradient-to-r from-slate-50 to-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-700">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200/80">
                    <UserRound className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-slate-500">Initiator </span>
                    <span className="font-semibold text-slate-900">{pendingMetaName}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200/80">
                    <Mail className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-slate-500"> Email</span>
                    <span className="font-semibold text-slate-900">{pendingMetaEmail}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200/80">
                    <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-slate-500">Initiated On </span>
                    <span className="font-semibold text-slate-900">{pendingMetaInitiatedAt}</span>
                  </span>
                </div>
              </div>
            ) : null}
            <div className="mb-6">
              <h3 className={sectionHeadingClassName}>Company Information</h3>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <Card className="overflow-hidden border-border/70 bg-background shadow-sm">
                  <div className="p-5">
                    <div className="mb-4 border-b border-border/60 pb-3">
                      <h4 className="text-sm font-semibold text-foreground">Group Details</h4>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <InfoField label="Group Name" value={displayValue(groupName)} />
                      <InfoField label="Group Code" value={groupCode ? <CodePill value={groupCode} /> : "—"} />
                    </div>
                  </div>
                </Card>

                <Card className="overflow-hidden border-border/70 bg-background shadow-sm">
                  <div className="p-5">
                    <div className="mb-4 border-b border-border/60 pb-3">
                      <h4 className="text-sm font-semibold text-foreground">Company Details</h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">Legal and registration data</p>
                    </div>
                    <div className="space-y-0.5">
                      <DetailRow label="Company Code" value={companyCode ? <CodePill value={companyCode} /> : "—"} />
                      <DetailRow label="Legal Name" value={displayValue(company.legalName)} />
                      <DetailRow label="Company Name" value={displayValue(company.companyName)} />
                      <DetailRow label="GST" value={displayValue(company.gstin)} />
                      <DetailRow label="IE Code" value={displayValue(company.ieCode)} />
                      <DetailRow label="Incorporation Date" value={formatDisplayDate(company.incorporationDate)} />
                      <DetailRow label="Address" value={displayValue(company.address)} />
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="overflow-hidden border-border/70 bg-background shadow-sm">
                <div className="p-5">
                  <div className="mb-4 border-b border-border/60 pb-3">
                    <h4 className="text-sm font-semibold text-foreground">New Signatory</h4>
                  </div>

                  <div className="space-y-3">
                    {signatoriesForPreview.length > 0 ? (
                      signatoriesForPreview.map((signatory, index) => (
                        <div key={`${signatory.email}-${index}`} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                          <p className="inline-block border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Signatory {index + 1}
                          </p>
                          <div className="mt-2 space-y-1">
                            <SignatoryDetailRow label="Name" value={displayValue(signatory.fullName)} />
                            <SignatoryDetailRow label="Email" value={displayValue(signatory.email)} />
                            <SignatoryDetailRow label="Phone" value={displayValue(signatory.phone)} />
                            <SignatoryDetailRow label="Designation" value={displayValue(signatory.designation)} />
                            {signatory.employeeId?.trim() ? (
                              <SignatoryDetailRow label="Employee ID" value={displayValue(signatory.employeeId)} />
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-5 text-sm text-muted-foreground">
                        No signatory details available.
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {showPendingActions && pendingDecision ? (
              <Card ref={remarkCardRef} className="mt-4 border-border/70 bg-background shadow-sm">
                <div className="space-y-3 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      {pendingDecision === "approve" ? "Approve Remark" : "Reject Remark"}
                    </h4>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Remark is required before submitting this action.</p>
                      <div className="text-[11px] text-muted-foreground">
                        {pendingRemark.length}/100
                      </div>
                    </div>
                  </div>
                  <Textarea
                    ref={remarkInputRef}
                    value={pendingRemark}
                    onChange={(event) => setPendingRemark(event.target.value)}
                    onBlur={() => setRemarkTouched(true)}
                    maxLength={100}
                    placeholder={`Enter remark for ${pendingDecision === "approve" ? "approval" : "rejection"}`}
                    className="min-h-[88px]"
                  />
                  {showRemarkError ? <p className="text-xs text-destructive">Please enter a remark.</p> : null}
                </div>
              </Card>
            ) : null}
          </div>
        </div>
        <DialogFooter className="border-t border-border bg-muted/10 px-4 py-4 sm:px-6">
          <div className="flex w-full items-center justify-end gap-2">
            {showPendingActions ? (
              pendingDecision === "approve" ? (
                <>
                  <Button variant="outline" onClick={handleClosePendingAction}>
                    Close
                  </Button>
                  <Button
                    className="rounded-full px-6 bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={handleSubmitPendingAction}
                    disabled={!isRemarkValid}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </>
              ) : pendingDecision === "reject" ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleSubmitPendingAction}
                    disabled={!isRemarkValid}
                    className="rounded-full px-6 border-red-600 bg-red-600 text-white hover:bg-red-700 hover:text-white"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button variant="outline" onClick={handleClosePendingAction}>
                    Close
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => handleStartPendingAction("reject")} className="rounded-full px-6">
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button className="rounded-full px-6 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => handleStartPendingAction("approve")}>
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </>
              )
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
