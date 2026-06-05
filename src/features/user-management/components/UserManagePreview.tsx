import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ArrowLeftRight,
  ChevronRight,
  CircleX,
  IdCard,
  Mail,
  Maximize2,
  Minimize2,
  History,
  Clock,
  Pencil,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import type { AppUser } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getAvatarColor,
  getInitials,
} from "@/features/user-management/utils";
import { getPermissionActionLabelFromRoleName } from "@/features/user-management/roleLabels";
import {
  CATEGORY_ORDER,
  cleanDisplayValue,
  buildPreviewUserData,
  displayOrFallback,
  formatDesignation,
  formatToIst,
  getNodeBadgeClass,
  getNodeEdgeBorderClass,
  getUserStatusClass,
  getNodeHoverClass,
  groupByNode,
} from "@/features/user-management/components/UserManagePreview.utils";
import type { GroupedByNode } from "@/features/user-management/components/UserManagePreview.utils";
import { NodeAccessCard } from "@/features/user-management/components/UserManagePreview.NodeAccessCard";
import type { HistoryDetailViewModel } from "@/components/HistoryDetailDialog";

// ── Main component ─────────────────────────────────────────────────────────────

export function UserManagePreview({
  member,
  currentTab = "active",
  onApprovePending,
  onRejectPending,
  onToggleActiveStatus,
  onClose,
  onToggleHistory,
  onEdit,
  onDelete,
  showDeleteActions = false,
  deleteActionLabel = "Delete User",
  deleteWorkflow = "__none__",
  deleteWorkflowOptions = [],
  deleteRemark = "",
  deleteRemarkPlaceholder = "Enter remark",
  requireDeleteRemark = false,
  deleteRemarkError = "",
  onDeleteWorkflowChange,
  onDeleteRemarkChange,
  onConfirmDelete,
  onCancelDeleteActions,
  onRequestStatusToggle,
  isHistoryOpen = false,
  historyDetailOverride = null,
}: {
  member: AppUser;
  currentTab?: "active" | "pending" | "inactive";
  onApprovePending?: (member: AppUser, remark?: string) => void;
  onRejectPending?: (member: AppUser, remark?: string) => void;
  onToggleActiveStatus?: (member: AppUser, isActive: boolean) => void;
  onClose?: () => void;
  onToggleHistory?: () => void;
  onEdit?: (member: AppUser) => void;
  onDelete?: (member: AppUser) => void;
  showDeleteActions?: boolean;
  deleteActionLabel?: string;
  deleteWorkflow?: string;
  deleteWorkflowOptions?: Array<{ id: string; label: string }>;
  deleteRemark?: string;
  deleteRemarkPlaceholder?: string;
  requireDeleteRemark?: boolean;
  deleteRemarkError?: string;
  onDeleteWorkflowChange?: (value: string) => void;
  onDeleteRemarkChange?: (value: string) => void;
  onConfirmDelete?: (member: AppUser) => void;
  onCancelDeleteActions?: () => void;
  onRequestStatusToggle?: (member: AppUser, isActive: boolean) => void;
  isHistoryOpen?: boolean;
  historyDetailOverride?: HistoryDetailViewModel | null;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditTooltipOpen, setIsEditTooltipOpen] = useState(false);
  const [isHistoryTooltipOpen, setIsHistoryTooltipOpen] = useState(false);
  const [showPreviousData, setShowPreviousData] = useState(false);
  const [collapsedFocusedKey, setCollapsedFocusedKey] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<"approve" | "reject" | null>(null);
  const [pendingRemark, setPendingRemark] = useState("");
  const [remarkTouched, setRemarkTouched] = useState(false);
  const remarkCardRef = useRef<HTMLDivElement | null>(null);
  const remarkInputRef = useRef<HTMLTextAreaElement | null>(null);

  const toRecord = (value: unknown) =>
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const mapRequestAccessEntries = (
    source: unknown,
    accessType: "PRIMARY" | "SECONDARY",
  ): NonNullable<AppUser["accessDetails"]> => {
    if (!Array.isArray(source)) return [];
    return source
      .map((row) => toRecord(row))
      .map((row) => ({
        roleCategory: readString(row.roleCategory).toUpperCase(),
        roleSubCategory: readString(row.roleSubCategory),
        roleName: readString(row.roleName),
        nodeName: readString(row.nodeName),
        nodePath: readString(row.nodePath),
        nodeType: readString(row.nodeType),
        accessCategory: ((): "ALL_CHILD" | "IMMEDIATE_CHILD" | "NODE" | null => {
          const normalized = readString(row.accessCategory).toUpperCase();
          if (normalized === "ALL_CHILD" || normalized === "IMMEDIATE_CHILD" || normalized === "NODE") return normalized;
          return null;
        })(),
        accessType,
      }))
      .filter((row) => row.nodeName || row.nodePath);
  };
  type RequestAccessEntry = NonNullable<AppUser["accessDetails"]>[number] & { remove?: boolean };
  const mapRequestPermissionsEntries = (source: unknown): RequestAccessEntry[] => {
    if (!Array.isArray(source)) return [];
    return source
      .map((row) => toRecord(row))
      .map((row) => {
        const accessTypeRaw = readString(row.accessType).toUpperCase();
        const accessType: "PRIMARY" | "SECONDARY" = accessTypeRaw === "PRIMARY" ? "PRIMARY" : "SECONDARY";
        return {
          roleCategory: readString(row.roleCategory).toUpperCase(),
          roleSubCategory: readString(row.roleSubCategory),
          roleName: readString(row.roleName),
          nodeName: readString(row.nodeName),
          nodePath: readString(row.nodePath),
          nodeType: readString(row.nodeType),
          accessCategory: ((): "ALL_CHILD" | "IMMEDIATE_CHILD" | "NODE" | null => {
            const normalized = readString(row.accessCategory).toUpperCase();
            if (normalized === "ALL_CHILD" || normalized === "IMMEDIATE_CHILD" || normalized === "NODE") return normalized;
            return null;
          })(),
          accessType,
          remove: Boolean(row.remove),
        };
      })
      .filter((row) => row.nodeName || row.nodePath);
  };
  const toPermissionIdentityKey = (permission: RequestAccessEntry) =>
    [
      (permission.roleCategory || "").trim().toUpperCase(),
      (permission.roleSubCategory || "").trim(),
      (permission.roleName || "").trim(),
      (permission.nodePath || "").trim(),
      (permission.accessType || "").trim().toUpperCase(),
    ].join("|");
  const dedupePermissions = (items: RequestAccessEntry[]) =>
    Array.from(new Map(items.map((permission) => [toPermissionIdentityKey(permission), permission])).values());
  const filterOutPermissions = (items: RequestAccessEntry[], targets: RequestAccessEntry[]) => {
    if (targets.length === 0) return items;
    const targetKeys = new Set(targets.map((permission) => toPermissionIdentityKey(permission)));
    return items.filter((permission) => !targetKeys.has(toPermissionIdentityKey(permission)));
  };
  const replacePermissions = (items: RequestAccessEntry[], replacements: RequestAccessEntry[]) => {
    if (replacements.length === 0) return dedupePermissions(items);
    return dedupePermissions([
      ...filterOutPermissions(items, replacements),
      ...replacements,
    ]);
  };
  const mapPermissionDeltaEntries = (source: unknown) => {
    const record = toRecord(source);
    const added = mapRequestPermissionsEntries(record.added);
    const removed = mapRequestPermissionsEntries(record.removed);
    const updated = mapRequestPermissionsEntries(record.updated);
    return {
      added,
      removed,
      updated,
      hasStructuredDelta: added.length > 0 || removed.length > 0 || updated.length > 0,
    };
  };
  const applyPermissionDelta = (
    base: RequestAccessEntry[],
    delta: ReturnType<typeof mapPermissionDeltaEntries>,
  ) => {
    let next = dedupePermissions(base);
    next = filterOutPermissions(next, delta.removed);
    next = replacePermissions(next, delta.updated);
    next = dedupePermissions([...next, ...delta.added]);
    return next;
  };
  const reversePermissionDelta = (
    current: RequestAccessEntry[],
    delta: ReturnType<typeof mapPermissionDeltaEntries>,
  ) => {
    let previous = dedupePermissions(current);
    previous = filterOutPermissions(previous, delta.added);
    previous = replacePermissions(previous, delta.updated);
    previous = dedupePermissions([...previous, ...delta.removed]);
    return previous;
  };
  const splitAccessEntriesByType = (entries: RequestAccessEntry[]) => ({
    primary: entries.filter((entry) => entry.accessType === "PRIMARY"),
    secondary: entries.filter((entry) => entry.accessType !== "PRIMARY"),
  });
  const historyOldData = historyDetailOverride?.mode === "comparison" ? toRecord(historyDetailOverride.oldData) : {};
  const historyNewData =
    historyDetailOverride?.mode === "comparison"
      ? toRecord(historyDetailOverride.newData)
      : historyDetailOverride?.mode === "single"
        ? toRecord(historyDetailOverride.record)
        : {};
  const isHistoryPreviewActive = Boolean(historyDetailOverride);
  const requestType = isHistoryPreviewActive
    ? historyDetailOverride?.mode === "comparison"
      ? "UPDATE"
      : "INITIATE"
    : (member.basicDetails?.requestType || "").trim().toUpperCase();
  const requestOldData = isHistoryPreviewActive ? historyOldData : toRecord(member.basicDetails?.requestOldData);
  const requestNewData = isHistoryPreviewActive ? historyNewData : toRecord(member.basicDetails?.requestNewData);
  const requestOldBasicDetails = toRecord(requestOldData.basicDetails);
  const requestNewBasicDetails = toRecord(requestNewData.basicDetails);
  const isPendingMember = member.status === "Pending" || Boolean(member.isPending);
  const historyFallbackBasicDetails = isHistoryPreviewActive ? requestOldBasicDetails : {};
  const canShowPendingActions = isPendingMember && currentTab === "pending" && !isHistoryPreviewActive;
  const hasOwn = (record: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(record, key);
  const hasOldBasicField = (field: string) => hasOwn(requestOldBasicDetails, field);
  const hasAnyBasicField = (field: string) => hasOldBasicField(field) || hasOwn(requestNewBasicDetails, field);
  const canShowHistoryComparison =
    isHistoryPreviewActive &&
    historyDetailOverride?.mode === "comparison" &&
    (Object.keys(requestOldData).length > 0 || Object.keys(requestNewData).length > 0);
  const canTogglePreviousUpdated =
    requestType === "UPDATE" &&
    (canShowPendingActions || canShowHistoryComparison) &&
    (Object.keys(requestOldData).length > 0 || Object.keys(requestNewData).length > 0);
  const selectedRequestData = showPreviousData ? requestOldData : requestNewData;
  const selectedRequestBasicDetails = showPreviousData ? requestOldBasicDetails : requestNewBasicDetails;
  const readRequestedBasicValue = (field: string, fallback: unknown) => {
    if (hasOwn(selectedRequestBasicDetails, field)) {
      return readString(selectedRequestBasicDetails[field]).trim();
    }
    if (isHistoryPreviewActive && hasOwn(historyFallbackBasicDetails, field)) {
      return readString(historyFallbackBasicDetails[field]).trim();
    }
    return readString(fallback).trim();
  };
  const requestPrimaryAccess = mapRequestAccessEntries(selectedRequestData.primary, "PRIMARY");
  const requestSecondaryAccess = mapRequestAccessEntries(selectedRequestData.secondary, "SECONDARY");
  const requestPermissionsAccess = mapRequestPermissionsEntries(selectedRequestData.permissions);
  const requestPermissionsDelta = mapPermissionDeltaEntries(selectedRequestData.permissions);
  const requestPermissionsAccessByType = splitAccessEntriesByType(requestPermissionsAccess);
  const historyOldPermissionsAccess = mapRequestPermissionsEntries(historyOldData.permissions);
  const historyOldPermissionsAccessByType = splitAccessEntriesByType(historyOldPermissionsAccess);
  const historyNewPermissionsAccess = mapRequestPermissionsEntries(historyNewData.permissions);
  const historyNewPermissionsDelta = mapPermissionDeltaEntries(historyNewData.permissions);
  const historyNewPermissionsAccessByType = splitAccessEntriesByType(historyNewPermissionsAccess);
  const oldRequestPrimaryAccess = mapRequestAccessEntries(requestOldData.primary, "PRIMARY");
  const oldRequestSecondaryAccess = mapRequestAccessEntries(requestOldData.secondary, "SECONDARY");
  const oldRequestPermissionsAccess = mapRequestPermissionsEntries(requestOldData.permissions);
  const oldRequestPermissionsDelta = mapPermissionDeltaEntries(requestOldData.permissions);
  const oldRequestPermissionRemovedEntries = oldRequestPermissionsDelta.removed;
  const oldRequestPermissionUpdatedEntries = oldRequestPermissionsDelta.updated;
  const oldRequestPermissionDiffEntries =
    oldRequestPermissionsAccess.length > 0
      ? oldRequestPermissionsAccess
      : [...oldRequestPermissionRemovedEntries, ...oldRequestPermissionUpdatedEntries];
  const oldRequestPermissionDiffEntriesByType = splitAccessEntriesByType(oldRequestPermissionDiffEntries);
  const currentPrimaryAccess = (member.accessDetails ?? []).filter((permission) => permission.accessType === "PRIMARY") as RequestAccessEntry[];
  const currentSecondaryAccess = (member.accessDetails ?? []).filter((permission) => permission.accessType !== "PRIMARY") as RequestAccessEntry[];
  const currentAccessSnapshot = dedupePermissions((member.accessDetails as RequestAccessEntry[] | undefined) ?? []);
  const previousPermissionsFromStructuredPending =
    !canShowHistoryComparison && oldRequestPermissionsDelta.hasStructuredDelta
      ? reversePermissionDelta(currentAccessSnapshot, oldRequestPermissionsDelta)
      : [];
  const currentPermissionsFromStructuredHistory =
    canShowHistoryComparison && historyOldPermissionsAccess.length > 0 && historyNewPermissionsDelta.hasStructuredDelta
      ? applyPermissionDelta(historyOldPermissionsAccess, historyNewPermissionsDelta)
      : [];
  const previousAccessDetailsFromRequest: RequestAccessEntry[] =
    previousPermissionsFromStructuredPending.length > 0
      ? previousPermissionsFromStructuredPending
      : oldRequestPermissionDiffEntries.length > 0
      ? oldRequestPermissionDiffEntries
      : oldRequestPrimaryAccess.length > 0 || oldRequestSecondaryAccess.length > 0
        ? [...oldRequestPrimaryAccess, ...oldRequestSecondaryAccess]
        : [];
  const previousPrimaryAccess: RequestAccessEntry[] =
    canShowHistoryComparison && historyOldPermissionsAccessByType.primary.length > 0
      ? historyOldPermissionsAccessByType.primary
      : !canShowHistoryComparison && previousPermissionsFromStructuredPending.length > 0
        ? splitAccessEntriesByType(previousPermissionsFromStructuredPending).primary
      : oldRequestPrimaryAccess.length > 0
      ? oldRequestPrimaryAccess
      : oldRequestPermissionDiffEntriesByType.primary.length > 0
        ? oldRequestPermissionDiffEntriesByType.primary
        : currentPrimaryAccess;
  const previousSecondaryAccess: RequestAccessEntry[] =
    canShowHistoryComparison && historyOldPermissionsAccessByType.secondary.length > 0
      ? historyOldPermissionsAccessByType.secondary
      : !canShowHistoryComparison && previousPermissionsFromStructuredPending.length > 0
        ? splitAccessEntriesByType(previousPermissionsFromStructuredPending).secondary
      : previousAccessDetailsFromRequest.length > 0
      ? previousAccessDetailsFromRequest.filter((permission) => permission.accessType !== "PRIMARY")
      : currentSecondaryAccess;
  const toPermissionKey = (permission: RequestAccessEntry) =>
    [
      (permission.roleCategory || "").trim().toUpperCase(),
      (permission.roleSubCategory || "").trim(),
      (permission.roleName || "").trim(),
      (permission.nodePath || "").trim(),
      (permission.accessType || "").trim().toUpperCase(),
      (permission.accessCategory || "").trim().toUpperCase(),
    ].join("|");
  const removedPermissionKeys = new Set(
    requestPermissionsAccess.filter((permission) => permission.remove).map((permission) => toPermissionKey(permission)),
  );
  const addedRequestPermissions = requestPermissionsAccess.filter((permission) => !permission.remove);
  const mergePermissions = (items: RequestAccessEntry[]) =>
    Array.from(new Map(items.map((permission) => [toPermissionKey(permission), permission])).values());
  const hasPermissionDeltaEntries = requestPermissionsAccess.some((permission) => permission.remove) || requestPermissionsDelta.hasStructuredDelta;
  const effectivePrimaryAccess: RequestAccessEntry[] =
    canShowHistoryComparison && historyNewPermissionsAccessByType.primary.length > 0
      ? historyNewPermissionsAccessByType.primary
      : canShowHistoryComparison && currentPermissionsFromStructuredHistory.length > 0
        ? splitAccessEntriesByType(currentPermissionsFromStructuredHistory).primary
      : requestPrimaryAccess.length > 0
      ? requestPrimaryAccess
      : requestPermissionsAccessByType.primary.length > 0
        ? requestPermissionsAccessByType.primary
        : currentPrimaryAccess;
  const effectiveSecondaryAccess: RequestAccessEntry[] =
    canShowHistoryComparison && historyNewPermissionsAccessByType.secondary.length > 0
      ? historyNewPermissionsAccessByType.secondary
      : canShowHistoryComparison && currentPermissionsFromStructuredHistory.length > 0
        ? splitAccessEntriesByType(currentPermissionsFromStructuredHistory).secondary
      : !canShowHistoryComparison && oldRequestPermissionsDelta.hasStructuredDelta
        ? currentSecondaryAccess
      : requestType === "UPDATE" && hasPermissionDeltaEntries
      ? mergePermissions([
          ...previousSecondaryAccess.filter((permission) => !removedPermissionKeys.has(toPermissionKey(permission))),
          ...addedRequestPermissions,
        ])
      : requestPermissionsAccessByType.secondary.length > 0
        ? requestPermissionsAccessByType.secondary
        : requestPrimaryAccess.length > 0 || requestSecondaryAccess.length > 0
          ? requestSecondaryAccess
          : previousSecondaryAccess;
  const effectiveAccessDetails: RequestAccessEntry[] = [
    ...effectivePrimaryAccess,
    ...effectiveSecondaryAccess,
  ];
  const effectiveMember: AppUser = {
    ...member,
    basicDetails: {
      ...member.basicDetails,
      name: readRequestedBasicValue("name", member.basicDetails?.name),
      email: readRequestedBasicValue("email", member.basicDetails?.email),
      phone: readRequestedBasicValue("phone", member.basicDetails?.phone),
      designation: readRequestedBasicValue("designation", member.basicDetails?.designation),
      employeeId: readRequestedBasicValue("employeeId", member.basicDetails?.employeeId),
      reportingManagerName: readRequestedBasicValue("reportingManagerName", member.basicDetails?.reportingManagerName),
      reportingManagerEmail: readRequestedBasicValue("reportingManagerEmail", member.basicDetails?.reportingManagerEmail),
      reportingManager: readRequestedBasicValue("reportingManager", member.basicDetails?.reportingManager),
    },
    accessDetails: effectiveAccessDetails,
  };
  const { data: userData, rawReportingManagerEmail, rawReportingManagerName } = buildPreviewUserData(effectiveMember);
  const shouldShowEmployeeId = Boolean(userData.employeeId) || hasAnyBasicField("employeeId");

  const formattedDesignation = formatDesignation(userData.designation);
  const formattedDepartment = cleanDisplayValue(userData.department);
  const previousDesignationRaw = readString(requestOldBasicDetails.designation).trim();
  const previousDesignationLabel = previousDesignationRaw ? formatDesignation(previousDesignationRaw) : "";
  const previousReportingManager = readString(requestOldBasicDetails.reportingManagerName || requestOldBasicDetails.reportingManager).trim();
  const previousReportingManagerEmail = readString(
    requestOldBasicDetails.reportingManagerEmail || requestOldBasicDetails.reportingManager,
  ).trim();

  const initiatorName = member.basicDetails?.initiatorName || "";
  const initiatorEmail = member.basicDetails?.initiatorEmail || "";
  const initiatedOnRaw = member.basicDetails?.initiatedDate || "";
  const pendingWorkflowName = member.basicDetails?.workflowName || "";
  const pendingWorkflowAlias = member.basicDetails?.alias || "";
  const resolvedInitiatorName = initiatorName || "—";
  const resolvedInitiatorEmail = initiatorEmail || "—";
  const initiatedOn = formatToIst(initiatedOnRaw);

  const avatar = getAvatarColor(userData.name);

  const accessDetails = effectiveMember.accessDetails ?? [];
  const previousPrimaryByNode = groupByNode(previousPrimaryAccess);
  const previousSecondaryByNode = groupByNode(previousSecondaryAccess);
  const primaryItems = accessDetails.filter((a) => a.accessType === "PRIMARY");
  const secondaryItemsRaw = accessDetails.filter((a) => a.accessType !== "PRIMARY");
  const secondaryItems =
    secondaryItemsRaw.length > 0
      ? secondaryItemsRaw
      : [];

  const primaryByNode = groupByNode(primaryItems);
  const secondaryByNode = groupByNode(secondaryItems);
  const buildAccessEntries = (
    current: GroupedByNode,
    previous: GroupedByNode,
  ): Array<[string, GroupedByNode[string]]> => {
    const previousKeys = canTogglePreviousUpdated ? Object.keys(previous) : [];
    return Array.from(new Set([...Object.keys(current), ...previousKeys])).map((key) => {
      const currentGroup = current[key];
      const previousGroup = previous[key];
      return [
        key,
        currentGroup ?? {
          ...previousGroup,
          categories: {},
        },
      ];
    });
  };
  const serializeNodeCategories = (categories: GroupedByNode[string]["categories"]) =>
    JSON.stringify(
      Object.keys(categories)
        .sort()
        .reduce<Record<string, string[]>>((acc, categoryKey) => {
          acc[categoryKey] = (categories[categoryKey] ?? [])
            .map((entry) => [
              (entry.roleSubCategory || "").trim(),
              (entry.roleName || "").trim(),
              (entry.nodeType || "").trim(),
              ((entry.accessCategory || "NODE") ?? "NODE").toString().trim(),
            ].join("|"))
            .sort();
          return acc;
        }, {}),
    );
  const getNodeChangeState = (
    currentGroup: GroupedByNode[string] | undefined,
    previousGroup: GroupedByNode[string] | undefined,
  ): "unchanged" | "added" | "removed" | "changed" => {
    if (currentGroup && !previousGroup) return "added";
    if (!currentGroup && previousGroup) return "removed";
    if (!currentGroup || !previousGroup) return "unchanged";
    return serializeNodeCategories(currentGroup.categories) === serializeNodeCategories(previousGroup.categories)
      ? "unchanged"
      : "changed";
  };
  const primaryEntries = buildAccessEntries(primaryByNode, previousPrimaryByNode);
  const secondaryEntries = buildAccessEntries(secondaryByNode, previousSecondaryByNode);
  const globalAccessNode = primaryItems.find((item) => {
    const roleCategory = (item.roleCategory || "").trim().toUpperCase();
    const roleSubCategory = (item.roleSubCategory || "").trim().toUpperCase();
    const accessCategory = (item.accessCategory || "").trim().toUpperCase();
    return Boolean(roleCategory) && roleCategory === roleSubCategory && accessCategory === "ALL_CHILD";
  }) ?? null;
  const hasGlobalAccess = Boolean(globalAccessNode && (globalAccessNode.roleName || "").trim());
  const shouldShowGlobalManagerBadge =
    !rawReportingManagerName.trim() && !rawReportingManagerEmail.trim();
  const globalAccessScopeLabel = ((globalAccessNode?.accessCategory || "").trim().toUpperCase() === "ALL_CHILD"
    ? "All Child"
    : (globalAccessNode?.accessCategory || "").trim().toUpperCase() === "IMMEDIATE_CHILD"
      ? "Immediate Child"
      : "Node");
  const globalAccessTitle = (globalAccessNode?.roleName || "").trim();

  const isRemarkValid = Boolean(pendingRemark.trim());
  const showRemarkError = remarkTouched && !isRemarkValid;
  const isActive = member.status !== "Inactive";
  const showActiveToggle = member.status === "Active" || member.status === "Inactive";
  const isActionLocked = Boolean(member.isPending);
  const handleInactiveToggleClick = () => {
    if (isActionLocked) return;
    const targetActiveState = member.status === "Inactive";
    if (onRequestStatusToggle) {
      onRequestStatusToggle(member, targetActiveState);
      return;
    }
    onToggleActiveStatus?.(member, targetActiveState);
  };

  useEffect(() => {
    if (!pendingDecision) return;
    requestAnimationFrame(() => {
      remarkCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      remarkInputRef.current?.focus();
    });
  }, [pendingDecision]);

  useEffect(() => {
    const selectableKeys = [
      ...primaryEntries.map(([key]) => `p:${key}`),
      ...secondaryEntries.map(([key]) => `s:${key}`),
    ];
    if (selectableKeys.length === 0 || (collapsedFocusedKey && !selectableKeys.includes(collapsedFocusedKey))) {
      setCollapsedFocusedKey(null);
    }
  }, [collapsedFocusedKey, primaryEntries, secondaryEntries]);
  useEffect(() => {
    if (!canTogglePreviousUpdated) {
      setShowPreviousData(false);
    }
  }, [canTogglePreviousUpdated]);

  const handleStartPendingAction = (action: "approve" | "reject") => {
    setPendingDecision(action);
    setRemarkTouched(false);
  };

  const handleSubmitPendingAction = (action: "approve" | "reject") => {
    setRemarkTouched(true);
    if (!isRemarkValid) return;

    if (action === "approve") {
      onApprovePending?.(member, pendingRemark.trim());
      return;
    }
    onRejectPending?.(member, pendingRemark.trim());
  };

  const handleCloseRemark = () => {
    setPendingDecision(null);
    setPendingRemark("");
    setRemarkTouched(false);
  };

  const statusCls = getUserStatusClass(member.status);
  const normalizedRequestType = requestType;
  const normalizedRequestImpact = readString(member.basicDetails?.requestImpact).toUpperCase();
  const normalizedRequestStatus = readString(requestNewBasicDetails.status).toUpperCase();
  const isPendingUpdateRequest = canShowPendingActions && normalizedRequestType === "UPDATE";
  const isPendingInactiveRequest =
    canShowPendingActions && (normalizedRequestType === "INACTIVE" || normalizedRequestStatus === "INACTIVE");
  const isPendingActiveRequest =
    canShowPendingActions && (normalizedRequestType === "ACTIVE" || normalizedRequestStatus === "ACTIVE");
  const pendingApprovalLabel = isPendingUpdateRequest
    ? "Edit Request Approval"
    : isPendingInactiveRequest
      ? "Deactivation Approval"
      : isPendingActiveRequest
        ? "Activation Approval"
        : "";
  const hiddenImpactTokens = new Set(["", "NO_ISSUES", "NO ISSUES", "NONE", "NA", "N/A"]);
  const formattedImpactLabel = hiddenImpactTokens.has(normalizedRequestImpact)
    ? ""
    : normalizedRequestImpact
      .split("_")
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" ");
  const approvalImpactLabel = pendingApprovalLabel
    ? formattedImpactLabel
      ? `${pendingApprovalLabel} - ${formattedImpactLabel}`
      : pendingApprovalLabel
    : "";
  const statusBadgeLabel = approvalImpactLabel || pendingApprovalLabel || (member.status || "Active");
  const shouldShowStatusBadge = Boolean(approvalImpactLabel || pendingApprovalLabel) || statusBadgeLabel.trim().toUpperCase() !== "PENDING";
  const statusBadgeClassName = pendingApprovalLabel
    ? "border-amber-200 bg-amber-100 text-amber-700"
    : statusCls;
  const impactBadgeMap: Record<string, string> = {
    ARCHIVE: "border-rose-200 bg-rose-100 text-rose-700",
    INACTIVE: "border-amber-200 bg-amber-100 text-amber-700",
    ACTIVE: "border-emerald-200 bg-emerald-100 text-emerald-700",
    DOWNGRADE: "border-rose-200 bg-rose-100 text-rose-700",
    UPGRADE: "border-emerald-200 bg-emerald-100 text-emerald-700",
    RMUPDATED: "border-sky-200 bg-sky-100 text-sky-700",
    PROFILE_UPDATE: "border-sky-200 bg-sky-100 text-sky-700",
  };
  const impactBadgeCls = impactBadgeMap[normalizedRequestImpact] || "";
  const renderDiffValue = (nextValue: string, prevValue: string, highlightAdded = false) => {
    const next = (nextValue || "-").trim() || "-";
    const prev = (prevValue || "").trim();
    if (!prev && highlightAdded && next !== "-") {
      return (
        <span className="font-semibold text-slate-900">
          <span className="rounded border border-emerald-100 bg-emerald-50 px-1 py-0.5 text-emerald-700">{next}</span>
        </span>
      );
    }
    if (!prev || prev === next) return <span className="font-semibold text-slate-900">{next}</span>;
    return (
      <span className="font-semibold text-slate-900">
        <span className="rounded border border-rose-100 bg-rose-50 px-1 py-0.5 text-rose-600 line-through">{prev}</span>
        <span className="px-1 text-slate-400">→</span>
        <span className="rounded border border-emerald-100 bg-emerald-50 px-1 py-0.5 text-emerald-700">{next}</span>
      </span>
    );
  };
  const historyPreviewEvent = historyDetailOverride?.previewEvent;
  const getHistoryEventTone = (action: string, fallbackStatus?: "pending" | "approved") => {
    const normalized = action.trim().toLowerCase();
    if (normalized.includes("reject")) return "rejected" as const;
    if (normalized.includes("inactive") || normalized.includes("deactivate")) return "inactive" as const;
    if (
      normalized.includes("modify") ||
      normalized.includes("update") ||
      normalized.includes("updated") ||
      normalized.includes("rmupdated") ||
      normalized.includes("profile update") ||
      normalized.includes("workflow update")
    ) {
      return "modified" as const;
    }
    if (normalized.includes("initiate")) return "initiation" as const;
    if (normalized.includes("pending")) return "pending" as const;
    if (normalized.includes("approve") || normalized.includes("active")) return "approved" as const;
    return fallbackStatus === "pending" ? "pending" : "approved";
  };
  const historyEventTone = historyPreviewEvent ? getHistoryEventTone(historyPreviewEvent.action, historyPreviewEvent.status) : null;
  const historyEventStripClassName =
    historyEventTone === "pending"
      ? "border-amber-200/50 bg-amber-50 text-amber-700"
      : historyEventTone === "initiation"
        ? "border-sky-200/60 bg-sky-50 text-sky-700"
      : historyEventTone === "modified"
        ? "border-orange-200/60 bg-orange-50 text-orange-700"
      : historyEventTone === "rejected"
        ? "border-rose-200/50 bg-rose-50 text-rose-700"
        : historyEventTone === "inactive"
          ? "border-slate-300/70 bg-slate-100 text-slate-700"
          : "border-emerald-200/50 bg-emerald-50 text-emerald-700";
  const HistoryEventIcon = historyEventTone === "pending"
    ? Clock
    : historyEventTone === "initiation" || historyEventTone === "modified"
      ? History
      : historyEventTone === "rejected"
        ? CircleX
        : ShieldCheck;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-slate-200 px-6 pt-6 pb-0">
        {/* Name + avatar row — no EDIT here so it doesn't clash with dialog X */}
        <div className="flex items-start justify-between gap-4 pr-8">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ring-1 ring-slate-200/80 shadow-sm", avatar.bg, avatar.text)}>
              {getInitials(userData.name)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">{userData.name}</h2>
                {historyPreviewEvent ? (
                  <span className={cn("inline-flex items-center gap-1.5 rounded border px-2 py-1", historyEventStripClassName)}>
                    <HistoryEventIcon className="h-3 w-3" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">{historyPreviewEvent.action}</span>
                    {historyPreviewEvent.levelCount ? (
                      <span className={cn("inline-flex h-4 min-w-4 items-center justify-center rounded-sm border px-1 text-[9px] font-bold leading-none", historyEventStripClassName)}>
                        {historyPreviewEvent.levelCount}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {shouldShowStatusBadge ? (
                  <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider", statusBadgeClassName)}>
                    {statusBadgeLabel}
                  </span>
                ) : null}
                {canShowHistoryComparison ? (
                  <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-sky-700">
                    History Comparison
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">{formattedDesignation}</span>
                {formattedDesignation !== "Not available" && formattedDepartment && (
                  <span className="text-slate-300">•</span>
                )}
                {formattedDepartment ? <span className="text-xs font-medium text-slate-500">{formattedDepartment}</span> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2.5">
            <div className="flex items-center gap-2">
              {onEdit && member.status !== "Pending" && member.status !== "Inactive" ? (
                <TooltipProvider delayDuration={120}>
                  <Tooltip open={isEditTooltipOpen}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={isActionLocked}
                        onClick={() => {
                          if (isActionLocked) return;
                          onEdit(member);
                        }}
                        onMouseEnter={() => setIsEditTooltipOpen(true)}
                        onMouseLeave={() => setIsEditTooltipOpen(false)}
                        onFocus={() => setIsEditTooltipOpen(false)}
                        onBlur={() => setIsEditTooltipOpen(false)}
                        className={cn(
                          "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700",
                          "disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-40",
                        )}
                        aria-label="Edit user"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Edit</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              {onDelete && member.status !== "Pending" ? (
                <button
                  type="button"
                  disabled={isActionLocked}
                  onClick={() => {
                    if (isActionLocked) return;
                    onDelete(member);
                  }}
                  className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700",
                    "disabled:cursor-not-allowed disabled:border-rose-200 disabled:bg-rose-50 disabled:text-rose-300 disabled:opacity-40",
                  )}
                  aria-label="Delete user"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
              {impactBadgeCls && !pendingApprovalLabel ? (
                <span
                  className={cn(
                    "inline-flex h-10 items-center rounded-xl border px-3 text-xs font-bold uppercase tracking-wide",
                    impactBadgeCls,
                  )}
                >
                  {formattedImpactLabel || normalizedRequestImpact}
                </span>
              ) : null}
              {onToggleHistory ? (
                <TooltipProvider delayDuration={120}>
                  <Tooltip open={isHistoryTooltipOpen}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={onToggleHistory}
                        onMouseEnter={() => setIsHistoryTooltipOpen(true)}
                        onMouseLeave={() => setIsHistoryTooltipOpen(false)}
                        onFocus={() => setIsHistoryTooltipOpen(false)}
                        onBlur={() => setIsHistoryTooltipOpen(false)}
                        className={cn(
                          "inline-flex h-10 w-10 items-center justify-center rounded-xl border transition",
                          isHistoryOpen
                            ? "border-[rgb(53,83,233)] bg-[rgb(53,83,233)] text-white shadow-[0_4px_12px_rgba(53,83,233,0.24)]"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700",
                        )}
                        aria-label={isHistoryOpen ? "Close history sidebar" : "Open history sidebar"}
                        aria-pressed={isHistoryOpen}
                      >
                        <History className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">User History</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                  aria-label="Close user preview"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {showActiveToggle ? (
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm">
                <button
                  type="button"
                  disabled={isActionLocked}
                  onClick={() => {
                    if (isActionLocked) return;
                    return onRequestStatusToggle ? onRequestStatusToggle(member, true) : onToggleActiveStatus?.(member, true);
                  }}
                  className={cn(
                    "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-[#3b5bdb] text-white shadow-[0_4px_12px_rgba(59,91,219,0.35)]"
                      : "text-slate-500 hover:text-slate-700",
                    "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-40",
                  )}
                  aria-pressed={isActive}
                >
                  Active
                </button>
                <button
                  type="button"
                  disabled={isActionLocked}
                  onClick={handleInactiveToggleClick}
                  className={cn(
                    "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
                    !isActive
                      ? "bg-[#3b5bdb] text-white shadow-[0_4px_12px_rgba(59,91,219,0.35)]"
                      : "text-slate-500 hover:text-slate-700",
                    "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-40",
                  )}
                  aria-pressed={!isActive}
                >
                  Inactive
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {canShowPendingActions ? (
          <div className="mb-4 mt-3 rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                <UserCheck size={12} className="text-slate-400" />
                <span className="text-slate-500">By</span>
                <span className="font-medium text-slate-700">{resolvedInitiatorName}</span>
              </span>
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                <Mail size={12} className="text-slate-400" />
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-slate-700 truncate">{resolvedInitiatorEmail}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                <Calendar size={12} className="text-slate-400" />
                <span className="text-slate-500">Initiated</span>
                <span className="font-medium text-slate-700">{initiatedOn || "—"}</span>
              </span>
              {pendingWorkflowName.trim() ? (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                  <span className="text-slate-500">Workflow</span>
                  <span className="font-medium text-slate-700 truncate">{pendingWorkflowName}</span>
                </span>
              ) : null}
              {pendingWorkflowAlias.trim() ? (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                  <span className="text-slate-500">Alias</span>
                  <span className="font-medium text-slate-700 truncate">{pendingWorkflowAlias}</span>
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-2" />
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-[13px] font-black uppercase tracking-[0.18em] text-slate-500">Access Rights</span>
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-[rgb(53,83,233)] hover:text-[rgb(53,83,233)]"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>
            {/* Toggle button */}
            {isExpanded ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-indigo-200 bg-[#DDE6FF] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                  <div
                    className={cn(
                      "grid items-stretch grid-cols-1 gap-3",
                      hasGlobalAccess
                        ? "xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)]"
                        : "xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]",
                    )}
                  >
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/70">
                      <div className="mb-3 border-b border-slate-200 pb-2">
                        <span className="text-[12px] font-black uppercase tracking-widest text-slate-600">Basic Details</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-[136px_10px_1fr] items-center gap-x-2">
                          <span className="text-slate-500">Name</span>
                          <span className="text-slate-400">:</span>
                          {renderDiffValue(userData.name || "-", readString(requestOldBasicDetails.name), hasOldBasicField("name"))}
                        </div>
                        <div className="grid grid-cols-[136px_10px_1fr] items-center gap-x-2">
                          <span className="text-slate-500">Email</span>
                          <span className="text-slate-400">:</span>
                          <span className="break-all font-semibold text-slate-900">{userData.email || "-"}</span>
                        </div>
                        <div className="grid grid-cols-[136px_10px_1fr] items-center gap-x-2">
                          <span className="text-slate-500">Phone</span>
                          <span className="text-slate-400">:</span>
                          <span className="font-semibold text-slate-900">{userData.phone || "-"}</span>
                        </div>
                        <div className="grid grid-cols-[136px_10px_1fr] items-center gap-x-2">
                          <span className="text-slate-500">Onboarding Date</span>
                          <span className="text-slate-400">:</span>
                          <span className="font-semibold text-slate-900">{userData.joiningDate || "-"}</span>
                        </div>
                        <div className="grid grid-cols-[136px_10px_1fr] items-center gap-x-2">
                          <span className="text-slate-500">Designation</span>
                          <span className="text-slate-400">:</span>
                          {renderDiffValue(formattedDesignation || "-", previousDesignationLabel, hasOldBasicField("designation"))}
                        </div>
                        {shouldShowEmployeeId ? (
                          <div className="grid grid-cols-[136px_10px_1fr] items-center gap-x-2">
                            <span className="text-slate-500">Employee ID</span>
                            <span className="text-slate-400">:</span>
                            {canTogglePreviousUpdated
                              ? renderDiffValue(userData.employeeId || "-", readString(requestOldBasicDetails.employeeId), hasOldBasicField("employeeId"))
                              : <span className="font-semibold text-slate-900">{userData.employeeId || "-"}</span>}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {hasGlobalAccess ? (
                      <div className="flex h-full min-h-[262px] flex-col rounded-xl border border-emerald-200 bg-white p-3.5 shadow-sm ring-1 ring-emerald-100/70">
                        <div className="flex flex-1 flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
                          <span className="inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-emerald-700 shadow-[0_10px_24px_rgba(16,185,129,0.18)]">
                            <ShieldCheck className="h-9 w-9" />
                          </span>
                          <span className="text-sm font-extrabold uppercase tracking-[0.12em] text-emerald-700">
                            {globalAccessTitle}
                          </span>
                          {globalAccessNode ? (
                            <div className="rounded-lg border border-emerald-200 bg-white/70 p-3 text-sm">
                              <div className="grid grid-cols-[110px_10px_1fr] items-center gap-x-2">
                                <span className="text-slate-500">Node Name</span>
                                <span className="text-slate-400">:</span>
                                <span className="font-semibold text-slate-900">{globalAccessNode.nodeName || "-"}</span>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-slate-500">Access Category</span>
                                <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold leading-none text-emerald-700">
                                  {globalAccessScopeLabel}
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[248px] flex-col space-y-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/70">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#4F46E5]" />
                          <span className="text-[12px] font-extrabold uppercase tracking-widest text-[#4F46E5]">Primary Access</span>
                        </div>
                        {primaryEntries.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-sm text-slate-400">
                            No primary access configured.
                          </div>
                        ) : (
                          primaryEntries.map(([key, group], idx) => {
                            const changeState = getNodeChangeState(primaryByNode[key], previousPrimaryByNode[key]);
                            return (
                              <NodeAccessCard
                                key={key}
                                nodeName={group.nodeName}
                                parentSubtitle={group.parentSubtitle}
                                nodeIndex={idx}
                                categories={group.categories}
                                previousCategories={previousPrimaryByNode[key]?.categories ?? {}}
                                changeState={changeState}
                                isPrimary
                              />
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {!shouldShowGlobalManagerBadge ? (
                    <div className="mt-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100/70">
                      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 lg:gap-6 lg:whitespace-nowrap">
                        <div className="flex min-w-0 items-center gap-1">
                          <span className="shrink-0 whitespace-nowrap text-slate-500">Reporting Manager</span>
                          <span className="shrink-0 text-slate-400">:</span>
                          <span className="min-w-0 truncate">
                            {canTogglePreviousUpdated
                              ? renderDiffValue(userData.reportingManager || "-", previousReportingManager, hasOldBasicField("reportingManager") || hasOldBasicField("reportingManagerName"))
                              : <span className="font-semibold text-slate-900">{userData.reportingManager || "-"}</span>}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-center gap-1">
                          <span className="shrink-0 whitespace-nowrap text-slate-500">Manager Email</span>
                          <span className="shrink-0 text-slate-400">:</span>
                          <span className="min-w-0 truncate">
                            {canTogglePreviousUpdated
                              ? renderDiffValue(
                                  userData.reportingManagerEmail || "-",
                                  previousReportingManagerEmail,
                                  hasOldBasicField("reportingManagerEmail") || hasOldBasicField("reportingManager"),
                                )
                              : <span className="font-semibold text-slate-900">{userData.reportingManagerEmail || "-"}</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {!hasGlobalAccess ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      <span className="text-[12px] font-black uppercase tracking-widest text-slate-500">Secondary Access</span>
                    </div>
                    {secondaryEntries.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-sm text-slate-400">
                        No secondary access assigned.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {secondaryEntries.map(([key, group], idx) => {
                          const changeState = getNodeChangeState(secondaryByNode[key], previousSecondaryByNode[key]);
                          return (
                            <NodeAccessCard
                              key={key}
                              nodeName={group.nodeName}
                              parentSubtitle={group.parentSubtitle}
                              nodeIndex={idx}
                              categories={group.categories}
                              previousCategories={previousSecondaryByNode[key]?.categories ?? {}}
                              changeState={changeState}
                              isPrimary={false}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              /* COLLAPSED — matches StepReviewSubmit collapsed style */
              <div className="space-y-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3.5">
                <div className="rounded-2xl border border-indigo-200 bg-[#DDE6FF] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100/70">
                    <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">Basic Details</span>
                      {hasGlobalAccess ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                          {globalAccessTitle}
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="grid grid-cols-[96px_10px_1fr] items-center gap-x-2">
                        <span className="text-slate-500">Name</span>
                        <span className="text-slate-400">:</span>
                        <span className="font-semibold text-slate-900">{userData.name || "-"}</span>
                      </div>
                      <div className="grid grid-cols-[96px_10px_1fr] items-center gap-x-2">
                        <span className="text-slate-500">Email</span>
                        <span className="text-slate-400">:</span>
                        <span className="truncate font-semibold text-slate-900">{userData.email || "-"}</span>
                      </div>
                      <div className="grid grid-cols-[96px_10px_1fr] items-center gap-x-2">
                        <span className="text-slate-500">Phone</span>
                        <span className="text-slate-400">:</span>
                        <span className="font-semibold text-slate-900">{userData.phone || "-"}</span>
                      </div>
                      <div className="grid grid-cols-[96px_10px_1fr] items-center gap-x-2">
                        <span className="text-slate-500">Designation</span>
                        <span className="text-slate-400">:</span>
                        <span className="font-semibold text-slate-900">{formattedDesignation || "-"}</span>
                      </div>
                      {shouldShowEmployeeId ? (
                        <div className="grid grid-cols-[96px_10px_1fr] items-center gap-x-2">
                          <span className="text-slate-500">Employee ID</span>
                          <span className="text-slate-400">:</span>
                          <span className="font-semibold text-slate-900">{userData.employeeId || "-"}</span>
                        </div>
                      ) : null}
                    </div>
                    {hasGlobalAccess && globalAccessNode ? (
                      <div className="mt-2.5 rounded-lg border border-emerald-200 bg-emerald-50/30 p-2.5 text-xs">
                        <div className="grid grid-cols-[92px_10px_1fr] items-center gap-x-2">
                          <span className="text-slate-500">Node Name</span>
                          <span className="text-slate-400">:</span>
                          <span className="font-semibold text-slate-900">{globalAccessNode.nodeName || "-"}</span>
                        </div>
                        <div className="mt-1.5 grid grid-cols-[92px_10px_1fr] items-center gap-x-2">
                          <span className="text-slate-500">Access Category</span>
                          <span className="text-slate-400">:</span>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-emerald-700">{globalAccessScopeLabel}</span>
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {!shouldShowGlobalManagerBadge ? (
                    <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100/70">
                      <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2 lg:gap-4 lg:whitespace-nowrap">
                        <div className="flex min-w-0 items-center gap-1">
                          <span className="shrink-0 whitespace-nowrap text-slate-500">Reporting Manager</span>
                          <span className="shrink-0 text-slate-400">:</span>
                          <span className="min-w-0 truncate">
                            {canTogglePreviousUpdated
                              ? renderDiffValue(userData.reportingManager || "-", previousReportingManager, hasOldBasicField("reportingManager") || hasOldBasicField("reportingManagerName"))
                              : <span className="font-semibold text-slate-900">{userData.reportingManager || "-"}</span>}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-center gap-1">
                          <span className="shrink-0 whitespace-nowrap text-slate-500">Manager Email</span>
                          <span className="shrink-0 text-slate-400">:</span>
                          <span className="min-w-0 truncate">
                            {canTogglePreviousUpdated
                              ? renderDiffValue(
                                  userData.reportingManagerEmail || "-",
                                  previousReportingManagerEmail,
                                  hasOldBasicField("reportingManagerEmail") || hasOldBasicField("reportingManager"),
                                )
                              : <span className="font-semibold text-slate-900">{userData.reportingManagerEmail || "-"}</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {!hasGlobalAccess ? (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-[12px] font-black uppercase tracking-widest text-blue-600">Primary Access</span>
                      </div>
                      {primaryEntries.length === 0 ? (
                        <div className="text-xs text-slate-400">No primary access configured.</div>
                      ) : (
                        primaryEntries.map(([key, group], idx) => {
                          const focused = collapsedFocusedKey === `p:${key}`;
                          const changeState = getNodeChangeState(primaryByNode[key], previousPrimaryByNode[key]);
                          const isRemovedNode = changeState === "removed";
                          const isAddedNode = changeState === "added";
                          const isChangedNode = changeState === "changed";
                          return (
                            <div key={key}>
                              {focused ? (
                                <NodeAccessCard
                                  nodeName={group.nodeName}
                                  parentSubtitle={group.parentSubtitle}
                                  nodeIndex={idx}
                                  categories={group.categories}
                                  previousCategories={previousPrimaryByNode[key]?.categories ?? {}}
                                  changeState={changeState}
                                  isPrimary
                                  onClose={() => setCollapsedFocusedKey(null)}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setCollapsedFocusedKey(`p:${key}`)}
                                  className={cn(
                                    "flex w-full items-center gap-3 rounded-md border border-l-[4px] border-slate-200 bg-white px-3 py-2.5 text-left transition-all duration-150 hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]",
                                    isRemovedNode
                                      ? "border-rose-300 bg-rose-50/70 opacity-75"
                                      : getNodeEdgeBorderClass(idx, true),
                                    getNodeHoverClass(idx, true),
                                    isRemovedNode && "border-dashed",
                                  )}
                                >
                                  <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", getNodeBadgeClass(idx, true))}>
                                    P{idx + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <div className={cn("truncate text-sm font-semibold text-slate-700", isRemovedNode && "text-slate-500 line-through")}>{group.nodeName}</div>
                                    {group.parentSubtitle ? <div className="truncate text-[11px] font-medium text-slate-500">{group.parentSubtitle}</div> : null}
                                  </div>
                                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>

                {!hasGlobalAccess ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      <span className="text-[12px] font-black uppercase tracking-widest text-slate-500">Secondary Access</span>
                    </div>
                    {secondaryEntries.length === 0 ? (
                      <div className="text-xs text-slate-400">No secondary access assigned.</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {secondaryEntries.map(([key, group], idx) => {
                          const focused = collapsedFocusedKey === `s:${key}`;
                          const changeState = getNodeChangeState(secondaryByNode[key], previousSecondaryByNode[key]);
                          const isRemovedNode = changeState === "removed";
                          const isAddedNode = changeState === "added";
                          const isChangedNode = changeState === "changed";
                          return (
                            <div key={key}>
                              {focused ? (
                                <NodeAccessCard
                                  nodeName={group.nodeName}
                                  parentSubtitle={group.parentSubtitle}
                                  nodeIndex={idx}
                                  categories={group.categories}
                                  previousCategories={previousSecondaryByNode[key]?.categories ?? {}}
                                  changeState={changeState}
                                  isPrimary={false}
                                  onClose={() => setCollapsedFocusedKey(null)}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setCollapsedFocusedKey(`s:${key}`)}
                                  className={cn(
                                    "flex w-full items-center gap-3 rounded-md border border-l-[4px] border-slate-200 bg-white px-3 py-2.5 text-left transition-all duration-150 hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]",
                                    isRemovedNode
                                      ? "border-rose-300 bg-rose-50/70 opacity-75"
                                      : getNodeEdgeBorderClass(idx, false),
                                    getNodeHoverClass(idx, false),
                                    isRemovedNode && "border-dashed",
                                  )}
                                >
                                  <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", getNodeBadgeClass(idx, false))}>
                                    S{idx + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <div className={cn("truncate text-sm font-semibold text-slate-700", isRemovedNode && "text-slate-500 line-through")}>{group.nodeName}</div>
                                    {group.parentSubtitle ? <div className="truncate text-[11px] font-medium text-slate-500">{group.parentSubtitle}</div> : null}
                                  </div>
                                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}

              </div>
            )}
          </div>

          {canShowPendingActions && pendingDecision ? (
            <div ref={remarkCardRef} className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {pendingDecision === "approve" ? "Approve Remark" : "Reject Remark"}
                </h4>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-slate-500">Remark is required before submitting this action.</p>
                  <div className="text-[11px] text-slate-500">{pendingRemark.length}/100</div>
                </div>
              </div>
              <Textarea
                ref={remarkInputRef}
                value={pendingRemark}
                onChange={(event) => setPendingRemark(event.target.value)}
                onBlur={() => setRemarkTouched(true)}
                maxLength={100}
                placeholder={`Enter remark for ${pendingDecision === "approve" ? "approval" : "rejection"}`}
                className="mt-3 min-h-[88px]"
              />
              {showRemarkError ? <p className="mt-2 text-xs text-rose-600">Please enter a remark.</p> : null}
            </div>
          ) : null}
        </div>
      </div>

      {canShowPendingActions ? (
        <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-end gap-3">
            {pendingDecision !== "approve" ? (
              <button
                type="button"
                className={cn(
                  "inline-flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition",
                  pendingDecision === "reject"
                    ? "border-[rgb(220,38,38)] bg-[rgb(220,38,38)] text-white hover:bg-[rgb(220,38,38)]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600",
                )}
                onClick={() =>
                  pendingDecision === "reject" ? handleSubmitPendingAction("reject") : handleStartPendingAction("reject")
                }
                disabled={pendingDecision === "reject" && !isRemarkValid}
              >
                Reject
              </button>
            ) : null}
            {pendingDecision ? (
              <button
                type="button"
                className="inline-flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                onClick={handleCloseRemark}
              >
                Close
              </button>
            ) : null}
            {pendingDecision !== "reject" ? (
              <button
                type="button"
                className={cn(
                  "inline-flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition",
                  pendingDecision === "approve"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-[rgb(53,83,233)] text-white shadow-sm hover:bg-[rgb(45,71,210)]",
                )}
                onClick={() =>
                  pendingDecision === "approve" ? handleSubmitPendingAction("approve") : handleStartPendingAction("approve")
                }
                disabled={pendingDecision === "approve" && !isRemarkValid}
              >
                Approve
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {member.status !== "Pending" && showDeleteActions ? (
        <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
          <div className="space-y-3">
            {requireDeleteRemark ? (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Remark <span className="text-rose-600">*</span>
                </label>
                <Textarea
                  value={deleteRemark}
                  onChange={(event) => onDeleteRemarkChange?.(event.target.value)}
                  placeholder={deleteRemarkPlaceholder}
                  className={cn("h-11 min-h-0 resize-none", deleteRemarkError ? "border-rose-500 focus-visible:ring-rose-500/30" : "")}
                />
                {deleteRemarkError ? <p className="text-xs text-rose-600">{deleteRemarkError}</p> : null}
              </div>
            ) : null}
            <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onCancelDeleteActions}>
              Cancel
            </Button>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Select value={deleteWorkflow} onValueChange={onDeleteWorkflowChange}>
                <SelectTrigger className="h-11 w-full min-w-[240px] border-[rgb(53,83,233)]/30 text-[rgb(53,83,233)] sm:w-[280px]">
                  <SelectValue placeholder="Select Workflow" />
                </SelectTrigger>
                <SelectContent side="top" align="end">
                  <SelectItem value="__none__">No Workflow</SelectItem>
                  {deleteWorkflowOptions.map((workflowOption) => (
                    <SelectItem key={workflowOption.id} value={workflowOption.id}>
                      {workflowOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                className="w-full bg-rose-600 text-white hover:bg-rose-700 sm:w-auto"
                onClick={() => onConfirmDelete?.(member)}
              >
                {deleteActionLabel}
              </Button>
            </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default UserManagePreview;
