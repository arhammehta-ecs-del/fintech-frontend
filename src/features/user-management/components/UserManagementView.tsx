import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { EyeOff, Users, UserPlus } from "lucide-react";
import type { AppUser } from "@/contexts/AppContext";
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
import { fetchCompanyNodesWithAccess } from "@/services/user.service";
import { useEditLockSession } from "@/hooks/useEditLockSession";
import EditLockWarningDialog from "@/components/EditLockWarningDialog";
import { useNotificationsPanelOpen } from "@/hooks/useNotificationsPanelOpen";
// import { acquireEditLock } from "@/services/edit-lock.service";

export function UserManagementView() {
  const { toast } = useToast();
  const userLockSession = useEditLockSession();
  const {
    search,
    setSearch,
    searchSuggestions,
    designationFilters,
    setDesignationFilters,
    accessCategoryFilters,
    setAccessCategoryFilters,
    accessSubcategoryFilters,
    setAccessSubcategoryFilters,
    departmentFilters,
    setDepartmentFilters,
    reportingManagerFilters,
    setReportingManagerFilters,
    primaryNodeFilters,
    setPrimaryNodeFilters,
    secondaryNodeFilters,
    setSecondaryNodeFilters,
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
    departments,
    reportingManagerOptions,
    primaryNodeOptions,
    secondaryNodeOptions,
    toggleFilterValue,
    clearAdvancedFilters,
    isLoading,
    currentMembers,
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
  const canSplitHistoryLayout =
    (viewingMember?.status === "Pending" || Boolean(viewingMember?.isPending)) &&
    availableContentWidth >= MIN_DIALOG_SPLIT_WIDTH + MIN_HISTORY_WIDTH;
  const canUseSplitHistory =
    (viewingMember?.status === "Pending" || Boolean(viewingMember?.isPending)) &&
    historyOpenForMember &&
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
        onToggleDesignation={(value) => setDesignationFilters((current) => toggleFilterValue(current, value))}
        accessCategoryFilters={accessCategoryFilters}
        onToggleAccessCategory={(value) => setAccessCategoryFilters((current) => toggleFilterValue(current, value))}
        accessSubcategoryFilters={accessSubcategoryFilters}
        onToggleAccessSubcategory={(value) => setAccessSubcategoryFilters((current) => toggleFilterValue(current, value))}
        departmentFilters={departmentFilters}
        onToggleDepartment={(value) => setDepartmentFilters((current) => toggleFilterValue(current, value))}
        reportingManagerFilters={reportingManagerFilters}
        onToggleReportingManager={(value) => setReportingManagerFilters((current) => toggleFilterValue(current, value))}
        primaryNodeFilters={primaryNodeFilters}
        onTogglePrimaryNode={(value) => setPrimaryNodeFilters((current) => toggleFilterValue(current, value))}
        secondaryNodeFilters={secondaryNodeFilters}
        onToggleSecondaryNode={(value) => setSecondaryNodeFilters((current) => toggleFilterValue(current, value))}
        onboardingDateFrom={onboardingDateFrom}
        onboardingDateTo={onboardingDateTo}
        onOnboardingDateFromChange={setOnboardingDateFrom}
        onOnboardingDateToChange={setOnboardingDateTo}
        onClearAdvancedFilters={clearAdvancedFilters}
        onApplyAdvancedFilters={(filters) => {
          setDesignationFilters(filters.designationFilters);
          setAccessCategoryFilters(filters.accessCategoryFilters);
          setAccessSubcategoryFilters(filters.accessSubcategoryFilters);
          setDepartmentFilters(filters.departmentFilters);
          setReportingManagerFilters(filters.reportingManagerFilters);
          setPrimaryNodeFilters(filters.primaryNodeFilters);
          setSecondaryNodeFilters(filters.secondaryNodeFilters);
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
        roles={roles}
        accessCategories={accessCategories}
        accessSubcategories={accessSubcategories}
        departments={departments}
        reportingManagerOptions={reportingManagerOptions}
        primaryNodeOptions={primaryNodeOptions}
        secondaryNodeOptions={secondaryNodeOptions}
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
              onView={setViewingMember}
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

      {viewingMember && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[49] bg-slate-900/40 backdrop-blur-sm transition-[top,left,width,height,opacity] duration-500"
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
        open={Boolean(viewingMember)}
        onOpenChange={(open) => {
          if (!open) {
            void (async () => {
              await userLockSession.stopSession(true);
              setViewingMember(null);
            })();
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="hidden"
          onInteractOutside={(event) => {
            if (canUseSplitHistory) {
              event.preventDefault();
            }
          }}
          className={
            canUseSplitHistory
              ? "flex flex-col overflow-hidden rounded-none p-0 max-w-none transition-[top,left,width,height,transform] duration-500 will-change-[width] data-[state=open]:animate-none data-[state=closed]:animate-none"
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
              onToggleHistory={() => setHistoryOpenForMember((current) => !current)}
              isHistoryOpen={historyOpenForMember}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {viewingMember ? (
        <UserHistorySidebar
          isOpen={historyOpenForMember}
          onClose={() => setHistoryOpenForMember(false)}
          user={viewingMember}
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
