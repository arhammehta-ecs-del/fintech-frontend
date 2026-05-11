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

const mapOrgHistoryEntry = (item: unknown, subtitle: string, index: number): HistoryEntry => {
  const record = toRecord(item);
  const user = toRecord(record.user);
  const createdAt = readString(record.createdAt) || readString(record.initiatedAt) || readString(record.initiatedDate);
  const hasCreatedAt = Boolean(createdAt);
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
        );
        if (!isMounted) return;
        const mappedHistory = Array.isArray(response?.data)
          ? response.data.map((item: unknown, index: number) => mapOrgHistoryEntry(item, subtitle, index))
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
  }, [isOpen, companyCode, subtitle, nodeName, toast]);

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
    />
  );
}
