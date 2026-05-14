import type { Dispatch, SetStateAction } from "react";
import type { AppUser } from "@/contexts/AppContext";
import { getApiErrorMessage } from "@/services/client";
import { createGlobalSignatoryOnboarding, createUserOnboarding, updateUserStatus } from "@/services/user.service";
import type { UserOnboardingFormData } from "@/features/user-management/types";
import { buildUserOnboardingPayload } from "@/features/user-management/utils";

type StatusAction = "activate" | "deactivate";
type PendingAction = { member: AppUser; action: StatusAction } | null;

type CreateActionsInput = {
  toast: (args: { title: string; description: string; variant?: "default" | "destructive" }) => void;
  setUsers: Dispatch<SetStateAction<AppUser[]>>;
  setAddDialogOpen: Dispatch<SetStateAction<boolean>>;
  setStatusTab: Dispatch<SetStateAction<"active" | "pending" | "inactive">>;
  setViewingMember: Dispatch<SetStateAction<AppUser | null>>;
  setEditingMember: Dispatch<SetStateAction<AppUser | null>>;
  setPendingAction: Dispatch<SetStateAction<PendingAction>>;
  setRemarkDialogOpen: Dispatch<SetStateAction<boolean>>;
  loadUsers: (showRefreshToast?: boolean) => Promise<void>;
  editingMember: AppUser | null;
  pendingAction: PendingAction;
};

export const createUserManagementActions = ({
  toast,
  setUsers,
  setAddDialogOpen,
  setStatusTab,
  setViewingMember,
  setEditingMember,
  setPendingAction,
  setRemarkDialogOpen,
  loadUsers,
  editingMember,
  pendingAction,
}: CreateActionsInput) => {
  const updateUsersStatus = (ids: Set<string>, status: AppUser["status"]) => {
    setUsers((previous) => previous.map((user) => (ids.has(user.id) ? { ...user, status } : user)));
  };

  const handleAddUser = async (userData: UserOnboardingFormData) => {
    if (!userData.basic.name.trim() || !userData.basic.email.trim()) return;

    try {
      const isGlobalSignatoryFlow = userData.isGlobalUserEligible && userData.isGlobalSignatory;
      const response = isGlobalSignatoryFlow
        ? await createGlobalSignatoryOnboarding({
          name: userData.basic.name.trim(),
          email: userData.basic.email.trim(),
          phone: userData.basic.phone.trim(),
          designation: userData.basic.designation.trim(),
          employeeId: userData.basic.employeeId.trim() || null,
          isGlobalUser: true,
        })
        : await createUserOnboarding(buildUserOnboardingPayload(userData));
      setAddDialogOpen(false);
      setStatusTab("pending");
      await loadUsers(true);

      toast({
        title: "User added",
        description: response.message || `${userData.basic.name.trim()} was created as a pending user request.`,
      });
    } catch (error) {
      const description = getApiErrorMessage(error, "Unable to submit user onboarding.");
      toast({
        title: "Submission failed",
        description,
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleOpenAddUserDialog = () => {
    setAddDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingMember) return;

    setUsers((previous) => previous.map((user) => (user.id === editingMember.id ? editingMember : user)));
    setEditingMember(null);
    toast({
      title: "User updated",
      description: "The user details were saved successfully.",
    });
  };

  const removeMember = (userId: string) => {
    setUsers((previous) => previous.filter((user) => user.id !== userId));
    toast({
      title: "User removed",
      description: "The user was removed from the company list.",
      variant: "destructive",
    });
  };

  const executeUserStatusAction = async (member: AppUser, action: StatusAction, remark?: string) => {
    if (!member.id) {
      toast({ title: "Action failed", description: "User ID is missing", variant: "destructive" });
      return;
    }

    try {
      if (!member.email?.trim()) {
        throw new Error("User email is missing");
      }

      await updateUserStatus(member.id, action === "activate" ? "approve" : "reject", remark ?? "");
      await loadUsers();
      setViewingMember(null);
      if (action === "activate") {
        setStatusTab("active");
      }
      toast({
        title: action === "activate" ? "User activated" : "User deactivated",
        description: `${member.name} was moved to ${action === "activate" ? "active" : "inactive"} users.`,
      });
    } catch (error) {
      toast({
        title: action === "activate" ? "Activation failed" : "Deactivation failed",
        description: getApiErrorMessage(error, "Unable to update user request."),
        variant: "destructive",
      });
    }
  };

  const handleUserStatusAction = (member: AppUser, action: StatusAction) => {
    if (!member.id) {
      toast({ title: "Action failed", description: "User ID is missing", variant: "destructive" });
      return;
    }
    setPendingAction({ member, action });
    setRemarkDialogOpen(true);
  };

  const processUserStatusAction = async (remark: string) => {
    if (!pendingAction) return;
    const { member, action } = pendingAction;
    await executeUserStatusAction(member, action, remark);
    setPendingAction(null);
  };

  const handleActivateMember = (member: AppUser, remark?: string) => {
    if (remark?.trim()) {
      void executeUserStatusAction(member, "activate", remark);
      return;
    }
    void handleUserStatusAction(member, "activate");
  };

  const handleDeactivateMember = (member: AppUser, remark?: string) => {
    if (remark?.trim()) {
      void executeUserStatusAction(member, "deactivate", remark);
      return;
    }
    void handleUserStatusAction(member, "deactivate");
  };

  return {
    updateUsersStatus,
    handleAddUser,
    handleOpenAddUserDialog,
    handleSaveEdit,
    removeMember,
    processUserStatusAction,
    handleActivateMember,
    handleDeactivateMember,
  };
};
