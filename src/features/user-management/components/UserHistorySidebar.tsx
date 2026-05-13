import { useState, useEffect } from "react";
import type { AppUser } from "@/contexts/AppContext";
import HistorySidebar, { formatDateParts, getInitials, type HistoryEntry } from "@/components/HistorySidebar";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { fetchUserHistory } from "@/services/user.service";
import { useAppContext } from "@/contexts/AppContext";

type UserHistorySidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  user: AppUser | null;
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
  const eventPhrase = toEventPhrase(action);
  const targetEmail = readString(record.email) || fallbackEmail || "this user";
  const level = readLevel(record.level);
  const hasCreatedAt = Boolean(createdAt);
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
    id:
      readString(record.id) ||
      readString(record.userId) ||
      readString(record.email) ||
      `${createdAt || "history"}-${index}`,
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
  };
};

export default function UserHistorySidebar({
  isOpen,
  onClose,
  user,
  dockOffset,
  splitView = Boolean(dockOffset),
  panelWidth,
}: UserHistorySidebarProps) {
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const { currentUser } = useAppContext();
  const { toast } = useToast();

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
            ? [...response.data]
              .sort((left, right) => {
                const leftRecord = toRecord(left);
                const rightRecord = toRecord(right);
                const leftTs = Math.max(
                  toEpochMs(leftRecord.createdAt),
                  toEpochMs(leftRecord.initiatedAt),
                  toEpochMs(leftRecord.initiatedDate),
                  toEpochMs(leftRecord.requestedAt),
                );
                const rightTs = Math.max(
                  toEpochMs(rightRecord.createdAt),
                  toEpochMs(rightRecord.initiatedAt),
                  toEpochMs(rightRecord.initiatedDate),
                  toEpochMs(rightRecord.requestedAt),
                );
                return rightTs - leftTs;
              })
              .map((item, index) => mapUserHistoryEntry(item, user.email, index))
            : [];
          setHistoryData(mappedHistory);
        }
      } catch (error) {
        const message = getApiErrorMessage(error, "Failed to fetch user history.");
        toast({ title: "Unable to load user history", description: message, variant: "destructive" });
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [isOpen, user, currentUser, toast]);

  return (
    <HistorySidebar
      isOpen={isOpen}
      onClose={onClose}
      title="User history"
      subtitle={user?.name || "Unknown User"}
      showSystemGenerated={false}
      data={historyData}
      dockOffset={dockOffset}
      splitView={splitView}
      panelWidth={panelWidth}
    />
  );
}
