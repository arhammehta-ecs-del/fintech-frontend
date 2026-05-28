import type { WorkflowRecord, WorkflowStatus } from "@/features/workflow-management/types/workflow.types";

type RawWorkflowRecord = Record<string, unknown>;

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const toRecord = (value: unknown): RawWorkflowRecord =>
  typeof value === "object" && value !== null ? (value as RawWorkflowRecord) : {};

export const isRootWorkflowNode = (nodePath: string, nodeType?: string) => {
  if ((nodeType || "").trim().toUpperCase() === "ROOT") return true;
  const trimmed = nodePath.trim();
  if (!trimmed) return false;
  return !trimmed.includes(".");
};

const getNodeLabelFromPath = (nodePath: string) => {
  const segments = nodePath.split(".").map((segment) => segment.trim()).filter(Boolean);
  const last = segments[segments.length - 1] || "";
  return formatSnakeCaseLabel(last);
};

export const formatSnakeCaseLabel = (value: string) =>
  value
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const formatWorkflowPath = (nodePath: string) =>
  nodePath
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => Boolean(segment) && segment.toUpperCase() !== "ROOT")
    .map((segment) => formatSnakeCaseLabel(segment))
    .join(" > ");

const toNodePathSegmentLabel = (segment: string) => segment.trim().replace(/_/g, " ");

const splitNodePathSegments = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const rawParts = trimmed.includes(">")
    ? trimmed.split(">")
    : trimmed.split(".");

  return rawParts
    .map((part) => toNodePathSegmentLabel(part))
    .filter((part) => Boolean(part) && part.toUpperCase() !== "ROOT");
};

export const getWorkflowPathPreview = (nodePath: string, keepLast = 3) => {
  const segments = splitNodePathSegments(nodePath);
  if (segments.length === 0) return "";

  const root = segments[0] ?? "";
  const tail = segments.slice(1);
  if (tail.length <= keepLast) {
    return [root, ...tail].filter(Boolean).join(" > ");
  }

  return [root, "...", ...tail.slice(-keepLast)].filter(Boolean).join(" > ");
};

export const getWorkflowParentPathPreview = (nodePath: string) => {
  const segments = nodePath
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => Boolean(segment) && segment.toUpperCase() !== "ROOT");

  if (segments.length <= 1) return "";

  const parentSegment = segments[segments.length - 2];
  return parentSegment ? formatSnakeCaseLabel(parentSegment) : "";
};

export const mapWorkflowRecord = (item: unknown, status: WorkflowStatus): WorkflowRecord => {
  const record = toRecord(item);
  const payload = toRecord(record.data);
  const pendingRequest = toRecord(record.pendingRequest);
  const orgStructure = toRecord(record.orgStructure);
  const initiator = toRecord(record.initiator);
  const rawModule = readString(record.module) || readString(payload.module);
  const subModule = readString(record.subModule) || readString(payload.subModule);
  const nodePath =
    readString(record.nodePath) ||
    readString(orgStructure.nodePath) ||
    readString(payload.nodePath);

  const id =
    readString(record.id) ||
    readString(record.workflowId) ||
    readString(record.requestId) ||
    [
      readString(record.levelsHash) || readString(payload.levelsHash),
      rawModule || "module",
      subModule || "sub-module",
      nodePath || "node-path",
      readString(record.name) || readString(payload.name) || "workflow",
      status,
    ]
      .filter(Boolean)
      .join("|");
  const levelsHash =
    readString(record.levelsHash) ||
    readString(payload.levelsHash) ||
    readString(record.workflowId) ||
    readString(payload.workflowId);
  const workflowId =
    readString(record.workflowId) ||
    readString(payload.workflowId) ||
    id;
  const name = readString(record.name) || readString(payload.name) || "Unknown";
  const alias = readString(record.alias) || readString(payload.alias) || "-";
  const moduleName = readString(record.module) || readString(payload.module) || "Unknown";
  const moduleDisplayName = subModule ? formatSnakeCaseLabel(subModule) : moduleName;
  const nodeType = readString(record.nodeType) || readString(orgStructure.nodeType) || readString(payload.nodeType);
  const nodeName =
    readString(record.nodeName) ||
    readString(orgStructure.nodeName) ||
    readString(record.department) ||
    (nodePath ? getNodeLabelFromPath(nodePath) : subModule || "Unknown");
  const levels = record.levels ?? payload.levels ?? [];

  return {
    id,
    workflowId,
    levelsHash,
    name,
    alias,
    module: moduleDisplayName,
    rawModule,
    nodeName,
    nodeType: nodeType ? formatSnakeCaseLabel(nodeType) : "-",
    subModule,
    nodePath,
    levels,
    approvalRemark: readString(record.approvalRemark),
    initiatorName:
      readString(record.initiatorName) ||
      readString(payload.initiatorName) ||
      readString(initiator.name),
    initiatorEmail:
      readString(record.initiatorEmail) ||
      readString(payload.initiatorEmail) ||
      readString(initiator.email),
    initiatedDate:
      readString(record.initiatedDate) ||
      readString(record.initiatedAt) ||
      readString(record.initiatorTimestamp) ||
      readString(payload.initiatedDate) ||
      readString(payload.initiatedAt) ||
      readString(payload.initiatorTimestamp),
    workflowName: readString(record.workflowName) || readString(payload.workflowName),
    workflowAlias: readString(record.alias) || readString(payload.alias),
    pendingRequestType: readString(pendingRequest.type),
    pendingOldData: toRecord(pendingRequest.oldData),
    pendingNewData: toRecord(pendingRequest.newData),
    status,
  };
};
