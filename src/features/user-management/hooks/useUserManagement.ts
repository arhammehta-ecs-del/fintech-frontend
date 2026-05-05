import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppUser } from "@/contexts/AppContext";
import { useAppContext } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { createUserOnboarding, getCompanyUsers, updateUserStatus } from "@/services/user.service";
import { USER_DEFAULT_PAGE_SIZE, USER_PAGE_SIZE_OPTIONS, USER_SEARCH_DEBOUNCE_MS } from "@/features/user-management/constants";
import type { MemberStatusTab, UserOnboardingFormData, SortOrder } from "@/features/user-management/types";
import { buildUserOnboardingPayload } from "@/features/user-management/utils";

export function useUserManagement() {
  const { currentUser, users, setUsers } = useAppContext();
  const { toast } = useToast();
  const [statusTab, setStatusTab] = useState<MemberStatusTab>("active");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof USER_PAGE_SIZE_OPTIONS)[number]>(USER_DEFAULT_PAGE_SIZE);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [viewingMember, setViewingMember] = useState<AppUser | null>(null);
  const [editingMember, setEditingMember] = useState<AppUser | null>(null);
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ member: AppUser; action: "activate" | "deactivate" } | null>(null);

  const loadUsers = useCallback(
    async (showRefreshToast = false) => {
      const companyCode = currentUser?.companyCode?.trim().toUpperCase();
      if (!companyCode) return;

      setIsLoading(true);
      try {
        const nextUsers = await getCompanyUsers(companyCode);
        setUsers(nextUsers);
        if (showRefreshToast) {
          toast({
            title: "Users refreshed",
            description: "The user list was updated from the latest company data.",
          });
        }
      } catch {
        setUsers([]);
        toast({
          title: "Unable to load users",
          description: "Live user API failed. Please try again once the backend is available.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [currentUser?.companyCode, setUsers, toast],
  );

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) {
      setDebouncedSearch("");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(trimmedSearch);
    }, USER_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusTab, debouncedSearch, departmentFilter, roleFilter, sortOrder, pageSize]);

  const departments = useMemo(
    () => Array.from(new Set(users.map((user) => user.department).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [users],
  );
  const roles = useMemo(
    () => Array.from(new Set(users.map((user) => user.designation).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [users],
  );

  const filterMembers = useCallback(
    (list: AppUser[]) => {
      const normalizedTerm = debouncedSearch.toLowerCase();

      return list
        .filter((user) => {
          const matchesDepartment = departmentFilter === "all" || user.department === departmentFilter;
          const matchesRole = roleFilter === "all" || user.designation === roleFilter;
          const matchesSearch =
            !normalizedTerm ||
            user.name.toLowerCase().includes(normalizedTerm) ||
            user.email.toLowerCase().includes(normalizedTerm) ||
            user.designation.toLowerCase().includes(normalizedTerm) ||
            user.department.toLowerCase().includes(normalizedTerm) ||
            (user.phone ?? "").toLowerCase().includes(normalizedTerm);

          return matchesDepartment && matchesRole && matchesSearch;
        })
        .sort((left, right) => {
          const comparison = left.name.localeCompare(right.name);
          return sortOrder === "asc" ? comparison : -comparison;
        });
    },
    [debouncedSearch, departmentFilter, roleFilter, sortOrder],
  );

  const activeMembers = useMemo(
    () => filterMembers(users.filter((user) => user.status !== "Pending" && user.status !== "Inactive")),
    [filterMembers, users],
  );
  const pendingMembers = useMemo(
    () => filterMembers(users.filter((user) => user.status === "Pending")),
    [filterMembers, users],
  );
  const inactiveMembers = useMemo(
    () => filterMembers(users.filter((user) => user.status === "Inactive")),
    [filterMembers, users],
  );

  const currentMembers =
    statusTab === "pending" ? pendingMembers : statusTab === "inactive" ? inactiveMembers : activeMembers;
  const totalPages = Math.max(1, Math.ceil(currentMembers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedMembers = currentMembers.slice((safePage - 1) * pageSize, safePage * pageSize);

  const updateUsersStatus = (ids: Set<string>, status: AppUser["status"]) => {
    setUsers((previous) => previous.map((user) => (ids.has(user.id) ? { ...user, status } : user)));
  };

  const handleAddUser = async (userData: UserOnboardingFormData) => {
    if (!userData.basic.name.trim() || !userData.basic.email.trim()) return;

    const payload = buildUserOnboardingPayload(userData);

    try {
      const response = await createUserOnboarding(payload);
      setAddDialogOpen(false);
      setStatusTab("pending");
      await loadUsers(true);

      toast({
        title: "User added",
        description: response.message || `${userData.basic.name.trim()} was created as a pending user request.`,
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Unable to submit user onboarding.";
      toast({
        title: "Submission failed",
        description,
        variant: "destructive",
      });
      throw error;
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

  const removeMember = (userId: string) => {
    setUsers((previous) => previous.filter((user) => user.id !== userId));
    toast({
      title: "User removed",
      description: "The user was removed from the company list.",
      variant: "destructive",
    });
  };

  const executeUserStatusAction = async (member: AppUser, action: "activate" | "deactivate", _remark?: string) => {
    if (!member.id) {
      toast({ title: "Action failed", description: "User ID is missing", variant: "destructive" });
      return;
    }

    try {
      if (!member.email?.trim()) {
        throw new Error("User email is missing");
      }

      await updateUserStatus(member.id, action === "activate" ? "approve" : "reject", _remark ?? "");
      updateUsersStatus(new Set([member.id]), action === "activate" ? "Active" : "Inactive");
      toast({
        title: action === "activate" ? "User activated" : "User deactivated",
        description: `${member.name} was moved to ${action === "activate" ? "active" : "inactive"} users.`,
      });
    } catch (error) {
      toast({
        title: action === "activate" ? "Activation failed" : "Deactivation failed",
        description: error instanceof Error ? error.message : "Unable to update user request.",
        variant: "destructive",
      });
    }
  };

  const handleUserStatusAction = (member: AppUser, action: "activate" | "deactivate") => {
    if (!member.id) {
      toast({ title: "Action failed", description: "User ID is missing", variant: "destructive" });
      return;
    }
    setPendingAction({ member, action });
    setRemarkDialogOpen(true);
  };

  const processUserStatusAction = async (_remark: string) => {
    if (!pendingAction) return;
    const { member, action } = pendingAction;
    await executeUserStatusAction(member, action, _remark);
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

  const statusHeading =
    statusTab === "pending" ? "Pending Requests" : statusTab === "inactive" ? "Inactive Members" : "Active Members";

  return {
    users,
    statusTab,
    setStatusTab,
    search,
    setSearch,
    departmentFilter,
    setDepartmentFilter,
    roleFilter,
    setRoleFilter,
    sortOrder,
    setSortOrder,
    isLoading,
    page,
    setPage,
    pageSize,
    setPageSize,
    addDialogOpen,
    setAddDialogOpen,
    viewingMember,
    setViewingMember,
    editingMember,
    setEditingMember,
    departments,
    roles,
    activeMembers,
    pendingMembers,
    inactiveMembers,
    currentMembers,
    totalPages,
    safePage,
    paginatedMembers,
    updateUsersStatus,
    handleAddUser,
    handleActivateMember,
    handleDeactivateMember,
    handleSaveEdit,
    removeMember,
    statusHeading,
    loadUsers,
    remarkDialogOpen,
    setRemarkDialogOpen,
    pendingAction,
    processUserStatusAction,
  };
}
