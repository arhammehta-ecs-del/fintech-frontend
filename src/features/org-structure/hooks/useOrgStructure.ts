import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { OrgNode } from "@/contexts/AppContext";
import { useAppContext } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { connectNotificationStream } from "@/services/notification.service";
import { createNewOrgNode, fetchUsersByNodePathCount, getCompanyOrgStructure, updateOrgNodeAction } from "@/services/org.service";
import { fetchCompanyNodes } from "@/services/user.service";
import { useEditLockSession } from "@/hooks/useEditLockSession";
import { collectNodeTrail, findOrgNodeById, findParentNodeById, flattenOrg } from "@/features/org-structure/orgNode.utils";
import type { DepartmentSidebarDepartment, NewNodeType } from "@/features/org-structure/types";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  VIEWPORT_EDGE_PADDING,
  ZOOM_STEP,
  buildEmptyPermissionRows,
  centerSelectedNode,
  getInitialZoomForOverflow,
  type PermissionMatrixRow,
  SYSTEM_ROWS,
  performPendingNodeAction,
} from "@/features/org-structure/hooks/orgStructureViewModel.utils";

export function useOrgStructure() {
  const { currentUser, orgStructure, setOrgStructure } = useAppContext();
  const { toast } = useToast();
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentSidebarDepartment | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [bottomScrollContentWidth, setBottomScrollContentWidth] = useState(0);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isNewNodePopupOpen, setIsNewNodePopupOpen] = useState(false);
  const [newNodeParent, setNewNodeParent] = useState<OrgNode | null>(null);
  const [newNodeWorkflowOptions, setNewNodeWorkflowOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [pendingNodeForReview, setPendingNodeForReview] = useState<OrgNode | null>(null);
  const [statusUpdateNode, setStatusUpdateNode] = useState<DepartmentSidebarDepartment | null>(null);
  const [statusUpdateTargetStatus, setStatusUpdateTargetStatus] = useState<"active" | "inactive">("inactive");
  const [statusUpdateWorkflowHash, setStatusUpdateWorkflowHash] = useState("");
  const [statusUpdateRemarks, setStatusUpdateRemarks] = useState("");
  const [statusUpdateWorkflowOptions, setStatusUpdateWorkflowOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [nodePermissionRows, setNodePermissionRows] = useState<PermissionMatrixRow[]>(buildEmptyPermissionRows);
  const [nodePermissionLoading, setNodePermissionLoading] = useState(false);
  const [hasNewOrgEvent, setHasNewOrgEvent] = useState(false);
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const graphContentRef = useRef<HTMLDivElement | null>(null);
  const syncSourceRef = useRef<"tree" | "bottom" | null>(null);
  const didApplyInitialAutoZoomRef = useRef(false);
  const suppressNextOrgEventRef = useRef(false);
  const orgLockSession = useEditLockSession();
  const companyCode = currentUser?.companyCode?.trim().toUpperCase() ?? "";

  const loadOrgForCompanyCode = async (nextCompanyCode: string) => {
    setOrgLoading(true);
    setOrgError("");

    try {
      const structure = await getCompanyOrgStructure(nextCompanyCode);
      setOrgStructure(structure);
    } catch (error) {
      setOrgStructure(null);
      const message = getApiErrorMessage(error, "Unable to fetch organization structure.");
      setOrgError(message);
      toast({ title: "Unable to load organization structure", description: message, variant: "destructive" });
    } finally {
      setOrgLoading(false);
    }
  };

  useEffect(() => {
    if (!companyCode) {
      setOrgStructure(null);
      setOrgError("No company code found for the logged-in user.");
      return;
    }

    let cancelled = false;

    const loadOrg = async () => {
      setOrgLoading(true);
      setOrgError("");

      try {
        const structure = await getCompanyOrgStructure(companyCode);
        if (cancelled) return;
        setOrgStructure(structure);
      } catch (error) {
        if (!cancelled) {
          setOrgStructure(null);
          const message = getApiErrorMessage(error, "Unable to fetch organization structure.");
          setOrgError(message);
          toast({ title: "Unable to load organization structure", description: message, variant: "destructive" });
        }
      } finally {
        if (!cancelled) {
          setOrgLoading(false);
        }
      }
    };

    void loadOrg();

    return () => {
      cancelled = true;
    };
  }, [companyCode, setOrgStructure, toast]);

  useEffect(() => {
    const disconnect = connectNotificationStream({
      onNotification: (packet) => {
        const refType = String(packet.refType ?? "").trim().toLowerCase();
        if (refType === "org") {
          if (suppressNextOrgEventRef.current) {
            suppressNextOrgEventRef.current = false;
            return;
          }
          setHasNewOrgEvent(true);
        }
      },
    });

    return disconnect;
  }, []);

  useEffect(() => {
    if (!orgStructure) {
      startTransition(() => {
        setSelectedDepartment(null);
        setSidebarOpen(false);
      });
    }
    didApplyInitialAutoZoomRef.current = false;
  }, [orgStructure]);

  useEffect(() => {
    const treeElement = treeScrollRef.current;
    if (!treeElement) return;

    const updateOverflowState = () => {
      const treeScrollableDistance = Math.max(treeElement.scrollWidth - treeElement.clientWidth, 0);
      setHasHorizontalOverflow(treeScrollableDistance > 1);
      setBottomScrollContentWidth(treeElement.clientWidth + treeScrollableDistance);
    };
    updateOverflowState();

    const resizeObserver = new ResizeObserver(() => {
      updateOverflowState();
    });
    resizeObserver.observe(treeElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [canvasWidth, sidebarOpen, zoom]);

  useEffect(() => {
    const treeElement = treeScrollRef.current;
    const bottomElement = bottomScrollRef.current;
    if (!treeElement || !bottomElement || !hasHorizontalOverflow) return;

    const centerScroll = () => {
      const treeMaxScrollLeft = Math.max(treeElement.scrollWidth - treeElement.clientWidth, 0);
      const bottomMaxScrollLeft = Math.max(bottomElement.scrollWidth - bottomElement.clientWidth, 0);
      const centeredTreeScrollLeft = treeMaxScrollLeft / 2;
      treeElement.scrollLeft = centeredTreeScrollLeft;
      bottomElement.scrollLeft = treeMaxScrollLeft === 0 ? 0 : (centeredTreeScrollLeft / treeMaxScrollLeft) * bottomMaxScrollLeft;
    };
    window.requestAnimationFrame(centerScroll);

    const syncFromTree = () => {
      if (syncSourceRef.current === "bottom") return;
      syncSourceRef.current = "tree";
      const treeMaxScrollLeft = Math.max(treeElement.scrollWidth - treeElement.clientWidth, 0);
      const bottomMaxScrollLeft = Math.max(bottomElement.scrollWidth - bottomElement.clientWidth, 0);
      const progress = treeMaxScrollLeft === 0 ? 0 : treeElement.scrollLeft / treeMaxScrollLeft;
      bottomElement.scrollLeft = progress * bottomMaxScrollLeft;
      window.requestAnimationFrame(() => {
        if (syncSourceRef.current === "tree") syncSourceRef.current = null;
      });
    };

    const syncFromBottom = () => {
      if (syncSourceRef.current === "tree") return;
      syncSourceRef.current = "bottom";
      const treeMaxScrollLeft = Math.max(treeElement.scrollWidth - treeElement.clientWidth, 0);
      const bottomMaxScrollLeft = Math.max(bottomElement.scrollWidth - bottomElement.clientWidth, 0);
      const progress = bottomMaxScrollLeft === 0 ? 0 : bottomElement.scrollLeft / bottomMaxScrollLeft;
      treeElement.scrollLeft = progress * treeMaxScrollLeft;
      window.requestAnimationFrame(() => {
        if (syncSourceRef.current === "bottom") syncSourceRef.current = null;
      });
    };

    treeElement.addEventListener("scroll", syncFromTree);
    bottomElement.addEventListener("scroll", syncFromBottom);

    return () => {
      treeElement.removeEventListener("scroll", syncFromTree);
      bottomElement.removeEventListener("scroll", syncFromBottom);
    };
  }, [canvasWidth, hasHorizontalOverflow, zoom]);

  useEffect(() => {
    if (!orgStructure) return;
    if (didApplyInitialAutoZoomRef.current) return;
    if (zoom !== 1) return;
    if (!hasHorizontalOverflow) return;

    didApplyInitialAutoZoomRef.current = true;
    setZoom(getInitialZoomForOverflow());
  }, [orgStructure, hasHorizontalOverflow, zoom]);

  useEffect(() => {
    const treeElement = treeScrollRef.current;
    const selectedId = selectedDepartment?.id;
    if (!treeElement || !selectedId) return;

    centerSelectedNode(treeElement, selectedId);
  }, [selectedDepartment?.id, sidebarOpen, canvasWidth, zoom]);

  const allNodes = useMemo(() => flattenOrg(orgStructure), [orgStructure]);
  const nodeCount = Math.max(allNodes.length - 1, 0);
  const companyName = currentUser?.company || currentUser?.brand || orgStructure?.name || "RJ Fintech";
  const canZoomOut = zoom > MIN_ZOOM;
  const canZoomIn = zoom < MAX_ZOOM;

  const handleOpenNewNodePopup = async (node: OrgNode) => {
    if (node.status?.trim().toUpperCase() === "PENDING") return;
    try {
      const nodes = await fetchCompanyNodes("ORG_STR");
      const selectedNodePath = node.nodePath.trim().toUpperCase();
      const options = nodes
        .flatMap((item) =>
          item.workflows.filter((workflow) => {
            const nodePath = item.nodePath.trim().toUpperCase();
            if (nodePath === selectedNodePath) return true;
            const alias = workflow.alias?.trim().toUpperCase();
            return Boolean(alias && alias.endsWith("D"));
          }),
        )
        .map((workflow) => {
          const id = workflow.levelsHash.trim();
          const name = workflow.name.trim();
          const alias = workflow.alias?.trim();
          if (!id || !name) return null;
          return { id, label: alias ? `${name} (${alias})` : name };
        })
        .filter((option): option is { id: string; label: string } => Boolean(option));
      setNewNodeWorkflowOptions(Array.from(new Map(options.map((option) => [option.id, option])).values()));
    } catch (error) {
      setNewNodeWorkflowOptions([]);
      toast({
        title: "Access denied",
        description: getApiErrorMessage(error, "You do not have permission to initiate ORG_STR."),
        variant: "destructive",
      });
      setIsNewNodePopupOpen(false);
      setNewNodeParent(null);
      return;
    }
    setNewNodeParent(node);
    setIsNewNodePopupOpen(true);
  };

  const fetchNodeWorkflowOptions = async (nodePath: string) => {
    const selectedNodePath = nodePath.trim().toUpperCase();
    const nodes = await fetchCompanyNodes("ORG_STR");
    const options = nodes
      .flatMap((item) =>
        item.workflows.filter((workflow) => {
          const currentNodePath = item.nodePath.trim().toUpperCase();
          if (currentNodePath === selectedNodePath) return true;
          const alias = workflow.alias?.trim().toUpperCase();
          return Boolean(alias && alias.endsWith("D"));
        }),
      )
      .map((workflow) => {
        const id = workflow.levelsHash.trim();
        const name = workflow.name.trim();
        const alias = workflow.alias?.trim();
        if (!id || !name) return null;
        return { id, label: alias ? `${name} (${alias})` : name };
      })
      .filter((option): option is { id: string; label: string } => Boolean(option));
    return Array.from(new Map(options.map((option) => [option.id, option])).values());
  };

  const handleCreateNode = async (name: string, nodeType: NewNodeType, selectedLevelsHash?: string) => {
    if (!newNodeParent || !companyCode) return;

    try {
      await createNewOrgNode({
        // TEMP: keep type/status omitted until backend confirms contract.
        newNodeName: name,
        nodeType,
        levelsHash: selectedLevelsHash?.trim() || null,
        parentNode: {
          nodeName: newNodeParent.name,
          nodePath: newNodeParent.nodePath,
        },
      });
      await loadOrgForCompanyCode(companyCode);
    } catch (error) {
      setOrgError(getApiErrorMessage(error, "Failed to create node. Please try again."));
    }

    setIsNewNodePopupOpen(false);
    setNewNodeParent(null);
  };

  const handleDepartmentClick = (node: OrgNode) => {
    if (node.status === "Pending") {
      setPendingNodeForReview(node);
      return;
    }

    if (node.nodePath?.trim()) {
      setNodePermissionLoading(true);
      void fetchUsersByNodePathCount(node.nodePath)
        .then((data) => {
          const normalizedRows = SYSTEM_ROWS.map((row) => {
            const entries = Array.isArray(data[row.key]) ? data[row.key] : [];
            const counts = { checker: 0, maker: 0, viewer: 0 };
            entries.forEach((entry) => {
              const level = String(entry.permissionlevel || "").trim().toUpperCase();
              const count = typeof entry.count === "number" ? entry.count : 0;
              if (level === "MANAGER") counts.checker = count;
              if (level === "USER") counts.maker = count;
              if (level === "VIEWER") counts.viewer = count;
            });
            return { key: row.key, label: row.label, counts };
          });
          setNodePermissionRows(normalizedRows);
        })
        .catch(() => {
          setNodePermissionRows(buildEmptyPermissionRows());
        })
        .finally(() => {
          setNodePermissionLoading(false);
        });
    } else {
      setNodePermissionRows(buildEmptyPermissionRows());
      setNodePermissionLoading(false);
    }

    if (selectedDepartment?.id === node.id && sidebarOpen) {
      startTransition(() => {
        setSelectedDepartment(null);
        setSidebarOpen(false);
      });
      return;
    }

    const parentNode = findParentNodeById(orgStructure, node.id);
    const currentNode = findOrgNodeById(orgStructure, node.id);
    const breadcrumbs = collectNodeTrail(orgStructure, node.id);

    startTransition(() => {
      setSelectedDepartment({
        id: node.id,
        name: node.name,
        parentId: parentNode?.id ?? null,
        nodeType: node.nodeType,
        nodePath: node.nodePath,
        status: node.status ?? "Active",
        pendingRequestType: node.pendingRequestType,
        pendingOldData: node.pendingOldData,
        pendingNewData: node.pendingNewData,
        companyId: node.companyId,
        childCount: node.children.length,
        breadcrumbs,
        parentName: parentNode?.name ?? null,
        parentNodePath: parentNode?.nodePath ?? null,
        children: (currentNode?.children ?? []).map((child) => ({
          id: child.id,
          name: child.name,
          nodeType: child.nodeType,
          childCount: child.children.length,
        })),
        siblings: (parentNode?.children ?? [])
          .filter((child) => child.id !== node.id)
          .map((child) => ({
            id: child.id,
            name: child.name,
            nodeType: child.nodeType,
            childCount: child.children.length,
          })),
      });
      setSidebarOpen(true);
    });
  };

  const handleSidebarOpenChange = (open: boolean) => {
    startTransition(() => {
      setSidebarOpen(open);
      if (!open) {
        setSelectedDepartment(null);
      }
    });
  };

  const handleRequestNodeStatusChange = async (
    department: DepartmentSidebarDepartment,
    isActive: boolean,
  ) => {
    const nodePath = (department.nodePath || "").trim();
    if (!nodePath || !companyCode) return;
    const targetStatus: "active" | "inactive" = isActive ? "active" : "inactive";
    const currentStatus = department.status === "Inactive" ? "inactive" : "active";
    if (currentStatus === targetStatus) return;

    try {
      const options = await fetchNodeWorkflowOptions(nodePath);
      await orgLockSession.startSession(
        {
          type: "org",
          target: { nodePath },
        },
        () => {
          setStatusUpdateNode(null);
          setStatusUpdateWorkflowHash("");
          setStatusUpdateRemarks("");
          setStatusUpdateWorkflowOptions([]);
          toast({
            title: "Edit lock expired",
            description: "No activity detected. Status update form was closed.",
            variant: "destructive",
          });
        },
      );
      setStatusUpdateWorkflowOptions(options);
      setStatusUpdateWorkflowHash("");
      setStatusUpdateRemarks("");
      setStatusUpdateTargetStatus(targetStatus);
      setStatusUpdateNode(department);
    } catch (error) {
      toast({
        title: "Unable to open status update",
        description: getApiErrorMessage(error, "Unable to fetch workflow options."),
        variant: "destructive",
      });
    }
  };

  const submitNodeStatusUpdate = async () => {
    if (!statusUpdateNode || !companyCode) return;
    const nodePath = (statusUpdateNode.nodePath || "").trim();
    if (!nodePath) return;
    try {
      await createNewOrgNode({
        type: "update",
        status: statusUpdateTargetStatus === "inactive" ? "INACTIVE" : "ACTIVE",
        nodePath,
        remarks: statusUpdateRemarks.trim(),
        levelsHash: statusUpdateWorkflowHash.trim() || null,
      });
      await loadOrgForCompanyCode(companyCode);
      setStatusUpdateNode(null);
      setStatusUpdateWorkflowHash("");
      setStatusUpdateRemarks("");
      setStatusUpdateWorkflowOptions([]);
      await orgLockSession.stopSession(true);
      toast({
        title: "Status request submitted",
        description: `Node ${statusUpdateNode.name} ${statusUpdateTargetStatus} request initiated.`,
      });
    } catch (error) {
      toast({
        title: "Unable to submit status request",
        description: getApiErrorMessage(error, "Failed to submit org status update."),
        variant: "destructive",
      });
    }
  };

  const handleApproveNode = async (node: OrgNode, remark: string) => {
    suppressNextOrgEventRef.current = true;
    await performPendingNodeAction({
      node,
      action: "approve",
      remark,
      setOrgError,
      toast,
      updateOrgNodeAction,
      onClose: () => setPendingNodeForReview(null),
      onSuccess: async () => {
        await loadOrgForCompanyCode(companyCode);
      },
    });
  };

  const handleRejectNode = async (node: OrgNode, remark: string) => {
    suppressNextOrgEventRef.current = true;
    await performPendingNodeAction({
      node,
      action: "reject",
      remark,
      setOrgError,
      toast,
      updateOrgNodeAction,
      onClose: () => setPendingNodeForReview(null),
      onSuccess: async () => {
        await loadOrgForCompanyCode(companyCode);
      },
    });
  };

  const zoomOut = () => setZoom((current) => Math.max(MIN_ZOOM, Number((current - ZOOM_STEP).toFixed(2))));
  const zoomIn = () => setZoom((current) => Math.min(MAX_ZOOM, Number((current + ZOOM_STEP).toFixed(2))));
  const refreshOrgStructure = async () => {
    if (!companyCode) return;
    await loadOrgForCompanyCode(companyCode);
  };

  return {
    companyCode, orgStructure, selectedDepartment, sidebarOpen, orgLoading, orgError, canvasWidth, bottomScrollContentWidth,
    hasHorizontalOverflow, zoom, isNewNodePopupOpen, newNodeParent, pendingNodeForReview, nodePermissionRows,
    nodePermissionLoading, treeScrollRef, bottomScrollRef, graphContentRef, companyName, nodeCount, canZoomOut, canZoomIn,
    viewportEdgePadding: VIEWPORT_EDGE_PADDING, setCanvasWidth, setIsNewNodePopupOpen, setNewNodeParent, newNodeWorkflowOptions,
    setPendingNodeForReview, handleOpenNewNodePopup, handleCreateNode, handleDepartmentClick, handleSidebarOpenChange,
    handleApproveNode, handleRejectNode, zoomOut, zoomIn, hasNewOrgEvent, setHasNewOrgEvent, refreshOrgStructure,
    statusUpdateNode, statusUpdateTargetStatus, statusUpdateWorkflowHash, statusUpdateWorkflowOptions,
    statusUpdateRemarks, setStatusUpdateNode, setStatusUpdateWorkflowHash, setStatusUpdateRemarks, handleRequestNodeStatusChange, submitNodeStatusUpdate,
    orgLockWarningOpen: orgLockSession.warningOpen,
    orgLockSecondsRemaining: orgLockSession.secondsRemaining,
    continueOrgEditing: orgLockSession.continueEditing,
    closeOrgEditingByTimeout: orgLockSession.endEditingNow,
    closeOrgStatusUpdatePopup: async () => {
      await orgLockSession.stopSession(true);
      setStatusUpdateNode(null);
      setStatusUpdateWorkflowHash("");
      setStatusUpdateRemarks("");
      setStatusUpdateWorkflowOptions([]);
    },
  };
}
