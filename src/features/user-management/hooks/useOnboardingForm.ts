import { useEffect, useMemo, useRef, useState } from "react";
import { useAppContext, type OrgNode } from "@/contexts/AppContext";
import { TRANSACTIONAL_PERMISSION_ITEMS } from "@/features/user-management/constants";
import type {
  NewMemberOnboardingFormData,
  NewMemberPermissions,
  PermissionAction,
  PermissionCategory,
  TransactionalPermissionItem,
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
  const [nodePermissions, setNodePermissions] = useState<Record<string, NewMemberPermissions>>({});
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
      setNodePermissions({});
      return;
    }

    setNodePermissions((current) => {
      const next: Record<string, NewMemberPermissions> = {};

      for (const node of selectedNodes) {
        next[node.id] = current[node.id] ?? createInitialPermissions();
      }

      return next;
    });

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
    category: C,
    item: keyof NewMemberOnboardingFormData["permissions"][C],
    action: PermissionAction,
  ) => {
    clearError("accessRights");

    setNodePermissions((current) => {
      const currentPermissions = current[nodeId] ?? createInitialPermissions();
      const currentItem = currentPermissions[category][item];
      const nextItem = {
        ...currentItem,
        [action]: !currentItem[action],
      };

      const nextPermissions = {
        ...current,
        [nodeId]: {
          ...currentPermissions,
          [category]: {
            ...currentPermissions[category],
            [item]: nextItem,
          },
        },
      };

      if (category === "transactional") {
        const nextTransactionalItem = item as TransactionalPermissionItem;
        const nextItemHasAnyRight = Object.values(nextItem).some(Boolean);

        setFormData((previous) => {
          if (nextItemHasAnyRight) {
            return previous.transactionalPrimary ? previous : { ...previous, transactionalPrimary: nextTransactionalItem };
          }

          if (previous.transactionalPrimary !== nextTransactionalItem) {
            return previous;
          }

          const fallbackPrimary =
            TRANSACTIONAL_PERMISSION_ITEMS.find((transactionalItem) => {
              const rights = nextPermissions[nodeId].transactional[transactionalItem];
              return Object.values(rights).some(Boolean);
            }) ?? null;

          return { ...previous, transactionalPrimary: fallbackPrimary };
        });
      }

      return nextPermissions;
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

          const selectedCount = Object.values(permissions).reduce((categoryTotal, categoryItems) => {
            return categoryTotal + Object.values(categoryItems).reduce((itemTotal, item) => itemTotal + Object.values(item).filter(Boolean).length, 0);
          }, 0);

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
        permissions: firstSelectedNodeId ? (nodePermissions[firstSelectedNodeId] ?? fallbackPermissions) : fallbackPermissions,
        nodeSelections: selectedNodes.map((node) => ({
          nodeId: node.id,
          nodeName: node.name,
          nodePath: node.nodePath,
          permissions: nodePermissions[node.id] ?? fallbackPermissions,
        })),
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
    nodePermissions,
    infoNodeId,
    isReviewAccessExpanded,
    reviewAccessNodeRefs,
    clearError,
    updateBasic,
    removeSelectedNode,
    handleNodeSelect,
    togglePermission,
    setExpandedAccessNodeId,
    setInfoNodeId,
    setIsReviewAccessExpanded,
    prevStep,
    handlePrimaryAction,
  };
}
