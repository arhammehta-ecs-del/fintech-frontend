import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { OrgNode } from "@/contexts/AppContext";
import { useAppContext } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { createNewOrgNode, getCompanyOrgStructure, updateOrgNodeAction } from "@/services/org.service";
import { collectNodeTrail, findOrgNodeById, findParentNodeById, flattenOrg } from "@/features/org-structure/orgNode.utils";
import type { DepartmentSidebarDepartment, NewNodeType } from "@/features/org-structure/types";

const VIEWPORT_EDGE_PADDING = 96;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

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
  const [pendingNodeForReview, setPendingNodeForReview] = useState<OrgNode | null>(null);
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const graphContentRef = useRef<HTMLDivElement | null>(null);
  const syncSourceRef = useRef<"tree" | "bottom" | null>(null);
  const didApplyInitialAutoZoomRef = useRef(false);
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
    if (!orgStructure) {
      startTransition(() => {
        setSelectedDepartment(null);
        setSidebarOpen(false);
      });
      didApplyInitialAutoZoomRef.current = false;
    }
  }, [orgStructure]);

  useEffect(() => {
    if (orgStructure) {
      didApplyInitialAutoZoomRef.current = false;
    }
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
    setZoom(Math.max(MIN_ZOOM, Number((1 - ZOOM_STEP * 2).toFixed(2))));
  }, [orgStructure, hasHorizontalOverflow, zoom]);

  useEffect(() => {
    const treeElement = treeScrollRef.current;
    const selectedId = selectedDepartment?.id;
    if (!treeElement || !selectedId) return;

    const escapedId = selectedId.replace(/"/g, '\\"');
    const selectedNodeElement = treeElement.querySelector<HTMLElement>(`[data-org-node-id="${escapedId}"]`);
    if (!selectedNodeElement) return;

    const treeRect = treeElement.getBoundingClientRect();
    const nodeRect = selectedNodeElement.getBoundingClientRect();
    const nodeCenterFromScrollLeft = treeElement.scrollLeft + (nodeRect.left - treeRect.left) + nodeRect.width / 2;
    const targetScrollLeft = Math.max(0, nodeCenterFromScrollLeft - treeElement.clientWidth / 2);

    treeElement.scrollTo({
      left: targetScrollLeft,
      behavior: "smooth",
    });
  }, [selectedDepartment?.id, sidebarOpen, canvasWidth, zoom]);

  const allNodes = useMemo(() => flattenOrg(orgStructure), [orgStructure]);
  const nodeCount = Math.max(allNodes.length - 1, 0);
  const companyName = currentUser?.company || currentUser?.brand || orgStructure?.name || "RJ Fintech";
  const canZoomOut = zoom > MIN_ZOOM;
  const canZoomIn = zoom < MAX_ZOOM;

  const handleOpenNewNodePopup = (node: OrgNode) => {
    if (node.status?.trim().toUpperCase() === "PENDING") return;
    setNewNodeParent(node);
    setIsNewNodePopupOpen(true);
  };

  const handleCreateNode = async (name: string, nodeType: NewNodeType) => {
    if (!newNodeParent || !companyCode) return;

    try {
      await createNewOrgNode({
        companyCode,
        newNodeName: name,
        nodeType,
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
        companyId: node.companyId,
        childCount: node.children.length,
        breadcrumbs,
        parentName: parentNode?.name ?? null,
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

  const handleApproveNode = async (node: OrgNode, remark: string) => {
    const cleanedRemark = remark.trim();
    if (!cleanedRemark) {
      setOrgError("Remark is required before approving this node.");
      return;
    }

    const nodeId = node.uuid?.trim() || node.id?.trim();
    if (!nodeId) {
      setOrgError("Pending node ID is missing.");
      return;
    }

    try {
      await updateOrgNodeAction(nodeId, "approve", cleanedRemark);
      setPendingNodeForReview(null);
      await loadOrgForCompanyCode(companyCode);
    } catch (error) {
      setOrgError(getApiErrorMessage(error, "Failed to approve node. Please try again."));
    }
  };

  const handleRejectNode = async (node: OrgNode, remark: string) => {
    const cleanedRemark = remark.trim();
    if (!cleanedRemark) {
      setOrgError("Remark is required before rejecting this node.");
      return;
    }

    const nodeId = node.uuid?.trim() || node.id?.trim();
    if (!nodeId) {
      setOrgError("Pending node ID is missing.");
      return;
    }

    try {
      await updateOrgNodeAction(nodeId, "reject", cleanedRemark);
      setPendingNodeForReview(null);
      await loadOrgForCompanyCode(companyCode);
    } catch (error) {
      setOrgError(getApiErrorMessage(error, "Failed to reject node. Please try again."));
    }
  };

  const zoomOut = () => setZoom((current) => Math.max(MIN_ZOOM, Number((current - ZOOM_STEP).toFixed(2))));
  const zoomIn = () => setZoom((current) => Math.min(MAX_ZOOM, Number((current + ZOOM_STEP).toFixed(2))));

  return {
    companyCode,
    orgStructure,
    selectedDepartment,
    sidebarOpen,
    orgLoading,
    orgError,
    canvasWidth,
    bottomScrollContentWidth,
    hasHorizontalOverflow,
    zoom,
    isNewNodePopupOpen,
    newNodeParent,
    pendingNodeForReview,
    treeScrollRef,
    bottomScrollRef,
    graphContentRef,
    companyName,
    nodeCount,
    canZoomOut,
    canZoomIn,
    viewportEdgePadding: VIEWPORT_EDGE_PADDING,
    setCanvasWidth,
    setIsNewNodePopupOpen,
    setNewNodeParent,
    setPendingNodeForReview,
    handleOpenNewNodePopup,
    handleCreateNode,
    handleDepartmentClick,
    handleSidebarOpenChange,
    handleApproveNode,
    handleRejectNode,
    zoomOut,
    zoomIn,
  };
}
