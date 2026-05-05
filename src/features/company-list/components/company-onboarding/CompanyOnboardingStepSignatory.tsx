import { Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { SignatoryForm, SignatoryWithId } from "./types";

type StepSignatoryProps = {
  errors: Record<string, string>;
  isExistingGroup: boolean;
  existingSignatories: SignatoryWithId[];
  signatories: SignatoryForm[];
  linkedSigIds: Set<string>;
  editingSignatoryIds: Set<string>;
  totalSignatories: number;
  showNewSignatoryForm: boolean;
  newSig: Omit<SignatoryForm, "id" | "source">;
  newSigErrors: Record<string, string>;
  signatoryValidationAttempted: boolean;
  onSetShowNewSignatoryForm: (show: boolean) => void;
  onSetNewSigErrors: (errors: Record<string, string>) => void;
  onSetNewSig: (updater: (current: Omit<SignatoryForm, "id" | "source">) => Omit<SignatoryForm, "id" | "source">) => void;
  onAddSignatory: () => void;
  onToggleLinkedSig: (sig: SignatoryWithId) => void;
  onToggleSignatoryEditing: (id: string) => void;
  onUpdateSignatory: (id: string, key: keyof SignatoryForm, value: string) => void;
  onRequestSignatoryRemove: (signatory: SignatoryForm) => void;
};

export function CompanyOnboardingStepSignatory({
  errors,
  isExistingGroup,
  existingSignatories,
  signatories,
  linkedSigIds,
  editingSignatoryIds,
  totalSignatories,
  showNewSignatoryForm,
  newSig,
  newSigErrors,
  signatoryValidationAttempted,
  onSetShowNewSignatoryForm,
  onSetNewSigErrors,
  onSetNewSig,
  onAddSignatory,
  onToggleLinkedSig,
  onToggleSignatoryEditing,
  onUpdateSignatory,
  onRequestSignatoryRemove,
}: StepSignatoryProps) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Label>New Signatory</Label>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 self-start"
          disabled={signatories.length >= 3}
          onClick={() => {
            onSetShowNewSignatoryForm(true);
            onSetNewSigErrors({});
          }}
        >
          <Plus className="h-3 w-3" /> Add Signatory
        </Button>
      </div>

      {signatoryValidationAttempted && errors.signatories === "Details can't be same" ? (
        <p className="text-sm text-destructive">Details can&apos;t be same</p>
      ) : null}

      {showNewSignatoryForm ? (
        <Card className="p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-foreground">Add Signatory</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newSig.fullName}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  onSetNewSig((current) => ({ ...current, fullName: nextValue }));
                  onSetNewSigErrors({ ...newSigErrors, fullName: "" });
                }}
              />
              {newSigErrors.fullName ? <p className="text-sm text-destructive">{newSigErrors.fullName}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newSig.email}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  onSetNewSig((current) => ({ ...current, email: nextValue }));
                  onSetNewSigErrors({ ...newSigErrors, email: "" });
                }}
              />
              {newSigErrors.email ? <p className="text-sm text-destructive">{newSigErrors.email}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={newSig.phone}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  onSetNewSig((current) => ({ ...current, phone: nextValue }));
                  onSetNewSigErrors({ ...newSigErrors, phone: "" });
                }}
              />
              {newSigErrors.phone ? <p className="text-sm text-destructive">{newSigErrors.phone}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input
                value={newSig.designation}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  onSetNewSig((current) => ({ ...current, designation: nextValue }));
                  onSetNewSigErrors({ ...newSigErrors, designation: "" });
                }}
              />
              {newSigErrors.designation ? <p className="text-sm text-destructive">{newSigErrors.designation}</p> : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Employee ID</Label>
              <Input value={newSig.employeeId} onChange={(event) => onSetNewSig((current) => ({ ...current, employeeId: event.target.value }))} />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={onAddSignatory} className="w-full sm:w-auto">
                Add Signatory
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  onSetShowNewSignatoryForm(false);
                  onSetNewSigErrors({});
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {signatoryValidationAttempted &&
      !showNewSignatoryForm &&
      errors.signatories &&
      (totalSignatories < 2 || totalSignatories > 3) ? (
        <p className="text-sm text-destructive">{errors.signatories}</p>
      ) : null}

      {signatories.length > 0 ? (
        <div className="space-y-3">
          {signatories.map((sig, index) => (
            <Card key={sig.id} className="border border-slate-200 p-3 shadow-none">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{sig.fullName || `Signatory ${index + 1}`}</p>
                  {sig.source === "existing" ? <p className="text-xs text-muted-foreground">Existing group signatory</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => onToggleSignatoryEditing(sig.id)} className="text-muted-foreground hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => onRequestSignatoryRemove(sig)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {editingSignatoryIds.has(sig.id) ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={sig.fullName} onChange={(event) => onUpdateSignatory(sig.id, "fullName", event.target.value)} />
                    {errors[`signatory-${index}-fullName`] ? <p className="text-sm text-destructive">{errors[`signatory-${index}-fullName`]}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={sig.email} onChange={(event) => onUpdateSignatory(sig.id, "email", event.target.value)} />
                    {errors[`signatory-${index}-email`] ? <p className="text-sm text-destructive">{errors[`signatory-${index}-email`]}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={sig.phone} onChange={(event) => onUpdateSignatory(sig.id, "phone", event.target.value)} />
                    {errors[`signatory-${index}-phone`] ? <p className="text-sm text-destructive">{errors[`signatory-${index}-phone`]}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Designation</Label>
                    <Input value={sig.designation} onChange={(event) => onUpdateSignatory(sig.id, "designation", event.target.value)} />
                    {errors[`signatory-${index}-designation`] ? <p className="text-sm text-destructive">{errors[`signatory-${index}-designation`]}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Employee ID</Label>
                    <Input value={sig.employeeId} onChange={(event) => onUpdateSignatory(sig.id, "employeeId", event.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-x-10 gap-y-1.5 sm:grid-cols-2">
                  <p className="text-sm text-foreground">
                    <span className="font-medium text-slate-500">Name:</span> <span className="font-semibold text-slate-900">{sig.fullName}</span>
                  </p>
                  <p className="min-w-0 text-sm text-foreground">
                    <span className="font-medium text-slate-500">Email:</span> <span className="break-all font-semibold text-slate-900">{sig.email}</span>
                  </p>
                  <p className="text-sm text-foreground">
                    <span className="font-medium text-slate-500">Phone:</span> <span className="font-semibold text-slate-900">{sig.phone}</span>
                  </p>
                  <p className="text-sm text-foreground">
                    <span className="font-medium text-slate-500">Designation:</span> <span className="font-semibold text-slate-900">{sig.designation}</span>
                  </p>
                  {sig.employeeId.trim() ? (
                    <p className="text-sm text-foreground sm:col-span-2">
                      <span className="font-medium text-slate-500">Employee ID:</span> <span className="font-semibold text-slate-900">{sig.employeeId}</span>
                    </p>
                  ) : null}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default CompanyOnboardingStepSignatory;
