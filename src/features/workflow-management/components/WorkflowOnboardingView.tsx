import { ChevronRight, Rocket } from "lucide-react";
import { useEffect, useState } from "react";
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
};

export default function WorkflowOnboardingView({ isOpen = false, onPublished, mode = "create", seedWorkflow = null }: WorkflowOnboardingViewProps) {
  const [showPrevious, setShowPrevious] = useState(false);
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
    moduleGroups,
    departmentOptions,
    workflowOptions,
    selectedWorkflowLevelsHash,
    remarks,
    levels,
    isRMUsedGlobally,
    currentLevelComplete,
    selectedModuleLabel,
    selectedNodeNameLabel,
    seedSnapshot,
    setWfName,
    setWfModule,
    setWfNode,
    setSelectedWorkflowLevelsHash,
    setRemarks,
    updateLevelApprover,
    addApproverToLevel,
    removeApproverFromLevel,
    toggleLogic,
    addNewLevel,
    removeLastLevel,
    handleNext,
    handleBack,
  } = useWorkflowOnboarding({ isOpen, onPublished, mode, seedWorkflow });

  useEffect(() => {
    if (!isOpen) return;
    setShowPrevious(false);
  }, [isOpen, mode, seedWorkflow?.id]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex-1 p-5">
        <WorkflowStepper step={step} />

        <div className="mt-3 h-[calc(100%-56px)] overflow-hidden rounded-2xl border border-slate-200 bg-[#fcfcfd]">
          {step === 1 ? (
            <WorkflowStepInputs
              wfName={wfName}
              wfModule={wfModule}
              wfNode={wfNode}
              moduleGroups={moduleGroups}
              departmentOptions={departmentOptions}
              showMetaErrors={showMetaErrors}
              onSetWfName={setWfName}
              onSetWfModule={setWfModule}
              onSetWfNode={setWfNode}
            />
          ) : null}

          {step === 2 ? (
            <WorkflowStepLevels
              levels={levels}
              visibleLevels={visibleLevels}
              errorMsg={errorMsg}
              isRMUsedGlobally={isRMUsedGlobally}
              onUpdateApprover={updateLevelApprover}
              onAddApprover={addApproverToLevel}
              onRemoveApprover={removeApproverFromLevel}
              onToggleLogic={toggleLogic}
              onAddLevel={addNewLevel}
              onRemoveLevel={removeLastLevel}
              canAddLevel={currentLevelComplete && visibleLevels < 5}
              canRemoveLevel={visibleLevels > 1}
            />
          ) : null}

          {step === 3 ? (
            <WorkflowStepSummary
              wfName={showPrevious && seedSnapshot ? seedSnapshot.wfName : wfName}
              wfAlias={showPrevious && seedSnapshot ? seedSnapshot.wfAlias : wfAlias}
              moduleLabel={showPrevious && seedSnapshot ? seedSnapshot.selectedModuleLabel : selectedModuleLabel}
              nodeNameLabel={showPrevious && seedSnapshot ? seedSnapshot.selectedNodeNameLabel : selectedNodeNameLabel}
              levels={showPrevious && seedSnapshot ? seedSnapshot.levels : levels}
              visibleLevels={showPrevious && seedSnapshot ? seedSnapshot.visibleLevels : visibleLevels}
            />
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
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
          {step === 3 && resolvedMode === "edit" && seedSnapshot ? (
            <button
              type="button"
              onClick={() => setShowPrevious((current) => !current)}
              className={`h-11 rounded-xl border px-4 text-sm font-semibold transition ${
                showPrevious
                  ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                  : "border-amber-300 bg-amber-100 text-amber-700"
              }`}
            >
              {showPrevious ? "Show Updated" : "Show Previous"}
            </button>
          ) : null}
          {step === 3 ? (
            <div className="flex items-end gap-2">
              <div>
                <Textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Add remarks..."
                  className="min-h-[44px] w-[220px] resize-none text-sm"
                  maxLength={250}
                />
              </div>
              <Select value={selectedWorkflowLevelsHash || "__none__"} onValueChange={(value) => setSelectedWorkflowLevelsHash(value === "__none__" ? "" : value)}>
                <SelectTrigger className="h-11 w-[220px] border-blue-200 text-blue-700">
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
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleNext}
            className={`flex min-w-[184px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all active:scale-95 ${
              step === 3 ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {step === 1 ? "Next Step" : step === 2 ? "Generate Summary" : resolvedMode === "edit" ? "Update Workflow" : "Publish Workflow"}
            {step < 3 ? <ChevronRight className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          `,
        }}
      />
    </div>
  );
}
