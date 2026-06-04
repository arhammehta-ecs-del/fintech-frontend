import { useState, useEffect } from "react";
import type { AppUser } from "@/contexts/AppContext";
import HistorySidebar, { type HistoryEntry } from "@/components/HistorySidebar";
import { normalizeHistoryDetail, type HistoryDetailViewModel } from "@/components/HistoryDetailDialog";
import { formatDateParts } from "@/lib/historyDate.utils";
import { getInitials } from "@/lib/userIdentity.utils";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { fetchUserHistory } from "@/services/user.service";
import { fetchHistoryDetail } from "@/services/history.service";

type UserHistorySidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  user: AppUser | null;
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
const toRecord = (value: unknown): RawHistoryRecord =>
  typeof value === "object" && value !== null ? (value as RawHistoryRecord) : {};
const readLevel = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};
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
const formatAccessRightsCountLabel = (count: number, action: "added" | "modified" | "removed") =>
  `${count} access-right${count === 1 ? "" : "s"} ${action}`;
const getChangeSummaryBadges = (record: RawHistoryRecord): HistoryEntry["changeSummaryBadges"] => {
  const changeCount = toRecord(record.changeCount);
  const added = readCount(changeCount.added);
  const modified = readCount(changeCount.modify);
  const removed = readCount(changeCount.remove);

  const badges: NonNullable<HistoryEntry["changeSummaryBadges"]> = [];
  if (added > 0) {
    badges.push({
      key: "added",
      label: formatAccessRightsCountLabel(added, "added"),
      tone: "added",
    });
  }
  if (modified > 0) {
    badges.push({
      key: "modified",
      label: formatAccessRightsCountLabel(modified, "modified"),
      tone: "modified",
    });
  }
  if (removed > 0) {
    badges.push({
      key: "removed",
      label: formatAccessRightsCountLabel(removed, "removed"),
      tone: "removed",
    });
  }

  return badges.length > 0 ? badges : undefined;
};
const toEventPhrase = (action: string) => {
  const normalized = action.trim().toUpperCase();
  if (normalized.includes("APPROVE")) return "approval";
  if (normalized.includes("REJECT")) return "rejection";
  if (normalized.includes("INITIATE") || normalized.includes("PENDING")) return "initiation";
  return `${normalized.toLowerCase()} event`;
};

const formatEligibleApproversDetail = (record: RawHistoryRecord) => {
  const eligibleApproversRaw = Array.isArray(record.eligibleapprovers) ? record.eligibleapprovers : [];
  const eligibleApprovers = eligibleApproversRaw
    .map((item) => toRecord(item))
    .map((approver) => {
      const name = readString(approver.name);
      const email = readString(approver.email);
      if (name && email) return `${name} (${email})`;
      return name || email;
    })
    .filter(Boolean);

  if (eligibleApprovers.length === 0) return "";
  return "Eligible approvers listed below.";
};

const mapEligibleApprovers = (record: RawHistoryRecord) => {
  const eligibleApproversRaw = Array.isArray(record.eligibleapprovers) ? record.eligibleapprovers : [];
  return eligibleApproversRaw
    .map((item) => toRecord(item))
    .map((approver) => ({
      name: readString(approver.name) || "Unknown",
      email: readString(approver.email) || "no-email@example.com",
    }))
    .filter((approver) => approver.name || approver.email);
};

const findNearestTimestamp = (records: RawHistoryRecord[], index: number) => {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidate = records[cursor];
    const createdAt =
      readString(candidate.createdAt) ||
      readString(candidate.initiatedAt) ||
      readString(candidate.initiatedDate) ||
      readString(candidate.requestedAt);
    if (createdAt) return createdAt;
  }

  for (let cursor = index + 1; cursor < records.length; cursor += 1) {
    const candidate = records[cursor];
    const createdAt =
      readString(candidate.createdAt) ||
      readString(candidate.initiatedAt) ||
      readString(candidate.initiatedDate) ||
      readString(candidate.requestedAt);
    if (createdAt) return createdAt;
  }

  return "";
};

const getEffectiveCreatedAt = (record: RawHistoryRecord, index: number, records: RawHistoryRecord[]) => {
  const createdAtRaw =
    readString(record.createdAt) ||
    readString(record.initiatedAt) ||
    readString(record.initiatedDate) ||
    readString(record.requestedAt);
  if (createdAtRaw) return createdAtRaw;
  const eligibleApprovers = mapEligibleApprovers(record);
  if (eligibleApprovers.length > 0) {
    return findNearestTimestamp(records, index);
  }
  return "";
};

const mapUserHistoryEntry = (
  record: RawHistoryRecord,
  fallbackEmail: string,
  index: number,
  records: RawHistoryRecord[],
): HistoryEntry => {
  const initiator = toRecord(record.user);
  const basicDetails = toRecord(record.basicDetails);
  const createdAt = getEffectiveCreatedAt(record, index, records);
  const actionRaw = readString(record.event) || readString(record.action) || readString(record.status);
  const action = actionRaw ? actionRaw.replace(/_/g, " ").toUpperCase() : "UPDATE";
  const eventPhrase = toEventPhrase(action);
  const targetEmail = readString(record.email) || fallbackEmail || "this user";
  const level = readLevel(record.level);
  const hasCreatedAt = Boolean(createdAt);
  const sortEpochMs = toEpochMs(createdAt);
  const { year, month, day, date, time } = formatDateParts(createdAt);

  const initiatorName =
    readString(initiator.name) ||
    readString(record.initiatorName) ||
    readString(record.requestedByName) ||
    readString(basicDetails.initiatorName) ||
    "System";
  const initiatorEmail =
    readString(initiator.email) ||
    readString(record.initiatorEmail) ||
    readString(record.requestedByEmail) ||
    readString(basicDetails.initiatorEmail) ||
    fallbackEmail ||
    "no-email@example.com";

  const normalizedAction = action.toLowerCase();
  const isPendingAction = normalizedAction.includes("initiate") || normalizedAction.includes("pending");
  const isApprovedAction = normalizedAction.includes("approve");
  const showActor = Boolean(readString(initiator.name) || readString(initiator.email));
  const eligibleApproversDetail = formatEligibleApproversDetail(record);
  const eligibleApprovers = mapEligibleApprovers(record);
  const remarks = readString(record.remarks);
  const defaultDetails =
    level !== null
      ? `Level ${level} ${eventPhrase} recorded for ${targetEmail}.`
      : `${eventPhrase.charAt(0).toUpperCase()}${eventPhrase.slice(1)} recorded for ${targetEmail}.`;

  return {
    id: [
      readString(record.id) || readString(record.userId) || readString(record.email) || "history",
      action,
      level ?? "na",
      createdAt || "no-ts",
      index,
    ].join("|"),
    sourceId:
      readString(record.id) ||
      readString(record.userId) ||
      readString(record.requestId) ||
      readString(record.email),
    sortEpochMs: Number.isFinite(sortEpochMs) ? sortEpochMs : undefined,
    year,
    month,
    day,
    action,
    details: eligibleApproversDetail || defaultDetails,
    remarks: remarks || undefined,
    timestampMissing: !hasCreatedAt,
    showActor,
    eligibleApprovers,
    initiator: {
      name: initiatorName,
      email: initiatorEmail,
      initials: getInitials(initiatorName),
      date,
      time,
    },
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

export default function UserHistorySidebar({
  isOpen,
  onClose,
  user,
  onOpenHistoryDetail,
  dockOffset,
  splitView = Boolean(dockOffset),
  panelWidth,
}: UserHistorySidebarProps) {
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const requestNewData = toRecord(user?.basicDetails?.requestNewData);
  const requestOldData = toRecord(user?.basicDetails?.requestOldData);
  const effectiveUserEmail =
    readString(user?.email) ||
    readString(user?.basicDetails?.email) ||
    readString(requestNewData.targetUserEmail) ||
    readString(requestOldData.targetUserEmail);

  useEffect(() => {
    if (!isOpen || !effectiveUserEmail) {
      setHistoryData([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const response = await fetchUserHistory(effectiveUserEmail);
        if (isMounted && response?.data) {
          const mappedHistory = Array.isArray(response.data)
            ? (() => {
              const rawRecords = response.data.map((item) => toRecord(item));
              const sortedRecords = rawRecords
                .map((record, index) => ({
                  record,
                  index,
                  effectiveCreatedAt: getEffectiveCreatedAt(record, index, rawRecords),
                  hasEligibleApprovers: mapEligibleApprovers(record).length > 0,
                }))
                .sort((left, right) => {
                  const leftTs = toEpochMs(left.effectiveCreatedAt);
                  const rightTs = toEpochMs(right.effectiveCreatedAt);
                  if (rightTs !== leftTs) return rightTs - leftTs;
                  if (left.hasEligibleApprovers !== right.hasEligibleApprovers) {
                    return left.hasEligibleApprovers ? -1 : 1;
                  }
                  return left.index - right.index;
                })
                .map((item) => item.record);

              return sortedRecords.map((record, index, records) => mapUserHistoryEntry(record, effectiveUserEmail, index, records));
            })()
            : [];
          setHistoryData(mappedHistory);
        }
      } catch (error) {
        const message = getApiErrorMessage(error, "Failed to fetch user history.");
        toast({ title: "Unable to load user history", description: message, variant: "destructive" });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [isOpen, effectiveUserEmail, toast]);

  const handleViewMore = async (entry: HistoryEntry) => {
    const sourceId = (entry.sourceId || entry.id).trim();
    if (!sourceId) return;

    try {
      const response = await fetchHistoryDetail({ id: sourceId, type: "user" });
      const detail = normalizeHistoryDetail(response);
      if (detail && onOpenHistoryDetail) {
        onOpenHistoryDetail(detail, sourceId);
      }
    } catch (error) {
      const message = getApiErrorMessage(error, "Failed to fetch history details.");
      toast({ title: "Unable to load history details", description: message, variant: "destructive" });
    }
  };

  return (
    <HistorySidebar
      isOpen={isOpen}
      onClose={onClose}
      title="User history"
      subtitle={user?.name || "Unknown User"}
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
