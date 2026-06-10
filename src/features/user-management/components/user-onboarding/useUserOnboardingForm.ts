import { useEffect, useMemo, useRef, useState } from "react";
import { useAppContext, type OrgNode } from "@/contexts/AppContext";
import type { AppUser } from "@/contexts/AppContext";
import type { RoleRecord } from "@/services/role.service";
import { getCompanyRoles } from "@/services/role.service";
import { fetchCompanyNodesWithAccess, fetchCompanyUsersPaginated } from "@/services/user.service";
import { USER_FILTER_CONFIG } from "@/features/user-management/constants";
import type {
  UserOnboardingFormData,
  NodePermissionBuckets,
  NodePermissionScopeBuckets,
  SystemAccessScope,
  PermissionAction,
  ValidationErrors,
} from "@/features/user-management/types";
import {
  createInitialUserOnboardingFormData,
  createInitialPermissions,
  createInitialPermissionScopes,
  findOrgNode,
  validateUserOnboardingStep,
} from "@/features/user-management/utils";
import { buildOrgTreeFromCompanyNodes, buildWorkflowOptions } from "./useUserOnboardingForm.utils";

const isSignatorySeedMember = (seedMember: AppUser) => {
  const designation = (seedMember.designation || seedMember.basicDetails?.designation || "").trim().toLowerCase();
  const name = (seedMember.name || seedMember.basicDetails?.name || "").trim().toLowerCase();
  const role = (seedMember.role || "").trim().toLowerCase();

  return (
    role === "signatory" ||
    USER_FILTER_CONFIG.roleType.signatoryDesignationKeywords.some(
      (keyword) => designation.includes(keyword) || name.includes(keyword),
    )
  );
};

type UseUserOnboardingFormOptions = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: UserOnboardingFormData, context?: { seedMember?: AppUser | null }) => void | Promise<void>;
  seedMember?: AppUser | null;
};

export function useUserOnboardingForm({ open, onOpenChange, onSubmit, seedMember = null }: UseUserOnboardingFormOptions) {
  const { currentUser, users } = useAppContext();
  const companyCode = currentUser?.companyCode ?? "";
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [companyNodesWithWorkflows, setCompanyNodesWithWorkflows] = useState<
    Array<{ nodePath: string; workflows: Array<{ levelsHash: string; name: string; alias?: string }> }>
  >([]);
  const [workflowOptions, setWorkflowOptions] = useState<Array<{ levelsHash: string; label: string }>>([]);
  const [localOrgStructure, setLocalOrgStructure] = useState<OrgNode | null>(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(createInitialUserOnboardingFormData);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [expandedAccessNodeIds, setExpandedAccessNodeIds] = useState<string[]>([]);
  const [primaryNodeId, setPrimaryNodeId] = useState<string | null>(null);
  const [nodePermissions, setNodePermissions] = useState<Record<string, NodePermissionBuckets>>({});
  const [nodePermissionScopes, setNodePermissionScopes] = useState<Record<string, NodePermissionScopeBuckets>>({});
  const [infoNodeId, setInfoNodeId] = useState<string | null>(null);
  const [isReviewAccessExpanded, setIsReviewAccessExpanded] = useState(true);
  const [activeUsersForManagers, setActiveUsersForManagers] = useState<AppUser[]>([]);
  const [reviewSnapshot, setReviewSnapshot] = useState<{
    basic: UserOnboardingFormData["basic"];
    selectedNodes: OrgNode[];
    primaryNodeId: string | null;
    nodePermissions: Record<string, NodePermissionBuckets>;
    nodePermissionScopes: Record<string, NodePermissionScopeBuckets>;
    selectedWorkflow: string;
  } | null>(null);
  const reviewAccessNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const orgStructure = localOrgStructure;
  const parsePermissionAction = (roleName: string): PermissionAction => {
    const normalized = roleName.trim().toLowerCase();
    if (normalized.includes("viewer")) return "viewer";
    if (normalized.includes("checker") || normalized.includes("maker") || normalized.includes("manager")) return "manager";
    return "user";
  };
  const parseSystemAccessScope = (scope: string): SystemAccessScope => {
    const normalized = scope.trim().toUpperCase();
    if (normalized === "ALL_CHILD") return "ALL_CHILD";
    if (normalized === "IMMEDIATE_CHILD") return "IMMEDIATE_CHILD";
    return "NODE";
  };

  // Fetch live roles when dialog opens
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    getCompanyRoles(companyCode).then((data) => {
      if (!ignore) setRoles(data);
    });
    return () => { ignore = true; };
  }, [open, companyCode]);

  useEffect(() => {
    if (!open) return;
    const normalizedCompanyCode = companyCode.trim().toUpperCase();
    if (!normalizedCompanyCode) return;

    let ignore = false;
    const loadActiveUsersForManagerDropdown = async () => {
      try {
        const allActiveUsers: AppUser[] = [];
        let cursor: string | null = null;
        let topCursor: string | null = null;
        let hasNext = true;
        let safetyCounter = 0;

        while (hasNext && safetyCounter < 100) {
          safetyCounter += 1;
          const response = await fetchCompanyUsersPaginated("active", {
            companyCode: normalizedCompanyCode,
            pagination: {
              limit: 100,
              cursor,
              topCursor,
              direction: "NEXT",
              statusType: "active",
            },
          });

          allActiveUsers.push(...response.users);
          cursor = response.pageInfo.nextCursor;
          topCursor = response.pageInfo.topCursor || topCursor;
          hasNext = Boolean(response.pageInfo.hasNext && response.pageInfo.nextCursor);
        }

        if (!ignore) setActiveUsersForManagers(allActiveUsers);
      } catch {
        if (!ignore) setActiveUsersForManagers([]);
      }
    };

    void loadActiveUsersForManagerDropdown();
    return () => {
      ignore = true;
    };
  }, [open, companyCode]);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    fetchCompanyNodesWithAccess("USER_ACC")
      .then(({ nodes, access }) => {
        if (ignore) return;
        const normalizedRoleName = (access.roleName || "")
          .trim()
          .toUpperCase()
          .replace(/[_-]+/g, " ")
          .replace(/\s+/g, " ");
        const isCorpAdmin =
          normalizedRoleName === "CORP ADMIN" || (access.roleCode || "").trim().toUpperCase() === "CORP_ADMIN";
        setCompanyNodesWithWorkflows(nodes);
        setLocalOrgStructure(buildOrgTreeFromCompanyNodes(nodes));
        setFormData((current) => ({
          ...current,
          isGlobalUserEligible: isCorpAdmin,
          isGlobalSignatory: isCorpAdmin ? current.isGlobalSignatory : false,
          basic: access.designation
            ? {
              ...current.basic,
              designation: current.basic.designation.trim() ? current.basic.designation : access.designation,
            }
            : current.basic,
        }));
      })
      .catch(() => {
        if (!ignore) {
          setCompanyNodesWithWorkflows([]);
          setWorkflowOptions([]);
          setLocalOrgStructure(null);
          setFormData((current) => ({
            ...current,
            isGlobalUserEligible: false,
            isGlobalSignatory: false,
          }));
        }
      });

    return () => {
      ignore = true;
    };
  }, [open, companyCode]);

  useEffect(() => {
    const isSameOrAncestorPath = (candidatePath: string, selectedPath: string) => {
      if (candidatePath === selectedPath) return true;
      const boundaries = [".", ">", "/", "|", ":"];
      return boundaries.some(
        (boundary) =>
          selectedPath.startsWith(`${candidatePath}${boundary}`) ||
          selectedPath.startsWith(`${candidatePath} ${boundary}`),
      );
    };

    const selectedNodePathSet = new Set(
      selectedNodeIds.map((nodePath) => nodePath.trim().toUpperCase()).filter(Boolean),
    );
    const scopedNodes = companyNodesWithWorkflows.map((node) => ({
      ...node,
      workflows: node.workflows.filter((workflow) => {
        const nodePath = node.nodePath.trim().toUpperCase();
        const isSelectedOrAncestor =
          selectedNodePathSet.size > 0 &&
          Array.from(selectedNodePathSet).some((selectedPath) => isSameOrAncestorPath(nodePath, selectedPath));
        if (isSelectedOrAncestor) return true;
        const alias = workflow.alias?.trim().toUpperCase();
        return Boolean(alias && alias.endsWith("D"));
      }),
    }));
    const nextWorkflowOptions = buildWorkflowOptions(scopedNodes);
    setWorkflowOptions(nextWorkflowOptions);

    setFormData((current) => {
      if (!current.selectedWorkflowLevelsHash) return current;
      const stillAvailable = nextWorkflowOptions.some(
        (option) => option.levelsHash === current.selectedWorkflowLevelsHash,
      );
      if (stillAvailable) return current;
      return {
        ...current,
        selectedWorkflowLevelsHash: "",
        selectedWorkflow: "",
      };
    });
  }, [companyNodesWithWorkflows, selectedNodeIds]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setErrors({});
    setInfoNodeId(null);
    setIsReviewAccessExpanded(true);

    if (!seedMember) {
      setFormData((current) => ({
        ...createInitialUserOnboardingFormData(),
        isGlobalUserEligible: current.isGlobalUserEligible,
        isGlobalSignatory: current.isGlobalSignatory,
      }));
      setSelectedNodeId(orgStructure?.id ?? null);
      setSelectedNodeIds([]);
      setExpandedAccessNodeIds([]);
      setPrimaryNodeId(null);
      setNodePermissions({});
      setNodePermissionScopes({});
      setReviewSnapshot(null);
      return;
    }

    const accessRows = seedMember.accessDetails ?? [];
    const nodeOrder: string[] = [];
    const nextNodePermissions: Record<string, NodePermissionBuckets> = {};
    const nextNodePermissionScopes: Record<string, NodePermissionScopeBuckets> = {};

    const ensureNode = (nodePath: string) => {
      if (nextNodePermissions[nodePath]) return;
      nextNodePermissions[nodePath] = {
        primary: createInitialPermissions(roles),
        secondary: createInitialPermissions(roles),
      };
      nextNodePermissionScopes[nodePath] = {
        primary: createInitialPermissionScopes(roles),
        secondary: createInitialPermissionScopes(roles),
      };
      nodeOrder.push(nodePath);
    };

    accessRows.forEach((row) => {
      const nodePath = (row.nodePath || "").trim();
      if (!nodePath) return;
      ensureNode(nodePath);
      const permissionBucket = row.accessType === "PRIMARY" ? "primary" : "secondary";
      const roleCategory = (row.roleCategory || "").trim().toUpperCase();
      const roleSubCategory = (row.roleSubCategory || "").trim();
      if (!roleCategory || !roleSubCategory) return;

      if (!nextNodePermissions[nodePath][permissionBucket][roleCategory]) {
        nextNodePermissions[nodePath][permissionBucket][roleCategory] = {};
      }
      if (!nextNodePermissions[nodePath][permissionBucket][roleCategory][roleSubCategory]) {
        nextNodePermissions[nodePath][permissionBucket][roleCategory][roleSubCategory] = { manager: false, user: false, viewer: false };
      }
      const action = parsePermissionAction(row.roleName || "");
      nextNodePermissions[nodePath][permissionBucket][roleCategory][roleSubCategory][action] = true;

      if (!nextNodePermissionScopes[nodePath][permissionBucket][roleCategory]) {
        nextNodePermissionScopes[nodePath][permissionBucket][roleCategory] = {};
      }
      if (!nextNodePermissionScopes[nodePath][permissionBucket][roleCategory][roleSubCategory]) {
        nextNodePermissionScopes[nodePath][permissionBucket][roleCategory][roleSubCategory] = {};
      }
      nextNodePermissionScopes[nodePath][permissionBucket][roleCategory][roleSubCategory][action] = parseSystemAccessScope(
        row.accessCategory || "NODE",
      );
    });

    const primaryCandidate = accessRows.find((row) => row.accessType === "PRIMARY" && (row.nodePath || "").trim())?.nodePath?.trim() || null;
    const selectedPrimaryNodeId = primaryCandidate || nodeOrder[0] || null;
    const selectedWorkflow = (seedMember.basicDetails?.workflowName || "").trim();
    const selectedWorkflowAlias = (seedMember.basicDetails?.alias || "").trim();
    const isGlobalSignatory = isSignatorySeedMember(seedMember);

    const seedEmployeeId = seedMember.employeeId || seedMember.basicDetails?.employeeId || "";

    setFormData((current) => ({
      ...current,
      basic: {
        name: seedMember.name || "",
        email: seedMember.email || "",
        phone: seedMember.phone || "",
        designation: seedMember.designation || "",
        employeeId: seedEmployeeId,
        reportingManager: seedMember.basicDetails?.reportingManagerEmail || seedMember.basicDetails?.reportingManager || "",
        reportingManagerName: seedMember.basicDetails?.reportingManagerName || seedMember.manager?.name || "",
        reportingManagerEmail: seedMember.basicDetails?.reportingManagerEmail || seedMember.manager?.email || "",
      },
      isGlobalUserEligible: current.isGlobalUserEligible,
      isGlobalSignatory,
      nodeSelections: nodeOrder.map((nodePath) => {
        const nodeMeta =
          accessRows.find((row) => (row.nodePath || "").trim() === nodePath) ||
          findOrgNode(orgStructure, nodePath);
        return {
          nodeId: nodePath,
          nodeName: "nodeName" in (nodeMeta || {}) ? ((nodeMeta as { nodeName?: string }).nodeName || "") : ((nodeMeta as { name?: string })?.name || ""),
          nodeType: "nodeType" in (nodeMeta || {}) ? ((nodeMeta as { nodeType?: string }).nodeType || "") : undefined,
          nodePath,
          immediateChildren: [],
          allChildren: [],
          permissions: nextNodePermissions[nodePath] ?? {
            primary: createInitialPermissions(roles),
            secondary: createInitialPermissions(roles),
          },
          permissionScopes: nextNodePermissionScopes[nodePath] ?? {
            primary: createInitialPermissionScopes(roles),
            secondary: createInitialPermissionScopes(roles),
          },
        };
      }),
      permissions: createInitialPermissions(roles),
      primaryNodeId: selectedPrimaryNodeId,
      selectedWorkflow: selectedWorkflowAlias ? `${selectedWorkflow} (${selectedWorkflowAlias})` : selectedWorkflow,
      selectedWorkflowLevelsHash: "",
      remark: "",
    }));
    setSelectedNodeId(selectedPrimaryNodeId || orgStructure?.id || null);
    setSelectedNodeIds(nodeOrder);
    setExpandedAccessNodeIds(nodeOrder);
    setPrimaryNodeId(selectedPrimaryNodeId);
    setNodePermissions(nextNodePermissions);
    setNodePermissionScopes(nextNodePermissionScopes);
    const snapshotSelectedNodes = nodeOrder
      .map((nodePath) => findOrgNode(orgStructure, nodePath))
      .filter((node): node is OrgNode => Boolean(node));
    setReviewSnapshot({
      basic: {
        name: seedMember.name || "",
        email: seedMember.email || "",
        phone: seedMember.phone || "",
        designation: seedMember.designation || "",
        employeeId: seedEmployeeId,
        reportingManager: seedMember.basicDetails?.reportingManagerEmail || seedMember.basicDetails?.reportingManager || "",
        reportingManagerName: seedMember.basicDetails?.reportingManagerName || seedMember.manager?.name || "",
        reportingManagerEmail: seedMember.basicDetails?.reportingManagerEmail || seedMember.manager?.email || "",
      },
      selectedNodes: snapshotSelectedNodes,
      primaryNodeId: selectedPrimaryNodeId,
      nodePermissions: JSON.parse(JSON.stringify(nextNodePermissions)) as Record<string, NodePermissionBuckets>,
      nodePermissionScopes: JSON.parse(JSON.stringify(nextNodePermissionScopes)) as Record<string, NodePermissionScopeBuckets>,
      selectedWorkflow: selectedWorkflowAlias ? `${selectedWorkflow} (${selectedWorkflowAlias})` : selectedWorkflow,
    });
  }, [open, orgStructure, roles, seedMember]);

  const selectedNodes = useMemo(
    () =>
      selectedNodeIds
        .map((nodeId) => findOrgNode(orgStructure, nodeId))
        .filter((node): node is OrgNode => Boolean(node) && node.status?.trim().toUpperCase() !== "PENDING"),
    [orgStructure, selectedNodeIds],
  );

  const reportingManagerOptions = useMemo(() => {
    const sourceUsers = activeUsersForManagers.length > 0 ? activeUsersForManagers : users.filter((user) => user.status === "Active");
    const seenEmails = new Set<string>();
    const options = sourceUsers
      .map((user) => {
        const name = user.name.trim();
        const email = user.email.trim().toLowerCase();
        if (!email || seenEmails.has(email)) return null;
        seenEmails.add(email);
        return {
          id: user.id || email,
          name,
          email,
          designation: user.designation?.trim() || "",
        };
      })
      .filter((option): option is { id: string; name: string; email: string; designation: string } => Boolean(option));

    return options.sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));
  }, [activeUsersForManagers, users]);

  useEffect(() => {
    if (step !== 4 || !isReviewAccessExpanded || expandedAccessNodeIds.length === 0) return;
    const targetId = expandedAccessNodeIds[expandedAccessNodeIds.length - 1];
    const target = reviewAccessNodeRefs.current[targetId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step, isReviewAccessExpanded, expandedAccessNodeIds]);

  useEffect(() => {
    if (selectedNodes.length === 0) {
      setExpandedAccessNodeIds([]);
      setPrimaryNodeId(null);
      setNodePermissions({});
      setNodePermissionScopes({});
      return;
    }

    setNodePermissions((current) => {
      const next: Record<string, NodePermissionBuckets> = {};

      for (const node of selectedNodes) {
        next[node.id] = current[node.id] ?? {
          primary: createInitialPermissions(roles),
          secondary: createInitialPermissions(roles),
        };
      }

      return next;
    });

    setPrimaryNodeId((current) =>
      current && selectedNodes.some((node) => node.id === current) ? current : selectedNodes[0].id,
    );

    setExpandedAccessNodeIds((current) => {
      return current.filter(id => selectedNodes.some(node => node.id === id));
    });
  }, [roles, selectedNodes]);

  useEffect(() => {
    if (selectedNodes.length === 0) return;

    setNodePermissionScopes((current) => {
      const next: Record<string, NodePermissionScopeBuckets> = {};
      for (const node of selectedNodes) {
        next[node.id] = current[node.id] ?? {
          primary: createInitialPermissionScopes(roles),
          secondary: createInitialPermissionScopes(roles),
        };
      }
      return next;
    });
  }, [roles, selectedNodes]);

  const clearError = (key: string) => {
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const removeSelectedNode = (nodeId: string) => {
    setSelectedNodeIds((current) => current.filter((id) => id !== nodeId));
    setSelectedNodeId((current) => (current === nodeId ? orgStructure?.id ?? null : current));
    setExpandedAccessNodeIds((current) => current.filter((id) => id !== nodeId));
    setPrimaryNodeId((current) => (current === nodeId ? null : current));
  };

  const handleNodeSelect = (nodeId: string) => {
    clearError("nodeSelection");
    const node = findOrgNode(orgStructure, nodeId);
    if (node?.status?.trim().toUpperCase() === "PENDING") return;
    setSelectedNodeId(nodeId);
    setSelectedNodeIds((current) => {
      if (current.includes(nodeId)) {
        return current.filter((id) => id !== nodeId);
      }
      return [...current, nodeId];
    });
  };

  const reorderSelectedNodes = (draggedNodeId: string, targetNodeId: string) => {
    if (draggedNodeId === targetNodeId) return;

    setSelectedNodeIds((current) => {
      const fromIndex = current.indexOf(draggedNodeId);
      const toIndex = current.indexOf(targetNodeId);

      if (fromIndex === -1 || toIndex === -1) return current;

      const next = [...current];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, draggedNodeId);

      const nextPrimaryNodeId = next[0] ?? null;
      setPrimaryNodeId(nextPrimaryNodeId);

      setExpandedAccessNodeIds((currentExpanded) => {
        return currentExpanded.filter(id => next.includes(id));
      });

      // Reordering changes the semantic meaning of primary vs secondary.
      // Reset all selected rights/scope selections to avoid stale payload entries.
      setNodePermissions(() => {
        const reset: Record<string, NodePermissionBuckets> = {};
        next.forEach((nodeId) => {
          reset[nodeId] = {
            primary: createInitialPermissions(roles),
            secondary: createInitialPermissions(roles),
          };
        });
        return reset;
      });

      setNodePermissionScopes(() => {
        const reset: Record<string, NodePermissionScopeBuckets> = {};
        next.forEach((nodeId) => {
          reset[nodeId] = {
            primary: createInitialPermissionScopes(roles),
            secondary: createInitialPermissionScopes(roles),
          };
        });
        return reset;
      });

      return next;
    });
  };

  const updateBasic = <K extends keyof UserOnboardingFormData["basic"]>(
    field: K,
    value: UserOnboardingFormData["basic"][K],
  ) => {
    setFormData((current) => ({
      ...current,
      basic: {
        ...current.basic,
        [field]: value,
      },
    }));
  };

  const setSelectedWorkflow = (levelsHash: string) => {
    const selectedOption = workflowOptions.find((option) => option.levelsHash === levelsHash);
    setFormData((current) => ({
      ...current,
      selectedWorkflowLevelsHash: levelsHash,
      selectedWorkflow: selectedOption?.label ?? "",
    }));
  };

  const setGlobalSignatory = (value: boolean) => {
    setFormData((current) => ({
      ...current,
      isGlobalSignatory: current.isGlobalUserEligible ? value : false,
    }));
  };

  const updateRemark = (value: string) => {
    clearError("remark");
    setFormData((current) => ({
      ...current,
      remark: value,
    }));
  };

  const togglePermission = (
    nodeId: string,
    bucket: keyof NodePermissionBuckets,
    category: string,
    item: string,
    action: PermissionAction,
  ) => {
    clearError("accessRights");

    setNodePermissions((current) => {
      const currentNodePermissions = current[nodeId] ?? {
        primary: createInitialPermissions(roles),
        secondary: createInitialPermissions(roles),
      };
      const currentBucketPermissions = currentNodePermissions[bucket];
      const currentItem = currentBucketPermissions[category]?.[item] ?? { manager: false, user: false, viewer: false };
      const nextValue = !currentItem[action];
      const nextPrimaryPermissions = createInitialPermissions(roles);

      if (bucket === "primary" && nextValue) {
        if (nextPrimaryPermissions[category]) {
          nextPrimaryPermissions[category][item] = { manager: false, user: false, viewer: false };
          nextPrimaryPermissions[category][item][action] = true;
        }
      }

      const nextItem =
        bucket === "primary"
          ? (nextPrimaryPermissions[category]?.[item] ?? { manager: false, user: false, viewer: false })
          : { ...currentItem, [action]: nextValue };

      return {
        ...current,
        [nodeId]: {
          ...currentNodePermissions,
          ...(bucket === "primary"
            ? { primary: nextPrimaryPermissions }
            : {
              secondary: {
                ...currentNodePermissions.secondary,
                [category]: {
                  ...currentNodePermissions.secondary[category],
                  [item]: nextItem,
                },
              },
            }),
        },
      };
    });
  };

  const setPermissionScope = (
    nodeId: string,
    bucket: keyof NodePermissionScopeBuckets,
    category: string,
    item: string,
    action: PermissionAction,
    scope: SystemAccessScope,
  ) => {
    clearError("accessRights");
    setNodePermissionScopes((current) => {
      const currentScopes = current[nodeId] ?? {
        primary: createInitialPermissionScopes(roles),
        secondary: createInitialPermissionScopes(roles),
      };

      return {
        ...current,
        [nodeId]: {
          ...currentScopes,
          [bucket]: {
            ...currentScopes[bucket],
            [category]: {
              ...(currentScopes[bucket][category] ?? {}),
              [item]: {
                ...((currentScopes[bucket][category] ?? {})[item] ?? {}),
                [action]: scope,
              },
            },
          },
        },
      };
    });
  };

  const prevStep = () =>
    setStep((current) => {
      if (formData.isGlobalUserEligible && formData.isGlobalSignatory && current === 4) return 1;
      return Math.max(current - 1, 1);
    });

  const handlePrimaryAction = async () => {
    if (step === 1 || step === 2 || step === 3) {
      const nextErrors = validateUserOnboardingStep(step, formData);

      if (step === 2 && selectedNodeIds.length === 0) {
        nextErrors.nodeSelection = "You need to select at least one node.";
      }

      if (step === 3) {
        const effectivePrimaryNodeId = primaryNodeId ?? selectedNodes[0]?.id ?? null;
        const hasPrimaryAccess = (() => {
          if (!effectivePrimaryNodeId) return false;
          const primaryPermissions = nodePermissions[effectivePrimaryNodeId]?.primary;
          if (!primaryPermissions) return false;

          return Object.values(primaryPermissions).some((categoryItems) =>
            Object.values(categoryItems).some((permissionItem) =>
              Object.values(permissionItem).some(Boolean),
            ),
          );
        })();

        if (!hasPrimaryAccess) {
          nextErrors.accessRights = "Select at least one Primary Access right before continuing.";
          if (effectivePrimaryNodeId) {
            setExpandedAccessNodeIds((current) =>
              current.includes(effectivePrimaryNodeId) ? current : [effectivePrimaryNodeId, ...current],
            );
            setPrimaryNodeId(effectivePrimaryNodeId);
          }
        }

      }

      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        return;
      }

      if (step === 1 && formData.isGlobalUserEligible && formData.isGlobalSignatory) {
        setStep(4);
        return;
      }

      if (step === 3) {
        setExpandedAccessNodeIds(selectedNodes[0] ? [selectedNodes[0].id] : []);
      }

      setStep((current) => Math.min(current + 1, 4));
      return;
    }

    if (formData.isGlobalUserEligible && formData.isGlobalSignatory) {
      if (onSubmit) {
        await onSubmit({
          ...formData,
          nodeSelections: [],
          permissions: createInitialPermissions(roles),
          primaryNodeId: null,
          selectedWorkflow: "",
          selectedWorkflowLevelsHash: "",
          remark: "",
        }, { seedMember });
      }
      onOpenChange(false);
      return;
    }

    if (seedMember && !formData.remark.trim()) {
      setErrors((current) => ({
        ...current,
        remark: "Remark is required for edit requests.",
      }));
      return;
    }

    const effectivePrimaryNodeId = primaryNodeId ?? selectedNodes[0]?.id ?? null;
    const hasPrimaryAccess = (() => {
      if (!effectivePrimaryNodeId) return false;
      const primaryPermissions = nodePermissions[effectivePrimaryNodeId]?.primary;
      if (!primaryPermissions) return false;

      return Object.values(primaryPermissions).some((categoryItems) =>
        Object.values(categoryItems).some((permissionItem) =>
          Object.values(permissionItem).some(Boolean),
        ),
      );
    })();

    if (!hasPrimaryAccess) {
      setErrors((current) => ({
        ...current,
        accessRights: "Select at least one Primary Access right before continuing.",
      }));
      if (effectivePrimaryNodeId) {
        setExpandedAccessNodeIds((current) =>
          current.includes(effectivePrimaryNodeId) ? current : [effectivePrimaryNodeId, ...current],
        );
        setPrimaryNodeId(effectivePrimaryNodeId);
      }
      setStep(3);
      return;
    }

    if (onSubmit) {
      const fallbackPermissions = createInitialPermissions(roles);
      const firstSelectedNodeId = selectedNodeIds[0];

      const payloadFormData: UserOnboardingFormData = {
        ...formData,
        permissions: firstSelectedNodeId ? (nodePermissions[firstSelectedNodeId]?.secondary ?? fallbackPermissions) : fallbackPermissions,
        nodeSelections: selectedNodes.map((node) => ({
          immediateChildren: node.children
            .filter((child) => child.status?.trim().toUpperCase() !== "PENDING")
            .map((child) => ({ nodeName: child.name, nodePath: child.nodePath })),
          allChildren: (() => {
            const descendants: Array<{ nodeName: string; nodePath: string }> = [];
            const walk = (current: OrgNode) => {
              current.children
                .filter((child) => child.status?.trim().toUpperCase() !== "PENDING")
                .forEach((child) => {
                  descendants.push({ nodeName: child.name, nodePath: child.nodePath });
                  walk(child);
                });
            };
            walk(node);
            return descendants;
          })(),
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.nodeType,
          nodePath: node.nodePath,
          permissions: nodePermissions[node.id] ?? {
            primary: createInitialPermissions(roles),
            secondary: fallbackPermissions,
          },
          permissionScopes: nodePermissionScopes[node.id] ?? {
            primary: createInitialPermissionScopes(roles),
            secondary: createInitialPermissionScopes(roles),
          },
        })),
        primaryNodeId,
        selectedWorkflow: formData.selectedWorkflow,
        selectedWorkflowLevelsHash: formData.selectedWorkflowLevelsHash,
        remark: formData.remark,
      };

      await onSubmit(payloadFormData, { seedMember });
    }

    onOpenChange(false);
  };

  return {
    orgStructure,
    roles,
    workflowOptions,
    step,
    setStep,
    formData,
    errors,
    selectedNodeId,
    selectedNodeIds,
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
    setSelectedWorkflow,
    setGlobalSignatory,
    updateRemark,
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
  };
}
