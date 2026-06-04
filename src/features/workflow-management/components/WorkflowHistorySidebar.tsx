import { useEffect, useState } from "react";
import HistorySidebar, { type HistoryEntry } from "@/components/HistorySidebar";
import { normalizeHistoryDetail, type HistoryDetailViewModel } from "@/components/HistoryDetailDialog";
import { formatDateParts } from "@/lib/historyDate.utils";
import { getInitials } from "@/lib/userIdentity.utils";
import { useToast } from "@/hooks/use-toast";
import type { WorkflowRecord } from "@/features/workflow-management/types/workflow.types";
import { getApiErrorMessage } from "@/services/client";
import { fetchWorkflowHistory } from "@/services/workflow.service";
import { fetchHistoryDetail } from "@/services/history.service";

export type WorkflowHistorySidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  workflow: WorkflowRecord | null;
  onOpenHistoryDetail?: (detail: HistoryDetailViewModel, sourceId: string) => void;
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

const readCount = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const formatLevelCountLabel = (count: number, action: "added" | "modified" | "removed") =>
  `${count} level${count === 1 ? "" : "s"} ${action}`;

const getChangeSummaryBadges = (record: RawHistoryRecord): HistoryEntry["changeSummaryBadges"] => {
  const changeCount = toRecord(record.changeCount);
  const added = readCount(changeCount.added);
  const modified = readCount(changeCount.modify);
  const removed = readCount(changeCount.remove);

  const badges: NonNullable<HistoryEntry["changeSummaryBadges"]> = [];
  if (added > 0) {
    badges.push({
      key: "added",
      label: formatLevelCountLabel(added, "added"),
      tone: "added",
    });
  }
  if (modified > 0) {
    badges.push({
      key: "modified",
      label: formatLevelCountLabel(modified, "modified"),
      tone: "modified",
    });
  }
  if (removed > 0) {
    badges.push({
      key: "removed",
      label: formatLevelCountLabel(removed, "removed"),
      tone: "removed",
    });
  }

  return badges.length > 0 ? badges : undefined;
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
    sourceId: readString(record.id) || readString(record.workflowId) || readString(record.requestId),
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
    changeSummaryBadges: getChangeSummaryBadges(record),
  };
};

export default function WorkflowHistorySidebar({
  isOpen,
  onClose,
  workflow,
  onOpenHistoryDetail,
  dockOffset,
  splitView = Boolean(dockOffset),
  panelWidth,
}: WorkflowHistorySidebarProps) {
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen || !workflow) {
      setHistoryData([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const id = (workflow.referenceId || workflow.id || workflow.workflowId || "").trim();
        if (!id) {
          if (isMounted) setHistoryData([]);
          return;
        }
        const response = await fetchWorkflowHistory({ id });
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
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [isOpen, workflow, toast]);

  const handleViewMore = async (entry: HistoryEntry) => {
    const sourceId = (entry.sourceId || entry.id).trim();
    if (!sourceId) return;

    try {
      const response = await fetchHistoryDetail({ id: sourceId, type: "workflow" });
      onOpenHistoryDetail?.(normalizeHistoryDetail(response), sourceId);
    } catch (error) {
      const message = getApiErrorMessage(error, "Failed to fetch history details.");
      toast({ title: "Unable to load history details", description: message, variant: "destructive" });
    }
  };

  return (
    <HistorySidebar
      isOpen={isOpen}
      onClose={onClose}
      title="Workflow history"
      subtitle={workflow?.name || "Unknown Workflow"}
      showSystemGenerated={false}
      data={historyData}
      isLoading={isLoading}
      dockOffset={dockOffset}
      splitView={splitView}
      panelWidth={panelWidth}
      onViewMore={handleViewMore}
    />
  );
}
