import type { OrgNode } from "@/contexts/AppContext";
import { apiFetch } from "@/services/client";

type CreateOrgNodePayload = {
  companyCode: string;
  newNodeName: string;
  nodeType: string;
  parentNode: {
    nodeName: string;
    nodeType: string;
    nodePath: string;
  };
};

type CreateOrgNodeResponse = {
  message: string;
  code?: number;
  data?: unknown;
};

type RawCompanyRecord = Record<string, unknown>;
type RawOrgRecord = Record<string, unknown>;

type OrgApiResponse = {
  success?: boolean;
  data?: RawOrgRecord[];
};

const COMPANY_ORG_PATH = "/api/v1/company-settings/org";
const NEW_NODE_PATH = "/api/v1/company-settings/new-node";

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

const mapOrgNode = (record: RawOrgRecord): OrgNode => {
  const nodePath = getString(record, ["nodePath"], "");

  return {
    id: getString(record, ["id"], nodePath || crypto.randomUUID()),
    companyId: getNullableString(record, ["companyId"]) ?? undefined,
    name: getString(record, ["nodeName"], "Untitled Node"),
    nodeType: getString(record, ["nodeType"], "NODE"),
    nodePath,
    children: [],
  };
};

const buildOrgTree = (items: RawOrgRecord[]): OrgNode | null => {
  if (!items.length) return null;

  const nodes = items.map(mapOrgNode);

  const getDerivedParentPath = (nodePath: string) => {
    const segments = nodePath
      .split(".")
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length <= 1) return null;

    if (segments.length === 2 && segments[1].toUpperCase() !== "ROOT") {
      return `${segments[0]}.ROOT`;
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
  return apiFetch<CreateOrgNodeResponse>(NEW_NODE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCompanyOrgStructure(companyCode: string): Promise<OrgNode | null> {
  const payload = await apiFetch<OrgApiResponse>(COMPANY_ORG_PATH, {
    method: "POST",
    body: JSON.stringify({
      companyCode: companyCode.trim().toUpperCase(),
    }),
  });

  return buildOrgTree(Array.isArray(payload.data) ? payload.data : []);
}
