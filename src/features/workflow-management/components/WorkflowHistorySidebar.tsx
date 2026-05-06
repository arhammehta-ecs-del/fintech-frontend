import { useState, useEffect } from "react";
import HistorySidebar, { formatDateParts, getInitials, type HistoryEntry } from "@/components/HistorySidebar";
import { useToast } from "@/hooks/use-toast";
import type { WorkflowRecord } from "@/features/workflow-management/types/workflow.types";
import { getApiErrorMessage } from "@/services/client";
import { fetchWorkflowHistory } from "@/services/workflow.service";

export type WorkflowHistorySidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  workflow: WorkflowRecord | null;
};

type RawHistoryRecord = Record<string, unknown>;

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const toRecord = (value: unknown): RawHistoryRecord =>
  typeof value === "object" && value !== null ? (value as RawHistoryRecord) : {};

const mapWorkflowHistoryEntry = (item: unknown, workflowName: string, index: number): HistoryEntry => {
  const record = toRecord(item);
  const user = toRecord(record.user);

  const createdAt = readString(record.createdAt) || readString(record.initiatedAt) || readString(record.initiatedDate);
  const eventRaw = readString(record.event) || readString(record.action) || readString(record.status);
  const action = eventRaw ? eventRaw.replace(/_/g, " ").toUpperCase() : "UPDATE";
  const { year, month, day, date, time } = formatDateParts(createdAt);

  const initiatorName = readString(user.name) || readString(record.initiatorName) || "System";
  const initiatorEmail = readString(user.email) || readString(record.initiatorEmail) || "no-email@example.com";
  const normalizedAction = action.toLowerCase();
  const isPendingAction = normalizedAction.includes("initiate") || normalizedAction.includes("pending");
  const isApprovedAction = normalizedAction.includes("approve");

  return {
    id: readString(record.id) || readString(record.workflowId) || `${createdAt || "history"}-${index}`,
    year,
    month,
    day,
    action,
    details: `event recorded for ${workflowName || "this workflow"}.`,
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

export default function WorkflowHistorySidebar({ isOpen, onClose, workflow }: WorkflowHistorySidebarProps) {
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen || !workflow) {
      setHistoryData([]);
      return;
    }

    let isMounted = true;
    const loadHistory = async () => {
      try {
        const response = await fetchWorkflowHistory(workflow.id);
        if (isMounted && response?.data) {
          const mappedHistory = Array.isArray(response.data)
            ? response.data.map((item, index) => mapWorkflowHistoryEntry(item, workflow.name, index))
            : [];
          setHistoryData(mappedHistory);
        }
      } catch (error) {
        const message = getApiErrorMessage(error, "Failed to fetch workflow history.");
        toast({ title: "Unable to load workflow history", description: message, variant: "destructive" });
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [isOpen, workflow, toast]);

  return (
    <HistorySidebar
      isOpen={isOpen}
      onClose={onClose}
      title="Workflow Audit Trail"
      subtitle={workflow?.name || "Unknown Workflow"}
      data={historyData}
    />
  );
}
