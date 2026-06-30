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
  categoryKey: string;
  counts: Record<PermissionAction, number>;
};

export type PermissionMatrixSection = {
  key: string;
  label: string;
  rows: PermissionMatrixRow[];
};

type NodePathCountItem = {
  label?: string;
  count?: number;
  permissionlevel?: string;
};

type NodePathCountPayload = Record<string, Record<string, NodePathCountItem[]>>;

const SYSTEM_ROW_LABELS: Record<string, string> = {
  ORG_STR: "Org Structure",
  USER_ACC: "User Access",
  WORK_FLOW: "Workflow",
};

const formatTokenLabel = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

export const formatPermissionSectionLabel = (value: string) => formatTokenLabel(value);

export const formatPermissionRowLabel = (value: string) => SYSTEM_ROW_LABELS[value.trim().toUpperCase()] || formatTokenLabel(value);

export const buildEmptyPermissionSections = (): PermissionMatrixSection[] => [];

export const buildPermissionSectionsFromCounts = (payload: NodePathCountPayload): PermissionMatrixSection[] =>
  Object.entries(payload)
    .map(([categoryKey, groups]) => {
      if (typeof groups !== "object" || groups === null) return null;

      const rows = Object.entries(groups)
        .map(([rowKey, entries]) => {
          const counts = { checker: 0, maker: 0, viewer: 0 } satisfies Record<PermissionAction, number>;
          (Array.isArray(entries) ? entries : []).forEach((entry) => {
            const level = String(entry.permissionlevel || "").trim().toUpperCase();
            const count = typeof entry.count === "number" ? entry.count : 0;
            if (level === "MANAGER") counts.checker = count;
            if (level === "USER") counts.maker = count;
            if (level === "VIEWER") counts.viewer = count;
          });

          return {
            key: rowKey,
            label: formatPermissionRowLabel(rowKey),
            categoryKey,
            counts,
          } satisfies PermissionMatrixRow;
        })
        .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));

      if (rows.length === 0) return null;

      return {
        key: categoryKey,
        label: formatPermissionSectionLabel(categoryKey),
        rows,
      } satisfies PermissionMatrixSection;
    })
    .filter((section): section is PermissionMatrixSection => Boolean(section));

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
    const message = getApiErrorMessage(
      error,
      input.action === "approve"
        ? "Failed to approve node. Please try again."
        : "Failed to reject node. Please try again.",
    );
    input.onClose();
    input.toast({
      title: input.action === "approve" ? "Unable to approve node" : "Unable to reject node",
      description: message,
      variant: "destructive",
    });
  }
};
