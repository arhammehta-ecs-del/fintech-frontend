import { format, isValid, parse, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogFooter,DialogHeader,DialogTitle,} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { Company } from "@/contexts/AppContext";
import { Building2 } from "lucide-react";
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

const fieldLabelClassName = "text-[11px] uppercase tracking-[0.06em] text-muted-foreground";
const fieldValueClassName = "text-[14px] font-medium text-foreground";
const sectionHeadingClassName = "text-[15px] font-medium text-foreground";
const displayValue = (value?: string | null) => (value && value.trim() ? value : "—");

const formatDisplayDate = (value?: string) => {
  if (!value) return "—";
  const isoDate = parseISO(value);
  if (isValid(isoDate)) return format(isoDate, "dd MMM yyyy");

  const parsedDate = parse(value, "dd/MM/yyyy", new Date());
  if (isValid(parsedDate)) return format(parsedDate, "dd MMM yyyy");

  return value;
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
  if (!company) return null;
  const headerCompanyName = company.companyName;
  const statusLabel = approvalStatusLabel ?? company.status;
  const isActive = company.status === "Approved";
  const showActiveToggle = Boolean(onToggleActive) && company.status === "Inactive";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[100dvh] w-[100vw] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[78vh] sm:w-[min(92vw,60rem)] sm:max-w-[60rem] sm:rounded-lg"
        showCloseButton={false}
      >
        <DialogHeader className="border-b border-border bg-muted/20 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  {headerCompanyName}
                </DialogTitle>
                {groupName ? <p className="mt-1 text-sm text-muted-foreground">{groupName}</p> : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={cn("text-xs", statusColors[statusLabel])}
              >
                {statusLabel}
              </Badge>
              {showActiveToggle ? (
                <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Inactive</span>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => onToggleActive?.(company.id, checked)}
                    aria-label="Toggle company active status"
                  />
                  <span className="text-xs font-medium text-muted-foreground">Active</span>
                </div>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <h3 className={sectionHeadingClassName}>Company Information</h3>
                {groupName ? <p className="mt-1 text-sm text-muted-foreground">{groupName}</p> : null}
              </div>
            </div>

            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              {groupCode ? (
                <div>
                  <p className={fieldLabelClassName}>Group Code</p>
                  <div className="mt-2">
                    <p className={fieldValueClassName}>{displayValue(groupCode)}</p>
                  </div>
                </div>
              ) : null}
              {groupName ? (
                <div>
                  <p className={fieldLabelClassName}>Group Name</p>
                  <div className="mt-2">
                    <p className={fieldValueClassName}>{displayValue(groupName)}</p>
                  </div>
                </div>
              ) : null}
              <div>
                <p className={fieldLabelClassName}>Company Code</p>
                <div className="mt-2">
                  <p className={fieldValueClassName}>{displayValue(companyCode)}</p>
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>Legal Name</p>
                <div className="mt-2">
                  <p className={fieldValueClassName}>{displayValue(company.legalName)}</p>
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>GST No</p>
                <div className="mt-2">
                  <p className={fieldValueClassName}>{displayValue(company.gstin)}</p>
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>Company Name</p>
                <div className="mt-2">
                  <p className={fieldValueClassName}>{displayValue(company.companyName)}</p>
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>IE Code</p>
                <div className="mt-2">
                  <p className={fieldValueClassName}>{displayValue(company.ieCode)}</p>
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>Incorporation Date</p>
                <div className="mt-2">
                  <p className={fieldValueClassName}>{formatDisplayDate(company.incorporationDate)}</p>
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>Address</p>
                <div className="mt-2">
                  <p className={fieldValueClassName}>{displayValue(company.address)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-muted/10 px-4 py-4 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
