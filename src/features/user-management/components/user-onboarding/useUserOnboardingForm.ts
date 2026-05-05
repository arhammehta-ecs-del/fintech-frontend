import { useEffect, useMemo, useRef, useState } from "react";
import { useAppContext, type OrgNode } from "@/contexts/AppContext";
import type { RoleRecord } from "@/services/role.service";
import { getCompanyRoles } from "@/services/role.service";
import { getCompanyOrgStructure } from "@/services/org.service";
import type {
  UserOnboardingFormData,
  NodePermissionBuckets,
  UserOnboardingPermissions,
  PermissionAction,
  ValidationErrors,
} from "@/features/user-management/types";
import {
  createInitialUserOnboardingFormData,
  createInitialPermissions,
  findOrgNode,
  validateUserOnboardingStep,
} from "@/features/user-management/utils";

type UseUserOnboardingFormOptions = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: UserOnboardingFormData) => void | Promise<void>;
};

export function useUserOnboardingForm({ open, onOpenChange, onSubmit }: UseUserOnboardingFormOptions) {
  const { orgStructure: contextOrgStructure, currentUser, users } = useAppContext();
  const companyCode = currentUser?.companyCode ?? "";
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [localOrgStructure, setLocalOrgStructure] = useState<OrgNode | null>(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(createInitialUserOnboardingFormData);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [expandedAccessNodeIds, setExpandedAccessNodeIds] = useState<string[]>([]);
  const [primaryNodeId, setPrimaryNodeId] = useState<string | null>(null);
  const [nodePermissions, setNodePermissions] = useState<Record<string, NodePermissionBuckets>>({});
  const [infoNodeId, setInfoNodeId] = useState<string | null>(null);
  const [isReviewAccessExpanded, setIsReviewAccessExpanded] = useState(true);
  const reviewAccessNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Use context org if already loaded, otherwise fetch independently
  const orgStructure = contextOrgStructure ?? localOrgStructure;

  // Fetch org structure when dialog opens (in case context hasn't loaded it)
  useEffect(() => {
    if (!open) return;
    if (contextOrgStructure) return; // already have it from context
    let ignore = false;
    getCompanyOrgStructure(companyCode).then((data) => {
      if (!ignore) setLocalOrgStructure(data);
    });
    return () => { ignore = true; };
  }, [open, companyCode, contextOrgStructure]);

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
    setStep(1);
    setFormData(createInitialUserOnboardingFormData());
    setErrors({});
    setSelectedNodeId(orgStructure?.id ?? null);
    setSelectedNodeIds([]);
    setExpandedAccessNodeIds([]);
    setPrimaryNodeId(null);
    setNodePermissions({});
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
    const seenEmails = new Set<string>();
    const options = users
      .filter((user) => user.status === "Active")
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
  }, [users]);

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

  const prevStep = () => setStep((current) => Math.max(current - 1, 1));

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

      if (step === 3) {
        setExpandedAccessNodeIds(selectedNodes[0] ? [selectedNodes[0].id] : []);
      }

      setStep((current) => Math.min(current + 1, 4));
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
          nodeId: node.id,
          nodeName: node.name,
          nodePath: node.nodePath,
          permissions: nodePermissions[node.id] ?? {
            primary: createInitialPermissions(roles),
            secondary: fallbackPermissions,
          },
        })),
        primaryNodeId,
      };

      await onSubmit(payloadFormData);
    }

    onOpenChange(false);
  };

  return {
    orgStructure,
    roles,
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
    infoNodeId,
    isReviewAccessExpanded,
    reviewAccessNodeRefs,
    clearError,
    updateBasic,
    removeSelectedNode,
    handleNodeSelect,
    togglePermission,
    reorderSelectedNodes,
    setExpandedAccessNodeIds,
    setPrimaryNodeId,
    setInfoNodeId,
    setIsReviewAccessExpanded,
    prevStep,
    handlePrimaryAction,
  };
}
