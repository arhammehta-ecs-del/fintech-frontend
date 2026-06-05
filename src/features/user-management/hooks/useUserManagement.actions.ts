import type { Dispatch, SetStateAction } from "react";
import type { AppUser, OrgNode } from "@/contexts/AppContext";
import { getApiErrorMessage } from "@/services/client";
import { createUserOnboarding, fetchCompanyNodesWithAccess, updateUserStatus } from "@/services/user.service";
// import { acquireEditLock } from "@/services/edit-lock.service";
import type { UserOnboardingFormData } from "@/features/user-management/types";
import { buildSignatoryOnboardingPayload, buildUserOnboardingPayload, buildUserUpdatePayload } from "@/features/user-management/utils";

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
  loadUsers: (
    showRefreshToast?: boolean,
    overrideStatusTab?: "active" | "pending" | "inactive",
  ) => Promise<
    | {
        counts: { active: number; pending: number; inactive: number };
      }
    | null
  >;
  editingMember: AppUser | null;
  pendingAction: PendingAction;
  orgStructure: OrgNode | null;
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
  orgStructure,
}: CreateActionsInput) => {
  const updateUsersStatus = (ids: Set<string>, status: AppUser["status"]) => {
    setUsers((previous) => previous.map((user) => (ids.has(user.id) ? { ...user, status } : user)));
  };

  const handleAddUser = async (userData: UserOnboardingFormData, context?: { seedMember?: AppUser | null }) => {
    if (!userData.basic.name.trim() || !userData.basic.email.trim()) return;

    try {
      const isGlobalSignatoryFlow = userData.isGlobalUserEligible && userData.isGlobalSignatory;
      if (isGlobalSignatoryFlow && (!orgStructure?.name?.trim() || !orgStructure?.nodePath?.trim())) {
        throw new Error("Company node name/path is missing for signatory onboarding.");
      }
      const isUpdateRequest = Boolean(context?.seedMember);
      const response = isGlobalSignatoryFlow
        ? await createUserOnboarding(
          buildSignatoryOnboardingPayload(userData, {
            nodeName: orgStructure?.name?.trim() || "",
            nodePath: orgStructure?.nodePath?.trim() || "",
            nodeType: orgStructure?.nodeType?.trim() || "",
          }),
        )
        : await createUserOnboarding(
          isUpdateRequest && context?.seedMember
            ? buildUserUpdatePayload(userData, context.seedMember)
            : buildUserOnboardingPayload(userData),
        );
      setAddDialogOpen(false);
      setStatusTab("pending");
      await loadUsers(true, "pending");

      toast({
        title: isUpdateRequest ? "Update initiated" : "User added",
        description:
          response.message ||
          (isUpdateRequest
            ? `${userData.basic.name.trim()} update request was submitted.`
            : `${userData.basic.name.trim()} was created as a pending user request.`),
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

  const handleOpenAddUserDialog = async () => {
    try {
      await fetchCompanyNodesWithAccess("USER_ACC");
      setAddDialogOpen(true);
    } catch (error) {
      setAddDialogOpen(false);
      toast({
        title: "Access denied",
        description: getApiErrorMessage(error, "You do not have permission to initiate USER_ACC onboarding."),
        variant: "destructive",
      });
    }
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

  const removeMember = async (targetMail: string, remark: string, levelsHash?: string | null) => {

    await createUserOnboarding({
      type: "archive",
      targetUserEmail: targetMail.trim() || null,
      remarks: remark.trim(),
      levelsHash: levelsHash?.trim() || null,
    });
    setUsers((previous) => previous.filter((user) => user.email !== targetMail));
    toast({
      title: "Delete initiated",
      description: "Delete user request has been submitted.",
      variant: "destructive",
    });
  };

  const executeUserStatusAction = async (
    member: AppUser,
    action: StatusAction,
    remark?: string,
    levelsHash?: string | null,
  ) => {
    try {
      if (!member.email?.trim()) {
        throw new Error("User email is missing");
      }
      // Temporarily disabled user edit-lock.
      // await acquireEditLock({ type: "user", target: member.email.trim() });

      const isPendingMember = member.status === "Pending" || Boolean(member.isPending);

      if (isPendingMember) {
        if (!member.id) {
          toast({ title: "Action failed", description: "User ID is missing", variant: "destructive" });
          return;
        }
        await updateUserStatus(
          member.id,
          action === "activate" ? "approve" : "reject",
          remark?.trim() || "",
        );
      } else {
        const normalizedRemark = (remark || "").trim();
        await createUserOnboarding({
          type: action === "activate" ? "active" : "inactive",
          targetUserEmail: member.email.trim(),
          remarks: normalizedRemark,
          levelsHash: levelsHash?.trim() || null,
        });
      }
      setViewingMember(null);
      if (isPendingMember) {
        const pendingResponse = await loadUsers(false, "pending");
        const remainingPendingCount = pendingResponse?.counts.pending ?? 0;
        if (remainingPendingCount === 0) {
          setStatusTab("active");
          await loadUsers(false, "active");
        } else {
          setStatusTab("pending");
        }
      } else {
        await loadUsers(false);
      }
      toast({
        title:
          isPendingMember
            ? action === "activate"
              ? "User approved"
              : "User rejected"
            : action === "activate"
              ? "User activated"
              : "User deactivated",
        description:
          isPendingMember
            ? `${member.name} ${action === "activate" ? "approval" : "rejection"} submitted.`
            : `${member.name} ${action === "activate" ? "activation" : "inactivation"} request submitted.`,
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
    executeUserStatusAction,
  };
};
