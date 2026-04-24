import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { OrgNode } from "@/contexts/AppContext";
import { useAppContext } from "@/contexts/AppContext";
import { createNewOrgNode, getCompanyOrgStructure } from "@/services/org.service";
import { collectNodeTrail, findOrgNodeById, findParentNodeById, flattenOrg } from "@/features/org-structure/orgNode.utils";
import type { DepartmentSidebarDepartment, NewNodeType } from "@/features/org-structure/types";

const VIEWPORT_EDGE_PADDING = 96;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.4;
const ZOOM_STEP = 0.1;

export function useOrgStructure() {
  const { currentUser, orgStructure, setOrgStructure } = useAppContext();
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
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const graphContentRef = useRef<HTMLDivElement | null>(null);
  const syncSourceRef = useRef<"tree" | "bottom" | null>(null);
  const companyCode = currentUser?.companyCode?.trim().toUpperCase() ?? "";

  const loadOrgForCompanyCode = async (nextCompanyCode: string) => {
    setOrgLoading(true);
    setOrgError("");

    try {
      const structure = await getCompanyOrgStructure(nextCompanyCode);
      setOrgStructure(structure);
    } catch {
      setOrgStructure(null);
      setOrgError("Unable to fetch organization structure.");
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
      } catch {
        if (!cancelled) {
          setOrgStructure(null);
          setOrgError("Unable to fetch organization structure.");
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
  }, [companyCode, setOrgStructure]);

  useEffect(() => {
    if (!orgStructure) {
      startTransition(() => {
        setSelectedDepartment(null);
        setSidebarOpen(false);
      });
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
  }, [canvasWidth, hasHorizontalOverflow, sidebarOpen, zoom]);

  const allNodes = useMemo(() => flattenOrg(orgStructure), [orgStructure]);
  const nodeCount = Math.max(allNodes.length - 1, 0);
  const companyName = currentUser?.company || currentUser?.brand || orgStructure?.name || "RJ Fintech";
  const canZoomOut = zoom > MIN_ZOOM;
  const canZoomIn = zoom < MAX_ZOOM;

  const handleOpenNewNodePopup = (node: OrgNode) => {
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
    } catch {
      setOrgError("Failed to create node. Please try again.");
    }

    setIsNewNodePopupOpen(false);
    setNewNodeParent(null);
  };

  const handleDepartmentClick = (node: OrgNode) => {
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

  const zoomOut = () => setZoom((current) => Math.max(MIN_ZOOM, Number((current - ZOOM_STEP).toFixed(2))));
  const zoomIn = () => setZoom((current) => Math.min(MAX_ZOOM, Number((current + ZOOM_STEP).toFixed(2))));

  return {
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
    handleOpenNewNodePopup,
    handleCreateNode,
    handleDepartmentClick,
    handleSidebarOpenChange,
    zoomOut,
    zoomIn,
  };
}
