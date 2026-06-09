import { useEffect, useState } from "react";
import HistorySidebar, { type HistoryEntry } from "@/components/HistorySidebar";
import { normalizeHistoryDetail, type HistoryDetailPreviewEvent, type HistoryDetailViewModel } from "@/components/HistoryDetailDialog";
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
  onLatestHistoryEventChange?: (event: HistoryDetailPreviewEvent | null) => void;
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

  // Parse multi-level approval data (approvedBy levels + approvalSummary)
  const approvedByLevels = toRecordArray(record.approvedBy)
    .map((levelEntry) => ({
      level: readLevel(levelEntry.level),
      rule: readString(levelEntry.rule) || null,
      approvers: toRecordArray(levelEntry.approvedBy)
        .map((approver) => ({
          levelCount: readString(approver.levelCount),
          name: readString(approver.name),
          email: readString(approver.email),
          approvedAt: readString(approver.approvedAt),
        }))
        .filter((approver) => approver.name || approver.email),
    }))
    .filter((entry) => entry.level !== null && entry.approvers.length > 0)
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0));

  const approvalSummaryData = toRecord(record.approvalSummary);
  const approvalTotalLevels = readCount(approvalSummaryData.totalLevels);
  const approvalCompletedLevels = readCount(approvalSummaryData.completedLevels);
  const isFullyApproved = approvalTotalLevels > 0 && approvalCompletedLevels >= approvalTotalLevels;

  // Derive timestamp from latest approvedAt when createdAt is missing
  const latestApprovedAt = approvedByLevels.reduce<string>((latest, entry) => {
    for (const approver of entry.approvers) {
      if (approver.approvedAt && (!latest || new Date(approver.approvedAt) > new Date(latest))) {
        return approver.approvedAt;
      }
    }
    return latest;
  }, "");

  const createdAtRaw = readString(record.createdAt) || readString(record.initiatedAt) || readString(record.initiatedDate);
  const createdAt = createdAtRaw || latestApprovedAt || (eligibleApprovers.length > 0 ? findNearestTimestamp(records, index) : "");
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
  const isAutoEvent = normalizedAction.includes("auto generate") || normalizedAction.includes("auto delete");
  const disableViewMore = isAutoEvent;
  const remarks = readString(record.remarks);
  const levelCount = readString(record.levelCount);
  const timestampMissing = !createdAt;
  const pendingApproverCount = eligibleApprovers.length;
  const details =
    level !== null
      ? `Level ${level} ${action.toLowerCase()} for ${subjectName}.`
      : isFullyApproved && approvalTotalLevels > 1
        ? `All ${approvalTotalLevels} levels approved for ${subjectName}.`
        : pendingApproverCount > 0
          ? `${pendingApproverCount} eligible approver${pendingApproverCount === 1 ? "" : "s"} for ${subjectName}.`
          : `Event recorded for ${subjectName}.`;

  return {
    id: readString(record.id) || readString(record.workflowId) || `${createdAt || "history"}-${index}`,
    sourceId: readString(record.id) || readString(record.workflowId) || readString(record.requestId),
    disableViewMore,
    collapseToHeader: isAutoEvent,
    sortEpochMs: Number.isFinite(sortEpochMs) ? sortEpochMs : undefined,
    year,
    month,
    day,
    action,
    levelCount: levelCount || undefined,
    details,
    remarks: remarks || undefined,
    timestampMissing,
    eligibleApprovers: eligibleApprovers.length > 0 ? eligibleApprovers : undefined,
    approvalSections: approvedByLevels.length > 0
      ? [{
          title: "Approved By",
          tone: "success" as const,
          items: approvedByLevels.map((entry) => ({
            label: `Level ${entry.level}`,
            levelCount: entry.approvers[0]?.levelCount || null,
            rule: entry.rule || null,
            status: null,
            people: entry.approvers.map((approver) => {
              const { date, time } = formatDateParts(approver.approvedAt || "");
              return {
                name: approver.name,
                email: approver.email,
                date: date || undefined,
                time: time || undefined,
              };
            }),
          })),
        }]
      : undefined,
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
  onLatestHistoryEventChange,
  dockOffset,
  splitView = Boolean(dockOffset),
  panelWidth,
}: WorkflowHistorySidebarProps) {
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeViewMoreSourceId, setActiveViewMoreSourceId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setActiveViewMoreSourceId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveViewMoreSourceId(null);
  }, [workflow?.id, workflow?.workflowId, workflow?.referenceId]);

  useEffect(() => {
    if (!isOpen || !workflow) {
      setHistoryData([]);
      setIsLoading(false);
      onLatestHistoryEventChange?.(null);
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
          onLatestHistoryEventChange?.(
            mappedHistory[0]
              ? {
                  action: mappedHistory[0].action,
                  levelCount: mappedHistory[0].levelCount,
                  status: mappedHistory[0].status,
                }
              : null,
          );
        }
      } catch (error) {
        const message = getApiErrorMessage(error, "Failed to fetch workflow history.");
        toast({ title: "Unable to load workflow history", description: message, variant: "destructive" });
        onLatestHistoryEventChange?.(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [isOpen, workflow, onLatestHistoryEventChange, toast]);

  const handleViewMore = async (entry: HistoryEntry) => {
    const sourceId = (entry.sourceId || entry.id).trim();
    if (!sourceId) return;

    try {
      const response = await fetchHistoryDetail({ id: sourceId, type: "workflow" });
      const detail = normalizeHistoryDetail(response);
      if (!detail) return;
      setActiveViewMoreSourceId(sourceId);
      onOpenHistoryDetail?.(
        {
          ...detail,
          previewEvent: {
            action: entry.action,
            levelCount: entry.levelCount,
            status: entry.status,
          },
        },
        sourceId,
      );
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
      subtitle={workflow?.workflowName || workflow?.name || workflow?.alias || "Workflow"}
      showSystemGenerated={false}
      data={historyData}
      isLoading={isLoading}
      dockOffset={dockOffset}
      splitView={splitView}
      panelWidth={panelWidth}
      onViewMore={handleViewMore}
      activeViewMoreSourceId={activeViewMoreSourceId}
    />
  );
}
