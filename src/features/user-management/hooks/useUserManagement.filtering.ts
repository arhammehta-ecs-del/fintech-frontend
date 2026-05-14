import Fuse from "fuse.js";
import type { AppUser } from "@/contexts/AppContext";
import {
  buildAccessScopeSet,
  extractDigits,
  getAccessEntriesByType,
  getNodeNamesByAccessType,
  getReportingManagerName,
  inferUserRoleType,
  isWithinTwoEdits,
  normalizeCompact,
  normalizeLoose,
  parseDateAtStartOfDay,
  splitAlphaNumericTokens,
} from "@/features/user-management/hooks/useUserManagement.helpers";

type FilterMembersInput = {
  list: AppUser[];
  debouncedSearch: string;
  designationFilters: string[];
  departmentFilters: string[];
  reportingManagerFilters: string[];
  primaryNodeFilters: string[];
  secondaryNodeFilters: string[];
  accessCategoryFilters: string[];
  accessSubcategoryFilters: string[];
  accessScopeFilters: string[];
  roleTypeFilters: string[];
  onboardingDateFrom: string;
  onboardingDateTo: string;
  linkedNodeFilter: string;
  linkedNodePathFilter: string;
  linkedCategoryFilter: string;
  linkedSubcategoryFilter: string;
  linkedActionFilter: "" | "checker" | "maker" | "viewer";
  sortOrder: "asc" | "desc";
};

export const filterMembersList = ({
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
}: FilterMembersInput): AppUser[] => {
  const normalizedTerm = normalizeLoose(debouncedSearch);
  const compactQuery = normalizeCompact(normalizedTerm);
  const queryTokens = normalizedTerm.split(" ").filter(Boolean);
  const queryDigits = extractDigits(normalizedTerm);

  const filteredByAdvancedFilters = list
    .filter((user) => {
      const matchesDesignation = designationFilters.length === 0 || designationFilters.includes(user.designation);
      const matchesDepartment =
        departmentFilters.length === 0 ||
        departmentFilters.includes(user.department) ||
        (user.accessDetails ?? []).some((entry) => departmentFilters.includes((entry.nodeName || "").trim()));
      const userReportingManager = getReportingManagerName(user);
      const matchesReportingManager =
        reportingManagerFilters.length === 0 || reportingManagerFilters.includes(userReportingManager);
      const primaryNodeNames = new Set(getNodeNamesByAccessType(user, "PRIMARY"));
      const secondaryNodeNames = new Set(getNodeNamesByAccessType(user, "SECONDARY"));
      const matchesPrimaryNode =
        primaryNodeFilters.length === 0 || primaryNodeFilters.some((nodeName) => primaryNodeNames.has(nodeName));
      const matchesSecondaryNode =
        secondaryNodeFilters.length === 0 || secondaryNodeFilters.some((nodeName) => secondaryNodeNames.has(nodeName));
      const scopedEntriesForRoleFilters = (() => {
        const primaryEntries = getAccessEntriesByType(user, "PRIMARY");
        const secondaryEntries = getAccessEntriesByType(user, "SECONDARY");
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
      const userAccessScopes = buildAccessScopeSet(user);
      const matchesAccessScope =
        accessScopeFilters.length === 0 || accessScopeFilters.some((scope) => userAccessScopes.has(scope));
      const userRoleType = inferUserRoleType(user);
      const matchesRoleType = roleTypeFilters.length === 0 || roleTypeFilters.includes(userRoleType);
      const userOnboardingDate = parseDateAtStartOfDay(user.onboardingDate || user.basicDetails?.createdAt || "");
      const fromDate = parseDateAtStartOfDay(onboardingDateFrom);
      const toDate = parseDateAtStartOfDay(onboardingDateTo);
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
};
