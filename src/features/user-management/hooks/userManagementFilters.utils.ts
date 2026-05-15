import type { AppUser } from "@/contexts/AppContext";
import { USER_FILTER_CONFIG } from "@/features/user-management/constants";
import { formatRoleTokenLabel } from "@/features/user-management/roleLabels";

export const normalizeCompact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export const normalizeLoose = (value: string) => value.toLowerCase().trim().replace(/\s+/g, " ");

export const extractDigits = (value: string): string[] => {
  const matches = value.match(/\d+/g);
  return matches ? [...matches] : [];
};

export const splitAlphaNumericTokens = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);

export const isWithinTwoEdits = (left: string, right: string) => {
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

export const parseDateAtStartOfDay = (value?: string) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

export const inferUserRoleType = (user: AppUser): (typeof USER_FILTER_CONFIG.roleType.options)[number] => {
  const designation = user.designation.trim().toLowerCase();
  const name = user.name.trim().toLowerCase();
  const isSignatory = USER_FILTER_CONFIG.roleType.signatoryDesignationKeywords.some(
    (keyword) => designation.includes(keyword) || name.includes(keyword),
  );
  return isSignatory ? "Signatory" : "Regular User";
};

export const parseLinkedActionFilter = (actionRaw: string): "" | "checker" | "maker" | "viewer" => {
  const normalized = actionRaw.trim().toLowerCase();
  return normalized === "checker" || normalized === "maker" || normalized === "viewer" ? normalized : "";
};

export const getReportingManagerName = (user: AppUser) =>
  (user.manager?.name || user.basicDetails?.reportingManagerName || "").trim();

export const getAccessEntriesByType = (user: AppUser, accessType: "PRIMARY" | "SECONDARY") =>
  (user.accessDetails ?? []).filter((entry) => entry.accessType === accessType);

export const getNodeNamesByAccessType = (user: AppUser, accessType: "PRIMARY" | "SECONDARY") =>
  getAccessEntriesByType(user, accessType)
    .map((entry) => entry.nodeName.trim())
    .filter(Boolean);

export const buildRoleCategoryOptions = (users: AppUser[]) =>
  Array.from(
    new Set(
      users.flatMap((user) =>
        (user.accessDetails ?? [])
          .map((entry) => entry.roleCategory.trim())
          .filter(Boolean),
      ),
    ),
  ).sort((a, b) => formatRoleTokenLabel(a).localeCompare(formatRoleTokenLabel(b)));

export const buildRoleSubcategoryOptions = (users: AppUser[]) =>
  Array.from(
    new Set(
      users.flatMap((user) =>
        (user.accessDetails ?? [])
          .map((entry) => entry.roleSubCategory.trim())
          .filter(Boolean),
      ),
    ),
  ).sort((a, b) => formatRoleTokenLabel(a).localeCompare(formatRoleTokenLabel(b)));

export const buildAccessScopeSet = (user: AppUser) =>
  new Set<string>(
    (user.accessDetails ?? [])
      .map((entry) => (entry.accessCategory || "NODE").toUpperCase())
      .filter((scope) => scope === "ALL_CHILD" || scope === "IMMEDIATE_CHILD" || scope === "NODE"),
  );

export const buildDepartmentOptions = (orgStructure: AppUser["orgStructure"] | any, users: AppUser[]) => {
  const namesFromOrg = new Set<string>();
  const walk = (node: any) => {
    if (!node) return;
    if ((node.status || "Active").trim().toUpperCase() !== "PENDING") {
      const name = (node.name || "").trim();
      if (name) namesFromOrg.add(name);
    }
    (node.children || []).forEach((child: any) => walk(child));
  };
  walk(orgStructure);

  const namesFromUsers = users
    .map((user) => (user.department || "").trim())
    .filter(Boolean);

  return Array.from(new Set([...namesFromOrg, ...namesFromUsers])).sort((a, b) => a.localeCompare(b));
};

export const buildRoleOptions = (users: AppUser[]) =>
  Array.from(new Set(users.map((user) => user.designation).filter(Boolean))).sort((a, b) => a.localeCompare(b));

export const buildReportingManagerOptions = (users: AppUser[]) =>
  Array.from(new Set(users.map((user) => getReportingManagerName(user)).filter(Boolean))).sort((a, b) => a.localeCompare(b));

export const buildNodeOptionsByType = (users: AppUser[], accessType: "PRIMARY" | "SECONDARY") =>
  Array.from(new Set(users.flatMap((user) => getNodeNamesByAccessType(user, accessType)))).sort((a, b) => a.localeCompare(b));

export const buildAccessScopeOptions = (users: AppUser[]) =>
  Array.from(
    new Set(
      users.flatMap((user) =>
        (user.accessDetails ?? [])
          .map((entry) => (entry.accessCategory || "NODE").toUpperCase())
          .filter((scope) => scope === "ALL_CHILD" || scope === "IMMEDIATE_CHILD" || scope === "NODE"),
      ),
    ),
  );

export const hasAppliedUserRefinement = (input: {
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
  linkedActionFilter: string;
}) =>
  Boolean(
    input.debouncedSearch ||
      input.designationFilters.length > 0 ||
      input.departmentFilters.length > 0 ||
      input.reportingManagerFilters.length > 0 ||
      input.primaryNodeFilters.length > 0 ||
      input.secondaryNodeFilters.length > 0 ||
      input.accessCategoryFilters.length > 0 ||
      input.accessSubcategoryFilters.length > 0 ||
      input.accessScopeFilters.length > 0 ||
      input.roleTypeFilters.length > 0 ||
      input.onboardingDateFrom.trim() ||
      input.onboardingDateTo.trim() ||
      input.linkedNodeFilter ||
      input.linkedNodePathFilter ||
      input.linkedCategoryFilter ||
      input.linkedSubcategoryFilter ||
      input.linkedActionFilter,
  );

export const toggleFilterValue = (current: string[], value: string) =>
  current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

export const clearUserAdvancedFilters = (input: {
  searchParams: URLSearchParams;
  setDesignationFilters: (value: string[]) => void;
  setDepartmentFilters: (value: string[]) => void;
  setReportingManagerFilters: (value: string[]) => void;
  setPrimaryNodeFilters: (value: string[]) => void;
  setSecondaryNodeFilters: (value: string[]) => void;
  setAccessCategoryFilters: (value: string[]) => void;
  setAccessSubcategoryFilters: (value: string[]) => void;
  setAccessScopeFilters: (value: string[]) => void;
  setRoleTypeFilters: (value: string[]) => void;
  setOnboardingDateFrom: (value: string) => void;
  setOnboardingDateTo: (value: string) => void;
  setLinkedNodeFilter: (value: string) => void;
  setLinkedNodePathFilter: (value: string) => void;
  setLinkedCategoryFilter: (value: string) => void;
  setLinkedSubcategoryFilter: (value: string) => void;
  setLinkedActionFilter: (value: "" | "checker" | "maker" | "viewer") => void;
  setSearchParams: (nextParams: URLSearchParams, options?: { replace?: boolean }) => void;
}) => {
  input.setDesignationFilters([]);
  input.setDepartmentFilters([]);
  input.setReportingManagerFilters([]);
  input.setPrimaryNodeFilters([]);
  input.setSecondaryNodeFilters([]);
  input.setAccessCategoryFilters([]);
  input.setAccessSubcategoryFilters([]);
  input.setAccessScopeFilters([]);
  input.setRoleTypeFilters([]);
  input.setOnboardingDateFrom("");
  input.setOnboardingDateTo("");
  input.setLinkedNodeFilter("");
  input.setLinkedNodePathFilter("");
  input.setLinkedCategoryFilter("");
  input.setLinkedSubcategoryFilter("");
  input.setLinkedActionFilter("");

  const nextParams = new URLSearchParams(input.searchParams);
  nextParams.delete("um_node");
  nextParams.delete("um_node_path");
  nextParams.delete("um_category");
  nextParams.delete("um_subcategory");
  nextParams.delete("um_action");
  input.setSearchParams(nextParams, { replace: true });
};

export const hydrateUserFiltersFromDeepLink = (input: {
  searchParams: URLSearchParams;
  setStatusTab: (value: "active" | "pending" | "inactive") => void;
  setLinkedNodeFilter: (value: string) => void;
  setLinkedNodePathFilter: (value: string) => void;
  setLinkedCategoryFilter: (value: string) => void;
  setLinkedSubcategoryFilter: (value: string) => void;
  setLinkedActionFilter: (value: "" | "checker" | "maker" | "viewer") => void;
  setAccessCategoryFilters: (value: string[]) => void;
  setAccessSubcategoryFilters: (value: string[]) => void;
  setDepartmentFilters: (value: string[]) => void;
  setPrimaryNodeFilters: (value: string[]) => void;
  setSecondaryNodeFilters: (value: string[]) => void;
  setSearch: (value: string) => void;
}) => {
  const tab = (input.searchParams.get("tab") || "").trim();
  if (tab !== "users") return;

  const node = (input.searchParams.get("um_node") || "").trim();
  const nodePath = (input.searchParams.get("um_node_path") || "").trim();
  const category = (input.searchParams.get("um_category") || "").trim();
  const subcategory = (input.searchParams.get("um_subcategory") || "").trim();
  const action = parseLinkedActionFilter(input.searchParams.get("um_action") || "");
  if (!node && !nodePath && !category && !subcategory && !action) return;

  input.setStatusTab("active");
  input.setLinkedNodeFilter(node);
  input.setLinkedNodePathFilter(nodePath);
  input.setLinkedCategoryFilter(category);
  input.setLinkedSubcategoryFilter(subcategory);
  input.setLinkedActionFilter(action);
  input.setAccessCategoryFilters(category ? [category] : []);
  input.setAccessSubcategoryFilters(subcategory ? [subcategory] : []);

  if (node) {
    input.setDepartmentFilters([node]);
    input.setPrimaryNodeFilters([]);
    input.setSecondaryNodeFilters([]);
  } else {
    input.setDepartmentFilters([]);
    input.setPrimaryNodeFilters([]);
    input.setSecondaryNodeFilters([]);
  }
  input.setSearch("");
};

export const resolveStatusTabAfterFiltering = (input: {
  statusTab: "active" | "pending" | "inactive";
  hasAppliedRefinement: boolean;
  activeCount: number;
  pendingCount: number;
  inactiveCount: number;
}): "active" | "pending" | "inactive" | null => {
  if (!input.hasAppliedRefinement) return null;

  const currentCount =
    input.statusTab === "active"
      ? input.activeCount
      : input.statusTab === "pending"
        ? input.pendingCount
        : input.inactiveCount;
  if (currentCount > 0) return null;
  if (input.pendingCount > 0) return "pending";
  if (input.activeCount > 0) return "active";
  if (input.inactiveCount > 0) return "inactive";
  return null;
};
