import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Rocket } from "lucide-react";
import { useAppContext, type OrgNode } from "@/contexts/AppContext";
import { getCompanyOrgStructure } from "@/services/org.service";
import { getCompanyRoles } from "@/services/role.service";
import { createWorkflow } from "@/services/workflow.service";
import WorkflowStepper from "@/features/workflow-management/components/configuration/WorkflowStepper";
import WorkflowStepInputs from "@/features/workflow-management/components/configuration/WorkflowStepInputs";
import WorkflowStepLevels from "@/features/workflow-management/components/configuration/WorkflowStepLevels";
import WorkflowStepSummary from "@/features/workflow-management/components/configuration/WorkflowStepSummary";
import type { ModuleGroup, WorkflowLevel, WorkflowStep } from "@/features/workflow-management/components/configuration/types";

type WorkflowConfigurationViewProps = {
  isOpen?: boolean;
};

const formatTokenLabel = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const getCategoryLabel = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "TRANSACTIONAL") return "Transactional";
  if (normalized === "OPERATIONAL") return "Operational";
  if (normalized === "SYSTEM_ACCESS") return "System Access";
  return formatTokenLabel(normalized);
};

const INITIAL_LEVELS: WorkflowLevel[] = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  approvals: [{ option: "" }],
  type: "AND",
}));

const toApiApprover = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "reporting_manager") return "REPORTING_MANAGER";
  if (normalized === "node_approver") return "NODE_APPROVER";
  if (normalized === "hierarchy_approver") return "HIERARCHY_APPROVER";
  return value.trim().toUpperCase();
};

export default function WorkflowConfigurationView({ isOpen = false }: WorkflowConfigurationViewProps) {
  const { currentUser } = useAppContext();

  const [step, setStep] = useState<WorkflowStep>(1);
  const [visibleLevels, setVisibleLevels] = useState(1);
  const [errorMsg, setErrorMsg] = useState("");
  const [showMetaErrors, setShowMetaErrors] = useState(false);

  const [wfName, setWfName] = useState("");
  const [wfAlias, setWfAlias] = useState("");
  const [wfModule, setWfModule] = useState("");
  const [wfNode, setWfNode] = useState("");

  const [moduleGroups, setModuleGroups] = useState<ModuleGroup[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ value: string; label: string }>>([]);

  const [levels, setLevels] = useState<WorkflowLevel[]>(INITIAL_LEVELS);

  const isWorkflowMetaComplete = [wfName, wfModule, wfNode].every((value) => Boolean(String(value).trim()));

  const isRMUsedGlobally = useMemo(
    () => levels.slice(0, visibleLevels).some((level) => level.approvals.some((approval) => approval.option === "reporting_manager")),
    [levels, visibleLevels],
  );

  const currentLevelComplete = useMemo(() => {
    const current = levels[visibleLevels - 1];
    return Boolean(current) && current.approvals.every((approval) => approval.option);
  }, [levels, visibleLevels]);

  const selectedModuleLabel = useMemo(() => {
    return moduleGroups
      .flatMap((group) => group.options)
      .find((option) => option.value === wfModule)?.label || "-";
  }, [moduleGroups, wfModule]);

  const selectedDepartmentLabel = useMemo(() => {
    return departmentOptions.find((option) => option.value === wfNode)?.label || "-";
  }, [departmentOptions, wfNode]);

  const selectedModuleCategoryKey = useMemo(() => {
    for (const group of moduleGroups) {
      if (group.options.some((option) => option.value === wfModule)) {
        return group.categoryKey;
      }
    }
    return "";
  }, [moduleGroups, wfModule]);

  useEffect(() => {
    if (!errorMsg) return;
    const timer = setTimeout(() => setErrorMsg(""), 3000);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  useEffect(() => {
    const companyCode = currentUser?.companyCode?.trim().toUpperCase();
    if (!companyCode) return;

    let ignore = false;

    const collectNodes = (node: OrgNode | null): Array<{ label: string; value: string }> => {
      if (!node) return [];
      const nodes: Array<{ label: string; value: string }> = [];
      const walk = (current: OrgNode) => {
        const normalized = current.name.trim();
        const normalizedPath = current.nodePath.trim();
        if (normalized && normalizedPath && current.nodeType.toUpperCase() !== "ROOT") {
          nodes.push({ label: normalized, value: normalizedPath });
        }
        current.children.forEach(walk);
      };
      walk(node);
      return nodes;
    };

    async function loadWorkflowDependencies() {
      try {
        const [roles, orgTree] = await Promise.all([getCompanyRoles(companyCode), getCompanyOrgStructure(companyCode)]);
        if (ignore) return;

        const groupedModules = Array.from(
          roles.reduce((acc, role) => {
            const categoryKey = role.category?.trim().toUpperCase();
            const subCategoryKey = role.subCategory?.trim().toUpperCase();
            if (!categoryKey || !subCategoryKey) return acc;

            if (!acc.has(categoryKey)) {
              acc.set(categoryKey, new Map());
            }

            const categoryMap = acc.get(categoryKey)!;
            if (!categoryMap.has(subCategoryKey)) {
              categoryMap.set(subCategoryKey, {
                value: subCategoryKey,
                label: formatTokenLabel(subCategoryKey),
              });
            }

            return acc;
          }, new Map<string, Map<string, { value: string; label: string }>>()),
          ([categoryKey, optionsMap]) => ({
            categoryKey,
            categoryLabel: getCategoryLabel(categoryKey),
            options: Array.from(optionsMap.values()),
          }),
        );

        setModuleGroups(groupedModules);
        setWfModule((current) => {
          const exists = groupedModules.some((group) => group.options.some((option) => option.value === current));
          return exists ? current : "";
        });

        const nodes = collectNodes(orgTree);
        const uniqueNodes = Array.from(
          nodes.reduce((acc, item) => {
            if (!acc.has(item.value)) acc.set(item.value, item);
            return acc;
          }, new Map<string, { value: string; label: string }>())
            .values(),
        );
        const nextDepartments = uniqueNodes;

        setDepartmentOptions(nextDepartments);
        setWfNode((current) => (nextDepartments.some((option) => option.value === current) ? current : ""));
      } catch {
        if (ignore) return;
      }
    }

    void loadWorkflowDependencies();

    return () => {
      ignore = true;
    };
  }, [currentUser?.companyCode]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setVisibleLevels(1);
    setErrorMsg("");
    setShowMetaErrors(false);
    setWfName("");
    setWfAlias("");
    setWfModule("");
    setWfNode("");
    setLevels(INITIAL_LEVELS.map((level) => ({ ...level, approvals: [{ option: "" }] })));
  }, [isOpen]);

  const updateLevelApprover = (levelId: number, index: number, value: string) => {
    setErrorMsg("");
    setLevels((previous) =>
      previous.map((level) =>
        level.id === levelId
          ? {
              ...level,
              approvals: level.approvals.map((approval, approvalIdx) =>
                approvalIdx === index ? { ...approval, option: value } : approval,
              ),
            }
          : level,
      ),
    );
  };

  const addApproverToLevel = (levelId: number) => {
    setLevels((previous) =>
      previous.map((level) =>
        level.id === levelId && level.approvals.length < 2
          ? {
              ...level,
              approvals: [...level.approvals, { option: "" }],
            }
          : level,
      ),
    );
  };

  const removeApproverFromLevel = (levelId: number, index: number) => {
    setLevels((previous) =>
      previous.map((level) =>
        level.id === levelId && level.approvals.length > 1
          ? {
              ...level,
              approvals: level.approvals.filter((_, approvalIdx) => approvalIdx !== index),
            }
          : level,
      ),
    );
  };

  const toggleLogic = (levelId: number) => {
    setLevels((previous) =>
      previous.map((level) =>
        level.id === levelId
          ? {
              ...level,
              type: level.type === "AND" ? "OR" : "AND",
            }
          : level,
      ),
    );
  };

  const addNewLevel = () => {
    if (!currentLevelComplete) {
      setErrorMsg(`Please select an approver for Level ${visibleLevels} first.`);
      return;
    }

    if (visibleLevels < 5) {
      setVisibleLevels((current) => current + 1);
      setErrorMsg("");
    }
  };

  const removeLastLevel = () => {
    if (visibleLevels <= 1) return;

    const removeIndex = visibleLevels - 1;
    setLevels((previous) =>
      previous.map((level, idx) =>
        idx === removeIndex
          ? { ...level, approvals: [{ option: "" }], type: "AND" as const }
          : level,
      ),
    );
    setVisibleLevels((current) => Math.max(1, current - 1));
    setErrorMsg("");
  };

  const handleNext = async () => {
    setErrorMsg("");

    if (step === 1) {
      setShowMetaErrors(true);
      if (!isWorkflowMetaComplete) {
        setErrorMsg("Please complete all base parameters before continuing.");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!currentLevelComplete) {
        setErrorMsg(`Complete Level ${visibleLevels} configuration to proceed.`);
        return;
      }
      setStep(3);
      return;
    }

    const companyCode = currentUser?.companyCode?.trim().toUpperCase();
    if (!companyCode) {
      setErrorMsg("Company code unavailable. Please re-login and try again.");
      return;
    }

    try {
      const payloadLevels = levels.slice(0, visibleLevels).reduce<Record<string, Record<string, string>>>((acc, level, idx) => {
        const levelKey = `l${idx + 1}`;
        const approver1 = level.approvals[0]?.option ? toApiApprover(level.approvals[0].option) : "";
        const approver2 = level.approvals[1]?.option ? toApiApprover(level.approvals[1].option) : "";

        acc[levelKey] = {
          approver1,
          ...(approver2 ? { approver2 } : {}),
          ...(level.approvals.length > 1 ? { type: level.type } : {}),
        };
        return acc;
      }, {});

      await createWorkflow({
        companyCode,
        name: wfName.trim(),
        ...(wfAlias.trim() ? { alias: wfAlias.trim() } : {}),
        module: selectedModuleCategoryKey || wfModule.trim(),
        subModule: wfModule.trim(),
        nodePath: wfNode.trim(),
        levels: payloadLevels,
      });
      window.alert("Workflow Published!");
    } catch {
      setErrorMsg("Failed to publish workflow. Please try again.");
    }
  };

  const handleBack = () => {
    setErrorMsg("");
    setShowMetaErrors(false);
    if (step > 1) {
      setStep((current) => (current - 1) as WorkflowStep);
    }
  };

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
              departmentLabel={selectedDepartmentLabel}
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
