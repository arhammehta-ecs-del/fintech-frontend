import type { OrgNode } from "@/contexts/AppContext";
import { apiFetch } from "@/services/client";

type CreateOrgNodePayload = {
  type?: "initiate" | "active" | "update" | "archive" | string;
  status?: "active" | "inactive" | "ACTIVE" | "INACTIVE" | null | string;
  companyCode?: string;
  newNodeName?: string;
  nodeType?: string;
  nodePath?: string;
  remarks?: string;
  levelsHash?: string | null;
  parentNode?: {
    nodeName: string;
    nodePath: string;
  };
};

type CreateOrgNodeResponse = {
  message: string;
  code?: number;
  data?: unknown;
};

type OrgNodeAction = "approve" | "reject";

type OrgNodeActionResponse = {
  message?: string;
  code?: number;
  success?: boolean;
  data?: unknown;
};
type OrgHistoryResponse = {
  message?: string;
  code?: number;
  success?: boolean;
  data?: unknown;
};

type RawCompanyRecord = Record<string, unknown>;
type RawOrgRecord = Record<string, unknown>;
type RawOrgRequestRecord = Record<string, unknown>;
type AllowedNodeType = "ROOT" | "DEPARTMENT" | "TEAM" | "PLANT" | "DIVISION" | "LOCATION";

type OrgApiResponse = {
  message?: string;
  code?: number;
  success?: boolean;
  data?: {
    active?: RawOrgRecord[];
    pending?: RawOrgRequestRecord[];
  };
};

type NodePathCountItem = {
  label?: string;
  count?: number;
  permissionlevel?: string;
};

type NodePathCountResponse = {
  message?: string;
  code?: number;
  data?: Record<string, NodePathCountItem[]>;
};

const COMPANY_ORG_PATH = "/api/v1/company-settings/org/fetch";
const NEW_NODE_PATH = "/api/v1/company-settings/org/initiate";
const NODE_ACTION_PATH = "/api/v1/company-settings/org/approve";
const ORG_HISTORY_PATH = "/api/v1/company-settings/org/fetch-history";
const USERS_BY_NODEPATH_COUNT_PATH = "/api/v1/company-settings/user/fetch-users-by-nodepath-count";


const getString = (record: RawCompanyRecord, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return fallback;
};

const getNullableString = (record: RawCompanyRecord, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
    if (value === null) {
      return null;
    }
  }
  return null;
};

const normalizePathSegment = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toUpperCase();

const normalizeNodeTypeForApi = (nodeType: string): AllowedNodeType => {
  const normalized = nodeType.trim().toUpperCase();
  if (normalized === "ROOT" || normalized === "DEPARTMENT" || normalized === "TEAM" || normalized === "PLANT" || normalized === "DIVISION" || normalized === "LOCATION") {
    return normalized;
  }
  return "DEPARTMENT";
};

const mapOrgNode = (record: RawOrgRecord, status: OrgNode["status"] = "Active"): OrgNode => {
  const nodePath = getString(record, ["nodePath"], "");
  const nodeId = getString(record, ["id"], nodePath);
  const nodeName = getString(record, ["nodeName"], "");
  const nodeType = getString(record, ["nodeType"], "");
  if (!nodePath || !nodeName || !nodeType) {
    throw new Error("Invalid org/fetch response: nodeName, nodeType and nodePath are required");
  }
  const pendingRequest =
    typeof record.pendingRequest === "object" && record.pendingRequest !== null
      ? (record.pendingRequest as RawOrgRecord)
      : null;
  const pendingRequestId = pendingRequest ? getString(pendingRequest, ["id"], "") : "";
  const pendingRequestType = pendingRequest ? getString(pendingRequest, ["type"], "") : "";
  const pendingRequestStatus = pendingRequest ? getString(pendingRequest, ["status"], "").trim().toUpperCase() : "";
  const pendingRequestOldData =
    pendingRequest && typeof pendingRequest.oldData === "object" && pendingRequest.oldData !== null
      ? (pendingRequest.oldData as Record<string, unknown>)
      : undefined;
  const pendingRequestNewData =
    pendingRequest && typeof pendingRequest.newData === "object" && pendingRequest.newData !== null
      ? (pendingRequest.newData as Record<string, unknown>)
      : undefined;
  const shouldTreatAsPending = Boolean(pendingRequest) && (!pendingRequestStatus || pendingRequestStatus === "PENDING");
  const nodeUuid = pendingRequestId || getString(record, ["uuid"], nodeId);
  const requestedStatusRaw =
    (typeof pendingRequestNewData?.status === "string" ? pendingRequestNewData.status.trim() : "") ||
    (typeof pendingRequestOldData?.status === "string" ? pendingRequestOldData.status.trim() : "");
  const requestedStatus = requestedStatusRaw.toUpperCase() === "INACTIVE"
    ? "INACTIVE"
    : requestedStatusRaw.toUpperCase() === "ACTIVE"
      ? "ACTIVE"
      : null;

  return {
    id: nodeId,
    uuid: nodeUuid || undefined,
    companyId: getNullableString(record, ["companyId"]) ?? undefined,
    name: nodeName,
    nodeType,
    nodePath,
    status: shouldTreatAsPending ? "Pending" : status,
    requestedStatus,
    requestedByName:
      getString(record, ["requestedByName", "requestedBy", "initiatorName", "requesterName", "createdByName"], "") ||
      (pendingRequest
        ? getString(pendingRequest, ["requestedByName", "requestedBy", "initiatorName", "requesterName", "createdByName"], "")
        : "") ||
      undefined,
    requestedByEmail:
      getString(record, ["requestedByEmail", "initiatorEmail", "requesterEmail", "createdByEmail"], "") ||
      (pendingRequest
        ? getString(pendingRequest, ["requestedByEmail", "initiatorEmail", "requesterEmail", "createdByEmail"], "")
        : "") ||
      undefined,
    requestedAt:
      getString(record, ["requestedAt", "initiatedAt", "initiatedDate", "createdAt", "requestedOn", "requestDate"], "") ||
      (pendingRequest
        ? getString(pendingRequest, ["requestedAt", "initiatedAt", "initiatedDate", "createdAt", "requestedOn", "requestDate"], "")
        : "") ||
      undefined,
    workflowName:
      getString(record, ["workflowName"], "") ||
      (pendingRequest ? getString(pendingRequest, ["workflowName"], "") : "") ||
      undefined,
    alias:
      getString(record, ["alias"], "") ||
      (pendingRequest ? getString(pendingRequest, ["alias"], "") : "") ||
      undefined,
    pendingRequestType: pendingRequestType || undefined,
    pendingOldData: pendingRequestOldData,
    pendingNewData: pendingRequestNewData,
    children: [],
  };
};

const mapPendingOrgRequest = (record: RawOrgRequestRecord): OrgNode | null => {
  const requestData =
    typeof record.data === "object" && record.data !== null
      ? (record.data as RawOrgRecord)
      : record;

  const parentNode =
    typeof requestData.parentNode === "object" && requestData.parentNode !== null
      ? (requestData.parentNode as RawOrgRecord)
      : null;

  const parentNodePath = parentNode ? getString(parentNode, ["nodePath"], "") : "";
  const newNodeName = getString(requestData, ["newNodeName"], "");
  const nodeType = getString(requestData, ["nodeType"], "");
  const requestId = getString(record, ["id"], "");
  const requestedByName =
    getString(record, ["requestedByName", "requestedBy", "initiatorName", "requesterName", "createdByName"], "") ||
    getString(requestData, ["requestedByName", "requestedBy", "initiatorName", "requesterName", "createdByName"], "");
  const requestedByEmail =
    getString(record, ["requestedByEmail", "initiatorEmail", "requesterEmail", "createdByEmail"], "") ||
    getString(requestData, ["requestedByEmail", "initiatorEmail", "requesterEmail", "createdByEmail"], "");
  const requestedAt =
    getString(record, ["requestedAt", "initiatedAt", "initiatedDate", "createdAt", "requestedOn", "requestDate"], "") ||
    getString(requestData, ["requestedAt", "initiatedAt", "initiatedDate", "createdAt", "requestedOn", "requestDate"], "");
  const workflowName =
    getString(record, ["workflowName"], "") ||
    getString(requestData, ["workflowName"], "");
  const alias =
    getString(record, ["alias"], "") ||
    getString(requestData, ["alias"], "");
  const requestedStatusRaw =
    getString(requestData, ["status"], "") ||
    getString(record, ["status"], "");
  const requestedStatus = requestedStatusRaw.trim().toUpperCase() === "INACTIVE"
    ? "INACTIVE"
    : requestedStatusRaw.trim().toUpperCase() === "ACTIVE"
      ? "ACTIVE"
      : null;

  if (!newNodeName || !nodeType) return null;

  const derivedNodePath =
    nodeType.trim().toUpperCase() === "ROOT"
      ? `${normalizePathSegment(getString(record, ["companyCode"], parentNodePath.split(".")[0] ?? ""))}.ROOT`
      : parentNodePath
        ? `${parentNodePath}.${normalizePathSegment(newNodeName)}`
        : "";

  return {
    id: requestId || derivedNodePath || `pending-${normalizePathSegment(newNodeName)}`,
    uuid: requestId || undefined,
    companyId: getNullableString(record, ["companyId"]) ?? undefined,
    name: newNodeName,
    nodeType: nodeType || "NODE",
    nodePath: derivedNodePath,
    requestedByName: requestedByName || undefined,
    requestedByEmail: requestedByEmail || undefined,
    requestedAt: requestedAt || undefined,
    workflowName: workflowName || undefined,
    alias: alias || undefined,
    status: "Pending",
    requestedStatus,
    children: [],
  };
};

const buildOrgTree = (nodes: OrgNode[]): OrgNode | null => {
  if (!nodes.length) return null;

  const getDerivedParentPath = (nodePath: string) => {
    const segments = nodePath
      .split(".")
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length <= 1) return null;

    if (segments.length === 2 && segments[1].toUpperCase() !== "ROOT") {
      // Backends may emit root as either COMPANY.ROOT or just COMPANY.
      // Prefer COMPANY.ROOT when present, otherwise fall back to COMPANY.
      const rootWithSuffix = `${segments[0]}.ROOT`;
      return nodePathMap.has(rootWithSuffix) ? rootWithSuffix : segments[0];
    }

    return segments.slice(0, -1).join(".");
  };

  const nodePathMap = new Map(
    nodes
      .filter((node) => node.nodePath)
      .map((node) => [node.nodePath, node] as const),
  );
  const rootNodes: OrgNode[] = [];

  for (const node of nodes) {
    const parent = node.nodePath ? nodePathMap.get(getDerivedParentPath(node.nodePath) ?? "") : null;

    if (parent) {
      parent.children.push(node);
      continue;
    }

    rootNodes.push(node);
  }

  const parseNodePath = (nodePath: string) =>
    nodePath
      .split(".")
      .map((segment) => segment.trim())
      .filter(Boolean);

  const compareNodePath = (leftPath: string, rightPath: string) => {
    const leftSegments = parseNodePath(leftPath);
    const rightSegments = parseNodePath(rightPath);
    const maxLength = Math.max(leftSegments.length, rightSegments.length);

    for (let index = 0; index < maxLength; index += 1) {
      const leftSegment = leftSegments[index];
      const rightSegment = rightSegments[index];

      if (leftSegment === undefined) return -1;
      if (rightSegment === undefined) return 1;

      if (leftSegment !== rightSegment) {
        const leftAsNumber = Number(leftSegment);
        const rightAsNumber = Number(rightSegment);
        const bothNumeric = !Number.isNaN(leftAsNumber) && !Number.isNaN(rightAsNumber);

        if (bothNumeric) {
          return leftAsNumber - rightAsNumber;
        }

        return leftSegment.localeCompare(rightSegment, undefined, { numeric: true, sensitivity: "base" });
      }
    }

    return 0;
  };

  const sortNodes = (branch: OrgNode[]) => {
    branch.sort((left, right) => {
      const pathComparison = compareNodePath(left.nodePath, right.nodePath);
      if (pathComparison !== 0) return pathComparison;
      return left.name.localeCompare(right.name);
    });

    branch.forEach((node) => sortNodes(node.children));
  };

  sortNodes(rootNodes);
  return rootNodes.find((node) => node.nodeType.trim().toUpperCase() === "ROOT") ?? rootNodes[0] ?? null;
};

export async function createNewOrgNode(payload: CreateOrgNodePayload) {
  const normalizedPayload: CreateOrgNodePayload = { ...payload };

  if (typeof payload.companyCode === "string") normalizedPayload.companyCode = payload.companyCode.trim().toUpperCase();
  if (typeof payload.nodeType === "string") normalizedPayload.nodeType = normalizeNodeTypeForApi(payload.nodeType);
  if (typeof payload.newNodeName === "string") normalizedPayload.newNodeName = payload.newNodeName.trim();
  if (typeof payload.nodePath === "string") normalizedPayload.nodePath = payload.nodePath.trim();
  if (typeof payload.remarks === "string") normalizedPayload.remarks = payload.remarks.trim();
  normalizedPayload.levelsHash = payload.levelsHash?.trim() || null;
  if (payload.parentNode) {
    normalizedPayload.parentNode = {
      nodeName: payload.parentNode.nodeName.trim(),
      nodePath: payload.parentNode.nodePath.trim(),
    };
  }

  if (typeof payload.type !== "undefined") normalizedPayload.type = payload.type;
  if (typeof payload.status !== "undefined") normalizedPayload.status = payload.status;

  return apiFetch<CreateOrgNodeResponse>(NEW_NODE_PATH, {
    method: "POST",
    body: JSON.stringify(normalizedPayload),
  });
}

export async function updateOrgNodeAction(id: string, action: OrgNodeAction, remark: string) {

  return apiFetch<OrgNodeActionResponse>(NODE_ACTION_PATH, {
    method: "POST",
    body: JSON.stringify({
      action,
      remark,
      id,
    }),
  });
}

export async function getCompanyOrgStructure(companyCode: string): Promise<OrgNode | null> {
  const payload = await apiFetch<OrgApiResponse>(COMPANY_ORG_PATH, {
    method: "POST",
    body: JSON.stringify({}),
  });

  if (!payload.data) {
    throw new Error("Invalid org/fetch response: missing data");
  }
  if (!Array.isArray(payload.data.active) || !Array.isArray(payload.data.pending)) {
    throw new Error("Invalid org/fetch response: active and pending must be arrays");
  }

  const activeNodes = payload.data.active.map((record) => mapOrgNode(record, "Active"));
  const pendingNodes = payload.data.pending
    .map((record) => mapPendingOrgRequest(record))
    .filter((node): node is OrgNode => node !== null);
  const parsedData = [...activeNodes, ...pendingNodes];

  if (parsedData.length > 0) {
    const tree = buildOrgTree(parsedData);
    if (tree) return tree;
  }
  throw new Error("Empty data or invalid tree returned");
}

export async function fetchOrgHistory(
  
  nodeName: string,
  nodePath?: string,
  options?: {
    isPending?: boolean;
    parentNodePath?: string;
  },
) {

  return apiFetch<OrgHistoryResponse>(ORG_HISTORY_PATH, {
    method: "POST",
    body: JSON.stringify({
      
      nodeName: nodeName.trim(),
      ...(nodePath?.trim() ? { nodePath: nodePath.trim() } : {}),
      ...(options?.isPending ? { pending: true } : {}),
      ...(options?.parentNodePath?.trim() ? { parentNodePath: options.parentNodePath.trim() } : {}),
    })
  });
}

export async function fetchUsersByNodePathCount(nodePath: string) {
  const payload = await apiFetch<NodePathCountResponse>(USERS_BY_NODEPATH_COUNT_PATH, {
    method: "POST",
    body: JSON.stringify({
      nodePath: nodePath.trim(),
    }),
  });
  if (!payload.data || typeof payload.data !== "object") {
    throw new Error("Invalid nodepath count response: missing data");
  }
  return payload.data;
}
