import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AppUser } from "@/contexts/AppContext";
import { useAppContext } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { getCompanyUsers } from "@/services/user.service";
import { USER_DEFAULT_PAGE_SIZE, USER_FILTER_CONFIG, USER_PAGE_SIZE_OPTIONS, USER_SEARCH_DEBOUNCE_MS } from "@/features/user-management/constants";
import type { MemberStatusTab, SortOrder } from "@/features/user-management/types";
import { filterMembersList } from "@/features/user-management/hooks/useUserManagement.filtering";
import { createUserManagementActions } from "@/features/user-management/hooks/useUserManagement.actions";
import {
  buildAccessScopeOptions,
  buildDepartmentOptions,
  buildNodeOptionsByType,
  buildReportingManagerOptions,
  buildRoleOptions,
  buildRoleCategoryOptions,
  buildRoleSubcategoryOptions,
  clearUserAdvancedFilters,
  hydrateUserFiltersFromDeepLink,
  hasAppliedUserRefinement,
  resolveStatusTabAfterFiltering,
  toggleFilterValue,
} from "@/features/user-management/hooks/userManagementFilters.utils";

const fuzzyMatch = (text: string, query: string) => {
  const source = text.trim().toLowerCase().replace(/\s+/g, "");
  const target = query.trim().toLowerCase().replace(/\s+/g, "");
  if (!target) return true;
  if (source.includes(target)) return true;
  let index = 0;
  for (const ch of source) {
    if (ch === target[index]) index += 1;
    if (index === target.length) return true;
  }
  return false;
};

export function useUserManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, orgStructure, users, setUsers } = useAppContext();
  const { toast } = useToast();
  const [statusTab, setStatusTab] = useState<MemberStatusTab>("active");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [designationFilters, setDesignationFilters] = useState<string[]>([]);
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);
  const [reportingManagerFilters, setReportingManagerFilters] = useState<string[]>([]);
  const [primaryNodeFilters, setPrimaryNodeFilters] = useState<string[]>([]);
  const [secondaryNodeFilters, setSecondaryNodeFilters] = useState<string[]>([]);
  const [accessCategoryFilters, setAccessCategoryFilters] = useState<string[]>([]);
  const [accessSubcategoryFilters, setAccessSubcategoryFilters] = useState<string[]>([]);
  const [accessScopeFilters, setAccessScopeFilters] = useState<string[]>([]);
  const [roleTypeFilters, setRoleTypeFilters] = useState<string[]>([]);
  const [linkedNodeFilter, setLinkedNodeFilter] = useState("");
  const [linkedNodePathFilter, setLinkedNodePathFilter] = useState("");
  const [linkedCategoryFilter, setLinkedCategoryFilter] = useState("");
  const [linkedSubcategoryFilter, setLinkedSubcategoryFilter] = useState("");
  const [linkedActionFilter, setLinkedActionFilter] = useState<"" | "checker" | "maker" | "viewer">("");
  const [onboardingDateFrom, setOnboardingDateFrom] = useState("");
  const [onboardingDateTo, setOnboardingDateTo] = useState("");
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
      } catch (error) {
        setUsers([]);
        toast({
          title: "Unable to load users",
          description: getApiErrorMessage(error, "Live user API failed. Please try again once the backend is available."),
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
  }, [
    statusTab,
    debouncedSearch,
    designationFilters,
    departmentFilters,
    reportingManagerFilters,
    primaryNodeFilters,
    secondaryNodeFilters,
    accessCategoryFilters,
    accessSubcategoryFilters,
    accessScopeFilters,
    roleTypeFilters,
    onboardingDateFrom,
    onboardingDateTo,
    sortOrder,
    pageSize,
    linkedNodeFilter,
    linkedNodePathFilter,
    linkedCategoryFilter,
    linkedSubcategoryFilter,
    linkedActionFilter,
  ]);

  useEffect(() => {
    hydrateUserFiltersFromDeepLink({
      searchParams,
      setStatusTab,
      setLinkedNodeFilter,
      setLinkedNodePathFilter,
      setLinkedCategoryFilter,
      setLinkedSubcategoryFilter,
      setLinkedActionFilter,
      setAccessCategoryFilters,
      setAccessSubcategoryFilters,
      setDepartmentFilters,
      setPrimaryNodeFilters,
      setSecondaryNodeFilters,
      setSearch,
    });
  }, [searchParams, users]);

  const departments = useMemo(() => buildDepartmentOptions(orgStructure, users), [orgStructure, users]);
  const roles = useMemo(() => buildRoleOptions(users), [users]);
  const reportingManagerOptions = useMemo(() => buildReportingManagerOptions(users), [users]);
  const primaryNodeOptions = useMemo(() => buildNodeOptionsByType(users, "PRIMARY"), [users]);
  const secondaryNodeOptions = useMemo(() => buildNodeOptionsByType(users, "SECONDARY"), [users]);
  const accessCategories = useMemo(() => buildRoleCategoryOptions(users), [users]);
  const accessSubcategories = useMemo(() => buildRoleSubcategoryOptions(users), [users]);
  const accessScopes = useMemo(() => buildAccessScopeOptions(users), [users]);
  const roleTypes = useMemo(() => [...USER_FILTER_CONFIG.roleType.options], []);

  const searchSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const values = new Set<string>();
    users.forEach((user) => {
      [
        user.name,
        user.email,
        user.designation,
        user.department,
        user.employeeId || "",
        user.manager?.name || "",
        user.manager?.email || "",
      ].forEach((field) => {
        if (field && fuzzyMatch(field, q)) values.add(field);
      });
    });
    return Array.from(values).slice(0, 8);
  }, [search, users]);

  const clearAdvancedFilters = () =>
    clearUserAdvancedFilters({
      searchParams,
      setDesignationFilters,
      setDepartmentFilters,
      setReportingManagerFilters,
      setPrimaryNodeFilters,
      setSecondaryNodeFilters,
      setAccessCategoryFilters,
      setAccessSubcategoryFilters,
      setAccessScopeFilters,
      setRoleTypeFilters,
      setOnboardingDateFrom,
      setOnboardingDateTo,
      setLinkedNodeFilter,
      setLinkedNodePathFilter,
      setLinkedCategoryFilter,
      setLinkedSubcategoryFilter,
      setLinkedActionFilter,
      setSearchParams,
    });

  const filterMembers = useCallback(
    (list: AppUser[]) => {
      return filterMembersList({
        list,
        debouncedSearch,
        designationFilters,
        departmentFilters,
        reportingManagerFilters,
        primaryNodeFilters,
        secondaryNodeFilters,
        accessCategoryFilters,
        accessSubcategoryFilters,
        accessScopeFilters,
        roleTypeFilters,
        onboardingDateFrom,
        onboardingDateTo,
        linkedNodeFilter,
        linkedNodePathFilter,
        linkedCategoryFilter,
        linkedSubcategoryFilter,
        linkedActionFilter,
        sortOrder,
      });
    },
    [
      accessCategoryFilters,
      accessSubcategoryFilters,
      accessScopeFilters,
      debouncedSearch,
      departmentFilters,
      designationFilters,
      linkedActionFilter,
      linkedCategoryFilter,
      linkedNodeFilter,
      linkedNodePathFilter,
      linkedSubcategoryFilter,
      onboardingDateFrom,
      onboardingDateTo,
      primaryNodeFilters,
      reportingManagerFilters,
      roleTypeFilters,
      secondaryNodeFilters,
      sortOrder,
    ],
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

  const hasAppliedRefinement = hasAppliedUserRefinement({
    debouncedSearch,
    designationFilters,
    departmentFilters,
    reportingManagerFilters,
    primaryNodeFilters,
    secondaryNodeFilters,
    accessCategoryFilters,
    accessSubcategoryFilters,
    accessScopeFilters,
    roleTypeFilters,
    onboardingDateFrom,
    onboardingDateTo,
    linkedNodeFilter,
    linkedNodePathFilter,
    linkedCategoryFilter,
    linkedSubcategoryFilter,
    linkedActionFilter,
  });

  useEffect(() => {
    const nextStatusTab = resolveStatusTabAfterFiltering({
      statusTab,
      hasAppliedRefinement,
      activeCount: activeMembers.length,
      pendingCount: pendingMembers.length,
      inactiveCount: inactiveMembers.length,
    });
    if (nextStatusTab) setStatusTab(nextStatusTab);
  }, [
    accessCategoryFilters.length,
    accessScopeFilters.length,
    accessSubcategoryFilters.length,
    activeMembers.length,
    debouncedSearch,
    departmentFilters.length,
    designationFilters.length,
    hasAppliedRefinement,
    inactiveMembers.length,
    linkedActionFilter,
    linkedCategoryFilter,
    linkedNodeFilter,
    linkedNodePathFilter,
    linkedSubcategoryFilter,
    onboardingDateFrom,
    onboardingDateTo,
    pendingMembers.length,
    primaryNodeFilters.length,
    reportingManagerFilters.length,
    roleTypeFilters.length,
    secondaryNodeFilters.length,
    statusTab,
  ]);

  const currentMembers =
    statusTab === "pending" ? pendingMembers : statusTab === "inactive" ? inactiveMembers : activeMembers;
  const totalPages = Math.max(1, Math.ceil(currentMembers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedMembers = currentMembers.slice((safePage - 1) * pageSize, safePage * pageSize);

  const {
    updateUsersStatus,
    handleAddUser,
    handleOpenAddUserDialog,
    handleSaveEdit,
    removeMember,
    processUserStatusAction,
    handleActivateMember,
    handleDeactivateMember,
  } = createUserManagementActions({
    toast: (input) => toast(input),
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
  });

  const statusHeading =
    statusTab === "pending" ? "Pending Requests" : statusTab === "inactive" ? "Inactive Members" : "Active Members";

  return {
    users,
    statusTab,
    setStatusTab,
    search,
    setSearch,
    searchSuggestions,
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
    accessCategoryFilters,
    setAccessCategoryFilters,
    accessSubcategoryFilters,
    setAccessSubcategoryFilters,
    accessScopeFilters,
    setAccessScopeFilters,
    roleTypeFilters,
    setRoleTypeFilters,
    onboardingDateFrom,
    setOnboardingDateFrom,
    onboardingDateTo,
    setOnboardingDateTo,
    sortOrder,
    setSortOrder,
    isLoading,
    page,
    setPage,
    pageSize,
    setPageSize,
    addDialogOpen,
    setAddDialogOpen,
    handleOpenAddUserDialog,
    viewingMember,
    setViewingMember,
    editingMember,
    setEditingMember,
    departments,
    roles,
    reportingManagerOptions,
    primaryNodeOptions,
    secondaryNodeOptions,
    accessCategories,
    accessSubcategories,
    accessScopes,
    roleTypes,
    toggleFilterValue,
    clearAdvancedFilters,
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
