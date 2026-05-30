import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type OrgStatusUpdatePopupProps = {
  open: boolean;
  nodeName: string;
  nodeTrail?: string[];
  nodeType: string;
  selectedLevelsHash: string;
  remarks: string;
  workflowOptions: Array<{ id: string; label: string }>;
  submitLabel: string;
  onOpenChange: (open: boolean) => void;
  onWorkflowChange: (value: string) => void;
  onRemarksChange: (value: string) => void;
  onSubmit: () => void;
};

export function OrgStatusUpdatePopup({
  open,
  nodeName,
  nodeTrail = [],
  nodeType,
  selectedLevelsHash,
  remarks,
  workflowOptions,
  submitLabel,
  onOpenChange,
  onWorkflowChange,
  onRemarksChange,
  onSubmit,
}: OrgStatusUpdatePopupProps) {
  const displayNodeName = nodeName.trim() || "New Node";
  const displayTrail = nodeTrail.length > 0 ? nodeTrail : [displayNodeName];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[45rem] overflow-visible gap-0 rounded-2xl border border-slate-200 bg-white p-0 shadow-[0_20px_64px_rgba(15,23,42,0.16)]">
        <DialogHeader className="border-b border-slate-100 px-6 pb-4 pt-5">
          <DialogTitle className="text-[1.5rem] font-semibold tracking-[-0.02em] text-slate-950">
            Org Status Update
          </DialogTitle>
          <DialogDescription className="sr-only">
            Review prefilled node details and submit status update with optional workflow.
          </DialogDescription>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(248,250,252,0.98))] px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">Updating Node</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {displayTrail.map((trailName, index) => {
                const isLast = index === displayTrail.length - 1;
                return (
                  <div key={`${trailName}-${index}`} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-sm ring-1",
                        isLast
                          ? "bg-[#3553E9] font-semibold text-white ring-blue-500/40 shadow-[0_0_0_3px_rgba(53,83,233,0.14)]"
                          : "bg-white font-medium text-slate-600 ring-slate-200",
                      )}
                    >
                      {trailName}
                    </span>
                    {!isLast ? (
                      <span className="shrink-0 text-slate-300" aria-hidden="true">
                        →
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2.5">
            <Label className="text-[15px] font-medium text-slate-900">Node name</Label>
            <div
              className={cn(
                "h-10 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[15px] leading-10 text-slate-700 shadow-sm",
              )}
            >
              {displayNodeName}
            </div>
          </div>

          <div className="space-y-2.5">
            <Label className="text-[15px] font-medium text-slate-900">Node Type</Label>
            <div
              className={cn(
                "h-10 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[15px] leading-10 text-slate-700 shadow-sm",
              )}
            >
              {nodeType || "-"}
            </div>
          </div>

          <div className="space-y-2.5">
            <Label className="text-[15px] font-medium text-slate-900">Remark</Label>
            <Textarea
              value={remarks}
              onChange={(event) => onRemarksChange(event.target.value)}
              placeholder="Enter remarks for this status update..."
              className="min-h-[88px] rounded-xl border-slate-200 bg-white text-[14px]"
              maxLength={250}
            />
            <p className="text-right text-[11px] text-slate-400">{remarks.length}/250</p>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:space-x-3">
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button variant="outline" className="h-10 rounded-xl px-5" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Select value={selectedLevelsHash || "__none__"} onValueChange={(value) => onWorkflowChange(value === "__none__" ? "" : value)}>
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3.5 text-[14px] shadow-sm sm:w-[260px]">
                <SelectValue placeholder="Select workflow" />
              </SelectTrigger>
              <SelectContent side="top" align="end">
                <SelectItem value="__none__">No Workflow</SelectItem>
                {workflowOptions.map((workflowOption) => (
                  <SelectItem key={workflowOption.id} value={workflowOption.id}>
                    {workflowOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="h-10 min-w-[160px] rounded-xl px-6" onClick={onSubmit}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OrgStatusUpdatePopup;
