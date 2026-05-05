import type { OrgNode } from "@/contexts/AppContext";
import { apiFetch } from "@/services/client";

type CreateOrgNodePayload = {
  companyCode: string;
  newNodeName: string;
  nodeType: string;
  parentNode: {
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

type RawCompanyRecord = Record<string, unknown>;
type RawOrgRecord = Record<string, unknown>;
type RawOrgRequestRecord = Record<string, unknown>;
type AllowedNodeType = "ROOT" | "DEPARTMENT" | "TEAM" | "PLANT" | "LOCATION";

type OrgApiResponse = {
  message?: string;
  code?: number;
  success?: boolean;
  data?: {
    active?: RawOrgRecord[];
    pending?: RawOrgRequestRecord[];
  };
};

const COMPANY_ORG_PATH = "/api/v1/company-settings/org/fetch";
const NEW_NODE_PATH = "/api/v1/company-settings/org/initiate";
const NODE_ACTION_PATH = "/api/v1/company-settings/org/approve";
const ORG_HISTORY_PATH = "/api/v1/company-settings/org/fetch-history";


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
  if (normalized === "DIVISION") return "DEPARTMENT";
  if (normalized === "ROOT" || normalized === "DEPARTMENT" || normalized === "TEAM" || normalized === "PLANT" || normalized === "LOCATION") {
    return normalized;
  }
  return "DEPARTMENT";
};

const mapOrgNode = (record: RawOrgRecord, status: OrgNode["status"] = "Active"): OrgNode => {
  const nodePath = getString(record, ["nodePath"], "");
  const nodeUuid = getString(record, ["uuid"], getString(record, ["id"], ""));

  const generateId = () => {
    try {
      return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `node-${Math.random().toString(36).substring(2, 9)}`;
    } catch {
      return `node-${Date.now()}`;
    }
  };

  return {
    id: getString(record, ["id"], nodePath || generateId()),
    uuid: nodeUuid || undefined,
    companyId: getNullableString(record, ["companyId"]) ?? undefined,
    name: getString(record, ["nodeName"], "Untitled Node"),
    nodeType: getString(record, ["nodeType"], "NODE"),
    nodePath,
    status,
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
    status: "Pending",
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
  const normalizedPayload: CreateOrgNodePayload = {
    ...payload,
    companyCode: payload.companyCode.trim().toUpperCase(),
    nodeType: normalizeNodeTypeForApi(payload.nodeType),
    newNodeName: payload.newNodeName.trim(),
    parentNode: {
      nodeName: payload.parentNode.nodeName.trim(),
      nodePath: payload.parentNode.nodePath.trim(),
    },
  };

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

  try {
    const payload = await apiFetch<OrgApiResponse>(COMPANY_ORG_PATH, {
      method: "POST",
      body: JSON.stringify({
        companyCode: companyCode.trim().toUpperCase(),
      }),
    });

    const activeNodes = Array.isArray(payload.data?.active) ? payload.data.active.map((record) => mapOrgNode(record, "Active")) : [];
    const pendingNodes = Array.isArray(payload.data?.pending)
      ? payload.data.pending
          .map((record) => mapPendingOrgRequest(record))
          .filter((node): node is OrgNode => node !== null)
      : [];
    const parsedData = [...activeNodes, ...pendingNodes];

    if (parsedData.length > 0) {
      const tree = buildOrgTree(parsedData);
      if (tree) return tree;
    }
    throw new Error("Empty data or invalid tree returned");
  } catch (error) {
    console.error("Failed to fetch org structure:", error);
    throw error;
  }
}

export async function fetchOrgHistory(companyCode: string) {

  return apiFetch<any>(ORG_HISTORY_PATH, {
    method: "POST",
    body: JSON.stringify({ companyCode })
  });
}
