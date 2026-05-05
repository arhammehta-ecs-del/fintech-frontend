import { useEffect, useState } from "react";
import HistorySidebar, { formatDateParts, getInitials, type HistoryEntry } from "@/components/HistorySidebar";
import { fetchOrgHistory } from "@/services/org.service";

type OrgHistorySidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  companyCode: string;
  subtitle: string;
};

type RawHistoryRecord = Record<string, unknown>;

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const toRecord = (value: unknown): RawHistoryRecord =>
  typeof value === "object" && value !== null ? (value as RawHistoryRecord) : {};

const mapOrgHistoryEntry = (item: unknown, subtitle: string, index: number): HistoryEntry => {
  const record = toRecord(item);
  const user = toRecord(record.user);
  const createdAt = readString(record.createdAt) || readString(record.initiatedAt) || readString(record.initiatedDate);
  const eventRaw = readString(record.event) || readString(record.action) || readString(record.status);
  const action = eventRaw ? eventRaw.replace(/_/g, " ").toUpperCase() : "UPDATE";
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
  const nodeName = readString(record.newNodeName) || readString(record.nodeName);
  const normalizedAction = action.toLowerCase();
  const isPendingAction = normalizedAction.includes("initiate") || normalizedAction.includes("pending");

  return {
    id: readString(record.id) || readString(record.requestId) || `${createdAt || "history"}-${index}`,
    year,
    month,
    day,
    action,
    details: nodeName
      ? `${action} event recorded for node ${nodeName} in ${subtitle || "organisation structure"}.`
      : `${action} event recorded for ${subtitle || "organisation structure"}.`,
    initiator: {
      name: initiatorName,
      email: initiatorEmail,
      initials: getInitials(initiatorName),
      date,
      time,
    },
    status: isPendingAction ? "pending" : "approved",
  };
};

export default function OrgHistorySidebar({ isOpen, onClose, companyCode, subtitle }: OrgHistorySidebarProps) {
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (!isOpen || !companyCode.trim()) {
      setHistoryData([]);
      return;
    }

    let isMounted = true;
    const loadHistory = async () => {
      try {
        const response = await fetchOrgHistory(companyCode.trim().toUpperCase());
        if (!isMounted) return;
        const mappedHistory = Array.isArray(response?.data)
          ? response.data.map((item: unknown, index: number) => mapOrgHistoryEntry(item, subtitle, index))
          : [];
        setHistoryData(mappedHistory);
      } catch (error) {
        console.error("Failed to fetch org history:", error);
      }
    };

    void loadHistory();
    return () => {
      isMounted = false;
    };
  }, [isOpen, companyCode, subtitle]);

  return (
    <HistorySidebar
      isOpen={isOpen}
      onClose={onClose}
      title="Org Audit Trail"
      subtitle={subtitle || "Organisation Structure"}
      data={historyData}
    />
  );
}

