import { ChevronRight, Rocket } from "lucide-react";
import WorkflowStepper from "@/features/workflow-management/components/onboarding/WorkflowStepper";
import WorkflowStepInputs from "@/features/workflow-management/components/onboarding/WorkflowStepInputs";
import WorkflowStepLevels from "@/features/workflow-management/components/onboarding/WorkflowStepLevels";
import WorkflowStepSummary from "@/features/workflow-management/components/onboarding/WorkflowStepSummary";
import { useWorkflowOnboarding } from "@/features/workflow-management/hooks/useWorkflowOnboarding";

type WorkflowOnboardingViewProps = {
  isOpen?: boolean;
  onPublished?: () => void | Promise<void>;
};

export default function WorkflowOnboardingView({ isOpen = false, onPublished }: WorkflowOnboardingViewProps) {
  const {
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
    levels,
    isRMUsedGlobally,
    currentLevelComplete,
    selectedModuleLabel,
    selectedNodeNameLabel,
    setWfName,
    setWfAlias,
    setWfModule,
    setWfNode,
    updateLevelApprover,
    addApproverToLevel,
    removeApproverFromLevel,
    toggleLogic,
    addNewLevel,
    removeLastLevel,
    handleNext,
    handleBack,
  } = useWorkflowOnboarding({ isOpen, onPublished });

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex-1 p-5">
        <WorkflowStepper step={step} />

        <div className="mt-3 h-[calc(100%-56px)] overflow-hidden rounded-2xl border border-slate-200 bg-[#fcfcfd]">
          {step === 1 ? (
            <WorkflowStepInputs
              wfName={wfName}
              wfAlias={wfAlias}
              wfModule={wfModule}
              wfNode={wfNode}
              moduleGroups={moduleGroups}
              departmentOptions={departmentOptions}
              showMetaErrors={showMetaErrors}
              onSetWfName={setWfName}
              onSetWfAlias={setWfAlias}
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
              wfName={wfName}
              wfAlias={wfAlias}
              moduleLabel={selectedModuleLabel}
              nodeNameLabel={selectedNodeNameLabel}
              levels={levels}
              visibleLevels={visibleLevels}
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

        <button
          type="button"
          onClick={handleNext}
          className={`flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all active:scale-95 ${
            step === 3 ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {step === 1 ? "Next Step" : step === 2 ? "Generate Summary" : "Publish Workflow"}
          {step < 3 ? <ChevronRight className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
        </button>
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
