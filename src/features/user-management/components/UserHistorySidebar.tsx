import { useState, useEffect } from "react";
import type { AppUser } from "@/contexts/AppContext";
import HistorySidebar, { type HistoryEntry } from "@/components/HistorySidebar";
import { normalizeHistoryDetail, type HistoryDetailPreviewEvent, type HistoryDetailViewModel } from "@/components/HistoryDetailDialog";
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
  onLatestHistoryEventChange?: (event: HistoryDetailPreviewEvent | null) => void;
  dockOffset?: {
    top: number;
    left: number;
  };
  splitView?: boolean;
  panelWidth?: number;
};

type RawHistoryRecord = Record<string, unknown>;
type ApprovalPerson = {
  name: string;
  email: string;
};

type ApprovalSectionItem = {
  label?: string;
  levelCount?: string | null;
  rule?: string | null;
  status?: string | null;
  people: ApprovalPerson[];
};
type ApprovalSection = NonNullable<HistoryEntry["approvalSections"]>[number];

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const toRecord = (value: unknown): RawHistoryRecord =>
  typeof value === "object" && value !== null ? (value as RawHistoryRecord) : {};
const toRecordArray = (value: unknown) => (Array.isArray(value) ? value.map((item) => toRecord(item)) : []);
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
const normalizeRule = (value: unknown) => {
  const rule = readString(value).toUpperCase();
  return rule === "AND" || rule === "OR" ? rule : null;
};
const readPersonName = (record: RawHistoryRecord) => {
  const directName = readString(record.name);
  if (directName) return directName;

  const fallbackNameEntry = Object.entries(record).find(([key, value]) => key.toLowerCase().startsWith("name") && readString(value));
  return fallbackNameEntry ? readString(fallbackNameEntry[1]) : "";
};
const sortByTimestampDesc = <T extends { approvedAtEpochMs: number }>(items: T[]) =>
  [...items].sort((left, right) => right.approvedAtEpochMs - left.approvedAtEpochMs);
const mapApprovalPeople = (value: unknown): ApprovalPerson[] => {
  const records = Array.isArray(value) ? value.map((item) => toRecord(item)) : [toRecord(value)];
  return records
    .map((person) => ({
      name: readPersonName(person) || "Unknown",
      email: readString(person.email) || "no-email@example.com",
    }))
    .filter((person) => Boolean(person.name || person.email));
};
const mapApprovalPeopleStrict = (value: unknown): ApprovalPerson[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toRecord(item))
    .map((person) => ({
      name: readPersonName(person) || "Unknown",
      email: readString(person.email) || "no-email@example.com",
    }))
    .filter((person) => Boolean(person.name || person.email));
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
  const eligibleApprovers = mapEligibleApprovers(record);

  if (eligibleApprovers.length === 0) return "";
  return "Eligible approvers listed below.";
};

const mapEligibleApprovers = (record: RawHistoryRecord) => {
  return mapApprovalPeopleStrict(record.eligibleapprovers);
};

const mapApprovalSectionItemsFromFlow = (record: RawHistoryRecord): ApprovalSectionItem[] => {
  const approvalFlow = toRecordArray(record.approvalFlow);
  return approvalFlow
    .map((flow) => {
      const level = readLevel(flow.level);
      const people = mapApprovalPeople(flow.approvedBy);
      if (people.length === 0) return null;

      return {
        label: level !== null ? `Level ${level}` : undefined,
        rule: normalizeRule(flow.rule),
        status: readString(flow.status) || null,
        people,
      };
    })
    .filter((item): item is ApprovalSectionItem => item !== null);
};

const mapApprovalSectionItemsFromApprovedBy = (record: RawHistoryRecord): ApprovalSectionItem[] =>
  toRecordArray(record.approvedBy)
    .map((group) => {
      const level = readLevel(group.level);
      const rule = normalizeRule(group.rule);
      const approvers = toRecordArray(group.approvedBy)
        .map((approver) => {
          const approvedAt = readString(approver.approvedAt);
          const { date, time } = formatDateParts(approvedAt);
          return {
            name: readPersonName(approver) || "Unknown",
            email: readString(approver.email) || "no-email@example.com",
            levelCount: readString(approver.levelCount),
            date: date || undefined,
            time: time || undefined,
            approvedAtEpochMs: toEpochMs(approvedAt),
          };
        })
        .filter((person) => Boolean(person.name || person.email));

      if (approvers.length === 0) return null;
      const sortedApprovers = rule === "AND" ? sortByTimestampDesc(approvers) : approvers;

      return {
        label: level !== null ? `Level ${level}` : undefined,
        levelCount: sortedApprovers[0]?.levelCount || null,
        rule,
        people: sortedApprovers.map((a) => ({ name: a.name, email: a.email, levelCount: a.levelCount, date: a.date, time: a.time })),
      };
    })
    .filter((item): item is ApprovalSectionItem => item !== null);

const buildApprovedSection = (items: ApprovalSectionItem[]): ApprovalSection | null =>
  items.length > 0
    ? {
        title: "Approved By",
        tone: "success",
        items,
      }
    : null;

const buildRejectedSection = (record: RawHistoryRecord): ApprovalSection | null => {
  const rejectedPeople = mapApprovalPeopleStrict(record.rejectedBy);
  const action = (readString(record.event) || readString(record.action) || readString(record.status)).toUpperCase();
  const isRejectedEvent = action.includes("REJECT");
  const rejectedLevel = readLevel(record.level);
  if (rejectedPeople.length === 0 && (!isRejectedEvent || rejectedLevel === null)) return null;
  if (rejectedPeople.length === 0) return null;

  return {
    title: "Rejected By",
    tone: "danger",
    items: [
      {
        label: rejectedLevel !== null ? `Level ${rejectedLevel}` : undefined,
        status: "REJECTED",
        people: rejectedPeople,
      },
    ],
  };
};

const mapApprovalSections = (record: RawHistoryRecord): HistoryEntry["approvalSections"] => {
  const flowItems = mapApprovalSectionItemsFromFlow(record);
  if (flowItems.length > 0) {
    const approvedItems = flowItems.filter((item) => (item.status || "").toUpperCase() !== "REJECTED");
    const rejectedItems = flowItems.filter((item) => (item.status || "").toUpperCase() === "REJECTED");
    const sections: ApprovalSection[] = [];
    const approvedSection = buildApprovedSection(approvedItems);
    if (approvedSection) sections.push(approvedSection);
    if (rejectedItems.length > 0) {
      sections.push({
        title: "Rejected By",
        tone: "danger",
        items: rejectedItems.map((item) => ({
          ...item,
          status: item.status || "REJECTED",
        })),
      });
    }
    return sections.length > 0 ? sections : undefined;
  }

  const approvedByItems = mapApprovalSectionItemsFromApprovedBy(record);
  const approvedSection = buildApprovedSection(approvedByItems);
  const rejectedSection = buildRejectedSection(record);

  const sections: ApprovalSection[] = [];
  if (approvedSection) sections.push(approvedSection);
  if (rejectedSection) sections.push(rejectedSection);

  return sections.length > 0 ? sections : undefined;
};

const formatApprovalSummaryDetail = (record: RawHistoryRecord, targetEmail: string) => {
  const approvalSummary = toRecord(record.approvalSummary);
  const totalLevels = readCount(approvalSummary.totalLevels);
  const completedLevels = readCount(approvalSummary.completedLevels);
  const currentStatus = readString(approvalSummary.currentStatus).toUpperCase();

  if (!totalLevels) return "";

  if (currentStatus === "APPROVED" && totalLevels > 1 && completedLevels >= totalLevels) {
    return `All ${totalLevels} levels approved for ${targetEmail}.`;
  }

  const statusLabel =
    currentStatus === "APPROVED"
      ? "Approval completed."
      : currentStatus === "REJECTED"
        ? "Approval stopped at the rejection stage."
        : "Approval progress recorded.";
  return `${statusLabel} ${completedLevels} of ${totalLevels} levels completed.`;
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

  // Derive timestamp from latest approvedAt when createdAt is missing
  const latestApprovedAt = toRecordArray(record.approvedBy).reduce<string>((latest, group) => {
    return toRecordArray(group.approvedBy).reduce<string>((groupLatest, approver) => {
      const approvedAt = readString(approver.approvedAt);
      if (approvedAt && (!groupLatest || new Date(approvedAt) > new Date(groupLatest))) {
        return approvedAt;
      }
      return groupLatest;
    }, latest);
  }, "");

  if (latestApprovedAt) return latestApprovedAt;

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
  const remarks = readString(record.remarks);
  const normalizedRemarks = remarks.toLowerCase();
  const isAutoGenerated = normalizedRemarks.includes("auto generated") || normalizedRemarks.includes("auto-generated");
  const isAutoDeleted = normalizedRemarks.includes("auto deleted") || normalizedRemarks.includes("auto-deleted");

  const actionRaw = readString(record.event) || readString(record.action) || readString(record.status);
  let action = actionRaw ? actionRaw.replace(/_/g, " ").toUpperCase() : "UPDATE";

  if (isAutoGenerated) {
    action = `${action} - AUTO GENERATE`;
  } else if (isAutoDeleted) {
    action = `${action} - AUTO DELETE`;
  }

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
  const isAutoEvent = isAutoGenerated || isAutoDeleted || normalizedAction.includes("auto generate") || normalizedAction.includes("auto delete");
  const showActor = Boolean(readString(initiator.name) || readString(initiator.email));
  const eligibleApproversDetail = formatEligibleApproversDetail(record);
  const eligibleApprovers = mapEligibleApprovers(record);
  const approvalSections = mapApprovalSections(record);
  const disableViewMore = isAutoEvent;
  const levelCount = readString(record.levelCount);
  const approvalSummaryDetail = formatApprovalSummaryDetail(record, targetEmail);
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
    disableViewMore,
    collapseToHeader: isAutoEvent,
    sortEpochMs: Number.isFinite(sortEpochMs) ? sortEpochMs : undefined,
    year,
    month,
    day,
    action,
    levelCount: levelCount || undefined,
    details: approvalSummaryDetail || eligibleApproversDetail || defaultDetails,
    remarks: remarks || undefined,
    timestampMissing: !hasCreatedAt,
    showActor,
    eligibleApprovers,
    approvalSections,
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
  onLatestHistoryEventChange,
  dockOffset,
  splitView = Boolean(dockOffset),
  panelWidth,
}: UserHistorySidebarProps) {
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeViewMoreSourceId, setActiveViewMoreSourceId] = useState<string | null>(null);
  const { toast } = useToast();
  const requestNewData = toRecord(user?.basicDetails?.requestNewData);
  const requestOldData = toRecord(user?.basicDetails?.requestOldData);
  const effectiveUserEmail =
    readString(user?.email) ||
    readString(user?.basicDetails?.email) ||
    readString(requestNewData.targetUserEmail) ||
    readString(requestOldData.targetUserEmail);

  useEffect(() => {
    if (!isOpen) {
      setActiveViewMoreSourceId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveViewMoreSourceId(null);
  }, [effectiveUserEmail]);

  useEffect(() => {
    if (!isOpen || !effectiveUserEmail) {
      setHistoryData([]);
      setIsLoading(false);
      onLatestHistoryEventChange?.(null);
      return;
    }

    let isMounted = true;
    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const rawHistoryData = (await fetchUserHistory(effectiveUserEmail))?.data;
        if (isMounted && rawHistoryData) {
          const mappedHistory = Array.isArray(rawHistoryData)
            ? (() => {
              const rawRecords = rawHistoryData.map((item) => toRecord(item));
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
        const message = getApiErrorMessage(error, "Failed to fetch user history.");
        toast({ title: "Unable to load user history", description: message, variant: "destructive" });
        onLatestHistoryEventChange?.(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [isOpen, effectiveUserEmail, onLatestHistoryEventChange, toast]);

  const handleViewMore = async (entry: HistoryEntry) => {
    const sourceId = (entry.sourceId || entry.id).trim();
    if (!sourceId) return;

    try {
      const response = await fetchHistoryDetail({ id: sourceId, type: "user" });
      const detail = normalizeHistoryDetail(response);
      if (detail && onOpenHistoryDetail) {
        setActiveViewMoreSourceId(sourceId);
        onOpenHistoryDetail(
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
      activeViewMoreSourceId={activeViewMoreSourceId}
    />
  );
}
