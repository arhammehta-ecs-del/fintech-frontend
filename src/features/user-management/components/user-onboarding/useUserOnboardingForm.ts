import { useEffect, useMemo, useRef, useState } from "react";
import { useAppContext, type OrgNode } from "@/contexts/AppContext";
import type { AppUser } from "@/contexts/AppContext";
import type { RoleRecord } from "@/services/role.service";
import { getCompanyRoles } from "@/services/role.service";
import { fetchCompanyNodesWithAccess, fetchCompanyUsersPaginated } from "@/services/user.service";
import type {
  UserOnboardingFormData,
  NodePermissionBuckets,
  NodePermissionScopeBuckets,
  SystemAccessScope,
  UserOnboardingPermissions,
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

type UseUserOnboardingFormOptions = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: UserOnboardingFormData) => void | Promise<void>;
};

export function useUserOnboardingForm({ open, onOpenChange, onSubmit }: UseUserOnboardingFormOptions) {
  const { currentUser, users } = useAppContext();
  const companyCode = currentUser?.companyCode ?? "";
  const [roles, setRoles] = useState<RoleRecord[]>([]);
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
  const reviewAccessNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const orgStructure = localOrgStructure;

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
            limit: 100,
            cursor,
            topCursor,
            direction: "NEXT",
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
        setLocalOrgStructure(buildOrgTreeFromCompanyNodes(nodes));
        setWorkflowOptions(buildWorkflowOptions(nodes));
        setFormData((current) => ({
          ...current,
          isGlobalUserEligible: access.isGlobalUser,
          isGlobalSignatory: access.isGlobalUser ? current.isGlobalSignatory : false,
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
    if (!open) return;
    setStep(1);
    setFormData((current) => ({
      ...createInitialUserOnboardingFormData(),
      isGlobalUserEligible: current.isGlobalUserEligible,
      isGlobalSignatory: current.isGlobalSignatory,
    }));
    setErrors({});
    setSelectedNodeId(orgStructure?.id ?? null);
    setSelectedNodeIds([]);
    setExpandedAccessNodeIds([]);
    setPrimaryNodeId(null);
    setNodePermissions({});
    setNodePermissionScopes({});
    setInfoNodeId(null);
    setIsReviewAccessExpanded(true);
  }, [open, orgStructure]);

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
  }, [selectedNodes]);

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

        const pendingNodes = selectedNodes.filter((node) => {
          const permissions = nodePermissions[node.id];
          if (!permissions) return true;

          const selectedCount = (Object.values(permissions) as UserOnboardingPermissions[]).reduce(
            (bucketTotal, bucketPermissions) =>
              bucketTotal +
              Object.values(bucketPermissions).reduce((categoryTotal, categoryItems) => {
                return (
                  categoryTotal +
                  Object.values(categoryItems).reduce((itemTotal, permissionItem) => {
                    return itemTotal + Object.values(permissionItem).filter(Boolean).length;
                  }, 0)
                );
              }, 0),
            0,
          );

          return selectedCount === 0;
        });

        if (pendingNodes.length > 0) {
          nextErrors.accessRights = `You need to select rights for: ${pendingNodes.map((node) => node.name).join(", ")}.`;
          setExpandedAccessNodeIds([pendingNodes[0].id]);
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
        });
      }
      onOpenChange(false);
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
      };

      await onSubmit(payloadFormData);
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
    clearError,
    updateBasic,
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
  };
}
