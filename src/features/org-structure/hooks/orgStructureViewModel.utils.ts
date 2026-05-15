import type { OrgNode } from "@/contexts/AppContext";
import { getApiErrorMessage } from "@/services/client";

export const VIEWPORT_EDGE_PADDING = 96;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;
export const ZOOM_STEP = 0.1;

export type PermissionAction = "checker" | "maker" | "viewer";
export type PermissionMatrixRow = {
  key: string;
  label: string;
  counts: Record<PermissionAction, number>;
};

export const SYSTEM_ROWS: Array<{ key: string; label: string }> = [
  { key: "ORG_STR", label: "Org Structure" },
  { key: "USER_ACC", label: "User Access" },
  { key: "WORK_FLOW", label: "Workflow" },
];

export const buildEmptyPermissionRows = (): PermissionMatrixRow[] =>
  SYSTEM_ROWS.map((row) => ({ key: row.key, label: row.label, counts: { checker: 0, maker: 0, viewer: 0 } }));

export const centerSelectedNode = (treeElement: HTMLDivElement, selectedId: string) => {
  const escapedId = selectedId.replace(/"/g, '\\"');
  const selectedNodeElement = treeElement.querySelector<HTMLElement>(`[data-org-node-id="${escapedId}"]`);
  if (!selectedNodeElement) return;

  const treeRect = treeElement.getBoundingClientRect();
  const nodeRect = selectedNodeElement.getBoundingClientRect();
  const nodeCenterFromScrollLeft = treeElement.scrollLeft + (nodeRect.left - treeRect.left) + nodeRect.width / 2;
  const targetScrollLeft = Math.max(0, nodeCenterFromScrollLeft - treeElement.clientWidth / 2);

  treeElement.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
};

export const getInitialZoomForOverflow = () => Math.max(MIN_ZOOM, Number((1 - ZOOM_STEP * 2).toFixed(2)));

export const toSidebarDepartment = (node: OrgNode) => ({
  id: node.id,
  name: node.name,
  manager: node.manager,
  members: node.members,
  children: node.children,
  nodeType: node.nodeType,
  nodePath: node.nodePath,
});

export const performPendingNodeAction = async (input: {
  node: OrgNode;
  action: "approve" | "reject";
  remark: string;
  setOrgError: (value: string) => void;
  toast: (value: { title: string; description: string; variant?: "default" | "destructive" }) => void;
  updateOrgNodeAction: (nodeId: string, action: "approve" | "reject", remark: string) => Promise<{ message?: string } | undefined>;
  onSuccess: () => Promise<void>;
  onClose: () => void;
}) => {
  const cleanedRemark = input.remark.trim();
  if (!cleanedRemark) {
    input.setOrgError(`Remark is required before ${input.action === "approve" ? "approving" : "rejecting"} this node.`);
    return;
  }

  const nodeId = input.node.uuid?.trim() || input.node.id?.trim();
  if (!nodeId) {
    input.setOrgError("Pending node ID is missing.");
    return;
  }

  try {
    const response = await input.updateOrgNodeAction(nodeId, input.action, cleanedRemark);
    input.toast({
      title: input.action === "approve" ? "Node Approved" : "Node Rejected",
      description:
        response?.message ||
        (input.action === "approve"
          ? "Organization structure node approved successfully."
          : "Organization structure node rejected successfully."),
      variant: "default",
    });
    input.onClose();
    await input.onSuccess();
  } catch (error) {
    input.setOrgError(
      getApiErrorMessage(
        error,
        input.action === "approve"
          ? "Failed to approve node. Please try again."
          : "Failed to reject node. Please try again.",
      ),
    );
  }
};
