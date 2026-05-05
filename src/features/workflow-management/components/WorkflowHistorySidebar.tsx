import { useState, useEffect } from "react";
import HistorySidebar, { formatDateParts, getInitials, type HistoryEntry } from "@/components/HistorySidebar";
import type { WorkflowRecord } from "@/features/workflow-management/components/WorkflowManagementView";
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

  return {
    id: readString(record.id) || readString(record.workflowId) || `${createdAt || "history"}-${index}`,
    year,
    month,
    day,
    action,
    details: `${action} event recorded for ${workflowName || "this workflow"}.`,
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

export default function WorkflowHistorySidebar({ isOpen, onClose, workflow }: WorkflowHistorySidebarProps) {
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);

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
        console.error("Failed to fetch workflow history:", error);
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [isOpen, workflow]);

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
