import { format, isValid, parseISO } from "date-fns";
import type { Company, CompanyStatus, GroupCompany } from "@/contexts/AppContext";
import type { DisplayRow } from "@/features/company-list/types";

export const statusColors: Record<CompanyStatus, string> = {
  Approved: "bg-success/10 text-success border-success/20",
  Pending: "bg-warning/10 text-warning border-warning/20",
  Inactive: "bg-destructive/10 text-destructive border-destructive/20",
};

export const formatDisplayDate = (value: string, emptyFallback = "") => {
  if (!value) return emptyFallback;

  const parsedDate = parseISO(value);
  return isValid(parsedDate) ? format(parsedDate, "dd MMM yyyy") : value;
};

export const reorderItems = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

export const isUngroupedGroup = (group: GroupCompany) =>
  group.id.trim().toLowerCase().startsWith("ungrouped") ||
  group.groupName.trim().toLowerCase() === "ungrouped" ||
  group.groupName.trim().toLowerCase() === "independent";

export const getSortableTimestamp = (value: string) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const sortCompaniesLifo = (companies: Company[]) =>
  [...companies].sort(
    (left, right) => getSortableTimestamp(right.incorporationDate) - getSortableTimestamp(left.incorporationDate),
  );

export const sortGroupsLifo = (inputGroups: GroupCompany[]) =>
  [...inputGroups]
    .map((group) => ({
      ...group,
      subsidiaries: sortCompaniesLifo(group.subsidiaries),
    }))
    .sort((left, right) => {
      const rightLatest = Math.max(
        getSortableTimestamp(right.createdDate),
        ...right.subsidiaries.map((company) => getSortableTimestamp(company.incorporationDate)),
      );
      const leftLatest = Math.max(
        getSortableTimestamp(left.createdDate),
        ...left.subsidiaries.map((company) => getSortableTimestamp(company.incorporationDate)),
      );
      return rightLatest - leftLatest;
    });

export const filterGroupsByStatusAndSearch = (
  groups: GroupCompany[],
  statusFilter: CompanyStatus,
  appliedSearch: string,
) => {
  const result = sortGroupsLifo(groups)
    .map((group) => ({
      ...group,
      subsidiaries: group.subsidiaries.filter((company) => company.status === statusFilter),
    }))
    .filter((group) => group.subsidiaries.length > 0);

  const term = appliedSearch.trim().toLowerCase();
  if (!term) return result;

  return result
    .map((group) => {
      const groupMatches =
        group.groupName.toLowerCase().includes(term) ||
        group.code.toLowerCase().includes(term);

      if (groupMatches) return group;

      const matchingSubsidiaries = group.subsidiaries.filter((company) =>
        [
          company.companyName,
          company.legalName,
          company.brand ?? "",
          company.gstin,
          company.ieCode,
          company.incorporationDate,
        ].some((value) => value.toLowerCase().includes(term)),
      );

      return { ...group, subsidiaries: matchingSubsidiaries };
    })
    .filter((group) => group.subsidiaries.length > 0);
};

export const filterGroupsBySearch = (groups: GroupCompany[], appliedSearch: string) => {
  const sorted = sortGroupsLifo(groups);
  const term = appliedSearch.trim().toLowerCase();
  if (!term) return sorted;

  return sorted
    .map((group) => {
      const groupMatches =
        group.groupName.toLowerCase().includes(term) ||
        group.code.toLowerCase().includes(term);

      if (groupMatches) return group;

      const matchingSubsidiaries = group.subsidiaries.filter((company) =>
        [
          company.companyName,
          company.legalName,
          company.brand ?? "",
          company.gstin,
          company.ieCode,
          company.incorporationDate,
        ].some((value) => value.toLowerCase().includes(term)),
      );

      return { ...group, subsidiaries: matchingSubsidiaries };
    })
    .filter((group) => group.subsidiaries.length > 0);
};

export const buildGroupedDisplayRows = (filteredGroups: GroupCompany[]): DisplayRow[] =>
  filteredGroups.filter((group) => !isUngroupedGroup(group)).map((group) => ({ type: "group", group }));

export const buildIndependentDisplayRows = (filteredGroups: GroupCompany[]): DisplayRow[] =>
  filteredGroups
    .filter((group) => isUngroupedGroup(group))
    .flatMap((group) =>
      sortCompaniesLifo(group.subsidiaries).map((company) => ({
        type: "company" as const,
        company,
        groupId: group.id,
        groupName: "Independent",
        isIndependent: true,
      })),
    );

export const buildAllDisplayRows = (filteredGroups: GroupCompany[]): DisplayRow[] =>
  filteredGroups
    .flatMap((group) =>
      sortCompaniesLifo(group.subsidiaries).map((company) => ({
        type: "company" as const,
        company,
        groupId: group.id,
        groupName: isUngroupedGroup(group) ? "Independent" : group.groupName,
        isIndependent: isUngroupedGroup(group),
      })),
    )
    .sort(
      (left, right) =>
        getSortableTimestamp(right.company.incorporationDate) - getSortableTimestamp(left.company.incorporationDate),
    );

export const getSelectedGroupInfo = (groups: GroupCompany[], selectedCompany: Company | null) => {
  const selectedParentGroup =
    groups.find((group) => group.subsidiaries.some((company) => company.id === selectedCompany?.id)) ?? null;
  if (!selectedParentGroup || isUngroupedGroup(selectedParentGroup)) {
    return { name: "", code: "" };
  }
  return { name: selectedParentGroup.groupName, code: selectedParentGroup.code };
};
