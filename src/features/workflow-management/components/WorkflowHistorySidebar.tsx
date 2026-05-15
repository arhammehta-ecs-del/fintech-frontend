import { useState, useEffect } from "react";
import HistorySidebar, { type HistoryEntry } from "@/components/HistorySidebar";
import { formatDateParts } from "@/lib/historyDate.utils";
import { getInitials } from "@/lib/userIdentity.utils";
import { useToast } from "@/hooks/use-toast";
import type { WorkflowRecord } from "@/features/workflow-management/types/workflow.types";
import { getApiErrorMessage } from "@/services/client";
import { fetchWorkflowHistory } from "@/services/workflow.service";
import { isRootWorkflowNode } from "@/features/workflow-management/utils/workflowRecord.utils";

export type WorkflowHistorySidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  workflow: WorkflowRecord | null;
  dockOffset?: {
    top: number;
    left: number;
  };
  splitView?: boolean;
  panelWidth?: number;
};

type RawHistoryRecord = Record<string, unknown>;

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const readLevel = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};
const toRecord = (value: unknown): RawHistoryRecord =>
  typeof value === "object" && value !== null ? (value as RawHistoryRecord) : {};
const toRecordArray = (value: unknown): RawHistoryRecord[] =>
  Array.isArray(value)
    ? value.filter((item): item is RawHistoryRecord => typeof item === "object" && item !== null)
    : [];
const toEpochMs = (value: unknown) => {
  const raw = readString(value);
  if (!raw) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
};

const getHistorySubject = (record: RawHistoryRecord, fallbackWorkflowName: string) => {
  const payload = toRecord(record.data);
  return (
    readString(record.requestName) ||
    readString(record.entityName) ||
    readString(record.name) ||
    readString(payload.requestName) ||
    readString(payload.entityName) ||
    readString(payload.name) ||
    fallbackWorkflowName ||
    "this workflow"
  );
};

const findNearestTimestamp = (records: RawHistoryRecord[], index: number) => {
  for (let cursor = index + 1; cursor < records.length; cursor += 1) {
    const candidate = records[cursor];
    const createdAt = readString(candidate.createdAt) || readString(candidate.initiatedAt) || readString(candidate.initiatedDate);
    if (createdAt) return createdAt;
  }

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidate = records[cursor];
    const createdAt = readString(candidate.createdAt) || readString(candidate.initiatedAt) || readString(candidate.initiatedDate);
    if (createdAt) return createdAt;
  }

  return "";
};

const mapWorkflowHistoryEntry = (
  record: RawHistoryRecord,
  workflowName: string,
  index: number,
  records: RawHistoryRecord[],
): HistoryEntry => {
  const user = toRecord(record.user);
  const level = readLevel(record.level);
  const subjectName = getHistorySubject(record, workflowName);
  const eligibleApprovers = toRecordArray((record as RawHistoryRecord).eligibleapprovers)
    .map((approver) => ({
      name: readString(approver.name),
      email: readString(approver.email),
    }))
    .filter((approver) => approver.name || approver.email);

  const createdAtRaw = readString(record.createdAt) || readString(record.initiatedAt) || readString(record.initiatedDate);
  const createdAt = createdAtRaw || (eligibleApprovers.length > 0 ? findNearestTimestamp(records, index) : "");
  const sortEpochMs = toEpochMs(createdAt);
  const eventRaw = readString(record.event) || readString(record.action) || readString(record.status);
  const action = eventRaw ? eventRaw.replace(/_/g, " ").toUpperCase() : "UPDATE";
  const { year, month, day, date, time } = formatDateParts(createdAt);

  const initiatorName = readString(user.name) || readString(record.initiatorName) || "System";
  const initiatorEmail = readString(user.email) || readString(record.initiatorEmail) || "no-email@example.com";
  const showActor = Boolean(readString(user.name) || readString(user.email));
  const normalizedAction = action.toLowerCase();
  const isPendingAction = normalizedAction.includes("initiate") || normalizedAction.includes("pending");
  const isApprovedAction = normalizedAction.includes("approve");
  const remarks = readString(record.remarks);
  const timestampMissing = !createdAt;
  const pendingApproverCount = eligibleApprovers.length;
  const details =
    level !== null
      ? `Level ${level} ${action.toLowerCase()} for ${subjectName}.`
      : pendingApproverCount > 0
        ? `${pendingApproverCount} eligible approver${pendingApproverCount === 1 ? "" : "s"} for ${subjectName}.`
        : `Event recorded for ${subjectName}.`;

  return {
    id: readString(record.id) || readString(record.workflowId) || `${createdAt || "history"}-${index}`,
    sortEpochMs: Number.isFinite(sortEpochMs) ? sortEpochMs : undefined,
    year,
    month,
    day,
    action,
    details,
    remarks: remarks || undefined,
    timestampMissing,
    eligibleApprovers: eligibleApprovers.length > 0 ? eligibleApprovers : undefined,
    initiator: {
      name: initiatorName,
      email: initiatorEmail,
      initials: getInitials(initiatorName),
      date: timestampMissing ? "" : date,
      time: timestampMissing ? "" : time,
    },
    showActor,
    approver: isApprovedAction
      ? {
        name: initiatorName,
        email: initiatorEmail,
        date,
        time,
      }
      : undefined,
    status: isPendingAction ? "pending" : "approved",
  };
};

export default function WorkflowHistorySidebar({
  isOpen,
  onClose,
  workflow,
  dockOffset,
  splitView = Boolean(dockOffset),
  panelWidth,
}: WorkflowHistorySidebarProps) {
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen || !workflow) {
      setHistoryData([]);
      return;
    }

    let isMounted = true;
    const loadHistory = async () => {
      try {
        const levelsHash = (workflow.levelsHash || workflow.id || "").trim();
        const module = workflow.rawModule?.trim() || workflow.module?.trim() || null;
        const subModule = workflow.subModule?.trim() || null;
        const nodePathRaw = workflow.nodePath?.trim() || "";
        const nodePath = nodePathRaw && !isRootWorkflowNode(nodePathRaw, workflow.nodeType) ? nodePathRaw : null;
        if (!levelsHash) {
          if (isMounted) setHistoryData([]);
          return;
        }
        const response = await fetchWorkflowHistory({ levelsHash, module, subModule, nodePath });
        if (isMounted && response?.data) {
          const mappedHistory = Array.isArray(response.data)
            ? response.data
              .map((item) => toRecord(item))
              .map((record, index, records) => mapWorkflowHistoryEntry(record, workflow.name, index, records))
            : [];
          setHistoryData(mappedHistory);
        }
      } catch (error) {
        const message = getApiErrorMessage(error, "Failed to fetch workflow history.");
        toast({ title: "Unable to load workflow history", description: message, variant: "destructive" });
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [isOpen, workflow, toast]);

  return (
    <HistorySidebar
      isOpen={isOpen}
      onClose={onClose}
      title="Workflow history"
      subtitle={workflow?.name || "Unknown Workflow"}
      showSystemGenerated={false}
      data={historyData}
      dockOffset={dockOffset}
      splitView={splitView}
      panelWidth={panelWidth}
    />
  );
}
