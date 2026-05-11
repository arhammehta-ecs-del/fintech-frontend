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
  dockOffset?: {
    top: number;
    left: number;
  };
  splitView?: boolean;
  panelWidth?: number;
};

type RawHistoryRecord = Record<string, unknown>;

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const readLevel = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};
const toRecord = (value: unknown): RawHistoryRecord =>
  typeof value === "object" && value !== null ? (value as RawHistoryRecord) : {};

const getHistorySubject = (record: RawHistoryRecord, fallbackWorkflowName: string) => {
  const payload = toRecord(record.data);
  return (
    readString(record.requestName) ||
    readString(record.entityName) ||
    readString(record.name) ||
    readString(payload.requestName) ||
    readString(payload.entityName) ||
    readString(payload.name) ||
    fallbackWorkflowName ||
    "this workflow"
  );
};

const mapWorkflowHistoryEntry = (item: unknown, workflowName: string, index: number): HistoryEntry => {
  const record = toRecord(item);
  const user = toRecord(record.user);
  const level = readLevel(record.level);
  const subjectName = getHistorySubject(record, workflowName);

  const createdAt = readString(record.createdAt) || readString(record.initiatedAt) || readString(record.initiatedDate);
  const eventRaw = readString(record.event) || readString(record.action) || readString(record.status);
  const action = eventRaw ? eventRaw.replace(/_/g, " ").toUpperCase() : "UPDATE";
  const { year, month, day, date, time } = formatDateParts(createdAt);

  const initiatorName = readString(user.name) || readString(record.initiatorName) || "System";
  const initiatorEmail = readString(user.email) || readString(record.initiatorEmail) || "no-email@example.com";
  const showActor = Boolean(readString(user.name) || readString(user.email));
  const normalizedAction = action.toLowerCase();
  const isPendingAction = normalizedAction.includes("initiate") || normalizedAction.includes("pending");
  const isApprovedAction = normalizedAction.includes("approve");
  const remarks = readString(record.remarks);

  return {
    id: readString(record.id) || readString(record.workflowId) || `${createdAt || "history"}-${index}`,
    year,
    month,
    day,
    action,
    details: level !== null ? `Level ${level} ${action.toLowerCase()} for ${subjectName}.` : `Event recorded for ${subjectName}.`,
    remarks: remarks || undefined,
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

export default function WorkflowHistorySidebar({
  isOpen,
  onClose,
  workflow,
  dockOffset,
  splitView = Boolean(dockOffset),
  panelWidth,
}: WorkflowHistorySidebarProps) {
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
        const levelsHash = (workflow.levelsHash || workflow.id || "").trim();
        const module = workflow.rawModule?.trim() || workflow.module?.trim() || null;
        const subModule = workflow.subModule?.trim() || null;
        const nodePath = workflow.nodePath?.trim() || null;
        if (!levelsHash) {
          throw new Error("Workflow levels hash is missing");
        }
        const response = await fetchWorkflowHistory({ levelsHash, module, subModule, nodePath });
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
      title="Workflow history"
      subtitle={workflow?.name || "Unknown Workflow"}
      showSystemGenerated={false}
      data={historyData}
      dockOffset={dockOffset}
      splitView={splitView}
      panelWidth={panelWidth}
    />
  );
}
