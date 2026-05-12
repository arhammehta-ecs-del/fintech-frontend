import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EyeOff, Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UserOnboardingDialog } from "@/features/user-management";
import EditMemberDialog from "@/features/user-management/components/EditMemberDialog";
import UserFilters from "@/features/user-management/components/UserFilters";
import UserPagination from "@/features/user-management/components/UserPagination";
import UserTable from "@/features/user-management/components/UserTable";
import { useUserManagement } from "@/features/user-management/hooks/useUserManagement";
import { UserManagePreview } from "./UserManagePreview";
import UserHistorySidebar from "./UserHistorySidebar";
import { RemarkDialog } from "@/components/RemarkDialog";

export function UserManagementView() {
  const {
    search,
    setSearch,
    designationFilters,
    setDesignationFilters,
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
    roles,
    departments,
    reportingManagerOptions,
    primaryNodeOptions,
    secondaryNodeOptions,
    toggleFilterValue,
    clearAdvancedFilters,
    activeMembers,
    pendingMembers,
    inactiveMembers,
    isLoading,
    currentMembers,
    paginatedMembers,
    pageSize,
    setPageSize,
    safePage,
    totalPages,
    setPage,
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
    statusTab,
    setStatusTab,
    statusHeading,
    remarkDialogOpen,
    setRemarkDialogOpen,
    pendingAction,
    processUserStatusAction,
  } = useUserManagement();
  const [historyOpenForMember, setHistoryOpenForMember] = useState(false);
  const [shellOffset, setShellOffset] = useState({ top: 56, left: 0 });
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    if (!viewingMember) {
      setHistoryOpenForMember(false);
    }
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
    viewingMember?.status === "Pending" &&
    availableContentWidth >= MIN_DIALOG_SPLIT_WIDTH + MIN_HISTORY_WIDTH;
  const canUseSplitHistory =
    viewingMember?.status === "Pending" &&
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
        designationFilters={designationFilters}
        onToggleDesignation={(value) => setDesignationFilters((current) => toggleFilterValue(current, value))}
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
          setDepartmentFilters(filters.departmentFilters);
          setReportingManagerFilters(filters.reportingManagerFilters);
          setPrimaryNodeFilters(filters.primaryNodeFilters);
          setSecondaryNodeFilters(filters.secondaryNodeFilters);
        }}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        roles={roles}
        departments={departments}
        reportingManagerOptions={reportingManagerOptions}
        primaryNodeOptions={primaryNodeOptions}
        secondaryNodeOptions={secondaryNodeOptions}
        statusCounts={{
          active: activeMembers.length,
          pending: pendingMembers.length,
          inactive: inactiveMembers.length,
        }}
      />

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-slate-200 bg-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              {statusTab === "inactive" ? <EyeOff className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {statusHeading} ({currentMembers.length})
            </CardTitle>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void handleOpenAddUserDialog()}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              Add User
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <UserTable
              isLoading={isLoading}
              currentMembers={currentMembers}
              paginatedMembers={paginatedMembers}
              onView={setViewingMember}
            />
          </div>

          <UserPagination
            currentCount={currentMembers.length}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            safePage={safePage}
            totalPages={totalPages}
            onPrevPage={() => setPage((previous) => Math.max(1, previous - 1))}
            onNextPage={() => setPage((previous) => Math.min(totalPages, previous + 1))}
          />
        </CardContent>
      </Card>

      <UserOnboardingDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSubmit={handleAddUser} />

      {viewingMember && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[49] bg-slate-900/40 backdrop-blur-sm transition-[top,left,width,height,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
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

      <Dialog modal={false} open={Boolean(viewingMember)} onOpenChange={(open) => !open && setViewingMember(null)}>
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
              ? "flex flex-col overflow-hidden rounded-none p-0 max-w-none transition-[top,left,width,height,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] data-[state=open]:animate-none data-[state=closed]:animate-none"
              : "flex h-[92vh] w-[96vw] max-w-[1200px] flex-col overflow-hidden p-0 transition-[transform,opacity] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=open]:animate-none data-[state=closed]:animate-none"
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
              : undefined
          }
        >
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
              onClose={() => setViewingMember(null)}
              onToggleHistory={
                viewingMember.status === "Pending" ? () => setHistoryOpenForMember((current) => !current) : undefined
              }
              isHistoryOpen={historyOpenForMember}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {viewingMember?.status === "Pending" ? (
        <UserHistorySidebar
          isOpen={historyOpenForMember}
          onClose={() => setHistoryOpenForMember(false)}
          user={viewingMember}
          dockOffset={splitDockOffset}
          splitView={canSplitHistoryLayout}
          panelWidth={computedHistoryPanelWidth}
        />
      ) : null}

      <Dialog open={Boolean(editingMember)} onOpenChange={(open) => !open && setEditingMember(null)}>
        {editingMember ? (
          <EditMemberDialog
            editingMember={editingMember}
            onEditMemberChange={setEditingMember}
            onSave={handleSaveEdit}
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
    </div>
  );
}
