import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { getCompanyOrgStructure } from "@/services/org.service";
import { getCompanyRoles } from "@/services/role.service";
import { createWorkflow } from "@/services/workflow.service";
import type { ModuleGroup, WorkflowStep } from "@/features/workflow-management/components/onboarding/types";
import { collectNodeOptions, createResetLevels, getCategoryLabel, INITIAL_LEVELS, formatTokenLabel, toApiApprover } from "@/features/workflow-management/utils/workflowOnboarding.utils";

type UseWorkflowOnboardingOptions = {
  isOpen?: boolean;
  onPublished?: () => void | Promise<void>;
};

export function useWorkflowOnboarding({ isOpen = false, onPublished }: UseWorkflowOnboardingOptions) {
  const { currentUser } = useAppContext();
  const { toast } = useToast();

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
  const [levels, setLevels] = useState(INITIAL_LEVELS);

  const isWorkflowMetaComplete = [wfName, wfModule, wfNode].every((value) => Boolean(String(value).trim()));

  const isRMUsedGlobally = useMemo(
    () => levels.slice(0, visibleLevels).some((level) => level.approvals.some((approval) => approval.option === "reporting_manager")),
    [levels, visibleLevels],
  );

  const currentLevelComplete = useMemo(() => {
    const current = levels[visibleLevels - 1];
    return Boolean(current) && current.approvals.every((approval) => approval.option);
  }, [levels, visibleLevels]);

  const selectedModuleLabel = useMemo(
    () => moduleGroups.flatMap((group) => group.options).find((option) => option.value === wfModule)?.label || "-",
    [moduleGroups, wfModule],
  );

  const selectedNodeNameLabel = useMemo(
    () => departmentOptions.find((option) => option.value === wfNode)?.label || "-",
    [departmentOptions, wfNode],
  );

  const selectedModuleCategoryKey = useMemo(() => {
    for (const group of moduleGroups) {
      if (group.options.some((option) => option.value === wfModule)) return group.categoryKey;
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
    const loadWorkflowDependencies = async () => {
      try {
        const [roles, orgTree] = await Promise.all([getCompanyRoles(companyCode), getCompanyOrgStructure(companyCode)]);
        if (ignore) return;

        const groupedModules = Array.from(
          roles.reduce((acc, role) => {
            const categoryKey = role.category?.trim().toUpperCase();
            const subCategoryKey = role.subCategory?.trim().toUpperCase();
            if (!categoryKey || !subCategoryKey) return acc;

            if (!acc.has(categoryKey)) acc.set(categoryKey, new Map());

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
        setWfModule((current) => (groupedModules.some((group) => group.options.some((option) => option.value === current)) ? current : ""));

        const nextDepartments = collectNodeOptions(orgTree);
        setDepartmentOptions(nextDepartments);
        setWfNode((current) => (nextDepartments.some((option) => option.value === current) ? current : ""));
      } catch (error) {
        if (ignore) return;
        const message = getApiErrorMessage(error, "Unable to load workflow dependencies.");
        setErrorMsg(message);
        toast({ title: "Unable to load workflow dependencies", description: message, variant: "destructive" });
      }
    };

    void loadWorkflowDependencies();
    return () => {
      ignore = true;
    };
  }, [currentUser?.companyCode, toast]);

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
    setLevels(createResetLevels());
  }, [isOpen]);

  const updateLevelApprover = (levelId: number, index: number, value: string) => {
    setErrorMsg("");
    setLevels((previous) =>
      previous.map((level) =>
        level.id === levelId
          ? {
            ...level,
            approvals: level.approvals.map((approval, approvalIdx) => (approvalIdx === index ? { ...approval, option: value } : approval)),
          }
          : level,
      ),
    );
  };

  const addApproverToLevel = (levelId: number) => {
    setLevels((previous) =>
      previous.map((level) =>
        level.id === levelId && level.approvals.length < 2
          ? { ...level, approvals: [...level.approvals, { option: "" }] }
          : level,
      ),
    );
  };

  const removeApproverFromLevel = (levelId: number, index: number) => {
    setLevels((previous) =>
      previous.map((level) =>
        level.id === levelId && level.approvals.length > 1
          ? { ...level, approvals: level.approvals.filter((_, approvalIdx) => approvalIdx !== index) }
          : level,
      ),
    );
  };

  const toggleLogic = (levelId: number) => {
    setLevels((previous) =>
      previous.map((level) => (level.id === levelId ? { ...level, type: level.type === "AND" ? "OR" : "AND" } : level)),
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
        idx === removeIndex ? { ...level, approvals: [{ option: "" }], type: "AND" as const } : level,
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
      await onPublished?.();
    } catch (error) {
      const message = getApiErrorMessage(error, "Failed to publish workflow. Please try again.");
      setErrorMsg(message);
      toast({ title: "Failed to publish workflow", description: message, variant: "destructive" });
    }
  };

  const handleBack = () => {
    setErrorMsg("");
    setShowMetaErrors(false);
    if (step > 1) setStep((current) => (current - 1) as WorkflowStep);
  };

  return {
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
  };
}
