import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { OnboardingPayload } from "@/services/company.service";
import { formatDisplayDate } from "./utils";

type StepPreviewSubmitProps = {
  payloadPreview: OnboardingPayload;
  gstDocumentName: string;
  gstDocumentFile: File | null;
  onPreviewGstDocument: () => void;
};

export function CompanyOnboardingStepPreviewSubmit({
  payloadPreview,
  gstDocumentName,
  gstDocumentFile,
  onPreviewGstDocument,
}: StepPreviewSubmitProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-3 inline-block border-b border-slate-300 pb-1 text-sm font-semibold text-slate-700">Group Details</h3>
            <div className="space-y-1.5 text-sm text-foreground">
              <p>
                <span className="font-medium tracking-wide text-slate-500">Group Name:</span> <span className="font-semibold text-slate-900">{payloadPreview.group.name || "-"}</span>
              </p>
              {payloadPreview.group.groupCode ? (
                <p>
                  <span className="font-medium tracking-wide text-slate-500">Group Code:</span> <span className="font-semibold text-slate-900">{payloadPreview.group.groupCode}</span>
                </p>
              ) : null}
              {payloadPreview.group.remarks ? (
                <p>
                  <span className="font-medium tracking-wide text-slate-500">Remarks:</span> <span className="font-semibold text-slate-900">{payloadPreview.group.remarks}</span>
                </p>
              ) : null}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 inline-block border-b border-slate-300 pb-1 text-sm font-semibold text-slate-700">Company Details</h3>
            <div className="space-y-1.5 text-sm text-foreground">
              <p className="flex items-start gap-1">
                <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">Legal Name</span>
                <span className="font-medium tracking-wide text-slate-500">:</span>
                <span className="font-semibold text-slate-900">{payloadPreview.company.name}</span>
              </p>
              <p className="flex items-start gap-1">
                <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">Company Name</span>
                <span className="font-medium tracking-wide text-slate-500">:</span>
                <span className="font-semibold text-slate-900">{payloadPreview.company.brand}</span>
              </p>
              <p className="flex items-start gap-1">
                <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">GST</span>
                <span className="font-medium tracking-wide text-slate-500">:</span>
                <span className="font-semibold text-slate-900">{payloadPreview.company.gst}</span>
              </p>
              <p className="flex items-start gap-1">
                <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">GST Document</span>
                <span className="font-medium tracking-wide text-slate-500">:</span>
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="break-all font-semibold text-slate-900">{gstDocumentName || "-"}</span>
                  {gstDocumentFile ? (
                    <button
                      type="button"
                      onClick={onPreviewGstDocument}
                      className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Preview
                    </button>
                  ) : null}
                </span>
              </p>
              <p className="flex items-start gap-1">
                <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">IE Code</span>
                <span className="font-medium tracking-wide text-slate-500">:</span>
                <span className="font-semibold text-slate-900">{payloadPreview.company.ieCode}</span>
              </p>
              <p className="flex items-start gap-1">
                <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">Registration Date</span>
                <span className="font-medium tracking-wide text-slate-500">:</span>
                <span className="font-semibold text-slate-900">{formatDisplayDate(payloadPreview.company.registeredAt)}</span>
              </p>
              <p className="flex items-start gap-1">
                <span className="w-28 shrink-0 font-medium tracking-wide text-slate-500">Address</span>
                <span className="font-medium tracking-wide text-slate-500">:</span>
                <span className="font-semibold text-slate-900">{payloadPreview.company.address}</span>
              </p>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="inline-block border-b border-slate-300 pb-1 text-sm font-semibold text-slate-700">New Signatory</h3>
            </div>
            <div className="space-y-3">
              {payloadPreview.signatories.map((sig, index) => (
                <div key={`${sig.email}-${sig.name}`} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Signatory {index + 1}</p>
                  <div className="grid grid-cols-1 gap-y-1.5 text-sm text-foreground sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] sm:gap-x-4">
                    <p className="min-w-0">
                      <span className="font-medium tracking-wide text-slate-500">Name:</span> <span className="font-semibold text-slate-900">{sig.name}</span>
                    </p>
                    <p className="min-w-0">
                      <span className="font-medium tracking-wide text-slate-500">Email:</span> <span className="break-all font-semibold text-slate-900">{sig.email}</span>
                    </p>
                    <p className="min-w-0">
                      <span className="font-medium tracking-wide text-slate-500">Phone:</span> <span className="font-semibold text-slate-900">{sig.phone}</span>
                    </p>
                    <p className="min-w-0">
                      <span className="font-medium tracking-wide text-slate-500">Designation:</span> <span className="font-semibold text-slate-900">{sig.designation}</span>
                    </p>
                    {sig.employeeId ? (
                      <p className="min-w-0 sm:col-span-2">
                        <span className="font-medium tracking-wide text-slate-500">Employee ID:</span> <span className="font-semibold text-slate-900">{sig.employeeId}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
        Status: Not Submitted
      </Badge>
    </div>
  );
}

export default CompanyOnboardingStepPreviewSubmit;
