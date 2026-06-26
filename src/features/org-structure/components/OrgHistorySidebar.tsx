import { useEffect, useState } from "react";
import HistorySidebar, { type HistoryEntry } from "@/components/HistorySidebar";
import { formatDateParts } from "@/lib/historyDate.utils";
import { getInitials } from "@/lib/userIdentity.utils";
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
  isPending?: boolean;
  parentNodePath?: string;
  dockOffset?: {
    top: number;
    left: number;
  };
  splitView?: boolean;
  closeOnOutsideClick?: boolean;
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
const readCount = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};
const toEpochMs = (value: unknown) => {
  const raw = readString(value);
  if (!raw) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
};
const formatApprovalSummaryDetail = (record: RawHistoryRecord, targetLabel: string) => {
  const approvalSummary = toRecord(record.approvalSummary);
  const totalLevels = readCount(approvalSummary.totalLevels);
  const completedLevels = readCount(approvalSummary.completedLevels);
  const currentStatus = readString(approvalSummary.currentStatus).toUpperCase();

  if (!totalLevels) return "";

  if (currentStatus === "APPROVED" && totalLevels > 1 && completedLevels >= totalLevels) {
    return `All ${totalLevels} levels approved for ${targetLabel}.`;
  }

  const statusLabel =
    currentStatus === "APPROVED"
      ? "Approval completed."
      : currentStatus === "REJECTED"
        ? "Approval stopped at the rejection stage."
        : "Approval progress recorded.";
  return `${statusLabel} ${completedLevels} of ${totalLevels} levels completed.`;
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

const formatAccessLabel = (value: string) =>
  value
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const mapImpactedAccessUsers = (record: RawHistoryRecord) => {
  const sources = [record, toRecord(record.impactSummary), toRecord(record.newData), toRecord(record.data)];

  for (const source of sources) {
    const nestedImpactSummary = toRecord(source.impactSummary);
    const userAccessRaw = Array.isArray(source.userAccess)
      ? source.userAccess
      : (Array.isArray(nestedImpactSummary.userAccess) ? nestedImpactSummary.userAccess : []);

    if (!Array.isArray(userAccessRaw) || userAccessRaw.length === 0) continue;

    const users = userAccessRaw
      .map((item) => toRecord(item))
      .map((user) => ({
        name: readString(user.name) || "Unknown",
        email: readString(user.email) || "no-email@example.com",
        badges: Object.entries(toRecord(user.access))
          .flatMap(([module, rawPermissions]) =>
            (Array.isArray(rawPermissions) ? rawPermissions : [])
              .map((permission) => (typeof permission === "string" ? permission.trim() : ""))
              .filter(Boolean)
              .map((permission) => `${formatAccessLabel(module)} ${formatAccessLabel(permission)}`),
          ),
      }))
      .filter((user) => user.name || user.email);

    if (users.length > 0) return users;
  }

  return [];
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
  const isAutoEvent = normalizedAction.includes("auto generate") || normalizedAction.includes("auto delete");
  const eligibleApprovers = mapEligibleApprovers(record);
  const impactedAccessUsers = mapImpactedAccessUsers(record);
  const disableViewMore = isAutoEvent;
  const remarks = readString(record.remarks);
  const levelCount = readString(record.levelCount);
  const targetNodeLabel = nodeName || subtitle || "organisation structure";
  const approvalSummaryDetail = formatApprovalSummaryDetail(record, targetNodeLabel);

  const approvedByLevels = (Array.isArray(record.approvedBy) ? record.approvedBy : [])
    .map((levelEntry: any) => ({
      level: readLevel(levelEntry.level),
      rule: readString(levelEntry.rule) || null,
      approvers: (Array.isArray(levelEntry.approvedBy) ? levelEntry.approvedBy : [])
        .map((approver: any) => ({
          name: readString(approver.name) || "Unknown",
          email: readString(approver.email) || "no-email@example.com",
          levelCount: readString(approver.levelCount),
          approvedAt: readString(approver.approvedAt),
        }))
        .filter((approver: any) => approver.name || approver.email),
    }))
    .filter((entry: any) => entry.level !== null && entry.approvers.length > 0)
    .sort((a: any, b: any) => (b.level ?? 0) - (a.level ?? 0));

  const details = approvalSummaryDetail || (
    eligibleApprovers.length > 0
      ? "Eligible approvers listed below."
      : nodeName
        ? `event recorded for node ${nodeName} in ${parentNodeName || subtitle || "organisation structure"}.`
        : `event recorded for ${subtitle || "organisation structure"}.`
  );
  const approvalSections = [
    ...(impactedAccessUsers.length > 0
      ? [{
          title: "Impacted User Access",
          tone: "warning" as const,
          items: impactedAccessUsers.map((user) => ({
            people: [{
              name: user.name,
              email: user.email,
              badges: user.badges,
            }],
          })),
        }]
      : []),
    ...(approvedByLevels.length > 0
      ? [{
          title: "Approved By",
          tone: "success" as const,
          items: approvedByLevels.map((entry: any) => ({
            label: `Level ${entry.level}`,
            levelCount: entry.approvers[0]?.levelCount || null,
            rule: entry.rule || null,
            status: null,
            people: entry.approvers.map((approver: any) => {
              const { date, time } = formatDateParts(approver.approvedAt || "");
              return {
                name: approver.name,
                email: approver.email,
                date: date || undefined,
                time: time || undefined,
              };
            }),
          })),
        }]
      : []),
  ];

  return {
    id: readString(record.id) || readString(record.requestId) || `${createdAt || "history"}-${index}`,
    sourceId: readString(record.id) || readString(record.requestId),
    disableViewMore,
    collapseToHeader: isAutoEvent,
    sortEpochMs: Number.isFinite(sortEpochMs) ? sortEpochMs : undefined,
    year,
    month,
    day,
    action,
    levelCount: levelCount || undefined,
    details,
    remarks: remarks || undefined,
    timestampMissing: !hasCreatedAt,
    eligibleApprovers: eligibleApprovers.length > 0 ? eligibleApprovers : undefined,
    approvalSections: approvalSections.length > 0 ? approvalSections : undefined,
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
  isPending = false,
  parentNodePath = "",
  dockOffset,
  splitView = false,
  closeOnOutsideClick = true,
}: OrgHistorySidebarProps) {
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const resolvedNodePath = nodePath.trim();
  const resolvedPendingParentNodePath = isPending
    ? (parentNodePath.trim() || resolvedNodePath)
    : "";

  useEffect(() => {
    if (!isOpen || !companyCode.trim()) {
      setHistoryData([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const response = await fetchOrgHistory(
          (nodeName || subtitle).trim(),
          resolvedNodePath,
          {
            isPending,
            parentNodePath: resolvedPendingParentNodePath,
          },
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
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadHistory();
    return () => {
      isMounted = false;
    };
  }, [isOpen, companyCode, subtitle, nodeName, resolvedNodePath, isPending, resolvedPendingParentNodePath, toast]);

  return (
    <HistorySidebar
      isOpen={isOpen}
      onClose={onClose}
      title="Org history"
      subtitle={subtitle || "Organisation Structure"}
      showSystemGenerated={false}
      data={historyData}
      isLoading={isLoading}
      dockOffset={dockOffset}
      splitView={splitView}
      closeOnOutsideClick={closeOnOutsideClick}
    />
  );
}
