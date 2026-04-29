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
import { RemarkDialog } from "@/components/RemarkDialog";

export function UserManagementView() {
  const {
    search,
    setSearch,
    departmentFilter,
    setDepartmentFilter,
    roleFilter,
    setRoleFilter,
    sortOrder,
    setSortOrder,
    roles,
    departments,
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

  return (
    <div className="space-y-4">
      <UserFilters
        statusTab={statusTab}
        onStatusTabChange={setStatusTab}
        search={search}
        onSearchChange={setSearch}
        departmentFilter={departmentFilter}
        onDepartmentFilterChange={setDepartmentFilter}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        roles={roles}
        departments={departments}
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
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
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

      <Dialog open={Boolean(viewingMember)} onOpenChange={(open) => !open && setViewingMember(null)}>
        <DialogContent className="flex h-[92vh] w-[96vw] max-w-[1200px] flex-col overflow-hidden p-0">
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
            />
          ) : null}
        </DialogContent>
      </Dialog>

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
