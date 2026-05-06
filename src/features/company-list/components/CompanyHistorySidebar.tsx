import { useState, useEffect } from "react";
import type { Company } from "@/contexts/AppContext";
import HistorySidebar, { formatDateParts, getInitials, type HistoryEntry } from "@/components/HistorySidebar";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { fetchCompanyHistory } from "@/services/company.service";

type CompanyHistorySidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
};

type RawHistoryRecord = Record<string, unknown>;

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const toRecord = (value: unknown): RawHistoryRecord =>
  typeof value === "object" && value !== null ? (value as RawHistoryRecord) : {};

const mapCompanyHistoryEntry = (item: unknown, index: number): HistoryEntry => {
  const record = toRecord(item);
  const user = toRecord(record.user);
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
    readString(user.name) ||
    readString(record.initiatorName) ||
    readString(record.requestedByName) ||
    readString(basicDetails.initiatorName) ||
    "System";
  const initiatorEmail =
    readString(user.email) ||
    readString(record.initiatorEmail) ||
    readString(record.requestedByEmail) ||
    readString(basicDetails.initiatorEmail) ||
    "no-email@example.com";
  const companyCode = readString(record.companyCode) || readString(record.code);

  const normalizedAction = action.toLowerCase();
  const isPendingAction = normalizedAction.includes("initiate") || normalizedAction.includes("pending");
  const isApprovedAction = normalizedAction.includes("approve");

  return {
    id: readString(record.id) || companyCode || `${createdAt || "history"}-${index}`,
    year,
    month,
    day,
    action,
    details: `event recorded for ${companyCode || "this company"}.`,
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

export default function CompanyHistorySidebar({ isOpen, onClose, company }: CompanyHistorySidebarProps) {
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen || !company?.companyCode) {
      setHistoryData([]);
      return;
    }

    let isMounted = true;
    const loadHistory = async () => {
      try {
        const response = await fetchCompanyHistory(company.companyCode);
        if (isMounted && response?.data) {
          const mappedHistory = Array.isArray(response.data)
            ? response.data.map((item, index) => mapCompanyHistoryEntry(item, index))
            : [];
          setHistoryData(mappedHistory);
        }
      } catch (error) {
        const message = getApiErrorMessage(error, "Failed to fetch company history.");
        toast({ title: "Unable to load company history", description: message, variant: "destructive" });
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [isOpen, company, toast]);

  return (
    <HistorySidebar
      isOpen={isOpen}
      onClose={onClose}
      title="Audit Trail"
      subtitle={company?.companyName || "Unknown Entity"}
      data={historyData}
    />
  );
}
