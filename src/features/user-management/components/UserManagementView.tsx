import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EyeOff, Users, UserPlus } from "lucide-react";
import type { AppUser } from "@/contexts/AppContext";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { UserOnboardingDialog } from "@/features/user-management";
import EditMemberDialog from "@/features/user-management/components/EditMemberDialog";
import UserFilters from "@/features/user-management/components/UserFilters";
import UserPagination from "@/features/user-management/components/UserPagination";
import UserTable from "@/features/user-management/components/UserTable";
import { useUserManagement } from "@/features/user-management/hooks/useUserManagement";
import { UserManagePreview } from "./UserManagePreview";
import UserHistorySidebar from "./UserHistorySidebar";
import { RemarkDialog } from "@/components/RemarkDialog";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { fetchCompanyNodesWithAccess, fetchUserDetails, fetchUserFilterDropdowns } from "@/services/user.service";
import { useEditLockSession } from "@/hooks/useEditLockSession";
import EditLockWarningDialog from "@/components/EditLockWarningDialog";
import { useNotificationsPanelOpen } from "@/hooks/useNotificationsPanelOpen";
import type { HistoryDetailPreviewEvent, HistoryDetailViewModel } from "@/components/HistoryDetailDialog";
import { formatRoleTokenLabel } from "@/features/user-management/roleLabels";
// import { acquireEditLock } from "@/services/edit-lock.service";

const normalizeFilterIntentValue = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const getLockErrorMessage = (error: unknown, fallback: string) => {
  const rawMessage =
    typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.trim()
      : "";
  return rawMessage || getApiErrorMessage(error, fallback);
};

export function UserManagementView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const userLockSession = useEditLockSession();
  const lastNotificationKeyRef = useRef<string | null>(null);
  const notificationFetchKeyRef = useRef<string | null>(null);
  const {
    search,
    setSearch,
    searchSuggestions,
    designationFilters,
    setDesignationFilters,
    nodeTypeFilters,
    setNodeTypeFilters,
    accessCategoryFilters,
    setAccessCategoryFilters,
    accessSubcategoryFilters,
    setAccessSubcategoryFilters,
    departmentFilters,
    setDepartmentFilters,
    departmentFilterPaths,
    reportingManagerFilters,
    setReportingManagerFilters,
    statusFilters,
    setStatusFilters,
    statusFilterMode,
    roleFilters,
    setRoleFilters,
    nodeAccessType,
    setNodeAccessType,
    pendingActionFilter,
    setPendingActionFilter,
    onboardingDateRange,
    setOnboardingDateRange,
    onboardingDateFrom,
    setOnboardingDateFrom,
    onboardingDateTo,
    setOnboardingDateTo,
    sortOrder,
    setSortOrder,
    hasNewUserEvent,
    setHasNewUserEvent,
    hasLoadedUsersOnce,
    designationOptions,
    accessCategories,
    accessSubcategories,
    filterNodeOptions,
    nodeTypeOptions,
    reportingManagerOptions,
    clearAdvancedFilters,
    applyAdvancedFilters,
    loadFilterOptions,
    isLoading,
    isFilterLoading,
    activeMembers,
    currentMembers,
    inactiveMembers,
    pendingMembers,
    paginatedMembers,
    pageSize,
    setPageSize,
    safePage,
    totalPages,
    statusCounts,
    handlePrevPage,
    handleNextPage,
    handleJumpToPage,
    addDialogOpen,
    setAddDialogOpen,
    handleOpenAddUserDialog,
    viewingMember,
    setViewingMember,
    editingMember,
    setEditingMember,
    handleAddUser,
    handleActivateMember,
    handleDeactivateMember,
    handleSaveEdit,
    removeMember,
    executeUserStatusAction,
    statusTab,
    setStatusTab,
    statusHeading,
    remarkDialogOpen,
    setRemarkDialogOpen,
    pendingAction,
    processUserStatusAction,
    loadUsers,
    userStatusSummary,
    permissionSummary,
  } = useUserManagement();
  const [refreshInitializedAt, setRefreshInitializedAt] = useState<number | null>(null);
  const [historyOpenForMember, setHistoryOpenForMember] = useState(false);
  const [historyPreviewDetail, setHistoryPreviewDetail] = useState<HistoryDetailViewModel | null>(null);
  const [historyPreviewEvent, setHistoryPreviewEvent] = useState<HistoryDetailPreviewEvent | null>(null);
  const [isOpeningMemberPreview, setIsOpeningMemberPreview] = useState(false);
  const [isManagePreviewReady, setIsManagePreviewReady] = useState(false);
  const [onboardingSeedMember, setOnboardingSeedMember] = useState<AppUser | null>(null);
  const [showDeleteActions, setShowDeleteActions] = useState(false);
  const [deleteWorkflow, setDeleteWorkflow] = useState("__none__");
  const [deleteWorkflowOptions, setDeleteWorkflowOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [pendingManageActionType, setPendingManageActionType] = useState<"archive" | "active" | "inactive" | null>(null);
  const [manageActionRemark, setManageActionRemark] = useState("");
  const [manageActionRemarkError, setManageActionRemarkError] = useState("");
  const [impactedPreviewMembers, setImpactedPreviewMembers] = useState<AppUser[] | null>(null);
  const [isImpactedPreviewLoading, setIsImpactedPreviewLoading] = useState(false);
  const [shellOffset, setShellOffset] = useState({ top: 56, left: 0 });
  const [viewportWidth, setViewportWidth] = useState(0);
  const isNotificationsPanelOpen = useNotificationsPanelOpen();
  const isAnyUserDialogOpen = addDialogOpen || Boolean(viewingMember) || Boolean(editingMember) || remarkDialogOpen;
  const pageMemberCount = useMemo(() => paginatedMembers.length, [paginatedMembers]);
  const totalMembersForTab = statusCounts[statusTab];
  const impactedPreviewKeyRef = useRef<string | null>(null);
  const linkedFilterKeyRef = useRef<string | null>(null);

  const clearNotificationIntentParams = (params: URLSearchParams) => {
    const nextParams = new URLSearchParams(params);
    [
      "notif_action",
      "notif_ref_type",
      "notif_ref_id",
      "notif_target",
      "notif_type",
      "notif_email",
      "notif_entity_name",
      "notif_target_status",
    ].forEach((key) => nextParams.delete(key));
    return nextParams;
  };

  const clearImpactedUserIntentParams = useCallback((params: URLSearchParams) => {
    const nextParams = new URLSearchParams(params);
    nextParams.delete("um_impact_users");
    nextParams.delete("um_impact_label");
    nextParams.delete("um_impact_node_path");
    return nextParams;
  }, []);

  const impactedUserEmailsParam = (searchParams.get("um_impact_users") || "").trim();
  const impactedUserLabel = (searchParams.get("um_impact_label") || "").trim();
  const isImpactedPreviewActive = Boolean(impactedUserEmailsParam);
  const linkedAccessContext = useMemo(() => {
    if ((searchParams.get("tab") || "").trim() !== "users") return null;

    const nodeName = (searchParams.get("um_node") || "").trim();
    const nodePath = (searchParams.get("um_node_path") || "").trim();
    const category = (searchParams.get("um_category") || "").trim();
    const subCategory = (searchParams.get("um_subcategory") || "").trim();
    const action = (searchParams.get("um_action") || "").trim().toLowerCase();

    if (!nodeName && !nodePath && !category && !subCategory && !action) return null;
    if (action !== "checker" && action !== "maker" && action !== "viewer") return null;

    return {
      nodeName,
      nodePath,
      category,
      subCategory,
      action,
    } as const;
  }, [searchParams]);

  const clearImpactedPreview = useCallback(() => {
    if (!isImpactedPreviewActive) return;
    setSearchParams(clearImpactedUserIntentParams(searchParams), { replace: true });
  }, [clearImpactedUserIntentParams, isImpactedPreviewActive, searchParams, setSearchParams]);

  const openMemberPreview = useCallback(async (
    member: AppUser,
    tabOverride?: "active" | "pending" | "inactive",
  ) => {
    const effectiveTab = tabOverride ?? statusTab;
    try {
      setIsManagePreviewReady(false);
      setIsOpeningMemberPreview(true);
      const detailedMember = await fetchUserDetails(effectiveTab, {
        id: member.id || member.requestId || member.uuid || null,
        email: member.email || member.basicDetails?.email || null,
      });
      setHistoryPreviewDetail(null);
      setHistoryPreviewEvent(null);
      startTransition(() => {
        setViewingMember(detailedMember);
      });
    } catch (error) {
      toast({
        title: "Unable to load user details",
        description: getApiErrorMessage(error, "Failed to fetch the selected user details."),
        variant: "destructive",
      });
    } finally {
      setIsOpeningMemberPreview(false);
    }
  }, [setViewingMember, statusTab, toast]);

  const fetchDetailedMemberForAction = useCallback(
    async (member: AppUser, tabOverride?: "active" | "pending" | "inactive") => {
      const effectiveTab = tabOverride ?? statusTab;
      return fetchUserDetails(effectiveTab, {
        id: member.id || member.requestId || member.uuid || null,
        email: member.email || member.basicDetails?.email || null,
      });
    },
    [statusTab],
  );

  useEffect(() => {
    if (!viewingMember) {
      setIsManagePreviewReady(false);
      setHistoryPreviewDetail(null);
      setHistoryPreviewEvent(null);
    }
  }, [viewingMember]);

  useEffect(() => {
    if (!viewingMember) return;

    let frameOne = 0;
    let frameTwo = 0;
    setIsManagePreviewReady(false);

    frameOne = requestAnimationFrame(() => {
      frameTwo = requestAnimationFrame(() => {
        setIsManagePreviewReady(true);
      });
    });

    return () => {
      cancelAnimationFrame(frameOne);
      cancelAnimationFrame(frameTwo);
    };
  }, [viewingMember, historyOpenForMember]);

  useEffect(() => {
    const activeTab = (searchParams.get("tab") || "").trim();
    if (activeTab !== "users") {
      impactedPreviewKeyRef.current = null;
      setImpactedPreviewMembers(null);
      setIsImpactedPreviewLoading(false);
      return;
    }

    const rawEmails = impactedUserEmailsParam;
    if (!rawEmails) {
      impactedPreviewKeyRef.current = null;
      setImpactedPreviewMembers(null);
      setIsImpactedPreviewLoading(false);
      return;
    }

    if (impactedPreviewKeyRef.current === rawEmails) return;
    impactedPreviewKeyRef.current = rawEmails;

    const requestedEmails = Array.from(
      new Set(
        rawEmails
          .split(",")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    if (requestedEmails.length === 0) {
      setImpactedPreviewMembers([]);
      setIsImpactedPreviewLoading(false);
      return;
    }

    clearAdvancedFilters();
    setSearch("");
    setStatusTab("active");
    setIsImpactedPreviewLoading(true);

    let cancelled = false;

    void Promise.allSettled(
      requestedEmails.map((email) =>
        fetchUserDetails("active", { email }),
      ),
    ).then((results) => {
      if (cancelled) return;

      const resolvedMembers = results
        .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
        .filter(
          (member, index, members) =>
            members.findIndex((candidate) => (candidate.email || "").trim().toLowerCase() === (member.email || "").trim().toLowerCase()) === index,
        );

      setImpactedPreviewMembers(resolvedMembers);
      setIsImpactedPreviewLoading(false);

      if (resolvedMembers.length === 0) {
        toast({
          title: "No impacted users found",
          description: "The selected impacted users are no longer available.",
          variant: "destructive",
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [clearAdvancedFilters, impactedUserEmailsParam, searchParams, setSearch, setStatusTab, toast]);

  useEffect(() => {
    const activeTab = (searchParams.get("tab") || "").trim();
    if (activeTab !== "users") {
      linkedFilterKeyRef.current = null;
      return;
    }

    const linkedNode = (searchParams.get("um_node") || "").trim();
    const linkedNodePath = (searchParams.get("um_node_path") || "").trim();
    const linkedCategory = (searchParams.get("um_category") || "").trim();
    const linkedSubcategory = (searchParams.get("um_subcategory") || "").trim();
    const linkedAction = (searchParams.get("um_action") || "").trim().toLowerCase();

    if (!linkedNode && !linkedNodePath && !linkedCategory && !linkedSubcategory && !linkedAction) {
      linkedFilterKeyRef.current = null;
      return;
    }

    const linkedKey = [linkedNode, linkedNodePath, linkedCategory, linkedSubcategory, linkedAction].join("|");
    if (linkedFilterKeyRef.current === linkedKey) return;
    linkedFilterKeyRef.current = linkedKey;

    const resolveRoleFilter = () => {
      if (linkedAction === "checker") return ["Checker"] as const;
      if (linkedAction === "maker") return ["Maker"] as const;
      if (linkedAction === "viewer") return ["User"] as const;
      return [] as const;
    };

    const resolveByNormalizedValue = (options: Array<string | { value: string }>, rawValue: string) => {
      const normalizedRaw = normalizeFilterIntentValue(rawValue);
      if (!normalizedRaw) return null;
      return (
        options.find((option) => normalizeFilterIntentValue(typeof option === "string" ? option : option.value) === normalizedRaw) ??
        options.find((option) => normalizeFilterIntentValue(typeof option === "string" ? option : option.value) === normalizeFilterIntentValue(formatRoleTokenLabel(rawValue))) ??
        null
      );
    };

    const resolveNodeFilter = async () => {
      try {
        const dropdowns = await fetchUserFilterDropdowns("USER_ACC");
        const formattedCategoryIntent = formatRoleTokenLabel(linkedCategory);
        const categoryCandidates = [linkedCategory, formattedCategoryIntent].filter(Boolean);
        const resolvedCategory =
          categoryCandidates
            .map((candidate) => resolveByNormalizedValue(dropdowns.category, candidate))
            .find(Boolean) ?? null;
        const resolvedCategoryValue = resolvedCategory
          ? (typeof resolvedCategory === "string" ? resolvedCategory : resolvedCategory.value)
          : "";
        const scopedSubcategories = resolvedCategoryValue
          ? dropdowns.subCategory[resolvedCategoryValue] ?? []
          : Object.values(dropdowns.subCategory).flat();
        const formattedSubcategoryIntent = formatRoleTokenLabel(linkedSubcategory);
        const subcategoryCandidates = [linkedSubcategory, formattedSubcategoryIntent].filter(Boolean);

        const resolvedNode =
          dropdowns.nodeName.find((option) => normalizeFilterIntentValue(option.path) === normalizeFilterIntentValue(linkedNodePath))?.value ??
          dropdowns.nodeName.find((option) => normalizeFilterIntentValue(option.value) === normalizeFilterIntentValue(linkedNode))?.value ??
          null;
        const resolvedSubcategory =
          subcategoryCandidates
            .map((candidate) => resolveByNormalizedValue(scopedSubcategories, candidate))
            .find(Boolean) ?? null;

        clearImpactedPreview();
        setSearch("");
        applyAdvancedFilters({
          designationFilters: [],
          nodeNameFilters: resolvedNode ? [resolvedNode] : linkedNode ? [linkedNode] : [],
          nodeNameFilterPaths: linkedNodePath ? [linkedNodePath] : [],
          nodeTypeFilters: [],
          accessCategoryFilters: resolvedCategory ? [typeof resolvedCategory === "string" ? resolvedCategory : resolvedCategory.value] : formattedCategoryIntent ? [formattedCategoryIntent] : linkedCategory ? [linkedCategory] : [],
          accessSubcategoryFilters: resolvedSubcategory ? [typeof resolvedSubcategory === "string" ? resolvedSubcategory : resolvedSubcategory.value] : formattedSubcategoryIntent ? [formattedSubcategoryIntent] : linkedSubcategory ? [linkedSubcategory] : [],
          reportingManagerFilters: [],
          statusFilters: [],
          statusFilterMode: [],
          roleFilters: [...resolveRoleFilter()],
          nodeAccessType: {},
          pendingActionFilter: null,
          onboardingDateRange: null,
          onboardingDateFrom: "",
          onboardingDateTo: "",
        });
      } catch (error) {
        toast({
          title: "Unable to apply linked filters",
          description: getApiErrorMessage(error, "Could not resolve the linked user filters."),
          variant: "destructive",
        });
      }
    };

    void resolveNodeFilter();
  }, [applyAdvancedFilters, clearImpactedPreview, searchParams, setSearch, toast]);

  useEffect(() => {
    if (!historyOpenForMember) {
      setHistoryPreviewEvent(null);
    }
  }, [historyOpenForMember]);

  useEffect(() => {
    if ((searchParams.get("tab") || "").trim() !== "users") return;
    if ((searchParams.get("notif_ref_type") || "").trim().toUpperCase() !== "USER") return;

    const notificationAction = (searchParams.get("notif_action") || "").trim().toLowerCase();
    const notificationType = (searchParams.get("notif_type") || "").trim().toUpperCase();
    const referenceId = (searchParams.get("notif_ref_id") || "").trim();
    const email = (searchParams.get("notif_email") || "").trim().toLowerCase();
    const notificationTargetStatus = (searchParams.get("notif_target_status") || "").trim().toLowerCase();
    const notificationKey = [notificationAction, notificationType, referenceId, email, notificationTargetStatus].join("|");

    if (!notificationAction && !notificationType && !referenceId && !email) {
      lastNotificationKeyRef.current = null;
      notificationFetchKeyRef.current = null;
      return;
    }
    if (lastNotificationKeyRef.current === notificationKey) return;
    const targetTab =
      notificationAction === "approve"
        ? "pending"
        : notificationTargetStatus === "active" || notificationTargetStatus === "inactive" || notificationTargetStatus === "pending"
          ? notificationTargetStatus
          : notificationType.includes("ONBOARD")
            ? "active"
            : notificationType.includes("INACTIV")
              ? "inactive"
              : "pending";

    const targetStatusCount =
      targetTab === "pending"
        ? statusCounts.pending
        : targetTab === "inactive"
          ? statusCounts.inactive
          : statusCounts.active;

    if (hasLoadedUsersOnce && targetStatusCount === 0) {
      toast({
        title: "Request not found",
        description: "The user request is no longer available.",
        variant: "destructive",
      });
      setSearchParams(clearNotificationIntentParams(searchParams), { replace: true });
      lastNotificationKeyRef.current = notificationKey;
      return;
    }

    if (statusTab !== targetTab) {
      notificationFetchKeyRef.current = null;
      setStatusTab(targetTab);
      return;
    }

    if (notificationFetchKeyRef.current !== notificationKey) {
      notificationFetchKeyRef.current = notificationKey;
      void loadUsers(false, targetTab);
      return;
    }

    if (isLoading) {
      return;
    }

    const sourceMembers =
      notificationAction === "approve"
        ? pendingMembers
        : targetTab === "pending"
          ? pendingMembers
          : targetTab === "inactive"
            ? inactiveMembers
            : activeMembers;
    const candidates = sourceMembers.filter(
      (member, index, array) =>
        array.findIndex(
          (candidate) =>
            (candidate.requestId || "").trim() === (member.requestId || "").trim() &&
            (candidate.email || "").trim().toLowerCase() === (member.email || "").trim().toLowerCase(),
        ) === index,
    );
    const matchedByReferenceId = referenceId
      ? candidates.find((member) => {
          const memberRequestId = (member.requestId || "").trim();
          const memberId = (member.id || "").trim();
          const memberUuid = (member.uuid || "").trim();
          return memberRequestId === referenceId || memberId === referenceId || memberUuid === referenceId;
        }) ?? null
      : null;
    const matchedMember = matchedByReferenceId ?? candidates.find((member) => {
      const memberId = (member.id || "").trim();
      const memberUuid = (member.uuid || "").trim();
      const memberRequestId = (member.requestId || "").trim();
      const memberEmail = (member.email || "").trim().toLowerCase();
      const basicEmail = (member.basicDetails?.email || "").trim().toLowerCase();
      if (notificationAction === "approve" && referenceId) return false;
      if (referenceId && (memberRequestId === referenceId || memberId === referenceId || memberUuid === referenceId)) return true;
      if (Boolean(email) && (memberEmail === email || basicEmail === email)) return true;
      if (!email) return false;
      const requestNewEmail = `${member.basicDetails?.requestNewData?.targetUserEmail ?? ""}`.trim().toLowerCase();
      const requestOldEmail = `${member.basicDetails?.requestOldData?.targetUserEmail ?? ""}`.trim().toLowerCase();
      return requestNewEmail === email || requestOldEmail === email;
    });

    if (!matchedMember) {
      if (hasLoadedUsersOnce) {
        toast({
          title: "Request not found",
          description: "The user request is no longer available.",
          variant: "destructive",
        });
        setSearchParams(clearNotificationIntentParams(searchParams), { replace: true });
        lastNotificationKeyRef.current = notificationKey;
      }
      return;
    }

    void openMemberPreview(matchedMember, targetTab);
    setSearchParams(clearNotificationIntentParams(searchParams), { replace: true });
    lastNotificationKeyRef.current = notificationKey;
    notificationFetchKeyRef.current = null;
  }, [
    activeMembers,
    hasLoadedUsersOnce,
    inactiveMembers,
    loadUsers,
    pendingMembers,
    searchParams,
    setSearchParams,
    setStatusTab,
    setViewingMember,
    isLoading,
    statusCounts.active,
    statusCounts.inactive,
    statusCounts.pending,
    statusTab,
    openMemberPreview,
    toast,
  ]);
  const startUserLockSession = async (member: AppUser) => {
    const targetMail = (member.email || "").trim();
    if (!targetMail) {
      throw new Error("User email is missing for lock request.");
    }
    await userLockSession.startSession(
      { type: "user", target: { email: targetMail } },
      () => {
        setViewingMember(null);
        setEditingMember(null);
        setAddDialogOpen(false);
        setShowDeleteActions(false);
        setPendingManageActionType(null);
        toast({
          title: "Edit lock expired",
          description: "No activity detected. User edit form was closed.",
          variant: "destructive",
        });
      },
    );
  };

  const startPendingUserAction = async (member: AppUser) => {
    return member;
  };

  const cancelPendingUserAction = async () => {
    return;
  };

  const loadWorkflowOptionsForMemberAction = async (member: AppUser) => {
    const primaryNodePath = (member.accessDetails || [])
      .find((entry) => entry.accessType === "PRIMARY")
      ?.nodePath?.trim()
      .toUpperCase() || "";

    const { nodes } = await fetchCompanyNodesWithAccess("USER_ACC");
    const options = nodes
      .flatMap((item) =>
        item.workflows.filter((workflow) => {
          const nodePath = item.nodePath.trim().toUpperCase();
          if (primaryNodePath && nodePath === primaryNodePath) return true;
          const alias = workflow.alias?.trim().toUpperCase();
          return Boolean(alias && alias.endsWith("D"));
        }),
      )
      .map((workflow) => {
        const id = workflow.levelsHash.trim();
        const name = workflow.name.trim();
        const alias = workflow.alias?.trim();
        if (!id || !name) return null;
        return { id, label: alias ? `${name} (${alias})` : name };
      })
      .filter((option): option is { id: string; label: string } => Boolean(option));
    setDeleteWorkflowOptions(Array.from(new Map(options.map((option) => [option.id, option])).values()));
  };

  const openDeleteActions = async (member: AppUser) => {
    const targetMail = (member.email || "").trim();
    if (!targetMail) {
      toast({
        title: "Delete unavailable",
        description: "User email is missing for lock request.",
        variant: "destructive",
      });
      return;
    }
    try {
      const detailedMember = await fetchDetailedMemberForAction(member);
      await startUserLockSession(detailedMember);
      await loadWorkflowOptionsForMemberAction(detailedMember);
      setViewingMember(detailedMember);
    } catch (error) {
      setDeleteWorkflowOptions([]);
      toast({
        title: "Action unavailable",
        description: getLockErrorMessage(error, "Unable to lock user for this action."),
        variant: "destructive",
      });
      return;
    }
    setPendingManageActionType("archive");
    setShowDeleteActions(true);
    setDeleteWorkflow("__none__");
    setManageActionRemark("");
    setManageActionRemarkError("");
  };

  const handleConfirmDelete = async () => {
    if (!viewingMember) return;
    const normalizedRemark = manageActionRemark.trim();
    const requiresRemark =
      pendingManageActionType === "archive" ||
      pendingManageActionType === "inactive" ||
      pendingManageActionType === "active";
    if (requiresRemark && !normalizedRemark) {
      setManageActionRemarkError("Remark is required.");
      return;
    }
    try {
      if (pendingManageActionType === "archive") {
        if (!viewingMember.email?.trim()) return;
        await removeMember(viewingMember.email, normalizedRemark, deleteWorkflow === "__none__" ? null : deleteWorkflow);
      } else if (pendingManageActionType === "active") {
        await executeUserStatusAction(viewingMember, "activate", normalizedRemark, deleteWorkflow === "__none__" ? null : deleteWorkflow);
      } else if (pendingManageActionType === "inactive") {
        await executeUserStatusAction(viewingMember, "deactivate", normalizedRemark, deleteWorkflow === "__none__" ? null : deleteWorkflow);
      }
      setPendingManageActionType(null);
      setShowDeleteActions(false);
      setManageActionRemark("");
      setManageActionRemarkError("");
      setViewingMember(null);
      await userLockSession.stopSession(true);
    } catch (error) {
      toast({
        title: "Action failed",
        description: getApiErrorMessage(error, "Unable to submit the user request."),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!hasLoadedUsersOnce) return;
    if (refreshInitializedAt) return;
    setRefreshInitializedAt(Date.now());
  }, [hasLoadedUsersOnce, refreshInitializedAt]);

  useEffect(() => {
    if (!viewingMember) {
      setHistoryOpenForMember(false);
      setShowDeleteActions(false);
      setPendingManageActionType(null);
      setDeleteWorkflowOptions([]);
      setManageActionRemark("");
      setManageActionRemarkError("");
    }
  }, [viewingMember]);

  useEffect(() => {
    if (!viewingMember) return;
    if (viewingMember.status !== "Pending") return;
    setHistoryOpenForMember(true);
  }, [viewingMember]);

  useEffect(() => {
    if (!viewingMember) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    // Keep the page behind the manage dialog stable while still allowing
    // internal scrolling in preview + history panes.
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [viewingMember]);

  useEffect(() => {
    const syncShellOffset = () => {
      const topBar = document.querySelector("header");
      const sideBar = document.querySelector("aside");
      // Use the actual rendered edge positions to avoid 1px seams between
      // split panes and the app chrome on fractional pixel layouts.
      const top = topBar ? Math.max(0, Math.floor(topBar.getBoundingClientRect().bottom)) : 56;
      const left = sideBar ? Math.max(0, Math.floor(sideBar.getBoundingClientRect().right)) : 0;
      setShellOffset({ top, left });
      setViewportWidth(window.innerWidth);
    };

    syncShellOffset();
    window.addEventListener("resize", syncShellOffset);
    const topBar = document.querySelector("header");
    const sideBar = document.querySelector("aside");
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncShellOffset) : null;

    if (resizeObserver && topBar) resizeObserver.observe(topBar);
    if (resizeObserver && sideBar) resizeObserver.observe(sideBar);
    topBar?.addEventListener("transitionend", syncShellOffset);
    sideBar?.addEventListener("transitionend", syncShellOffset);

    return () => {
      window.removeEventListener("resize", syncShellOffset);
      topBar?.removeEventListener("transitionend", syncShellOffset);
      sideBar?.removeEventListener("transitionend", syncShellOffset);
      resizeObserver?.disconnect();
    };
  }, []);

  const availableContentWidth = Math.max(0, viewportWidth - shellOffset.left);
  const MIN_DIALOG_SPLIT_WIDTH = 860;
  const MIN_HISTORY_WIDTH = 420;
  const MAX_HISTORY_WIDTH = 560;
  const computedHistoryPanelWidth = Math.max(
    MIN_HISTORY_WIDTH,
    Math.min(MAX_HISTORY_WIDTH, availableContentWidth - MIN_DIALOG_SPLIT_WIDTH),
  );
  const hasOpenManageHistory = Boolean(viewingMember) && historyOpenForMember;
  const canSplitHistoryLayout =
    hasOpenManageHistory &&
    availableContentWidth >= MIN_DIALOG_SPLIT_WIDTH + MIN_HISTORY_WIDTH;
  const canUseSplitHistory =
    hasOpenManageHistory &&
    availableContentWidth >= MIN_DIALOG_SPLIT_WIDTH + MIN_HISTORY_WIDTH;
  const splitHistoryTopOverlap = 2;
  const splitDockOffset = canSplitHistoryLayout
    ? { top: Math.max(0, shellOffset.top - splitHistoryTopOverlap), left: shellOffset.left }
    : shellOffset;
  const displayMembers = impactedPreviewMembers ?? paginatedMembers;
  const displayCurrentMembers = impactedPreviewMembers ?? currentMembers;
  const displayMemberCount = impactedPreviewMembers?.length ?? statusCounts[statusTab];
  const displayPageMemberCount = impactedPreviewMembers?.length ?? pageMemberCount;
  const displayStatusHeading = impactedPreviewMembers ? (impactedUserLabel ? `${impactedUserLabel} Impacted Users` : "Impacted Users") : statusHeading;
  const shouldShowDefaultPagination = !impactedPreviewMembers;
  const isUserTableLoading = isLoading || isImpactedPreviewLoading;
  const userRangeSummary = useMemo(() => {
    if (totalMembersForTab <= 0 || pageMemberCount === 0) return "Range: 0-0 of 0";
    const start = Math.max(1, (safePage - 1) * pageSize + 1);
    const end = Math.min(totalMembersForTab, start + pageMemberCount - 1);
    return `Range: ${start}-${end} of ${totalMembersForTab}`;
  }, [pageMemberCount, pageSize, safePage, totalMembersForTab]);

  return (
    <div className="space-y-4">
      <UserFilters
        statusTab={statusTab}
        onStatusTabChange={(value) => {
          clearImpactedPreview();
          setStatusTab(value);
        }}
        search={search}
        onSearchChange={(value) => {
          if (value.trim()) {
            clearImpactedPreview();
          }
          setSearch(value);
        }}
        searchSuggestions={searchSuggestions}
        designationFilters={designationFilters}
        nodeNameFilters={departmentFilters}
        nodeNameFilterPaths={departmentFilterPaths}
        nodeTypeFilters={nodeTypeFilters}
        accessCategoryFilters={accessCategoryFilters}
        accessSubcategoryFilters={accessSubcategoryFilters}
        reportingManagerFilters={reportingManagerFilters}
        statusFilters={statusFilters}
        statusFilterMode={statusFilterMode}
        roleFilters={roleFilters}
        nodeAccessType={nodeAccessType}
        pendingActionFilter={pendingActionFilter}
        onboardingDateRange={onboardingDateRange}
        onboardingDateFrom={onboardingDateFrom}
        onboardingDateTo={onboardingDateTo}
        onClearAdvancedFilters={async () => {
          clearImpactedPreview();
          clearAdvancedFilters();
          await loadFilterOptions(null);
        }}
        onOpenFilters={loadFilterOptions}
        onApplyAdvancedFilters={(filters) => {
          clearImpactedPreview();
          applyAdvancedFilters(filters);
        }}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        hasNewUserEvent={hasNewUserEvent}
        suppressAutoEventTooltip={isAnyUserDialogOpen || isNotificationsPanelOpen}
        refreshInitializedAt={refreshInitializedAt}
        onRefresh={async () => {
          await loadUsers(true);
          setHasNewUserEvent(false);
        }}
        designationOptions={designationOptions}
        accessCategories={accessCategories}
        accessSubcategories={accessSubcategories}
        filterNodeOptions={filterNodeOptions}
        nodeTypeOptions={nodeTypeOptions}
        reportingManagerOptions={reportingManagerOptions}
        isFilterLoading={isFilterLoading}
        statusCounts={{
          active: statusCounts.active,
          pending: statusCounts.pending,
          inactive: statusCounts.inactive,
        }}
        userStatusSummary={userStatusSummary}
        permissionSummary={permissionSummary}
      />

      <Card className="overflow-hidden border-slate-200 shadow-sm md:flex md:h-[calc(100dvh-19.5rem)] md:min-h-[500px] md:flex-col">
        <CardHeader className="flex flex-col gap-4 border-b border-slate-200 bg-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              {statusTab === "inactive" ? <EyeOff className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {displayStatusHeading} ({displayMemberCount})
            </CardTitle>
          </div>

          <div className="flex flex-wrap items-center gap-2">
                        <Button
              size="sm"
              className="bg-[hsl(235,60%,50%)] text-white shadow-[0_10px_24px_rgba(30,35,80,0.22)] hover:bg-[hsl(235,60%,45%)]"
              onClick={() => {
                setOnboardingSeedMember(null);
                void handleOpenAddUserDialog();
              }}
            >
              <UserPlus className="mr-1.5 h-4 w-4" />
              Add User
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div className="relative min-h-0 flex-1 overflow-auto">
            <UserTable
              isLoading={isUserTableLoading}
              currentMembers={displayCurrentMembers}
              paginatedMembers={displayMembers}
              linkedAccessContext={impactedPreviewMembers ? null : linkedAccessContext}
              onView={(member) => {
                void openMemberPreview(member);
              }}
              onOpenHistoryDetail={(member, detail) => {
                void (async () => {
                  try {
                    setIsManagePreviewReady(false);
                    setIsOpeningMemberPreview(true);
                    const detailedMember = await fetchUserDetails(statusTab, {
                      id: member.id || member.requestId || member.uuid || null,
                      email: member.email || member.basicDetails?.email || null,
                    });
                    startTransition(() => {
                      setViewingMember(detailedMember);
                      setHistoryOpenForMember(true);
                      setHistoryPreviewDetail(detail);
                      setHistoryPreviewEvent(null);
                    });
                  } catch (error) {
                    toast({
                      title: "Unable to load user details",
                      description: getApiErrorMessage(error, "Failed to fetch the selected user details."),
                      variant: "destructive",
                    });
                  } finally {
                    setIsOpeningMemberPreview(false);
                  }
                })();
              }}
              onDelete={(member) => {
                void openDeleteActions(member);
              }}
            />
          </div>

          {shouldShowDefaultPagination ? (
            <UserPagination
              currentCount={currentMembers.length}
              recordCurrentCount={pageMemberCount}
              recordTotalCount={totalMembersForTab}
              recordLabel="Records"
              summaryTextOverride={userRangeSummary}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              safePage={safePage}
              totalPages={totalPages}
              onPrevPage={() => void handlePrevPage()}
              onNextPage={() => void handleNextPage()}
              onJumpToPage={(value) => void handleJumpToPage(value)}
              className="sticky bottom-0 z-20 shrink-0 flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            />
          ) : (
            <div className="sticky bottom-0 z-20 shrink-0 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Showing {displayPageMemberCount} impacted user{displayPageMemberCount === 1 ? "" : "s"} from the selected org approval.
            </div>
          )}
        </CardContent>
      </Card>

      <UserOnboardingDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            void (async () => {
              await userLockSession.stopSession(true);
              setAddDialogOpen(false);
              setOnboardingSeedMember(null);
            })();
            return;
          }
          setAddDialogOpen(true);
        }}
        onSubmit={handleAddUser}
        seedMember={onboardingSeedMember}
      />

      {(viewingMember || isOpeningMemberPreview) && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[49] bg-slate-900/40 transition-opacity duration-200"
              style={
                canUseSplitHistory
                  ? {
                      top: `${shellOffset.top}px`,
                      left: `${shellOffset.left}px`,
                      width: `calc(100vw - ${shellOffset.left}px - ${computedHistoryPanelWidth}px)`,
                      height: `calc(100vh - ${shellOffset.top}px)`,
                    }
                  : {
                      top: "0px",
                      left: "0px",
                      width: "100vw",
                      height: "100vh",
                    }
              }
            />,
            document.body,
          )
        : null}

      <Dialog
        modal={false}
        open={Boolean(viewingMember) || isOpeningMemberPreview}
        onOpenChange={(open) => {
          if (!open) {
            void (async () => {
              await userLockSession.stopSession(true);
              setHistoryPreviewDetail(null);
              setViewingMember(null);
            })();
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="hidden"
          onInteractOutside={(event) => {
            if (canUseSplitHistory || historyOpenForMember) {
              event.preventDefault();
            }
          }}
          className={
            canUseSplitHistory
              ? "flex flex-col overflow-hidden rounded-none p-0 max-w-none transition-none data-[state=open]:animate-none data-[state=closed]:animate-none"
              : "flex h-[92vh] w-[96vw] max-w-[1200px] flex-col overflow-hidden p-0 transition-[transform,opacity] duration-200 data-[state=open]:animate-none data-[state=closed]:animate-none"
          }
          style={
            canUseSplitHistory
              ? {
                  top: `${shellOffset.top}px`,
                  left: `${shellOffset.left}px`,
                  width: `calc(100vw - ${shellOffset.left}px - ${computedHistoryPanelWidth}px)`,
                  height: `calc(100vh - ${shellOffset.top}px)`,
                  transform: "translate(0, 0)",
                }
              : { transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }
          }
        >
          <DialogTitle className="sr-only">Manage User</DialogTitle>
          <DialogDescription className="sr-only">
            Review and manage selected user details, permissions, and status actions.
          </DialogDescription>
          {viewingMember && isManagePreviewReady ? (
            <UserManagePreview
              member={viewingMember}
              currentTab={statusTab}
              onApprovePending={handleActivateMember}
              onRejectPending={handleDeactivateMember}
              onStartPendingAction={async (member) => {
                try {
                  await startPendingUserAction(member);
                  return true;
                } catch (error) {
                  toast({
                    title: "Approve unavailable",
                    description: getLockErrorMessage(error, "Unable to lock user for approval."),
                    variant: "destructive",
                  });
                  return false;
                }
              }}
              onCancelPendingAction={async () => {
                await cancelPendingUserAction();
              }}
              onToggleActiveStatus={(member, isActive) => {
                if (isActive) {
                  handleActivateMember(member);
                  return;
                }
                handleDeactivateMember(member);
              }}
              onRequestStatusToggle={(member, isActive) => {
                void (async () => {
                  try {
                    const detailedMember = await fetchDetailedMemberForAction(member);
                    await startUserLockSession(detailedMember);
                    await loadWorkflowOptionsForMemberAction(detailedMember);
                    setViewingMember(detailedMember);
                  } catch (error) {
                    setDeleteWorkflowOptions([]);
                    toast({
                      title: "Action unavailable",
                      description: getLockErrorMessage(error, "Unable to lock user for this action."),
                      variant: "destructive",
                    });
                    return;
                  }
                  setPendingManageActionType(isActive ? "active" : "inactive");
                  setShowDeleteActions(true);
                  setDeleteWorkflow("__none__");
                  setManageActionRemark("");
                  setManageActionRemarkError("");
                })();
              }}
              onEdit={(member) => {
                void (async () => {
                  try {
                    await startUserLockSession(member);
                    setOnboardingSeedMember(member);
                    setViewingMember(null);
                    setAddDialogOpen(true);
                  } catch (error) {
                    toast({
                      title: "Edit unavailable",
                      description: getLockErrorMessage(error, "Unable to lock user for edit."),
                      variant: "destructive",
                    });
                  }
                })();
              }}
              onClose={() =>
                void (async () => {
                  await userLockSession.stopSession(true);
                  setHistoryPreviewDetail(null);
                  setViewingMember(null);
                })()
              }
              onDelete={(member) => {
                void openDeleteActions(member);
              }}
              showDeleteActions={showDeleteActions}
              deleteActionLabel={
                pendingManageActionType === "archive"
                  ? "Delete User"
                  : pendingManageActionType === "inactive"
                    ? "Set Inactive"
                    : pendingManageActionType === "active"
                      ? "Set Active"
                      : "Submit"
              }
              deleteWorkflow={deleteWorkflow}
              deleteWorkflowOptions={deleteWorkflowOptions}
              deleteRemark={manageActionRemark}
              deleteRemarkError={manageActionRemarkError}
              requireDeleteRemark={
                pendingManageActionType === "archive" ||
                pendingManageActionType === "inactive" ||
                pendingManageActionType === "active"
              }
              deleteRemarkPlaceholder={
                pendingManageActionType === "archive"
                  ? "Enter remark for delete user request"
                  : pendingManageActionType === "inactive"
                    ? "Enter remark for set inactive request"
                    : pendingManageActionType === "active"
                      ? "Enter remark for set active request"
                      : "Enter remark"
              }
              onDeleteWorkflowChange={setDeleteWorkflow}
              onDeleteRemarkChange={(value) => {
                setManageActionRemark(value);
                if (manageActionRemarkError) setManageActionRemarkError("");
              }}
              onConfirmDelete={() => void handleConfirmDelete()}
              onCancelDeleteActions={() => {
                void (async () => {
                  await userLockSession.stopSession(true);
                  setShowDeleteActions(false);
                  setPendingManageActionType(null);
                  setManageActionRemark("");
                  setManageActionRemarkError("");
                })();
              }}
              onToggleHistory={() => setHistoryOpenForMember((current) => {
                const next = !current;
                if (!next) {
                  setHistoryPreviewDetail(null);
                  setHistoryPreviewEvent(null);
                }
                return next;
              })}
              isHistoryOpen={historyOpenForMember}
              historyDetailOverride={historyPreviewDetail}
              historyPreviewEvent={statusTab === "pending" ? historyPreviewEvent : null}
            />
          ) : isOpeningMemberPreview || viewingMember ? (
            <div className="flex h-full min-h-[280px] items-center justify-center text-sm font-medium text-slate-500">
              Loading user details...
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {viewingMember ? (
        <UserHistorySidebar
          isOpen={historyOpenForMember}
          onClose={() => {
            setHistoryOpenForMember(false);
            setHistoryPreviewDetail(null);
            setHistoryPreviewEvent(null);
          }}
          user={viewingMember}
          onOpenHistoryDetail={(detail) => {
            setHistoryPreviewDetail(detail);
          }}
          onLatestHistoryEventChange={setHistoryPreviewEvent}
          dockOffset={splitDockOffset}
          splitView={canSplitHistoryLayout}
          panelWidth={computedHistoryPanelWidth}
        />
      ) : null}

      <Dialog
        open={Boolean(editingMember)}
        onOpenChange={(open) => {
          if (!open) {
            void (async () => {
              await userLockSession.stopSession(true);
              setEditingMember(null);
            })();
          }
        }}
      >
        {editingMember ? (
          <EditMemberDialog
            editingMember={editingMember}
            onEditMemberChange={setEditingMember}
            onSave={() => {
              handleSaveEdit();
              void userLockSession.stopSession(true);
            }}
          />
        ) : null}
      </Dialog>

      <RemarkDialog
        open={remarkDialogOpen}
        onOpenChange={setRemarkDialogOpen}
        onConfirm={processUserStatusAction}
        title={pendingAction?.action === "activate" ? "Activate User" : "Deactivate User"}
        description={`Are you sure you want to ${pendingAction?.action} ${pendingAction?.member.name}? Please provide a remark.`}
        confirmLabel={pendingAction?.action === "activate" ? "Activate" : "Deactivate"}
        confirmVariant={pendingAction?.action === "activate" ? "success" : "destructive"}
      />
      <EditLockWarningDialog
        open={userLockSession.warningOpen}
        secondsRemaining={userLockSession.secondsRemaining}
        onContinue={() => void userLockSession.continueEditing()}
        onCloseAndRelease={() => void userLockSession.endEditingNow()}
      />
    </div>
  );
}


