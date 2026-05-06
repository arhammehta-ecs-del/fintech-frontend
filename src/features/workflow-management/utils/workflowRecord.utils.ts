import type { WorkflowRecord, WorkflowStatus } from "@/features/workflow-management/types/workflow.types";

type RawWorkflowRecord = Record<string, unknown>;

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const toRecord = (value: unknown): RawWorkflowRecord =>
  typeof value === "object" && value !== null ? (value as RawWorkflowRecord) : {};

const getNodeLabelFromPath = (nodePath: string) => {
  const segments = nodePath.split(".").map((segment) => segment.trim()).filter(Boolean);
  const last = segments[segments.length - 1] || "";
  return last
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatNodeType = (value: string) =>
  value
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const mapWorkflowRecord = (item: unknown, status: WorkflowStatus): WorkflowRecord => {
  const record = toRecord(item);
  const payload = toRecord(record.data);
  const orgStructure = toRecord(record.orgStructure);

  const id =
    readString(record.id) ||
    readString(record.workflowId) ||
    readString(record.requestId) ||
    readString(payload.id) ||
    readString(payload.workflowId);
  const name = readString(record.name) || readString(payload.name) || "Unknown";
  const alias = readString(record.alias) || readString(payload.alias) || "-";
  const moduleName = readString(record.module) || readString(payload.module) || "Unknown";
  const nodePath =
    readString(record.nodePath) ||
    readString(orgStructure.nodePath) ||
    readString(payload.nodePath);
  const subModule = readString(record.subModule) || readString(payload.subModule);
  const nodeType = readString(record.nodeType) || readString(orgStructure.nodeType) || readString(payload.nodeType);
  const nodeName =
    readString(record.nodeName) ||
    readString(orgStructure.nodeName) ||
    readString(record.department) ||
    (nodePath ? getNodeLabelFromPath(nodePath) : subModule || "Unknown");
  const levels = record.levels ?? payload.levels ?? [];

  return {
    id,
    name,
    alias,
    module: moduleName,
    nodeName,
    nodeType: nodeType ? formatNodeType(nodeType) : "-",
    subModule,
    nodePath,
    levels,
    approvalRemark: readString(record.approvalRemark),
    status,
  };
};
