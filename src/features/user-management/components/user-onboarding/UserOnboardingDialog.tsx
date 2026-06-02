import { Check, ChevronRight, Building2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { NEW_MEMBER_STEPS } from "@/features/user-management/constants";
import { useUserOnboardingForm } from "./useUserOnboardingForm";
import { UserOnboardingStepAccessRights } from "./UserOnboardingStepAccessRights";
import { UserOnboardingStepBasicDetails } from "./UserOnboardingStepBasicDetails";
import { UserOnboardingStepReviewSubmit } from "./UserOnboardingStepReviewSubmit";
import { UserOnboardingStepSelectNode } from "./UserOnboardingStepSelectNode";
import type { UserOnboardingFormData } from "@/features/user-management/types";
import type { AppUser } from "@/contexts/AppContext";

type UserOnboardingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: UserOnboardingFormData, context?: { seedMember?: AppUser | null }) => void | Promise<void>;
  seedMember?: AppUser | null;
};

export function UserOnboardingDialog({ open, onOpenChange, onSubmit, seedMember = null }: UserOnboardingDialogProps) {
  const {
    orgStructure,
    roles,
    workflowOptions,
    step,
    formData,
    errors,
    selectedNodeId,
    selectedNodes,
    reportingManagerOptions,
    expandedAccessNodeIds,
    primaryNodeId,
    nodePermissions,
    nodePermissionScopes,
    infoNodeId,
    isReviewAccessExpanded,
    reviewAccessNodeRefs,
    reviewSnapshot,
    clearError,
    updateBasic,
    updateRemark,
    setSelectedWorkflow,
    setGlobalSignatory,
    removeSelectedNode,
    handleNodeSelect,
    togglePermission,
    setPermissionScope,
    reorderSelectedNodes,
    setExpandedAccessNodeIds,
    setPrimaryNodeId,
    setInfoNodeId,
    setIsReviewAccessExpanded,
    prevStep,
    handlePrimaryAction,
  } = useUserOnboardingForm({ open, onOpenChange, onSubmit, seedMember });
  const [showEditRemark, setShowEditRemark] = useState(false);
  const isGlobalSignatoryFlow = formData.isGlobalUserEligible && formData.isGlobalSignatory;
  const stepContainerRef = useRef<HTMLDivElement | null>(null);
  const remarkSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (Object.keys(errors).length === 0) return;
    stepContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [errors, open, step]);

  useEffect(() => {
    if (!open) return;
    setShowEditRemark(false);
  }, [open, seedMember]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-[100vw] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[92vh] sm:w-[min(96vw,76rem)] sm:max-w-[76rem] sm:rounded-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 4 && seedMember && !showEditRemark) {
              setShowEditRemark(true);
              requestAnimationFrame(() => {
                remarkSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              });
              return;
            }
            handlePrimaryAction();
          }}
          className={cn(
            "mx-auto flex h-full w-full max-w-6xl flex-col px-6 py-6 sm:px-8 sm:py-8",
            step === 1 ? "space-y-4 sm:space-y-5 sm:py-6" : step === 2 ? "space-y-4 sm:space-y-5 sm:py-6" : "space-y-6",
          )}
        >
          <div>
            <DialogHeader className="text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground">User Onboarding</DialogTitle>
                    <DialogDescription className="sr-only">
                      Complete user details, select nodes, configure access rights, and review before submitting.
                    </DialogDescription>
                  </div>
                </div>
                <div />
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
              ref={stepContainerRef}
              className={cn(
                step === 4 ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
                step === 1
                  ? "p-5 pt-5 sm:p-6 sm:pt-6"
                  : step === 3
                    ? "p-5 pt-5 sm:p-6 sm:pt-6"
                    : step === 4
                      ? "p-4 pt-4 sm:p-5 sm:pt-5"
                      : "p-6 pt-6 sm:p-8 sm:pt-8",
              )}
            >
              {step === 1 ? (
                <UserOnboardingStepBasicDetails
                  basic={formData.basic}
                  isEditMode={Boolean(seedMember)}
                  isGlobalUserEligible={formData.isGlobalUserEligible}
                  isGlobalSignatory={formData.isGlobalSignatory}
                  reportingManagerOptions={reportingManagerOptions}
                  onGlobalSignatoryToggle={setGlobalSignatory}
                  errors={errors}
                  onBasicChange={updateBasic}
                  onClearError={clearError}
                />
              ) : null}

              {step === 2 && !isGlobalSignatoryFlow ? (
                <UserOnboardingStepSelectNode
                  orgStructure={orgStructure}
                  selectedNodeId={selectedNodeId}
                  selectedNodes={selectedNodes}
                  errors={errors}
                  onNodeSelect={handleNodeSelect}
                  onRemoveNode={removeSelectedNode}
                />
              ) : null}

              {step === 3 && !isGlobalSignatoryFlow ? (
                <UserOnboardingStepAccessRights
                  orgStructure={orgStructure}
                  selectedNodes={selectedNodes}
                  roles={roles}
                  errors={errors}
                  expandedAccessNodeIds={expandedAccessNodeIds}
                  primaryNodeId={primaryNodeId}
                  infoNodeId={infoNodeId}
                  nodePermissions={nodePermissions}
                  nodePermissionScopes={nodePermissionScopes}
                  onSetExpandedAccessNodeIds={setExpandedAccessNodeIds}
                  onSetPrimaryNodeId={setPrimaryNodeId}
                  onReorderSelectedNodes={reorderSelectedNodes}
                  onSetInfoNodeId={setInfoNodeId}
                  onTogglePermission={togglePermission}
                  onSetPermissionScope={setPermissionScope}
                />
              ) : null}

              {step === 4 ? (
                <UserOnboardingStepReviewSubmit
                  orgStructure={orgStructure}
                  basic={formData.basic}
                  isGlobalSignatory={isGlobalSignatoryFlow}
                  selectedNodes={selectedNodes}
                  primaryNodeId={primaryNodeId}
                  nodePermissions={nodePermissions}
                  nodePermissionScopes={nodePermissionScopes}
                  selectedWorkflow={formData.selectedWorkflow}
                  isEditMode={Boolean(seedMember)}
                  previousReviewSnapshot={reviewSnapshot}
                  expandedAccessNodeIds={expandedAccessNodeIds}
                  isReviewAccessExpanded={isReviewAccessExpanded}
                  reviewAccessNodeRefs={reviewAccessNodeRefs}
                  onSetExpandedAccessNodeIds={setExpandedAccessNodeIds}
                  onSetIsReviewAccessExpanded={setIsReviewAccessExpanded}
                />
              ) : null}
            </CardContent>
          </Card>

          {step === 4 && seedMember && showEditRemark ? (
            <div ref={remarkSectionRef} className="space-y-2">
              <label htmlFor="edit-user-remark" className="text-sm font-semibold text-slate-700">
                Remark <span className="text-rose-600">*</span>
              </label>
              <Textarea
                id="edit-user-remark"
                value={formData.remark}
                onChange={(event) => updateRemark(event.target.value)}
                placeholder="Enter remark for this edit request"
                className={cn("h-11 min-h-0 resize-none", errors.remark ? "border-rose-500 focus-visible:ring-rose-500/30" : "")}
              />
              {errors.remark ? <p className="text-xs text-rose-600">{errors.remark}</p> : null}
            </div>
          ) : null}

          <DialogFooter className={cn("border-t border-border bg-background px-0", step === 1 || step === 3 ? "py-3" : "py-4")}>
            <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={step === 1 ? () => onOpenChange(false) : prevStep}>
                {step === 1 ? "Cancel" : "Back"}
              </Button>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                {step === 4 && !isGlobalSignatoryFlow ? (
                  <Select
                    value={formData.selectedWorkflowLevelsHash || "__none__"}
                    onValueChange={(value) => setSelectedWorkflow(value === "__none__" ? "" : value)}
                  >
                    <SelectTrigger className="h-11 w-full min-w-[240px] border-[rgb(53,83,233)]/30 text-[rgb(53,83,233)] sm:w-[280px]">
                      <SelectValue placeholder="Select Workflow" />
                    </SelectTrigger>
                    <SelectContent side="top" align="end">
                      <SelectItem value="__none__">No Workflow</SelectItem>
                      {workflowOptions.map((workflowOption) => (
                        <SelectItem key={workflowOption.levelsHash} value={workflowOption.levelsHash}>
                          {workflowOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}

                <Button type="submit" className="w-full bg-[rgb(53,83,233)] text-white hover:bg-[rgb(53,83,233)]/90 sm:w-auto">
                  {step === 4
                    ? seedMember
                      ? "Submit Changes"
                      : (onSubmit ? "Confirm & Create User" : "Close Preview")
                    : "Continue"}
                  {step < 4 ? <ChevronRight className="ml-2 h-4 w-4" /> : null}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default UserOnboardingDialog;
