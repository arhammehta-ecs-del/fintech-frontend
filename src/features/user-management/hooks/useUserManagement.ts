import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppUser } from "@/contexts/AppContext";
import { useAppContext } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { createUserOnboarding, getCompanyUsers } from "@/services/user.service";
import { USER_DEFAULT_PAGE_SIZE, USER_PAGE_SIZE_OPTIONS, USER_SEARCH_DEBOUNCE_MS } from "@/features/user-management/constants";
import type { MemberStatusTab, NewMemberOnboardingFormData, SortOrder } from "@/features/user-management/types";
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
            description: "The member list was updated from the latest company data.",
          });
        }
      } catch {
        setUsers([]);
        toast({
          title: "Unable to load users",
          description: "Live user API failed. Please verify backend response and try again.",
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

  const handleAddMember = async (memberData: NewMemberOnboardingFormData) => {
    if (!memberData.basic.name.trim() || !memberData.basic.email.trim()) return;

    const payload = buildUserOnboardingPayload(memberData);

    try {
      const response = await createUserOnboarding(payload);
      setAddDialogOpen(false);
      setStatusTab("pending");
      await loadUsers(true);

      toast({
        title: "Member added",
        description: response.message || `${memberData.basic.name.trim()} was created as a pending member request.`,
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Unable to submit member onboarding.";
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
      title: "Member updated",
      description: "The member details were saved successfully.",
    });
  };

  const removeMember = (userId: string) => {
    setUsers((previous) => previous.filter((user) => user.id !== userId));
    toast({
      title: "Member removed",
      description: "The member was removed from the company list.",
      variant: "destructive",
    });
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
    handleAddMember,
    handleSaveEdit,
    removeMember,
    statusHeading,
    loadUsers,
  };
}
