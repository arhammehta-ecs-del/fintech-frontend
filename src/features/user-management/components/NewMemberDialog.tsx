import { Check, ChevronRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { NEW_MEMBER_STEPS } from "@/features/user-management/constants";
import { useOnboardingForm } from "@/features/user-management/hooks/useOnboardingForm";
import { StepAccessRights } from "@/features/user-management/components/StepAccessRights";
import { StepBasicDetails } from "@/features/user-management/components/StepBasicDetails";
import { StepReviewSubmit } from "@/features/user-management/components/StepReviewSubmit";
import { StepSelectNode } from "@/features/user-management/components/StepSelectNode";
import type { NewMemberOnboardingFormData } from "@/features/user-management/types";

type NewMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: NewMemberOnboardingFormData) => void | Promise<void>;
};

export function NewMemberDialog({ open, onOpenChange, onSubmit }: NewMemberDialogProps) {
  const {
    orgStructure,
    step,
    formData,
    errors,
    selectedNodeId,
    selectedNodes,
    expandedAccessNodeId,
    nodePermissions,
    infoNodeId,
    isReviewAccessExpanded,
    reviewAccessNodeRefs,
    clearError,
    updateBasic,
    removeSelectedNode,
    handleNodeSelect,
    togglePermission,
    setExpandedAccessNodeId,
    setInfoNodeId,
    setIsReviewAccessExpanded,
    prevStep,
    handlePrimaryAction,
  } = useOnboardingForm({ open, onOpenChange, onSubmit });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-[100vw] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[92vh] sm:w-[min(96vw,76rem)] sm:max-w-[76rem] sm:rounded-lg">
        <div
          className={cn(
            "mx-auto flex h-full w-full max-w-6xl flex-col px-6 py-6 sm:px-8 sm:py-8",
            step === 1 ? "space-y-4 sm:space-y-5 sm:py-6" : step === 2 ? "space-y-4 sm:space-y-5 sm:py-6" : "space-y-6",
          )}
        >
          <div>
            <DialogHeader className="text-left">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground">New Member Onboarding</DialogTitle>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="pb-1">
            <div className="flex w-full items-center gap-3 sm:gap-4">
              {NEW_MEMBER_STEPS.map((label, index) => {
                const currentStep = index + 1;
                const isActive = step >= currentStep;
                const isComplete = step > currentStep;

                return (
                  <div key={label} className="contents">
                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                          isActive ? "bg-[rgb(53,83,233)] text-white" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isComplete ? <Check className="h-4 w-4" /> : currentStep}
                      </div>
                      <span
                        className={cn(
                          "hidden whitespace-nowrap text-xs font-medium sm:block",
                          isActive ? "text-[rgb(53,83,233)]" : "text-muted-foreground",
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    {index < NEW_MEMBER_STEPS.length - 1 ? (
                      <div className="flex min-w-[2rem] flex-1 items-center">
                        <div className={cn("h-px w-full", step > currentStep ? "bg-[rgb(53,83,233)]" : "bg-border")} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <Card className="flex min-h-0 flex-1 overflow-hidden border-slate-200 shadow-sm">
            <CardContent
              className={cn(
                step === 4 ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
                step === 1 ? "p-5 pt-5 sm:p-6 sm:pt-6" : step === 3 ? "p-5 pt-5 sm:p-6 sm:pt-6" : "p-6 pt-6 sm:p-8 sm:pt-8",
              )}
            >
              {step === 1 ? (
                <StepBasicDetails
                  basic={formData.basic}
                  errors={errors}
                  onBasicChange={updateBasic}
                  onClearError={clearError}
                />
              ) : null}

              {step === 2 ? (
                <StepSelectNode
                  orgStructure={orgStructure}
                  selectedNodeId={selectedNodeId}
                  selectedNodes={selectedNodes}
                  errors={errors}
                  onNodeSelect={handleNodeSelect}
                  onRemoveNode={removeSelectedNode}
                />
              ) : null}

              {step === 3 ? (
                <StepAccessRights
                  selectedNodes={selectedNodes}
                  errors={errors}
                  expandedAccessNodeId={expandedAccessNodeId}
                  infoNodeId={infoNodeId}
                  nodePermissions={nodePermissions}
                  onSetExpandedAccessNodeId={setExpandedAccessNodeId}
                  onSetInfoNodeId={setInfoNodeId}
                  onTogglePermission={togglePermission}
                />
              ) : null}

              {step === 4 ? (
                <StepReviewSubmit
                  basic={formData.basic}
                  selectedNodes={selectedNodes}
                  nodePermissions={nodePermissions}
                  expandedAccessNodeId={expandedAccessNodeId}
                  isReviewAccessExpanded={isReviewAccessExpanded}
                  reviewAccessNodeRefs={reviewAccessNodeRefs}
                  onSetExpandedAccessNodeId={setExpandedAccessNodeId}
                  onSetIsReviewAccessExpanded={setIsReviewAccessExpanded}
                />
              ) : null}
            </CardContent>
          </Card>

          <DialogFooter className={cn("border-t border-border bg-background px-0", step === 1 || step === 3 ? "py-3" : "py-4")}>
            <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" className="w-full sm:w-auto" onClick={step === 1 ? () => onOpenChange(false) : prevStep}>
                {step === 1 ? "Cancel" : "Back"}
              </Button>

              <Button className="w-full bg-[rgb(53,83,233)] text-white hover:bg-[rgb(53,83,233)]/90 sm:w-auto" onClick={handlePrimaryAction}>
                {step === 4 ? (onSubmit ? "Confirm & Create User" : "Close Preview") : "Continue"}
                {step < 4 ? <ChevronRight className="ml-2 h-4 w-4" /> : null}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NewMemberDialog;
