import { useState, useEffect } from "react";
import type { AppUser } from "@/contexts/AppContext";
import HistorySidebar, { formatDateParts, getInitials, type HistoryEntry } from "@/components/HistorySidebar";
import { fetchUserHistory } from "@/services/user.service";
import { useAppContext } from "@/contexts/AppContext";

type UserHistorySidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  user: AppUser | null;
};

type RawHistoryRecord = Record<string, unknown>;

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const toRecord = (value: unknown): RawHistoryRecord =>
  typeof value === "object" && value !== null ? (value as RawHistoryRecord) : {};

const mapUserHistoryEntry = (item: unknown, fallbackEmail: string, index: number): HistoryEntry => {
  const record = toRecord(item);
  const initiator = toRecord(record.user);
  const basicDetails = toRecord(record.basicDetails);

  const createdAt =
    readString(record.createdAt) ||
    readString(record.initiatedAt) ||
    readString(record.initiatedDate) ||
    readString(record.requestedAt);
  const actionRaw = readString(record.event) || readString(record.action) || readString(record.status);
  const action = actionRaw ? actionRaw.replace(/_/g, " ").toUpperCase() : "UPDATE";
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

  return {
    id:
      readString(record.id) ||
      readString(record.userId) ||
      readString(record.email) ||
      `${createdAt || "history"}-${index}`,
    year,
    month,
    day,
    action,
    details: `${action} event recorded for ${fallbackEmail || "this user"}.`,
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

export default function UserHistorySidebar({ isOpen, onClose, user }: UserHistorySidebarProps) {
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const { currentUser } = useAppContext();

  useEffect(() => {
    // History API expects companyCode; use authenticated user's companyCode.
    const targetCompanyCode = currentUser?.companyCode;

    if (!isOpen || !user?.email || !targetCompanyCode) {
      setHistoryData([]);
      return;
    }

    let isMounted = true;
    const loadHistory = async () => {
      try {
        const response = await fetchUserHistory(user.email, targetCompanyCode);
        if (isMounted && response?.data) {
          const mappedHistory = Array.isArray(response.data)
            ? response.data.map((item, index) => mapUserHistoryEntry(item, user.email, index))
            : [];
          setHistoryData(mappedHistory);
        }
      } catch (error) {
        console.error("Failed to fetch user history:", error);
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [isOpen, user, currentUser]);

  return (
    <HistorySidebar
      isOpen={isOpen}
      onClose={onClose}
      title="User Audit Trail"
      subtitle={user?.name || "Unknown User"}
      data={historyData}
    />
  );
}
