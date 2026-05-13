import { useCallback, useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { useSearchParams } from "react-router-dom";
import type { AppUser } from "@/contexts/AppContext";
import { useAppContext } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/services/client";
import { createUserOnboarding, getCompanyUsers, updateUserStatus } from "@/services/user.service";
import { USER_DEFAULT_PAGE_SIZE, USER_FILTER_CONFIG, USER_PAGE_SIZE_OPTIONS, USER_SEARCH_DEBOUNCE_MS } from "@/features/user-management/constants";
import type { MemberStatusTab, UserOnboardingFormData, SortOrder } from "@/features/user-management/types";
import { buildUserOnboardingPayload } from "@/features/user-management/utils";
import { formatRoleTokenLabel } from "@/features/user-management/roleLabels";

const normalizeCompact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizeLoose = (value: string) => value.toLowerCase().trim().replace(/\s+/g, " ");
const extractDigits = (value: string): string[] => {
  const matches = value.match(/\d+/g);
  return matches ? [...matches] : [];
};
const splitAlphaNumericTokens = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);

const isWithinTwoEdits = (left: string, right: string) => {
  if (!left || !right) return false;
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  const aLen = a.length;
  const bLen = b.length;
  if (Math.abs(aLen - bLen) > 2) return false;

  const prev = Array.from({ length: bLen + 1 }, (_, idx) => idx);
  for (let i = 1; i <= aLen; i += 1) {
    let diagonal = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= bLen; j += 1) {
      const temp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + cost);
      diagonal = temp;
      if (prev[j] < rowMin) rowMin = prev[j];
    }
    if (rowMin > 2) return false;
  }
  return prev[bLen] <= 2;
};

export function useUserManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, users, setUsers } = useAppContext();
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
    const tab = (searchParams.get("tab") || "").trim();
    if (tab !== "users") return;

    const node = (searchParams.get("um_node") || "").trim();
    const nodePath = (searchParams.get("um_node_path") || "").trim();
    const category = (searchParams.get("um_category") || "").trim();
    const subcategory = (searchParams.get("um_subcategory") || "").trim();
    const actionRaw = (searchParams.get("um_action") || "").trim().toLowerCase();
    const action = actionRaw === "checker" || actionRaw === "maker" || actionRaw === "viewer" ? actionRaw : "";

    const hasDeepLinkFilters = Boolean(node || nodePath || category || subcategory || action);
    if (!hasDeepLinkFilters) return;

    setStatusTab("active");
    setLinkedNodeFilter(node);
    setLinkedNodePathFilter(nodePath);
    setLinkedCategoryFilter(category);
    setLinkedSubcategoryFilter(subcategory);
    setLinkedActionFilter(action);
    setAccessCategoryFilters(category ? [category] : []);
    setAccessSubcategoryFilters(subcategory ? [subcategory] : []);
    if (node) {
      setDepartmentFilters([node]);
      setPrimaryNodeFilters([]);
      setSecondaryNodeFilters([]);
    } else {
      setDepartmentFilters([]);
      setPrimaryNodeFilters([]);
      setSecondaryNodeFilters([]);
    }
    setSearch("");
  }, [searchParams, users]);

  const parseToDate = useCallback((value?: string) => {
    const trimmed = (value || "").trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }, []);

  const inferRoleType = useCallback((user: AppUser): (typeof USER_FILTER_CONFIG.roleType.options)[number] => {
    const designation = user.designation.trim().toLowerCase();
    const name = user.name.trim().toLowerCase();
    const isSignatory = USER_FILTER_CONFIG.roleType.signatoryDesignationKeywords.some(
      (keyword) => designation.includes(keyword) || name.includes(keyword),
    );
    return isSignatory ? "Signatory" : "Regular User";
  }, []);

  const departments = useMemo(
    () => Array.from(new Set(users.map((user) => user.department).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [users],
  );
  const roles = useMemo(
    () => Array.from(new Set(users.map((user) => user.designation).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [users],
  );
  const reportingManagerOptions = useMemo(
    () =>
      Array.from(
        new Set(
          users
            .map((user) => user.manager?.name?.trim() || user.basicDetails?.reportingManagerName?.trim() || "")
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [users],
  );
  const primaryNodeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          users.flatMap((user) =>
            (user.accessDetails ?? [])
              .filter((entry) => entry.accessType === "PRIMARY")
              .map((entry) => entry.nodeName.trim())
              .filter(Boolean),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [users],
  );
  const secondaryNodeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          users.flatMap((user) =>
            (user.accessDetails ?? [])
              .filter((entry) => entry.accessType === "SECONDARY")
              .map((entry) => entry.nodeName.trim())
              .filter(Boolean),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [users],
  );
  const accessCategories = useMemo(
    () =>
      Array.from(
        new Set(
          users.flatMap((user) =>
            (user.accessDetails ?? [])
              .map((entry) => entry.roleCategory.trim())
              .filter((category) => Boolean(category)),
          ),
        ),
      ).sort((a, b) => formatRoleTokenLabel(a).localeCompare(formatRoleTokenLabel(b))),
    [users],
  );
  const accessSubcategories = useMemo(
    () =>
      Array.from(
        new Set(
          users.flatMap((user) =>
            (user.accessDetails ?? [])
              .map((entry) => entry.roleSubCategory.trim())
              .filter((subcategory) => Boolean(subcategory)),
          ),
        ),
      ).sort((a, b) => formatRoleTokenLabel(a).localeCompare(formatRoleTokenLabel(b))),
    [users],
  );
  const accessScopes = useMemo(
    () =>
      Array.from(
        new Set(
          users.flatMap((user) =>
            (user.accessDetails ?? [])
              .map((entry) => (entry.accessCategory || "NODE").toUpperCase())
              .filter((scope) => scope === "ALL_CHILD" || scope === "IMMEDIATE_CHILD" || scope === "NODE"),
          ),
        ),
      ),
    [users],
  );
  const roleTypes = useMemo(() => [...USER_FILTER_CONFIG.roleType.options], []);

  const toggleFilterValue = (current: string[], value: string) =>
    current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

  const clearAdvancedFilters = () => {
    setDesignationFilters([]);
    setDepartmentFilters([]);
    setReportingManagerFilters([]);
    setPrimaryNodeFilters([]);
    setSecondaryNodeFilters([]);
    setAccessCategoryFilters([]);
    setAccessSubcategoryFilters([]);
    setAccessScopeFilters([]);
    setRoleTypeFilters([]);
    setOnboardingDateFrom("");
    setOnboardingDateTo("");
    setLinkedNodeFilter("");
    setLinkedNodePathFilter("");
    setLinkedCategoryFilter("");
    setLinkedSubcategoryFilter("");
    setLinkedActionFilter("");

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("um_node");
    nextParams.delete("um_node_path");
    nextParams.delete("um_category");
    nextParams.delete("um_subcategory");
    nextParams.delete("um_action");
    setSearchParams(nextParams, { replace: true });
  };

  const filterMembers = useCallback(
    (list: AppUser[]) => {
      const normalizedTerm = normalizeLoose(debouncedSearch);
      const compactQuery = normalizeCompact(normalizedTerm);
      const queryTokens = normalizedTerm.split(" ").filter(Boolean);
      const queryDigits = extractDigits(normalizedTerm);

      const filteredByAdvancedFilters = list.filter((user) => {
          const matchesDesignation = designationFilters.length === 0 || designationFilters.includes(user.designation);
          const matchesDepartment =
            departmentFilters.length === 0 ||
            departmentFilters.includes(user.department) ||
            (user.accessDetails ?? []).some((entry) => departmentFilters.includes((entry.nodeName || "").trim()));
          const userReportingManager = (user.manager?.name || user.basicDetails?.reportingManagerName || "").trim();
          const matchesReportingManager =
            reportingManagerFilters.length === 0 || reportingManagerFilters.includes(userReportingManager);
          const primaryNodeNames = new Set(
            (user.accessDetails ?? [])
              .filter((entry) => entry.accessType === "PRIMARY")
              .map((entry) => entry.nodeName.trim())
              .filter(Boolean),
          );
          const secondaryNodeNames = new Set(
            (user.accessDetails ?? [])
              .filter((entry) => entry.accessType === "SECONDARY")
              .map((entry) => entry.nodeName.trim())
              .filter(Boolean),
          );
          const matchesPrimaryNode =
            primaryNodeFilters.length === 0 || primaryNodeFilters.some((nodeName) => primaryNodeNames.has(nodeName));
          const matchesSecondaryNode =
            secondaryNodeFilters.length === 0 || secondaryNodeFilters.some((nodeName) => secondaryNodeNames.has(nodeName));
          const scopedEntriesForRoleFilters = (() => {
            const primaryEntries = (user.accessDetails ?? []).filter((entry) => entry.accessType === "PRIMARY");
            const secondaryEntries = (user.accessDetails ?? []).filter((entry) => entry.accessType === "SECONDARY");
            const scopedPrimaryEntries =
              primaryNodeFilters.length > 0
                ? primaryEntries.filter((entry) => primaryNodeFilters.includes(entry.nodeName.trim()))
                : [];
            const scopedSecondaryEntries =
              secondaryNodeFilters.length > 0
                ? secondaryEntries.filter((entry) => secondaryNodeFilters.includes(entry.nodeName.trim()))
                : [];

            if (primaryNodeFilters.length > 0 || secondaryNodeFilters.length > 0) {
              return [...scopedPrimaryEntries, ...scopedSecondaryEntries];
            }
            return user.accessDetails ?? [];
          })();
          const userAccessCategories = new Set(
            scopedEntriesForRoleFilters
              .map((entry) => entry.roleCategory.trim())
              .filter((category) => Boolean(category)),
          );
          const matchesAccessCategory =
            accessCategoryFilters.length === 0 ||
            accessCategoryFilters.some((category) => userAccessCategories.has(category));
          const userAccessSubcategories = new Set(
            scopedEntriesForRoleFilters
              .map((entry) => entry.roleSubCategory.trim())
              .filter((subcategory) => Boolean(subcategory)),
          );
          const matchesAccessSubcategory =
            accessSubcategoryFilters.length === 0 ||
            accessSubcategoryFilters.some((subcategory) => userAccessSubcategories.has(subcategory));
          const linkedEntryMatched = (() => {
            const hasLinkedFilters =
              Boolean(linkedNodeFilter) ||
              Boolean(linkedNodePathFilter) ||
              Boolean(linkedCategoryFilter) ||
              Boolean(linkedSubcategoryFilter) ||
              Boolean(linkedActionFilter);
            if (!hasLinkedFilters) return true;

            return scopedEntriesForRoleFilters.some((entry) => {
              const entryNode = (entry.nodeName || "").trim();
              const entryNodePath = (entry.nodePath || "").trim();
              const entryCategory = (entry.roleCategory || "").trim();
              const entrySubcategory = (entry.roleSubCategory || "").trim();
              const normalizedRoleName = (entry.roleName || "").trim().toLowerCase();

              const actionMatched = (() => {
                if (!linkedActionFilter) return true;
                if (linkedActionFilter === "checker") {
                  return normalizedRoleName.endsWith("manager") || normalizedRoleName.endsWith("checker");
                }
                if (linkedActionFilter === "maker") {
                  return normalizedRoleName.endsWith("user") || normalizedRoleName.endsWith("maker");
                }
                return normalizedRoleName.endsWith("viewer");
              })();

              return (
                (!linkedNodeFilter || entryNode === linkedNodeFilter) &&
                (!linkedNodePathFilter || entryNodePath === linkedNodePathFilter) &&
                (!linkedCategoryFilter || entryCategory === linkedCategoryFilter) &&
                (!linkedSubcategoryFilter || entrySubcategory === linkedSubcategoryFilter) &&
                actionMatched
              );
            });
          })();
          const userAccessScopes = new Set<string>(
            (user.accessDetails ?? [])
              .map((entry) => (entry.accessCategory || "NODE").toUpperCase())
              .filter((scope) => scope === "ALL_CHILD" || scope === "IMMEDIATE_CHILD" || scope === "NODE"),
          );
          const matchesAccessScope =
            accessScopeFilters.length === 0 || accessScopeFilters.some((scope) => userAccessScopes.has(scope));
          const userRoleType = inferRoleType(user);
          const matchesRoleType = roleTypeFilters.length === 0 || roleTypeFilters.includes(userRoleType);
          const userOnboardingDate = parseToDate(user.onboardingDate || user.basicDetails?.createdAt || "");
          const fromDate = parseToDate(onboardingDateFrom);
          const toDate = parseToDate(onboardingDateTo);
          const matchesOnboardingDate =
            (!fromDate || (userOnboardingDate && userOnboardingDate >= fromDate)) &&
            (!toDate || (userOnboardingDate && userOnboardingDate <= toDate));

          return (
            matchesDesignation &&
            matchesDepartment &&
            matchesReportingManager &&
            matchesPrimaryNode &&
            matchesSecondaryNode &&
            matchesAccessCategory &&
            matchesAccessSubcategory &&
            linkedEntryMatched &&
            matchesAccessScope &&
            matchesRoleType &&
            matchesOnboardingDate
          );
        })
        .sort((left, right) => {
          // Keep deterministic ordering before fuzzy ranking so results feel stable.
          const comparison = left.name.localeCompare(right.name);
          return sortOrder === "asc" ? comparison : -comparison;
        });

      if (!normalizedTerm) {
        return filteredByAdvancedFilters;
      }

      const searchable = filteredByAdvancedFilters.map((user) => {
        const name = user.name || "";
        const email = user.email || "";
        const designation = user.designation || "";
        const department = user.department || "";
        const phone = user.phone || "";
        const searchableText = normalizeLoose(`${name} ${email} ${designation} ${department} ${phone}`);
        const compact = normalizeCompact(searchableText);
        const digits = extractDigits(searchableText);
        return { user, name, email, designation, department, phone, searchableText, compact, digits };
      });

      const rankContains = (candidate: (typeof searchable)[number]) => {
        const normalizedName = normalizeLoose(candidate.name);
        let score = 0;
        if (normalizedName === normalizedTerm) score += 400;
        if (normalizedName.startsWith(normalizedTerm)) score += 220;
        if (normalizedName.includes(normalizedTerm)) score += 160;
        if (candidate.compact === compactQuery) score += 180;
        if (candidate.compact.startsWith(compactQuery)) score += 120;
        if (candidate.compact.includes(compactQuery)) score += 90;
        score += queryTokens.filter((token) => normalizedName.includes(token)).length * 35;

        const hasAllDigits =
          queryDigits.length === 0 || queryDigits.every((digit) => candidate.digits.includes(digit));
        if (hasAllDigits) score += 80;
        score -= Math.abs(normalizedName.length - normalizedTerm.length);
        return score;
      };

      const containsMatches = searchable
        .filter((candidate) => {
          const digitsMatch =
            queryDigits.length === 0 || queryDigits.every((digit) => candidate.digits.includes(digit));
          if (!digitsMatch) return false;

          const tokenCoverage =
            queryTokens.length === 0 || queryTokens.every((token) => candidate.searchableText.includes(token));

          return (
            candidate.name.toLowerCase().includes(normalizedTerm) ||
            candidate.email.toLowerCase().includes(normalizedTerm) ||
            candidate.designation.toLowerCase().includes(normalizedTerm) ||
            candidate.department.toLowerCase().includes(normalizedTerm) ||
            (candidate.phone ?? "").toLowerCase().includes(normalizedTerm) ||
            (compactQuery && candidate.compact.includes(compactQuery)) ||
            tokenCoverage
          );
        })
        .sort((left, right) => rankContains(right) - rankContains(left))
        .map((candidate) => candidate.user);

      // If we already have deterministic contains matches, return those only.
      // Fuzzy fallback is for typo recovery when direct matching fails.
      if (containsMatches.length > 0) {
        return containsMatches;
      }

      const hasDigits = /\d/.test(normalizedTerm);
      const isDigitOnlyQuery = hasDigits && /^[\d\s()+-]+$/.test(normalizedTerm);
      const threshold = isDigitOnlyQuery ? 0.22 : normalizedTerm.length >= 8 ? 0.3 : 0.32;
      const minMatchCharLength = 2;

      const fuse = new Fuse(searchable, {
        includeScore: true,
        threshold,
        ignoreLocation: true,
        minMatchCharLength,
        keys: [
          { name: "name", weight: 0.5 },
          { name: "email", weight: 0.2 },
          { name: "designation", weight: 0.12 },
          { name: "department", weight: 0.08 },
          { name: "phone", weight: 0.05 },
          { name: "compact", weight: 0.35 },
        ],
      });

      const fuzzyMatches = fuse
        .search(normalizedTerm)
        .filter((result) => {
          const digitPass =
            queryDigits.length === 0 || queryDigits.every((digit) => result.item.digits.includes(digit));
          if (!digitPass) return false;

          const queryWordTokens = splitAlphaNumericTokens(normalizedTerm)
            .filter((token) => token.length >= 3 && /[a-z]/.test(token));
          if (queryWordTokens.length === 0) {
            return (result.score ?? 1) <= threshold;
          }

          const candidateTokens = splitAlphaNumericTokens(result.item.searchableText);
          const withinTwoEditsPass = queryWordTokens.every((queryToken) =>
            candidateTokens.some((candidateToken) => isWithinTwoEdits(queryToken, candidateToken)),
          );
          if (withinTwoEditsPass) return true;

          return (result.score ?? 1) <= threshold;
        })
        .map((result) => result.item.user);

      const merged = [...fuzzyMatches];
      const seen = new Set<string>();
      return merged.filter((user) => {
        const key = user.id?.trim() || `${user.email.toLowerCase()}|${user.name.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    [
      accessCategoryFilters,
      accessSubcategoryFilters,
      accessScopeFilters,
      debouncedSearch,
      departmentFilters,
      designationFilters,
      inferRoleType,
      linkedActionFilter,
      linkedCategoryFilter,
      linkedNodeFilter,
      linkedNodePathFilter,
      linkedSubcategoryFilter,
      onboardingDateFrom,
      onboardingDateTo,
      parseToDate,
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
