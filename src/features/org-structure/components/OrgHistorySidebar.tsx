import { useEffect, useState } from "react";
import HistorySidebar, { formatDateParts, getInitials, type HistoryEntry } from "@/components/HistorySidebar";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { fetchOrgHistory } from "@/services/org.service";

type OrgHistorySidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  companyCode: string;
  subtitle: string;
  nodeName?: string;
  nodePath?: string;
  dockOffset?: {
    top: number;
    left: number;
  };
  splitView?: boolean;
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

const mapOrgHistoryEntry = (
  record: RawHistoryRecord,
  subtitle: string,
  index: number,
  records: RawHistoryRecord[],
): HistoryEntry => {
  const user = toRecord(record.user);
  const createdAt = getEffectiveCreatedAt(record, index, records);
  const hasCreatedAt = Boolean(createdAt);
  const sortEpochMs = toEpochMs(createdAt);
  const eventRaw = readString(record.event) || readString(record.action) || readString(record.status);
  const rawAction = eventRaw ? eventRaw.replace(/_/g, " ").toUpperCase() : "UPDATE";
  const level = readLevel(record.level);
  const action = level !== null ? `LEVEL ${level} ${rawAction}` : rawAction;
  const { year, month, day, date, time } = formatDateParts(createdAt);

  const initiatorName =
    readString(user.name) ||
    readString(record.initiatorName) ||
    readString(record.requestedByName) ||
    "System";
  const initiatorEmail =
    readString(user.email) ||
    readString(record.initiatorEmail) ||
    readString(record.requestedByEmail) ||
    "no-email@example.com";
  const showActor = Boolean(readString(user.name) || readString(user.email));
  const nodeName = readString(record.newNodeName) || readString(record.nodeName);
  const parentNodeName = readString(record.parentNodeName);
  const normalizedAction = rawAction.toLowerCase();
  const isPendingAction = normalizedAction.includes("initiate") || normalizedAction.includes("pending");
  const isApprovedAction = normalizedAction.includes("approve");
  const eligibleApprovers = mapEligibleApprovers(record);
  const remarks = readString(record.remarks);
  const details = eligibleApprovers.length > 0
    ? "Eligible approvers listed below."
    : nodeName
      ? `event recorded for node ${nodeName} in ${parentNodeName || subtitle || "organisation structure"}.`
      : `event recorded for ${subtitle || "organisation structure"}.`;

  return {
    id: readString(record.id) || readString(record.requestId) || `${createdAt || "history"}-${index}`,
    sortEpochMs: Number.isFinite(sortEpochMs) ? sortEpochMs : undefined,
    year,
    month,
    day,
    action,
    details,
    remarks: remarks || undefined,
    timestampMissing: !hasCreatedAt,
    eligibleApprovers,
    initiator: {
      name: initiatorName,
      email: initiatorEmail,
      initials: getInitials(initiatorName),
      date,
      time,
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

export default function OrgHistorySidebar({
  isOpen,
  onClose,
  companyCode,
  subtitle,
  nodeName = "",
  nodePath = "",
  dockOffset,
  splitView = false,
}: OrgHistorySidebarProps) {
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen || !companyCode.trim()) {
      setHistoryData([]);
      return;
    }

    let isMounted = true;
    const loadHistory = async () => {
      try {
        const response = await fetchOrgHistory(
          companyCode.trim().toUpperCase(),
          (nodeName || subtitle).trim(),
          nodePath.trim(),
        );
        if (!isMounted) return;
        const mappedHistory = Array.isArray(response?.data)
          ? response.data
            .map((item: unknown) => toRecord(item))
            .map((record: RawHistoryRecord, index: number, records: RawHistoryRecord[]) => mapOrgHistoryEntry(record, subtitle, index, records))
          : [];
        setHistoryData(mappedHistory);
      } catch (error) {
        const message = getApiErrorMessage(error, "Failed to fetch org history.");
        toast({ title: "Unable to load org history", description: message, variant: "destructive" });
      }
    };

    void loadHistory();
    return () => {
      isMounted = false;
    };
  }, [isOpen, companyCode, subtitle, nodeName, nodePath, toast]);

  return (
    <HistorySidebar
      isOpen={isOpen}
      onClose={onClose}
      title="Org history"
      subtitle={subtitle || "Organisation Structure"}
      showSystemGenerated={false}
      data={historyData}
      dockOffset={dockOffset}
      splitView={splitView}
      closeOnOutsideClick
    />
  );
}
