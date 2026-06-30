import { ChevronRight, Rocket } from "lucide-react";
import { useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import WorkflowStepper from "@/features/workflow-management/components/onboarding/WorkflowStepper";
import WorkflowStepInputs from "@/features/workflow-management/components/onboarding/WorkflowStepInputs";
import WorkflowStepLevels from "@/features/workflow-management/components/onboarding/WorkflowStepLevels";
import WorkflowStepSummary from "@/features/workflow-management/components/onboarding/WorkflowStepSummary";
import { useWorkflowOnboarding } from "@/features/workflow-management/hooks/useWorkflowOnboarding";

type WorkflowOnboardingViewProps = {
  isOpen?: boolean;
  onPublished?: () => void | Promise<void>;
  mode?: "create" | "edit";
  seedWorkflow?: import("@/features/workflow-management/types/workflow.types").WorkflowRecord | null;
  onStepChange?: (step: number) => void;
};

export default function WorkflowOnboardingView({
  isOpen = false,
  onPublished,
  mode = "create",
  seedWorkflow = null,
  onStepChange,
}: WorkflowOnboardingViewProps) {
  const {
    mode: resolvedMode,
    step,
    visibleLevels,
    errorMsg,
    showMetaErrors,
    wfName,
    wfAlias,
    wfModule,
    wfNode,
    workflowType,
    moduleGroups,
    departmentOptions,
    workflowOptions,
    selectedWorkflowLevelsHash,
    remarks,
    remarkTouched,
    levels,
    isRMUsedGlobally,
    currentLevelComplete,
    hasNoApproverSelected,
    selectedModuleLabel,
    selectedNodeNameLabel,
    selectedNodeLevelCount,
    seedSnapshot,
    setWfName,
    setWfModule,
    setWfNode,
    setWorkflowType,
    setSelectedWorkflowLevelsHash,
    setRemarks,
    setRemarkTouched,
    updateLevelApprover,
    addApproverToLevel,
    removeApproverFromLevel,
    toggleLogic,
    addNewLevel,
    removeLastLevel,
    handleNext,
    handleBack,
  } = useWorkflowOnboarding({ isOpen, onPublished, mode, seedWorkflow });

  const remarkSectionRef = useRef<HTMLDivElement | null>(null);
  const remarkInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    onStepChange?.(step);
  }, [onStepChange, step]);

  useEffect(() => {
    if (!(resolvedMode === "edit" && remarkTouched && !remarks.trim())) return;
    requestAnimationFrame(() => {
      remarkSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      remarkInputRef.current?.focus();
    });
  }, [remarkTouched, remarks, resolvedMode]);

  const stepContent = (
    <div
      className={
        step === 3
          ? "mt-6 min-h-0 flex-1 overflow-hidden"
          : "mt-6 h-full overflow-hidden"
      }
    >
      {step === 1 ? (
        <WorkflowStepInputs
          mode={resolvedMode}
          wfName={wfName}
          wfModule={wfModule}
          wfNode={wfNode}
          workflowType={workflowType}
          moduleGroups={moduleGroups}
          departmentOptions={departmentOptions}
          showMetaErrors={showMetaErrors}
          onSetWfName={setWfName}
          onSetWfModule={setWfModule}
          onSetWfNode={setWfNode}
          onSetWorkflowType={setWorkflowType}
        />
      ) : null}

      {step === 2 ? (
        <WorkflowStepLevels
          levels={levels}
          visibleLevels={visibleLevels}
          errorMsg={errorMsg}
          isRMUsedGlobally={isRMUsedGlobally}
          hasNoApproverSelected={hasNoApproverSelected}
          onUpdateApprover={updateLevelApprover}
          onAddApprover={addApproverToLevel}
          onRemoveApprover={removeApproverFromLevel}
          onToggleLogic={toggleLogic}
          onAddLevel={addNewLevel}
          onRemoveLevel={removeLastLevel}
          canAddLevel={!hasNoApproverSelected && currentLevelComplete && visibleLevels < 5}
          canRemoveLevel={visibleLevels > 1}
        />
      ) : null}

      {step === 3 ? (
        <WorkflowStepSummary
          wfName={wfName}
          wfAlias={wfAlias}
          moduleLabel={selectedModuleLabel}
          workflowType={workflowType || "-"}
          nodeNameLabel={selectedNodeNameLabel}
          nodeLevelCount={selectedNodeLevelCount}
          wfNode={wfNode}
          levels={levels}
          visibleLevels={visibleLevels}
          previous={resolvedMode === "edit" && seedSnapshot ? {
            wfName: seedSnapshot.wfName,
            wfAlias: seedSnapshot.wfAlias,
            moduleLabel: seedSnapshot.selectedModuleLabel,
            workflowType: workflowType || "-",
            nodeNameLabel: seedSnapshot.selectedNodeNameLabel,
            nodeLevelCount: seedSnapshot.selectedNodeLevelCount,
            wfNode: seedSnapshot.wfNode,
            levels: seedSnapshot.levels,
            visibleLevels: seedSnapshot.visibleLevels,
          } : null}
        />
      ) : null}
    </div>
  );

  const isUpdateRemarkRequired = resolvedMode === "edit";
  const showUpdateRemarkError = isUpdateRemarkRequired && remarkTouched && !remarks.trim();

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {step === 3 ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col p-5">
            <WorkflowStepper step={step} />
            {stepContent}
            <div ref={remarkSectionRef} className="mt-4 border-t border-slate-200 bg-white px-1 pt-4">
              <div className="flex items-end gap-2">
                <div className="flex w-full flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Remark{isUpdateRemarkRequired ? <span className="text-rose-500"> *</span> : null}
                  </label>
                  <Textarea
                    ref={remarkInputRef}
                    value={remarks}
                    onChange={(event) => {
                      setRemarks(event.target.value);
                      if (event.target.value.trim()) setRemarkTouched(false);
                    }}
                    placeholder={isUpdateRemarkRequired ? "Enter remark" : "Enter remark (optional)"}
                    className={`h-11 min-h-0 w-full resize-none text-sm ${showUpdateRemarkError ? "border-rose-500 focus-visible:ring-rose-500/30" : ""}`}
                    maxLength={250}
                  />
                  {showUpdateRemarkError ? <p className="text-xs text-rose-600">Please enter a remark.</p> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-5">
          <WorkflowStepper step={step} />
          <div className="h-[calc(100%-56px)]">
            {stepContent}
          </div>
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
        <button
          type="button"
          onClick={handleBack}
          className={`rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50 ${
            step === 1 ? "pointer-events-none opacity-0" : ""
          }`}
        >
          Back
        </button>

        <div className="flex items-center gap-2">
          {step === 3 ? (
            <Select
              value={selectedWorkflowLevelsHash || "__none__"}
              onValueChange={(value) => setSelectedWorkflowLevelsHash(value === "__none__" ? "" : value)}
            >
              <SelectTrigger className="h-11 w-[220px] border-[hsl(235,60%,50%)]/30 text-[hsl(235,60%,50%)]">
                <SelectValue placeholder="Select Workflow" />
              </SelectTrigger>
              <SelectContent side="top" align="end">
                <SelectItem value="__none__">No Workflow</SelectItem>
                {workflowOptions.map((option) => (
                  <SelectItem key={option.levelsHash} value={option.levelsHash}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <button
            type="button"
            onClick={handleNext}
            className={`flex min-w-[184px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all active:scale-95 ${
              "bg-[hsl(235,60%,50%)] hover:bg-[hsl(235,60%,45%)] shadow-[0_10px_24px_rgba(30,35,80,0.22)]"
            }`}
          >
            {step === 1 ? "Next Step" : step === 2 ? "Generate Summary" : resolvedMode === "edit" ? "Update Workflow" : "Submit Workflow"}
            {step < 3 ? <ChevronRight className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}








