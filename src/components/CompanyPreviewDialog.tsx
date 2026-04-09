import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Company } from "@/contexts/AppContext";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

// export interface ApprovalEvent {
//   name: string;
//   action: string;
//   at: string;
// }

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
  approvalStatusLabel?: string;
  defaultEditing?: boolean;
  // onAuditEvent?: (event: ApprovalEvent) => void;
}

const statusColors = {
  Approved: "bg-success/10 text-success border-success/20",
  Pending: "bg-warning/10 text-warning border-warning/20",
  Inactive: "bg-destructive/10 text-destructive border-destructive/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
} as const;

const fieldLabelClassName = "text-[11px] uppercase tracking-[0.06em] text-muted-foreground";
const fieldValueClassName = "text-[14px] font-medium text-foreground";
const sectionHeadingClassName = "text-[15px] font-medium text-foreground";

const renderValue = (value: string) => <p className={fieldValueClassName}>{value}</p>;

const formatDisplayDate = (value: string) => {
  if (!value) return "—";

  try {
    return format(parseISO(value), "dd/MMM/yyyy");
  } catch {
    return value;
  }
};

export function CompanyPreviewDialog({
  company,
  companyCode = "",
  groupName,
  groupCode = "",
  open,
  onOpenChange,
  onSave,
  onToggleActive,
  // approvalHistory,
  approvalStatusLabel = "Approved",
  defaultEditing = false,
  // onAuditEvent,
}: CompanyPreviewDialogProps) {
  const [draft, setDraft] = useState<Company | null>(company);

  useEffect(() => {
    setDraft(company);
  }, [company]);

  if (!draft) return null;
  const headerCompanyName = company?.companyName ?? draft.companyName;
  const headerBrand = company?.brand ?? draft.brand;

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
                  {headerBrand && headerBrand !== headerCompanyName
                    ? `${headerCompanyName} = ${headerBrand}`
                    : headerCompanyName}
                </DialogTitle>
                {groupName ? <p className="mt-1 text-sm text-muted-foreground">{groupName}</p> : null}
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn("text-xs", statusColors[approvalStatusLabel as keyof typeof statusColors] ?? statusColors.Approved)}
            >
              {approvalStatusLabel}
            </Badge>
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
                    {renderValue(groupCode)}
                  </div>
                </div>
              ) : null}
              {groupName ? (
                <div>
                  <p className={fieldLabelClassName}>Group Name</p>
                  <div className="mt-2">
                    {renderValue(groupName)}
                  </div>
                </div>
              ) : null}
              <div>
                <p className={fieldLabelClassName}>Company Code</p>
                <div className="mt-2">
                  {renderValue(companyCode || "—")}
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>Name</p>
                <div className="mt-2">
                  {renderValue(draft.legalName)}
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>GST No</p>
                <div className="mt-2">
                  {renderValue(draft.gstin || "—")}
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>Brand</p>
                <div className="mt-2">
                  {renderValue(draft.companyName)}
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>IE Code</p>
                <div className="mt-2">
                  {renderValue(draft.ieCode || "—")}
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>Incorporation Date</p>
                <div className="mt-2">
                  {renderValue(formatDisplayDate(draft.incorporationDate))}
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>Address</p>
                <div className="mt-2">
                  {renderValue(draft.address || "—")}
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
