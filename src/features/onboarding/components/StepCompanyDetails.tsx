import { useRef } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type StepCompanyDetailsProps = {
  errors: Record<string, string>;
  legalName: string;
  companyName: string;
  ieCode: string;
  incDate: string;
  todayDateInputValue: string;
  gstin: string;
  gstDocumentName: string;
  address: string;
  onLegalNameChange: (value: string) => void;
  onCompanyNameChange: (value: string) => void;
  onIeCodeChange: (value: string) => void;
  onIncDateChange: (value: string) => void;
  onGstinChange: (value: string) => void;
  onGstDocumentChange: (file: File | null) => void;
  onAddressChange: (value: string) => void;
};

export function StepCompanyDetails({
  errors,
  legalName,
  companyName,
  ieCode,
  incDate,
  todayDateInputValue,
  gstin,
  gstDocumentName,
  address,
  onLegalNameChange,
  onCompanyNameChange,
  onIeCodeChange,
  onIncDateChange,
  onGstinChange,
  onGstDocumentChange,
  onAddressChange,
}: StepCompanyDetailsProps) {
  const gstDocumentInputRef = useRef<HTMLInputElement | null>(null);

  const clearGstDocument = () => {
    onGstDocumentChange(null);
    if (gstDocumentInputRef.current) {
      gstDocumentInputRef.current.value = "";
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-right-4 duration-300 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Legal Name</Label>
        <Input value={legalName} onChange={(event) => onLegalNameChange(event.target.value.toUpperCase())} />
        {errors.legalName ? <p className="text-sm text-destructive">{errors.legalName}</p> : null}
      </div>
      <div className="space-y-2">
        <Label>Company Name</Label>
        <Input value={companyName} onChange={(event) => onCompanyNameChange(event.target.value)} />
        {errors.companyName ? <p className="text-sm text-destructive">{errors.companyName}</p> : null}
      </div>
      <div className="space-y-2">
        <Label>IE Code</Label>
        <Input value={ieCode} onChange={(event) => onIeCodeChange(event.target.value)} />
        {errors.ieCode ? <p className="text-sm text-destructive">{errors.ieCode}</p> : null}
      </div>
      <div className="space-y-2">
        <Label>Incorporation Date</Label>
        <Input type="date" value={incDate} max={todayDateInputValue} onChange={(event) => onIncDateChange(event.target.value)} />
        {errors.incDate ? <p className="text-sm text-destructive">{errors.incDate}</p> : null}
      </div>
      <div className="space-y-2">
        <Label>GST</Label>
        <Input value={gstin} onChange={(event) => onGstinChange(event.target.value)} />
        {errors.gstin ? <p className="text-sm text-destructive">{errors.gstin}</p> : null}
        <div className="space-y-2 pt-1">
          <Label htmlFor="gstDocument">Upload Company GST (Optional)</Label>
          <input
            id="gstDocument"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="sr-only"
            ref={gstDocumentInputRef}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              onGstDocumentChange(file);
            }}
          />
          <div className="relative">
            <label
              htmlFor="gstDocument"
              className="flex min-h-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center transition-colors hover:border-primary/50 hover:bg-slate-100"
            >
              <span className="text-xs text-slate-500">
                {gstDocumentName || "Click to choose image/document or drag here"}
              </span>
            </label>
            {gstDocumentName ? (
              <button
                type="button"
                onClick={clearGstDocument}
                aria-label="Clear uploaded GST document"
                className="absolute right-2 top-2 rounded-full border border-slate-300 bg-white p-1 text-slate-500 transition-colors hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
          <p className="text-center text-xs font-medium text-primary">+ Add New Attachment</p>
          {errors.gstDocument ? <p className="text-sm text-destructive">{errors.gstDocument}</p> : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Textarea className="min-h-48 resize" value={address} onChange={(event) => onAddressChange(event.target.value)} />
        {errors.address ? <p className="text-sm text-destructive">{errors.address}</p> : null}
      </div>
    </div>
  );
}

export default StepCompanyDetails;
