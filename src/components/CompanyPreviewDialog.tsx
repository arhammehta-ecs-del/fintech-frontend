import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Company } from "@/contexts/AppContext";
import { Building2, History, Pencil, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ApprovalEvent {
  name: string;
  action: string;
  at: string;
}

interface CompanyPreviewDialogProps {
  company: Company | null;
  companyCode?: string;
  groupName: string;
  groupCode?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (company: Company) => void;
  onToggleActive?: (companyId: string, isActive: boolean) => void;
  approvalHistory?: ApprovalEvent[];
  approvalStatusLabel?: string;
  defaultEditing?: boolean;
  onAuditEvent?: (event: ApprovalEvent) => void;
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

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const renderValue = (value: string) => <p className={fieldValueClassName}>{value}</p>;

export function CompanyPreviewDialog({
  company,
  companyCode = "",
  groupName,
  groupCode = "",
  open,
  onOpenChange,
  onSave,
  onToggleActive,
  approvalHistory,
  approvalStatusLabel = "Approved",
  defaultEditing = false,
  onAuditEvent,
}: CompanyPreviewDialogProps) {
  const [isEditing, setIsEditing] = useState(defaultEditing);
  const [draft, setDraft] = useState<Company | null>(company);
  const [historyEvents, setHistoryEvents] = useState<ApprovalEvent[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    setDraft(company);
    setIsEditing(defaultEditing);
  }, [company, open, defaultEditing]);

  useEffect(() => {
    if (open) {
      setIsHistoryOpen(false);
    }
  }, [open, company?.id]);

  useEffect(() => {
    if (!company) {
      setHistoryEvents([]);
      return;
    }
    setHistoryEvents(approvalHistory ?? []);
  }, [approvalHistory, company, open]);

  const history = useMemo(() => {
    if (!company) return [];
    return historyEvents;
  }, [company, historyEvents]);

  if (!draft) return null;

  const updateField = (field: keyof Company, value: string) => {
    setDraft((previous) => (previous ? { ...previous, [field]: value } : previous));
  };

  const handleSave = () => {
    toast({
      title: "Currently not available",
      description: "Editing company details is currently not available.",
    });
  };

  const handleCancel = () => {
    setDraft(company);
    setIsEditing(false);
  };

  const isActive = draft.status === "Approved";
  const timelineEvents = history.slice(0, 12);
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

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div
            className={cn(
              "relative min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6",
              isHistoryOpen && "lg:border-r lg:border-border",
            )}
          >
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <h3 className={sectionHeadingClassName}>Company Information</h3>
                {groupName ? <p className="mt-1 text-sm text-muted-foreground">{groupName}</p> : null}
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {isEditing ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </div>
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Open company actions"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 space-y-4">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit details
                      </Button>
                      {onToggleActive && draft.status !== "Pending" && (
                        <div className="rounded-xl border border-border bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Company Status</p>
                              <p className={cn("mt-1 text-sm font-medium", isActive ? "text-success" : "text-destructive")}>
                                {isActive ? "Approved" : "Inactive"}
                              </p>
                            </div>
                            <Switch
                              checked={isActive}
                              onCheckedChange={() => {
                                toast({
                                  title: "Currently not available",
                                  description: "Status updates are currently not available.",
                                });
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                )}
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full border border-border bg-muted/20"
                        onClick={() => setIsHistoryOpen((previous) => !previous)}
                        aria-label={isHistoryOpen ? "Hide audit history" : "Show audit history"}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="end">Audit History</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <div>
                <p className={fieldLabelClassName}>Group Code</p>
                <div className="mt-2">
                  {isEditing ? <Input value={groupCode} readOnly disabled /> : renderValue(groupCode || "—")}
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>Group Name</p>
                <div className="mt-2">
                  {isEditing ? <Input value={groupName} readOnly disabled /> : renderValue(groupName || "—")}
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>Company Code</p>
                <div className="mt-2">
                  {isEditing ? <Input value={companyCode} readOnly disabled /> : renderValue(companyCode || "—")}
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>Name</p>
                <div className="mt-2">
                  {isEditing ? (
                    <Input value={draft.legalName} onChange={(event) => updateField("legalName", event.target.value)} />
                  ) : (
                    renderValue(draft.legalName)
                  )}
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>GST No</p>
                <div className="mt-2">
                  {isEditing ? <Input value={draft.gstin} readOnly disabled /> : renderValue(draft.gstin || "—")}
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>Brand</p>
                <div className="mt-2">
                  {isEditing ? (
                    <Input value={draft.companyName} onChange={(event) => updateField("companyName", event.target.value)} />
                  ) : (
                    renderValue(draft.companyName)
                  )}
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>IE Code</p>
                <div className="mt-2">
                  {isEditing ? (
                    <Input value={draft.ieCode} onChange={(event) => updateField("ieCode", event.target.value)} />
                  ) : (
                    renderValue(draft.ieCode || "—")
                  )}
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>Incorporation Date</p>
                <div className="mt-2">
                  {isEditing ? <Input type="date" value={draft.incorporationDate} readOnly disabled /> : renderValue(draft.incorporationDate || "—")}
                </div>
              </div>
              <div>
                <p className={fieldLabelClassName}>Address</p>
                <div className="mt-2">
                  {isEditing ? (
                    <Input value={draft.address} onChange={(event) => updateField("address", event.target.value)} />
                  ) : (
                    renderValue(draft.address || "—")
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "flex shrink-0 flex-col overflow-hidden transition-[width,padding] duration-300 ease-out lg:min-h-0 lg:h-full",
              isHistoryOpen
                ? "w-full border-t border-border px-4 py-4 sm:px-6 sm:py-6 lg:w-[20rem] lg:border-l lg:border-t-0 xl:w-[21rem]"
                : "w-0 px-0 py-0",
            )}
          >
            {isHistoryOpen ? (
              <Button
                type="button"
                variant="ghost"
                className="mb-3 inline-flex !h-7 w-auto flex-none self-end items-center justify-center !gap-1.5 rounded-full bg-muted !px-2.5 !py-1 text-xs font-medium opacity-100 shadow-none hover:bg-muted/80 sm:mb-4"
                onClick={() => setIsHistoryOpen(false)}
                aria-label="Hide history"
              >
                <span>Hide</span>
                <History className="h-4 w-4" />
              </Button>
            ) : null}

            {isHistoryOpen ? (
              <div className="min-h-0 flex-1 overflow-y-auto pr-0 transition-all duration-300 ease-out lg:pr-2">
                <div className="space-y-5">
                  {timelineEvents.map((event, index) => (
                    <div key={`${event.name}-${event.at}-${index}`} className="relative flex gap-3">
                      {index < timelineEvents.length - 1 && (
                        <span className="absolute left-5 top-10 h-[calc(100%-1rem)] w-px bg-border" />
                      )}
                      <div className="z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {getInitials(event.name)}
                      </div>
                      <div className="flex-1 min-w-0 pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 text-[13px] font-medium leading-5 text-foreground break-words">
                            {event.name}
                          </p>
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {event.action}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                          {format(parseISO(event.at), "MMM d, yyyy · h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                  {history.length > timelineEvents.length && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      Showing the latest {timelineEvents.length} history events
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="sr-only">Approval history is hidden</div>
            )}
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
