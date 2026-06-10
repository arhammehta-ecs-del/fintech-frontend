import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { fetchCompanyNodesWithAccess, fetchUserDetails } from "@/services/user.service";
import { useEditLockSession } from "@/hooks/useEditLockSession";
import EditLockWarningDialog from "@/components/EditLockWarningDialog";
import { useNotificationsPanelOpen } from "@/hooks/useNotificationsPanelOpen";
import type { HistoryDetailPreviewEvent, HistoryDetailViewModel } from "@/components/HistoryDetailDialog";
// import { acquireEditLock } from "@/services/edit-lock.service";

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
    reportingManagerFilters,
    setReportingManagerFilters,
    statusFilters,
    setStatusFilters,
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
    roles,
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
  } = useUserManagement();
  const [refreshInitializedAt, setRefreshInitializedAt] = useState<number | null>(null);
  const [historyOpenForMember, setHistoryOpenForMember] = useState(false);
  const [historyPreviewDetail, setHistoryPreviewDetail] = useState<HistoryDetailViewModel | null>(null);
  const [historyPreviewEvent, setHistoryPreviewEvent] = useState<HistoryDetailPreviewEvent | null>(null);
  const [isOpeningMemberPreview, setIsOpeningMemberPreview] = useState(false);
  const [onboardingSeedMember, setOnboardingSeedMember] = useState<AppUser | null>(null);
  const [showDeleteActions, setShowDeleteActions] = useState(false);
  const [deleteWorkflow, setDeleteWorkflow] = useState("__none__");
  const [deleteWorkflowOptions, setDeleteWorkflowOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [pendingManageActionType, setPendingManageActionType] = useState<"archive" | "active" | "inactive" | null>(null);
  const [manageActionRemark, setManageActionRemark] = useState("");
  const [manageActionRemarkError, setManageActionRemarkError] = useState("");
  const [shellOffset, setShellOffset] = useState({ top: 56, left: 0 });
  const [viewportWidth, setViewportWidth] = useState(0);
  const isNotificationsPanelOpen = useNotificationsPanelOpen();
  const isAnyUserDialogOpen = addDialogOpen || Boolean(viewingMember) || Boolean(editingMember) || remarkDialogOpen;
  const pageMemberCount = useMemo(() => paginatedMembers.length, [paginatedMembers]);
  const totalMembersForTab = statusCounts[statusTab];

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

  const openMemberPreview = useCallback(async (
    member: AppUser,
    tabOverride?: "active" | "pending" | "inactive",
  ) => {
    const effectiveTab = tabOverride ?? statusTab;
    try {
      setIsOpeningMemberPreview(true);
      const detailedMember = await fetchUserDetails(effectiveTab, {
        id: member.id || member.requestId || member.uuid || null,
        email: member.email || member.basicDetails?.email || null,
      });
      setHistoryPreviewDetail(null);
      setHistoryPreviewEvent(null);
      setViewingMember(detailedMember);
    } catch (error) {
      toast({
        title: "Unable to load user details",
        description: getApiErrorMessage(error, "Failed to fetch the selected user details."),
        variant: "destructive",
      });
    } finally {
      setIsOpeningMemberPreview(false);
    }
  }, [statusTab, toast]);

  useEffect(() => {
    if (!viewingMember) {
      setHistoryPreviewDetail(null);
      setHistoryPreviewEvent(null);
    }
  }, [viewingMember]);

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
      await startUserLockSession(member);
      await loadWorkflowOptionsForMemberAction(member);
    } catch (error) {
      setDeleteWorkflowOptions([]);
      toast({
        title: "Action unavailable",
        description: error instanceof Error ? error.message : "Unable to lock user for this action.",
        variant: "destructive",
      });
      return;
    }
    setViewingMember(member);
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

  return (
    <div className="space-y-4">
      <UserFilters
        statusTab={statusTab}
        onStatusTabChange={setStatusTab}
        search={search}
        onSearchChange={setSearch}
        searchSuggestions={searchSuggestions}
        designationFilters={designationFilters}
        nodeNameFilters={departmentFilters}
        nodeTypeFilters={nodeTypeFilters}
        accessCategoryFilters={accessCategoryFilters}
        accessSubcategoryFilters={accessSubcategoryFilters}
        reportingManagerFilters={reportingManagerFilters}
        statusFilters={statusFilters}
        roleFilters={roleFilters}
        nodeAccessType={nodeAccessType}
        pendingActionFilter={pendingActionFilter}
        onboardingDateRange={onboardingDateRange}
        onboardingDateFrom={onboardingDateFrom}
        onboardingDateTo={onboardingDateTo}
        onClearAdvancedFilters={clearAdvancedFilters}
        onOpenFilters={loadFilterOptions}
        onApplyAdvancedFilters={applyAdvancedFilters}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        hasNewUserEvent={hasNewUserEvent}
        suppressAutoEventTooltip={isAnyUserDialogOpen || isNotificationsPanelOpen}
        refreshInitializedAt={refreshInitializedAt}
        onRefresh={async () => {
          await loadUsers(true);
          setHasNewUserEvent(false);
        }}
        roles={roles}
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
      />

      <Card className="overflow-hidden border-slate-200 shadow-sm md:flex md:h-[calc(100dvh-21rem)] md:min-h-[420px] md:flex-col">
        <CardHeader className="flex flex-col gap-4 border-b border-slate-200 bg-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              {statusTab === "inactive" ? <EyeOff className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {statusHeading} ({statusCounts[statusTab]})
            </CardTitle>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
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
              isLoading={isLoading}
              currentMembers={currentMembers}
              paginatedMembers={paginatedMembers}
              onView={(member) => {
                void openMemberPreview(member);
              }}
              onOpenHistoryDetail={(member, detail) => {
                void (async () => {
                  try {
                    setIsOpeningMemberPreview(true);
                    const detailedMember = await fetchUserDetails(statusTab, {
                      id: member.id || member.requestId || member.uuid || null,
                      email: member.email || member.basicDetails?.email || null,
                    });
                    setViewingMember(detailedMember);
                    setHistoryOpenForMember(true);
                    setHistoryPreviewDetail(detail);
                    setHistoryPreviewEvent(null);
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

          <UserPagination
            currentCount={currentMembers.length}
            recordCurrentCount={pageMemberCount}
            recordTotalCount={totalMembersForTab}
            recordLabel="Records"
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            safePage={safePage}
            totalPages={totalPages}
            onPrevPage={() => void handlePrevPage()}
            onNextPage={() => void handleNextPage()}
            onJumpToPage={(value) => void handleJumpToPage(value)}
            className="sticky bottom-0 z-20 shrink-0 flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          />
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
              className="fixed z-[49] bg-slate-900/40 backdrop-blur-sm transition-[top,left,width,height,opacity] duration-300"
              style={
                canUseSplitHistory
                  ? {
                      top: `${shellOffset.top}px`,
                      left: `${shellOffset.left}px`,
                      width: `calc(100vw - ${shellOffset.left}px - ${computedHistoryPanelWidth}px)`,
                      height: `calc(100vh - ${shellOffset.top}px)`,
                      transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
                    }
                  : {
                      top: "0px",
                      left: "0px",
                      width: "100vw",
                      height: "100vh",
                      transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
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
              ? "flex flex-col overflow-hidden rounded-none p-0 max-w-none transition-[top,left,width,height,transform] duration-300 will-change-[width] data-[state=open]:animate-none data-[state=closed]:animate-none"
              : "flex h-[92vh] w-[96vw] max-w-[1200px] flex-col overflow-hidden p-0 transition-[transform,opacity] duration-350 data-[state=open]:animate-none data-[state=closed]:animate-none"
          }
          style={
            canUseSplitHistory
              ? {
                  top: `${shellOffset.top}px`,
                  left: `${shellOffset.left}px`,
                  width: `calc(100vw - ${shellOffset.left}px - ${computedHistoryPanelWidth}px)`,
                  height: `calc(100vh - ${shellOffset.top}px)`,
                  transform: "translate(0, 0)",
                  transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
                }
              : { transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }
          }
        >
          <DialogTitle className="sr-only">Manage User</DialogTitle>
          <DialogDescription className="sr-only">
            Review and manage selected user details, permissions, and status actions.
          </DialogDescription>
          {viewingMember ? (
            <UserManagePreview
              member={viewingMember}
              currentTab={statusTab}
              onApprovePending={handleActivateMember}
              onRejectPending={handleDeactivateMember}
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
                    await startUserLockSession(member);
                    await loadWorkflowOptionsForMemberAction(member);
                  } catch (error) {
                    setDeleteWorkflowOptions([]);
                    toast({
                      title: "Action unavailable",
                      description: error instanceof Error ? error.message : "Unable to lock user for this action.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setViewingMember(member);
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
                      description: error instanceof Error ? error.message : "Unable to lock user for edit.",
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
          ) : isOpeningMemberPreview ? (
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
