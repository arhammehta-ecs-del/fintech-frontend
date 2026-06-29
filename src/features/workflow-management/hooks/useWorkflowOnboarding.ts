import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { getCompanyRoles } from "@/services/role.service";
import { fetchCompanyNodes } from "@/services/user.service";
import { createWorkflow } from "@/services/workflow.service";
import { acquireEditLock } from "@/services/edit-lock.service";
import type { ModuleGroup, WorkflowStep, WorkflowTypeScope } from "@/features/workflow-management/components/onboarding/types";
import { createResetLevels, getCategoryLabel, INITIAL_LEVELS, formatTokenLabel, toApiApprover, toApiWorkflowType } from "@/features/workflow-management/utils/workflowOnboarding.utils";
import { formatSnakeCaseLabel } from "@/features/workflow-management/utils/workflowRecord.utils";
import type { WorkflowRecord } from "@/features/workflow-management/types/workflow.types";

type UseWorkflowOnboardingOptions = {
  isOpen?: boolean;
  onPublished?: () => void | Promise<void>;
  mode?: "create" | "edit";
  seedWorkflow?: WorkflowRecord | null;
};

const fromApiApprover = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "REPORTING_MANAGER") return "reporting_manager";
  if (normalized === "NODE_APPROVER") return "node_approver";
  if (normalized === "HIERARCHY_APPROVER") return "hierarchy_approver";
  if (normalized === "NO_APPROVER") return "no_approver";
  return normalized.toLowerCase();
};

const isNoApproverOption = (value: string) => value.trim().toLowerCase() === "no_approver";

const parseSeedLevels = (source: unknown) => {
  const reset = createResetLevels();
  const toLevel = (id: number, approver1?: string | null, approver2?: string | null, approverType?: string | null) => ({
    id,
    approvals: [
      { option: approver1 ? fromApiApprover(approver1) : "" },
      ...(approver2 ? [{ option: fromApiApprover(approver2) }] : []),
    ],
    type: (approverType || "AND").toUpperCase() === "OR" ? ("OR" as const) : ("AND" as const),
  });

  if (Array.isArray(source)) {
    source.forEach((rawLevel, index) => {
      if (!rawLevel || typeof rawLevel !== "object") return;
      const level = rawLevel as Record<string, unknown>;
      const levelId = Number(level.level ?? index + 1);
      if (!levelId || levelId < 1 || levelId > reset.length) return;
      reset[levelId - 1] = toLevel(
        levelId,
        typeof level.approver1 === "string" ? level.approver1 : null,
        typeof level.approver2 === "string" ? level.approver2 : null,
        typeof level.approverType === "string" ? level.approverType : null,
      );
    });
    return reset;
  }

  if (source && typeof source === "object") {
    const byKey = source as Record<string, unknown>;
    Object.entries(byKey).forEach(([key, value]) => {
      if (!/^l\d+$/i.test(key) || !value || typeof value !== "object") return;
      const level = value as Record<string, unknown>;
      const levelId = Number(key.replace(/[^0-9]/g, ""));
      if (!levelId || levelId < 1 || levelId > reset.length) return;
      reset[levelId - 1] = toLevel(
        levelId,
        typeof level.approver1 === "string" ? level.approver1 : null,
        typeof level.approver2 === "string" ? level.approver2 : null,
        typeof level.type === "string" ? level.type : null,
      );
    });
  }

  return reset;
};

const getVisibleLevelCount = (levels: typeof INITIAL_LEVELS) => {
  for (let index = levels.length - 1; index >= 0; index -= 1) {
    if (levels[index].approvals.some((approval) => Boolean(approval.option))) {
      return index + 1;
    }
  }
  return 1;
};

const getNodeLabelWithType = (nodeName: string, nodeType?: string) => {
  const formattedType = formatSnakeCaseLabel(nodeType || "").trim();
  return formattedType ? `${nodeName} (${formattedType})` : nodeName;
};

export function useWorkflowOnboarding({ isOpen = false, onPublished, mode = "create", seedWorkflow = null }: UseWorkflowOnboardingOptions) {
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
  const [workflowType, setWorkflowType] = useState<WorkflowTypeScope | "">("");

  const [moduleGroups, setModuleGroups] = useState<ModuleGroup[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ value: string; label: string; nodeType?: string; levelCount?: number }>>([]);
  const [companyNodesWithWorkflows, setCompanyNodesWithWorkflows] = useState<
    Array<{
      nodePath: string;
      levelCount?: number;
      selectedWorkflow?: { levelsHash: string; name: string; alias?: string; selected?: boolean } | null;
      workflows: Array<{ levelsHash: string; name: string; alias?: string; selected?: boolean }>;
    }>
  >([]);
  const [workflowOptions, setWorkflowOptions] = useState<Array<{ levelsHash: string; label: string }>>([]);
  const [selectedWorkflowLevelsHash, setSelectedWorkflowLevelsHash] = useState("");
  const [remarks, setRemarks] = useState("");
  const [levels, setLevels] = useState(INITIAL_LEVELS);
  const [seedSnapshot, setSeedSnapshot] = useState<{
    wfName: string;
    wfAlias: string;
    selectedModuleLabel: string;
    selectedNodeNameLabel: string;
    selectedNodeLevelCount?: number;
    wfNode: string;
    levels: typeof INITIAL_LEVELS;
    visibleLevels: number;
  } | null>(null);

  const isRMUsedGlobally = useMemo(
    () => levels.slice(0, visibleLevels).some((level) => level.approvals.some((approval) => approval.option === "reporting_manager")),
    [levels, visibleLevels],
  );

  const currentLevelComplete = useMemo(() => {
    const current = levels[visibleLevels - 1];
    return Boolean(current) && current.approvals.every((approval) => approval.option);
  }, [levels, visibleLevels]);

  const hasNoApproverSelected = useMemo(() => isNoApproverOption(levels[0]?.approvals[0]?.option || ""), [levels]);

  const selectedModuleLabel = useMemo(
    () => moduleGroups.flatMap((group) => group.options).find((option) => option.value === wfModule)?.label || "-",
    [moduleGroups, wfModule],
  );

  const selectedNodeNameLabel = useMemo(() => {
    const selectedNode = departmentOptions.find((option) => option.value === wfNode);
    if (!selectedNode) return "-";
    return getNodeLabelWithType(selectedNode.label, selectedNode.nodeType);
  }, [departmentOptions, wfNode]);

  const selectedNodeLevelCount = useMemo(
    () => departmentOptions.find((option) => option.value === wfNode)?.levelCount,
    [departmentOptions, wfNode],
  );

  const selectedModuleCategoryKey = useMemo(() => {
    for (const group of moduleGroups) {
      if (group.options.some((option) => option.value === wfModule)) return group.categoryKey;
    }
    return "";
  }, [moduleGroups, wfModule]);

  const isWorkflowMetaComplete = useMemo(() => {
    if (!wfName.trim() || !wfModule.trim() || !wfNode.trim()) return false;
    if (!workflowType.trim()) return false;
    return true;
  }, [wfModule, wfName, wfNode, workflowType]);

  useEffect(() => {
    if (!wfModule.trim()) {
      if (workflowType) setWorkflowType("");
      return;
    }
    if (!workflowType) setWorkflowType("ALL CHILD");
  }, [wfModule, workflowType]);

  useEffect(() => {
    if (!errorMsg) return;
    const timer = setTimeout(() => setErrorMsg(""), 3000);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  useEffect(() => {
    if (!isOpen) return;
    const companyCode = currentUser?.companyCode?.trim().toUpperCase();
    if (!companyCode) return;

    let ignore = false;
    const loadWorkflowDependencies = async () => {
      try {
        const [roles, nodes] = await Promise.all([getCompanyRoles(companyCode), fetchCompanyNodes("WORK_FLOW")]);
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

        const nextDepartments = Array.from(
          nodes.reduce((acc, node) => {
            const label = node.nodeName.trim();
            const value = node.nodePath.trim();
            if (!label || !value) return acc;
            if (!acc.has(value)) {
              acc.set(value, {
                label,
                value,
                nodeType: node.nodeType.trim(),
                levelCount: typeof node.levelCount === "number" ? node.levelCount : undefined,
              });
            }
            return acc;
          }, new Map<string, { label: string; value: string; nodeType?: string; levelCount?: number }>())
            .values(),
        );
        setDepartmentOptions(nextDepartments);
        setWfNode((current) => (nextDepartments.some((option) => option.value === current) ? current : ""));
        setCompanyNodesWithWorkflows(
          nodes.map((node) => ({
            nodePath: node.nodePath.trim(),
            levelCount: typeof node.levelCount === "number" ? node.levelCount : undefined,
            selectedWorkflow: node.selectedWorkflow,
            workflows: node.workflows,
          })),
        );
      } catch (error) {
        if (ignore) return;
        const message = getApiErrorMessage(error, "Unable to load workflow dependencies.");
        setErrorMsg(message);
        setDepartmentOptions([]);
        setCompanyNodesWithWorkflows([]);
        setWorkflowOptions([]);
        toast({ title: "Unable to load workflow dependencies", description: message, variant: "destructive" });
      }
    };

    void loadWorkflowDependencies();
    return () => {
      ignore = true;
    };
  }, [currentUser?.companyCode, isOpen, toast]);

  useEffect(() => {
    const selectedNodePath = wfNode.trim().toUpperCase();
    const matchedNode =
      companyNodesWithWorkflows.find((node) => node.nodePath.trim().toUpperCase() === selectedNodePath) ?? null;
    const options = companyNodesWithWorkflows
      .flatMap((node) =>
        node.workflows.filter((workflow) => {
          const nodePath = node.nodePath.trim().toUpperCase();
          if (selectedNodePath && nodePath === selectedNodePath) return true;
          const alias = workflow.alias?.trim().toUpperCase();
          return Boolean(alias && alias.endsWith("D"));
        }),
      )
      .map((workflow) => {
        const levelsHash = workflow.levelsHash.trim();
        const name = workflow.name.trim();
        const alias = workflow.alias?.trim();
        if (!levelsHash || !name) return null;
        return { levelsHash, label: alias ? `${name} (${alias})` : name };
      })
      .filter((option): option is { levelsHash: string; label: string } => Boolean(option));
    const nextWorkflowOptions = Array.from(new Map(options.map((option) => [option.levelsHash, option])).values());

    setWorkflowOptions(nextWorkflowOptions);
    setSelectedWorkflowLevelsHash((current) => {
      const normalizedCurrent = current.trim();
      if (normalizedCurrent) {
        return nextWorkflowOptions.some((option) => option.levelsHash === normalizedCurrent) ? normalizedCurrent : "";
      }

      const selectedFromNode =
        matchedNode?.selectedWorkflow?.levelsHash?.trim() ||
        matchedNode?.workflows.find((workflow) => workflow.selected)?.levelsHash?.trim() ||
        "";
      if (selectedFromNode && nextWorkflowOptions.some((option) => option.levelsHash === selectedFromNode)) {
        return selectedFromNode;
      }

      const seededLevelsHash = mode === "edit" ? (seedWorkflow?.levelsHash || "").trim() : "";
      if (seededLevelsHash && nextWorkflowOptions.some((option) => option.levelsHash === seededLevelsHash)) {
        return seededLevelsHash;
      }

      return "";
    });
  }, [companyNodesWithWorkflows, mode, seedWorkflow?.levelsHash, wfNode]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setErrorMsg("");
    setShowMetaErrors(false);

    if (mode === "edit" && seedWorkflow) {
      const nextLevels = parseSeedLevels(seedWorkflow.levels);
      const nextVisibleLevels = getVisibleLevelCount(nextLevels);

      setVisibleLevels(nextVisibleLevels);
      setWfName(seedWorkflow.name || "");
      setWfAlias(seedWorkflow.alias === "-" ? "" : seedWorkflow.alias || "");
      setWfModule(seedWorkflow.subModule || "");
      setWfNode(seedWorkflow.nodePath || "");
      setWorkflowType("ALL CHILD");
      setSelectedWorkflowLevelsHash(seedWorkflow.levelsHash || "");
      setLevels(nextLevels);
      return;
    }

    setVisibleLevels(1);
    setWfName("");
    setWfAlias("");
    setWfModule("");
    setWfNode("");
    setWorkflowType("");
    setSelectedWorkflowLevelsHash("");
    setRemarks("");
    setLevels(createResetLevels());
    setSeedSnapshot(null);
  }, [isOpen, mode, seedWorkflow]);

  useEffect(() => {
    if (!isOpen || mode !== "edit" || !seedWorkflow) return;
    const snapshotLevels = parseSeedLevels(seedWorkflow.levels);
    const snapshotVisibleLevels = getVisibleLevelCount(snapshotLevels);
    setSeedSnapshot({
      wfName: seedWorkflow.name || "",
      wfAlias: seedWorkflow.alias === "-" ? "" : seedWorkflow.alias || "",
      selectedModuleLabel: seedWorkflow.module || "-",
      selectedNodeNameLabel: getNodeLabelWithType(seedWorkflow.nodeName || "-", seedWorkflow.nodeType || ""),
      selectedNodeLevelCount: seedWorkflow.levelCount,
      wfNode: seedWorkflow.nodePath || "",
      levels: snapshotLevels,
      visibleLevels: snapshotVisibleLevels,
    });
  }, [isOpen, mode, seedWorkflow]);

  const updateLevelApprover = (levelId: number, index: number, value: string) => {
    setErrorMsg("");
    if (levelId === 1 && index === 0 && isNoApproverOption(value)) {
      setLevels((previous) =>
        previous.map((level, levelIndex) => {
          if (level.id === 1) {
            return {
              ...level,
              approvals: [{ option: "no_approver" }],
              type: "AND" as const,
            };
          }

          if (levelIndex > 0) {
            return {
              ...level,
              approvals: [{ option: "" }],
              type: "AND" as const,
            };
          }

          return level;
        }),
      );
      setVisibleLevels(1);
      setSelectedWorkflowLevelsHash("");
      return;
    }

    setLevels((previous) =>
      previous.map((level) => {
        if (level.id !== levelId) return level;

        const nextApprovals = level.approvals.map((approval, approvalIdx) => (approvalIdx === index ? { ...approval, option: value } : approval));
        const nextLevel =
          levelId === 1 && index === 0 && isNoApproverOption(level.approvals[0]?.option || "")
            ? { ...level, approvals: nextApprovals, type: "AND" as const }
            : { ...level, approvals: nextApprovals };
        return nextLevel;
      }),
    );
  };

  const addApproverToLevel = (levelId: number) => {
    if (levelId === 1 && hasNoApproverSelected) return;
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
    if (levelId === 1 && hasNoApproverSelected) return;
    setLevels((previous) =>
      previous.map((level) => (level.id === levelId ? { ...level, type: level.type === "AND" ? "OR" : "AND" } : level)),
    );
  };

  const addNewLevel = () => {
    if (hasNoApproverSelected) {
      setErrorMsg("No Approver can only be used in Level 1 and does not allow more levels.");
      return;
    }
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

    try {
      const payloadLevels = toPayloadLevels(levels, visibleLevels);

      const normalizedNodePath = wfNode.trim();
      const normalizedModule = (selectedModuleCategoryKey || wfModule.trim()).trim();
      const normalizedSubModule = wfModule.trim();
      const nextRemarks = remarks.trim();

      if (mode === "edit" && seedWorkflow) {
        const target = {
          module: (seedWorkflow.rawModule || seedWorkflow.module || "").trim(),
          subModule: (seedWorkflow.subModule || "").trim(),
          nodePath: (seedWorkflow.nodePath || "").trim(),
          levelsHash: (seedWorkflow.levelsHash || "").trim(),
        };

        await acquireEditLock({
          type: "workflow",
          target: {
            nodePath: (seedWorkflow.nodePath || "").trim(),
            levelsHash: target.levelsHash,
            subModule: target.subModule,
            module: target.module,
          },
        });

        const changedPayload: Record<string, unknown> = {};
        if (wfName.trim() !== (seedWorkflow.name || "").trim()) changedPayload.name = wfName.trim();
        if (normalizedModule !== (seedWorkflow.rawModule || seedWorkflow.module || "").trim()) changedPayload.module = normalizedModule;
        if (normalizedSubModule !== (seedWorkflow.subModule || "").trim()) changedPayload.subModule = normalizedSubModule;
        if (normalizedNodePath !== (seedWorkflow.nodePath || "").trim()) changedPayload.nodePath = normalizedNodePath;

        const seedLevels = parseSeedLevels(seedWorkflow.levels);
        const seedVisibleLevels = getVisibleLevelCount(seedLevels);
        const seedPayloadLevels = toPayloadLevels(seedLevels, seedVisibleLevels);
        if (JSON.stringify(payloadLevels) !== JSON.stringify(seedPayloadLevels)) changedPayload.levels = payloadLevels;

        await createWorkflow({
          type: "update",
          target,
          ...changedPayload,
          remarks: nextRemarks,
          levelsHash: selectedWorkflowLevelsHash.trim() || null,
        });
        await onPublished?.();
        return;
      }

      await createWorkflow({
        type: "initiate",
        name: wfName.trim(),
        ...(wfAlias.trim() ? { alias: wfAlias.trim() } : {}),
        module: normalizedModule,
        subModule: normalizedSubModule,
        workflowType: toApiWorkflowType(workflowType),
        ...(normalizedNodePath ? { nodePath: normalizedNodePath } : {}),
        levels: payloadLevels,
        levelsHash: hasNoApproverSelected ? null : selectedWorkflowLevelsHash.trim() || null,
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
    mode,
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
    levels,
    isRMUsedGlobally,
    currentLevelComplete,
    hasNoApproverSelected,
    selectedModuleLabel,
    selectedNodeNameLabel,
    selectedNodeLevelCount,
    seedSnapshot,
    setWfName,
    setWfAlias,
    setWfModule,
    setWfNode,
    setWorkflowType,
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
  };
}
  const toPayloadLevels = (sourceLevels: typeof INITIAL_LEVELS, visibleLevelCount: number) =>
    sourceLevels.slice(0, visibleLevelCount).reduce<Record<string, Record<string, string>>>((acc, level, idx) => {
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





