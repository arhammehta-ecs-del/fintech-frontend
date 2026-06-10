import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppUser } from "@/contexts/AppContext";
import { useAppContext } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { connectNotificationStream } from "@/services/notification.service";
import {
  fetchCompanyUsersPaginated,
  fetchUserFilterDropdowns,
  type UserAppliedFilters,
  type UserFilterDropdowns,
} from "@/services/user.service";
import { USER_DEFAULT_PAGE_SIZE, USER_PAGE_SIZE_OPTIONS, USER_SEARCH_DEBOUNCE_MS } from "@/features/user-management/constants";
import type { MemberStatusTab, SortOrder } from "@/features/user-management/types";
import { createUserManagementActions } from "@/features/user-management/hooks/useUserManagement.actions";

type FilterStatusValue = "Active" | "Pending" | "Inactive" | "Modification In Progress";
type FilterRoleValue = "Maker" | "Checker" | "User";
type NodeAccessValue = "Primary" | "Secondary" | null;
type PendingActionValue = "Yes" | "No" | null;
type OnboardingDateRange = "7DAYS" | "15DAYS" | "1MONTH" | "1YEAR" | "CUSTOM" | null;
type AppliedUserFiltersDraft = {
  designationFilters: string[];
  nodeNameFilters: string[];
  nodeTypeFilters: string[];
  accessCategoryFilters: string[];
  accessSubcategoryFilters: string[];
  reportingManagerFilters: string[];
  statusFilters: FilterStatusValue[];
  roleFilters: FilterRoleValue[];
  nodeAccessType: NodeAccessValue;
  pendingActionFilter: PendingActionValue;
  onboardingDateRange: OnboardingDateRange;
  onboardingDateFrom: string;
  onboardingDateTo: string;
};

const DEFAULT_FILTER_DROPDOWNS: UserFilterDropdowns = {
  designation: [],
  nodeName: [],
  nodeType: [],
  category: [],
  subCategory: {},
  reportingManager: [],
};

const FILTER_STATUS_TO_TAB: Record<FilterStatusValue, MemberStatusTab> = {
  Active: "active",
  Pending: "pending",
  Inactive: "inactive",
  "Modification In Progress": "active",
};

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

const toggleFilterValue = (current: string[], value: string) =>
  current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

const normalizeAppliedArray = (values: string[]) => (values.length > 0 ? values : null);

const buildAppliedFilters = (input: AppliedUserFiltersDraft): UserAppliedFilters => {
  const dateFilter =
    input.onboardingDateRange || input.onboardingDateFrom || input.onboardingDateTo
      ? {
          dateRange: input.onboardingDateRange && input.onboardingDateRange !== "CUSTOM" ? input.onboardingDateRange : null,
          fromDate: input.onboardingDateFrom || null,
          toDate: input.onboardingDateTo || null,
        }
      : null;

  return {
    designation: normalizeAppliedArray(input.designationFilters),
    nodeName: {
      values: normalizeAppliedArray(input.nodeNameFilters),
      nodeAccess: input.nodeAccessType ? (input.nodeAccessType === "Primary" ? "Primary" : "Secondary") : null,
    },
    nodeType: normalizeAppliedArray(input.nodeTypeFilters),
    category: normalizeAppliedArray(input.accessCategoryFilters),
    subCategory: normalizeAppliedArray(input.accessSubcategoryFilters),
    reportingManager: normalizeAppliedArray(input.reportingManagerFilters),
    onboardingDate: dateFilter,
    status: normalizeAppliedArray(input.statusFilters),
    role: input.roleFilters.length > 0 ? input.roleFilters : null,
    isPending: input.pendingActionFilter,
  };
};

export function useUserManagement() {
  const { currentUser, orgStructure, users, setUsers } = useAppContext();
  const { toast } = useToast();
  const [statusTab, setStatusTab] = useState<MemberStatusTab>("active");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [designationFilters, setDesignationFilters] = useState<string[]>([]);
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);
  const [reportingManagerFilters, setReportingManagerFilters] = useState<string[]>([]);
  const [accessCategoryFilters, setAccessCategoryFilters] = useState<string[]>([]);
  const [accessSubcategoryFilters, setAccessSubcategoryFilters] = useState<string[]>([]);
  const [nodeTypeFilters, setNodeTypeFilters] = useState<string[]>([]);
  const [roleFilters, setRoleFilters] = useState<FilterRoleValue[]>([]);
  const [statusFilters, setStatusFilters] = useState<FilterStatusValue[]>([]);
  const [nodeAccessType, setNodeAccessType] = useState<NodeAccessValue>(null);
  const [pendingActionFilter, setPendingActionFilter] = useState<PendingActionValue>(null);
  const [onboardingDateRange, setOnboardingDateRange] = useState<OnboardingDateRange>(null);
  const [onboardingDateFrom, setOnboardingDateFrom] = useState("");
  const [onboardingDateTo, setOnboardingDateTo] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [isLoading, setIsLoading] = useState(false);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof USER_PAGE_SIZE_OPTIONS)[number]>(USER_DEFAULT_PAGE_SIZE);
  const [resolvedTotalPages, setResolvedTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState<Record<MemberStatusTab, number>>({
    active: 0,
    pending: 0,
    inactive: 0,
  });
  const [topCursor, setTopCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [pageCursors, setPageCursors] = useState<Record<number, string | null>>({ 1: null });
  const [filterDropdowns, setFilterDropdowns] = useState<UserFilterDropdowns>(DEFAULT_FILTER_DROPDOWNS);
  const lastActivityToastKeyRef = useRef<string>("");
  const isLoadingRef = useRef(false);
  const queuedLoadRequestRef = useRef<{ showRefreshToast: boolean; overrideStatusTab?: MemberStatusTab } | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [viewingMember, setViewingMember] = useState<AppUser | null>(null);
  const [editingMember, setEditingMember] = useState<AppUser | null>(null);
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ member: AppUser; action: "activate" | "deactivate" } | null>(null);
  const [hasNewUserEvent, setHasNewUserEvent] = useState(false);
  const [hasLoadedUsersOnce, setHasLoadedUsersOnce] = useState(false);
  const [isFilterRequestActive, setIsFilterRequestActive] = useState(false);

  const selectedFilterStatus = statusFilters[0] ?? null;
  const effectiveStatusTab = selectedFilterStatus ? FILTER_STATUS_TO_TAB[selectedFilterStatus] : statusTab;

  const appliedFilters = useMemo<UserAppliedFilters>(
    () =>
      buildAppliedFilters({
        designationFilters,
        nodeNameFilters: departmentFilters,
        nodeTypeFilters,
        accessCategoryFilters,
        accessSubcategoryFilters,
        reportingManagerFilters,
        statusFilters,
        roleFilters,
        nodeAccessType,
        pendingActionFilter,
        onboardingDateRange,
        onboardingDateFrom,
        onboardingDateTo,
      }),
    [
      accessCategoryFilters,
      accessSubcategoryFilters,
      departmentFilters,
      designationFilters,
      nodeAccessType,
      nodeTypeFilters,
      onboardingDateFrom,
      onboardingDateRange,
      onboardingDateTo,
      pendingActionFilter,
      reportingManagerFilters,
      roleFilters,
      statusFilters,
    ],
  );

  const getCountForTab = useCallback(
    (
      counts: { active: number; pending: number; inactive: number },
      tab: MemberStatusTab,
    ) => (tab === "pending" ? counts.pending : tab === "inactive" ? counts.inactive : counts.active),
    [],
  );

  const maybeShowActivityToast = useCallback(
    (response: Awaited<ReturnType<typeof fetchCompanyUsersPaginated>>, tab: MemberStatusTab) => {
      const count = response.pageInfo.newCount;
      if (count <= 0) return;

      const toastKey = `${tab}-new-${count}-${response.pageInfo.topCursor ?? "no-top-cursor"}`;
      if (lastActivityToastKeyRef.current === toastKey) return;
      lastActivityToastKeyRef.current = toastKey;

      toast({
        title: "Activity updated",
        description: `Activity for ${count} user${count === 1 ? "" : "s"} has been executed.`,
      });
    },
    [toast],
  );

  const loadUsers = useCallback(
    async (
      showRefreshToast = false,
      overrideStatusTab?: MemberStatusTab,
      requestOverrides?: { forceFilter?: boolean; applied?: UserAppliedFilters | null },
    ) => {
      const companyCode = currentUser?.companyCode?.trim().toUpperCase();
      if (!companyCode) return null;
      const requestedTab = overrideStatusTab ?? effectiveStatusTab;
      if (isLoadingRef.current) {
        queuedLoadRequestRef.current = { showRefreshToast, overrideStatusTab: requestedTab };
        return null;
      }
      isLoadingRef.current = true;

      setIsLoading(true);
      try {
        const shouldSendFilter = requestOverrides?.forceFilter ?? isFilterRequestActive;
        const requestApplied = requestOverrides?.applied ?? appliedFilters;
        const response = await fetchCompanyUsersPaginated(requestedTab, {
          companyCode,
          filter: shouldSendFilter,
          applied: requestApplied,
          pagination: {
            limit: pageSize,
            cursor: null,
            topCursor: null,
            page: null,
            direction: "NEXT",
            query: debouncedSearch || null,
            statusType: requestedTab,
          },
        });
        setUsers(response.users);
        setPageCursors({ 1: null, 2: response.pageInfo.nextCursor });
        setPage(response.pageInfo.page || 1);
        setTopCursor(response.pageInfo.topCursor);
        setNextCursor(response.pageInfo.nextCursor);
        setHasNext(response.pageInfo.hasNext);
        setResolvedTotalPages(
          response.pageInfo.totalPages ||
            Math.max(1, Math.ceil(getCountForTab(response.counts, requestedTab) / pageSize)),
        );
        setStatusCounts(response.counts);
        setHasLoadedUsersOnce(true);
        maybeShowActivityToast(response, requestedTab);
        if (showRefreshToast) {
          toast({
            title: "Users refreshed",
            description: "The user list was updated from the latest company data.",
          });
        }
        return response;
      } catch (error) {
        setUsers([]);
        toast({
          title: "Unable to load users",
          description: getApiErrorMessage(error, "Live user API failed. Please try again once the backend is available."),
          variant: "destructive",
        });
        return null;
      } finally {
        setIsLoading(false);
        isLoadingRef.current = false;
        if (queuedLoadRequestRef.current) {
          const queuedRequest = queuedLoadRequestRef.current;
          queuedLoadRequestRef.current = null;
          void loadUsers(queuedRequest.showRefreshToast, queuedRequest.overrideStatusTab);
        }
      }
    },
    [appliedFilters, currentUser?.companyCode, debouncedSearch, effectiveStatusTab, getCountForTab, isFilterRequestActive, maybeShowActivityToast, pageSize, setUsers, toast],
  );

  const loadFilterOptions = useCallback(async () => {
    setIsFilterLoading(true);
    try {
      const dropdowns = await fetchUserFilterDropdowns("USER_ACC");
      setFilterDropdowns(dropdowns);
    } catch (error) {
      toast({
        title: "Unable to load filter options",
        description: getApiErrorMessage(error, "Failed to load user filter dropdowns."),
        variant: "destructive",
      });
    } finally {
      setIsFilterLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const disconnect = connectNotificationStream({
      onNotification: (packet) => {
        const refType = String(packet.refType ?? "").trim().toLowerCase();
        if (refType === "user") {
          setHasNewUserEvent(true);
        }
      },
    });

    return disconnect;
  }, []);

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
  }, [effectiveStatusTab, debouncedSearch, pageSize, appliedFilters]);

  const searchSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const values = new Set<string>();
    users.forEach((user) => {
      [
        user.name,
        user.email,
        user.designation,
        user.phone || "",
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

  const clearAdvancedFilters = useCallback(() => {
    setDesignationFilters([]);
    setDepartmentFilters([]);
    setReportingManagerFilters([]);
    setAccessCategoryFilters([]);
    setAccessSubcategoryFilters([]);
    setNodeTypeFilters([]);
    setRoleFilters([]);
    setStatusFilters([]);
    setNodeAccessType(null);
    setPendingActionFilter(null);
    setOnboardingDateRange(null);
    setOnboardingDateFrom("");
    setOnboardingDateTo("");
    setStatusTab("active");
    setIsFilterRequestActive(false);
  }, []);

  const applyAdvancedFilters = useCallback(
    (filters: AppliedUserFiltersDraft) => {
      setDesignationFilters(filters.designationFilters);
      setDepartmentFilters(filters.nodeNameFilters);
      setNodeTypeFilters(filters.nodeTypeFilters);
      setAccessCategoryFilters(filters.accessCategoryFilters);
      setAccessSubcategoryFilters(filters.accessSubcategoryFilters);
      setReportingManagerFilters(filters.reportingManagerFilters);
      setStatusFilters(filters.statusFilters);
      setRoleFilters(filters.roleFilters);
      setNodeAccessType(filters.nodeAccessType);
      setPendingActionFilter(filters.pendingActionFilter);
      setOnboardingDateRange(filters.onboardingDateRange);
      setOnboardingDateFrom(filters.onboardingDateFrom);
      setOnboardingDateTo(filters.onboardingDateTo);
      setIsFilterRequestActive(true);

      const selectedStatus = filters.statusFilters[0];
      const nextStatusTab =
        selectedStatus === "Pending" ? "pending" : selectedStatus === "Inactive" ? "inactive" : "active";
      setStatusTab(nextStatusTab);
      setPage(1);
      setPageCursors({ 1: null });
      setTopCursor(null);
      setNextCursor(null);
      setHasNext(false);
    },
    [],
  );

  const sortedUsers = useMemo(() => {
    const next = [...users];
    next.sort((left, right) => {
      const comparison = left.name.localeCompare(right.name);
      return sortOrder === "asc" ? comparison : -comparison;
    });
    return next;
  }, [sortOrder, users]);

  const activeMembers = useMemo(
    () => sortedUsers.filter((user) => user.status !== "Pending" && user.status !== "Inactive"),
    [sortedUsers],
  );
  const pendingMembers = useMemo(
    () => sortedUsers.filter((user) => user.status === "Pending"),
    [sortedUsers],
  );
  const inactiveMembers = useMemo(
    () => sortedUsers.filter((user) => user.status === "Inactive"),
    [sortedUsers],
  );

  const currentMembers =
    effectiveStatusTab === "pending" ? pendingMembers : effectiveStatusTab === "inactive" ? inactiveMembers : activeMembers;
  const derivedTotalPages = Math.max(1, Math.ceil(getCountForTab(statusCounts, effectiveStatusTab) / pageSize));
  const totalPages = Math.max(resolvedTotalPages, derivedTotalPages);
  const safePage = page;
  const paginatedMembers = currentMembers;

  const handlePrevPage = useCallback(async () => {
    if (page <= 1) return;
    const companyCode = currentUser?.companyCode?.trim().toUpperCase();
    if (!companyCode) return;
    const previousPage = page - 1;
    const prevCursor = pageCursors[previousPage] ?? null;

    setIsLoading(true);
    try {
      const response = await fetchCompanyUsersPaginated(effectiveStatusTab, {
        companyCode,
        filter: isFilterRequestActive,
        applied: appliedFilters,
        pagination: {
          limit: pageSize,
          cursor: prevCursor,
          topCursor,
          page: null,
          direction: "PREV",
          query: debouncedSearch || null,
          statusType: effectiveStatusTab,
        },
      });
      setUsers(response.users);
      setPage(previousPage);
      setPageCursors((current) => ({ ...current, [previousPage]: prevCursor }));
      setTopCursor(response.pageInfo.topCursor || topCursor);
      setNextCursor(response.pageInfo.nextCursor);
      setHasNext(response.pageInfo.hasNext);
      setResolvedTotalPages(
        response.pageInfo.totalPages ||
          Math.max(1, Math.ceil(getCountForTab(response.counts, effectiveStatusTab) / pageSize)),
      );
      setStatusCounts(response.counts);
      maybeShowActivityToast(response, effectiveStatusTab);
    } catch (error) {
      toast({
        title: "Unable to load previous page",
        description: getApiErrorMessage(error, "Unable to fetch previous users page."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters, currentUser?.companyCode, debouncedSearch, effectiveStatusTab, getCountForTab, isFilterRequestActive, maybeShowActivityToast, page, pageCursors, pageSize, setUsers, toast, topCursor]);

  const handleNextPage = useCallback(async () => {
    if (!hasNext) return;
    const companyCode = currentUser?.companyCode?.trim().toUpperCase();
    if (!companyCode) return;
    const upcomingPage = page + 1;
    const cursor = pageCursors[upcomingPage] ?? nextCursor;
    if (!cursor) return;

    setIsLoading(true);
    try {
      const response = await fetchCompanyUsersPaginated(effectiveStatusTab, {
        companyCode,
        filter: isFilterRequestActive,
        applied: appliedFilters,
        pagination: {
          limit: pageSize,
          cursor,
          topCursor,
          page: null,
          direction: "NEXT",
          query: debouncedSearch || null,
          statusType: effectiveStatusTab,
        },
      });
      setUsers(response.users);
      setPageCursors((current) => ({
        ...current,
        [upcomingPage]: cursor,
        [upcomingPage + 1]: response.pageInfo.nextCursor,
      }));
      setPage(upcomingPage);
      setTopCursor(response.pageInfo.topCursor || topCursor);
      setNextCursor(response.pageInfo.nextCursor);
      setHasNext(response.pageInfo.hasNext);
      setResolvedTotalPages(
        response.pageInfo.totalPages ||
          Math.max(1, Math.ceil(getCountForTab(response.counts, effectiveStatusTab) / pageSize)),
      );
      setStatusCounts(response.counts);
      maybeShowActivityToast(response, effectiveStatusTab);
    } catch (error) {
      toast({
        title: "Unable to load next page",
        description: getApiErrorMessage(error, "Unable to fetch next users page."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters, currentUser?.companyCode, debouncedSearch, effectiveStatusTab, getCountForTab, hasNext, isFilterRequestActive, maybeShowActivityToast, nextCursor, page, pageCursors, pageSize, setUsers, toast, topCursor]);

  const handleJumpToPage = useCallback(
    async (requestedPage: number) => {
      const companyCode = currentUser?.companyCode?.trim().toUpperCase();
      if (!companyCode) return;
      const targetPage = Math.max(1, Math.min(totalPages, requestedPage));
      if (targetPage === page) return;

      setIsLoading(true);
      try {
        const jumpCursor = pageCursors[targetPage] ?? nextCursor ?? topCursor ?? "";
        const response = await fetchCompanyUsersPaginated(effectiveStatusTab, {
          companyCode,
          filter: isFilterRequestActive,
          applied: appliedFilters,
          pagination: {
            limit: pageSize,
            cursor: jumpCursor,
            topCursor: topCursor ?? "",
            page: targetPage,
            direction: "NEXT",
            query: debouncedSearch || null,
            statusType: effectiveStatusTab,
          },
        });
        setUsers(response.users);
        setPage(targetPage);
        setPageCursors((current) => ({
          ...current,
          [targetPage]: jumpCursor,
          [targetPage + 1]: response.pageInfo.nextCursor,
        }));
        setTopCursor(response.pageInfo.topCursor || topCursor);
        setNextCursor(response.pageInfo.nextCursor);
        setHasNext(response.pageInfo.hasNext);
        setResolvedTotalPages(
          response.pageInfo.totalPages ||
            Math.max(1, Math.ceil(getCountForTab(response.counts, effectiveStatusTab) / pageSize)),
        );
        setStatusCounts(response.counts);
      } catch (error) {
        toast({
          title: "Unable to jump to page",
          description: getApiErrorMessage(error, "Unable to fetch the selected users page."),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [appliedFilters, currentUser?.companyCode, debouncedSearch, effectiveStatusTab, getCountForTab, isFilterRequestActive, nextCursor, page, pageCursors, pageSize, setUsers, toast, topCursor, totalPages],
  );

  const {
    updateUsersStatus,
    handleAddUser,
    handleOpenAddUserDialog,
    handleSaveEdit,
    removeMember,
    processUserStatusAction,
    handleActivateMember,
    handleDeactivateMember,
    executeUserStatusAction,
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
    effectiveStatusTab === "pending" ? "Pending Requests" : effectiveStatusTab === "inactive" ? "Inactive Members" : "Active Members";

  return {
    users,
    statusTab: effectiveStatusTab,
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
    accessCategoryFilters,
    setAccessCategoryFilters,
    accessSubcategoryFilters,
    setAccessSubcategoryFilters,
    nodeTypeFilters,
    setNodeTypeFilters,
    roleFilters,
    setRoleFilters,
    statusFilters,
    setStatusFilters,
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
    isLoading,
    isFilterLoading,
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
    departments: filterDropdowns.nodeName.map((item) => item.value),
    roles: filterDropdowns.designation,
    reportingManagerOptions: filterDropdowns.reportingManager,
    primaryNodeOptions: [],
    secondaryNodeOptions: [],
    accessCategories: filterDropdowns.category,
    accessSubcategories: filterDropdowns.subCategory,
    filterNodeOptions: filterDropdowns.nodeName,
    nodeTypeOptions: filterDropdowns.nodeType,
    toggleFilterValue,
    clearAdvancedFilters,
    applyAdvancedFilters,
    loadFilterOptions,
    activeMembers,
    pendingMembers,
    inactiveMembers,
    currentMembers,
    totalPages,
    safePage,
    paginatedMembers,
    statusCounts,
    handlePrevPage,
    handleNextPage,
    handleJumpToPage,
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
    executeUserStatusAction,
  };
}
