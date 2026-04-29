import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CompanyOnboardingStepCompanyDetails } from "./CompanyOnboardingStepCompanyDetails";
import { CompanyOnboardingStepGroupCompany } from "./CompanyOnboardingStepGroupCompany";
import { CompanyOnboardingStepPreviewSubmit } from "./CompanyOnboardingStepPreviewSubmit";
import { CompanyOnboardingStepSignatory } from "./CompanyOnboardingStepSignatory";
import { CompanyOnboardingProgressBar } from "./CompanyOnboardingProgressBar";
import { useCompanyOnboardingWizard } from "./useCompanyOnboardingWizard";
import type { CompanyOnboardingWizardContentProps } from "./types";
import { companyOnboardingSteps } from "./utils";

export default function CompanyOnboardingWizard() {
  return <CompanyOnboardingWizardContent />;
}

export function CompanyOnboardingWizardContent({
  embedded = false,
  open = true,
  onOpenChange,
}: CompanyOnboardingWizardContentProps = {}) {
  const {
    groups,
    step,
    isSubmitting,
    groupSelectionMode,
    selectedGroupId,
    groupName,
    remarks,
    companyName,
    legalName,
    incDate,
    address,
    gstin,
    gstDocumentName,
    gstDocumentFile,
    isGstPreviewOpen,
    gstPreviewUrl,
    gstPreviewMimeType,
    ieCode,
    signatories,
    linkedSigIds,
    editingSignatoryIds,
    signatoryToRemove,
    showNewSignatoryForm,
    newSig,
    newSigErrors,
    errors,
    signatoryValidationAttempted,
    selectedGroupData,
    isExistingGroup,
    existingSignatories,
    totalSignatories,
    todayDateInputValue,
    payloadPreview,
    isGstImagePreview,
    isGstPdfPreview,
    handleGroupModeChange,
    handleGroupSelection,
    toggleLinkedSig,
    updateSignatory,
    toggleSignatoryEditing,
    next,
    prev,
    addSignatory,
    removeSignatory,
    handleSubmit,
    handleCloseGstPreview,
    handlePreviewGstDocument,
    navigate,
    setGroupName,
    setRemarks,
    setLegalName,
    setCompanyName,
    setIeCode,
    setIncDate,
    setGstin,
    setGstDocumentFile,
    setGstDocumentName,
    setErrors,
    setAddress,
    setSignatoryToRemove,
    setShowNewSignatoryForm,
    setNewSigErrors,
    setNewSig,
  } = useCompanyOnboardingWizard({ embedded, open, onOpenChange });

  const content = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (step < companyOnboardingSteps.length - 1) {
          next();
        } else {
          handleSubmit();
        }
      }}
      className="mx-auto max-w-5xl space-y-6"
    >
      <div>
        <h1 className="text-2xl font-semibold text-foreground">New Onboarding</h1>
        <p className="mt-1 text-sm text-muted-foreground">Complete the steps below to onboard a new company</p>
      </div>

      <CompanyOnboardingProgressBar steps={companyOnboardingSteps} currentStep={step} />

      <Card className="shadow-sm">
        <CardContent className="pt-6">
          {step === 0 ? (
            <CompanyOnboardingStepGroupCompany
              groups={groups}
              errors={errors}
              groupSelectionMode={groupSelectionMode}
              selectedGroupId={selectedGroupId}
              selectedGroupData={selectedGroupData}
              groupName={groupName}
              remarks={remarks}
              onGroupModeChange={handleGroupModeChange}
              onGroupSelection={handleGroupSelection}
              onGroupNameChange={setGroupName}
              onRemarksChange={setRemarks}
            />
          ) : null}

          {step === 1 ? (
            <CompanyOnboardingStepCompanyDetails
              errors={errors}
              legalName={legalName}
              companyName={companyName}
              ieCode={ieCode}
              incDate={incDate}
              todayDateInputValue={todayDateInputValue}
              gstin={gstin}
              gstDocumentName={gstDocumentName}
              address={address}
              onLegalNameChange={setLegalName}
              onCompanyNameChange={setCompanyName}
              onIeCodeChange={setIeCode}
              onIncDateChange={setIncDate}
              onGstinChange={setGstin}
              onGstDocumentChange={(file) => {
                setGstDocumentFile(file);
                setGstDocumentName(file?.name ?? "");
                setErrors((current) => {
                  const nextErrors = { ...current };
                  delete nextErrors.gstDocument;
                  return nextErrors;
                });
              }}
              onAddressChange={setAddress}
            />
          ) : null}

          {step === 2 ? (
            <CompanyOnboardingStepSignatory
              errors={errors}
              isExistingGroup={isExistingGroup}
              existingSignatories={existingSignatories}
              signatories={signatories}
              linkedSigIds={linkedSigIds}
              editingSignatoryIds={editingSignatoryIds}
              totalSignatories={totalSignatories}
              showNewSignatoryForm={showNewSignatoryForm}
              newSig={newSig}
              newSigErrors={newSigErrors}
              signatoryValidationAttempted={signatoryValidationAttempted}
              onSetShowNewSignatoryForm={setShowNewSignatoryForm}
              onSetNewSigErrors={setNewSigErrors}
              onSetNewSig={setNewSig}
              onAddSignatory={addSignatory}
              onToggleLinkedSig={toggleLinkedSig}
              onToggleSignatoryEditing={toggleSignatoryEditing}
              onUpdateSignatory={updateSignatory}
              onRequestSignatoryRemove={setSignatoryToRemove}
            />
          ) : null}

          {step === 3 ? (
            <CompanyOnboardingStepPreviewSubmit
              payloadPreview={payloadPreview}
              gstDocumentName={gstDocumentName}
              gstDocumentFile={gstDocumentFile}
              onPreviewGstDocument={handlePreviewGstDocument}
            />
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={step === 0 ? () => navigate(-1) : prev} disabled={isSubmitting}>
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        {step < companyOnboardingSteps.length - 1 ? (
          <Button type="submit" className="w-full sm:w-auto">
            Continue
          </Button>
        ) : (
          <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        )}
      </div>

      <AlertDialog open={Boolean(signatoryToRemove)} onOpenChange={(isOpen) => !isOpen && setSignatoryToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Signatory</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to remove the signatory?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">No</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => {
                if (signatoryToRemove) {
                  removeSignatory(signatoryToRemove.id);
                }
                setSignatoryToRemove(null);
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isGstPreviewOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleCloseGstPreview();
          }
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-hidden p-0">
          <div className="border-b border-slate-200 px-4 py-3">
            <DialogTitle className="text-base text-slate-900">GST Document Preview</DialogTitle>
            <p className="mt-1 truncate text-sm text-slate-500">{gstDocumentName || "GST document"}</p>
          </div>

          <div className="h-[72vh] bg-slate-50 p-3">
            {gstPreviewUrl ? (
              isGstImagePreview ? (
                <img src={gstPreviewUrl} alt={gstDocumentName || "GST document"} className="h-full w-full rounded-md object-contain" />
              ) : isGstPdfPreview ? (
                <iframe src={gstPreviewUrl} title="GST document preview" className="h-full w-full rounded-md border border-slate-200 bg-white" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-slate-300 bg-white p-4 text-center">
                  <p className="text-sm text-slate-600">Preview is not available for this file type.</p>
                  <a href={gstPreviewUrl} download={gstDocumentName || "gst-document"} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
                    Download File
                  </a>
                </div>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );

  if (!embedded) {
    return content;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange?.(nextOpen);
      }}
    >
      <DialogContent className="flex h-[100dvh] w-[100vw] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[88vh] sm:w-[min(95vw,72rem)] sm:max-w-[72rem] sm:rounded-lg">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
