import { useEffect, useMemo, useRef, useState } from "react";
import { useAppContext, type OrgNode } from "@/contexts/AppContext";
import type {
  NewMemberOnboardingFormData,
  NodePermissionBuckets,
  NewMemberPermissions,
  PermissionAction,
  PermissionCategory,
  ValidationErrors,
} from "@/features/user-management/types";
import {
  createInitialFormData,
  createInitialPermissions,
  findOrgNode,
  validateNewMemberStep,
} from "@/features/user-management/utils";

type UseOnboardingFormOptions = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: NewMemberOnboardingFormData) => void | Promise<void>;
};

export function useOnboardingForm({ open, onOpenChange, onSubmit }: UseOnboardingFormOptions) {
  const { orgStructure } = useAppContext();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(createInitialFormData);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [expandedAccessNodeId, setExpandedAccessNodeId] = useState<string | null>(null);
  const [primaryNodeId, setPrimaryNodeId] = useState<string | null>(null);
  const [nodePermissions, setNodePermissions] = useState<Record<string, NodePermissionBuckets>>({});
  const [infoNodeId, setInfoNodeId] = useState<string | null>(null);
  const [isReviewAccessExpanded, setIsReviewAccessExpanded] = useState(true);
  const reviewAccessNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setFormData(createInitialFormData());
    setErrors({});
    setSelectedNodeId(orgStructure?.id ?? null);
    setSelectedNodeIds([]);
    setExpandedAccessNodeId(null);
    setPrimaryNodeId(null);
    setNodePermissions({});
    setInfoNodeId(null);
    setIsReviewAccessExpanded(true);
  }, [open, orgStructure]);

  const selectedNodes = useMemo(
    () => selectedNodeIds.map((nodeId) => findOrgNode(orgStructure, nodeId)).filter((node): node is OrgNode => Boolean(node)),
    [orgStructure, selectedNodeIds],
  );

  useEffect(() => {
    if (step !== 4 || !isReviewAccessExpanded || !expandedAccessNodeId) return;
    const target = reviewAccessNodeRefs.current[expandedAccessNodeId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step, isReviewAccessExpanded, expandedAccessNodeId]);

  useEffect(() => {
    if (selectedNodes.length === 0) {
      setExpandedAccessNodeId(null);
      setPrimaryNodeId(null);
      setNodePermissions({});
      return;
    }

    setNodePermissions((current) => {
      const next: Record<string, NodePermissionBuckets> = {};

      for (const node of selectedNodes) {
        next[node.id] = current[node.id] ?? {
          primary: createInitialPermissions(),
          secondary: createInitialPermissions(),
        };
      }

      return next;
    });

    setPrimaryNodeId((current) =>
      current && selectedNodes.some((node) => node.id === current) ? current : selectedNodes[0].id,
    );

    setExpandedAccessNodeId((current) =>
      current && selectedNodes.some((node) => node.id === current) ? current : selectedNodes[0].id,
    );
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
    setExpandedAccessNodeId((current) => (current === nodeId ? null : current));
    setPrimaryNodeId((current) => (current === nodeId ? null : current));
  };

  const handleNodeSelect = (nodeId: string) => {
    clearError("nodeSelection");
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

      const adjustedTargetIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
      next.splice(adjustedTargetIndex, 0, draggedNodeId);

      const nextPrimaryNodeId = next[0] ?? null;
      setPrimaryNodeId(nextPrimaryNodeId);
      setExpandedAccessNodeId((currentExpanded) =>
        currentExpanded && next.includes(currentExpanded) ? currentExpanded : nextPrimaryNodeId,
      );

      return next;
    });
  };

  const updateBasic = <K extends keyof NewMemberOnboardingFormData["basic"]>(
    field: K,
    value: NewMemberOnboardingFormData["basic"][K],
  ) => {
    setFormData((current) => ({
      ...current,
      basic: {
        ...current.basic,
        [field]: value,
      },
    }));
  };

  const togglePermission = <C extends PermissionCategory>(
    nodeId: string,
    bucket: keyof NodePermissionBuckets,
    category: C,
    item: keyof NewMemberOnboardingFormData["permissions"][C],
    action: PermissionAction,
  ) => {
    clearError("accessRights");

    setNodePermissions((current) => {
      const currentNodePermissions = current[nodeId] ?? {
        primary: createInitialPermissions(),
        secondary: createInitialPermissions(),
      };
      const currentBucketPermissions = currentNodePermissions[bucket];
      const currentItem = currentBucketPermissions[category][item];
      const nextValue = !currentItem[action];
      const nextPrimaryPermissions = createInitialPermissions();

      if (bucket === "primary" && nextValue) {
        nextPrimaryPermissions[category][item][action] = true;
      }

      const nextItem =
        bucket === "primary"
          ? nextPrimaryPermissions[category][item]
          : {
              ...currentItem,
              [action]: nextValue,
            };

      return {
        ...current,
        [nodeId]: {
          ...currentNodePermissions,
          ...(bucket === "primary"
            ? {
                primary: nextPrimaryPermissions,
              }
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
      const nextErrors = validateNewMemberStep(step, formData);

      if (step === 2 && selectedNodeIds.length === 0) {
        nextErrors.nodeSelection = "You need to select at least one node.";
      }

      if (step === 3) {
        const pendingNodes = selectedNodes.filter((node) => {
          const permissions = nodePermissions[node.id];
          if (!permissions) return true;

          const selectedCount = (Object.values(permissions) as NewMemberPermissions[]).reduce(
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
          setExpandedAccessNodeId(pendingNodes[0].id);
        }
      }

      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        return;
      }

      if (step === 3) {
        setExpandedAccessNodeId(selectedNodes[0]?.id ?? null);
      }

      setStep((current) => Math.min(current + 1, 4));
      return;
    }

    if (onSubmit) {
      const fallbackPermissions = createInitialPermissions();
      const firstSelectedNodeId = selectedNodeIds[0];

      const payloadFormData: NewMemberOnboardingFormData = {
        ...formData,
        permissions: firstSelectedNodeId ? (nodePermissions[firstSelectedNodeId]?.secondary ?? fallbackPermissions) : fallbackPermissions,
        nodeSelections: selectedNodes.map((node) => ({
          nodeId: node.id,
          nodeName: node.name,
          nodePath: node.nodePath,
          permissions: nodePermissions[node.id] ?? {
            primary: createInitialPermissions(),
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
    step,
    setStep,
    formData,
    errors,
    selectedNodeId,
    selectedNodeIds,
    selectedNodes,
    expandedAccessNodeId,
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
    setExpandedAccessNodeId,
    setPrimaryNodeId,
    setInfoNodeId,
    setIsReviewAccessExpanded,
    prevStep,
    handlePrimaryAction,
  };
}
