import type { DragEvent } from "react";
import type { Company, CompanyStatus, GroupCompany } from "@/contexts/AppContext";

export type VisibleColumn = "groupName" | "companyName" | "code" | "createdDate" | "status" | "manage";
export type StatusTab = "active" | "pending" | "inactive";
export type ViewMode = "all" | "grouped" | "independent";

export type DragPayload =
  | { type: "group"; groupId: string }
  | { type: "subsidiary"; groupId: string; companyId: string };

export type FlatCompanyRow = {
  type: "company";
  company: Company;
  groupId: string;
  groupName: string;
  groupCode: string;
  isIndependent: boolean;
};

export type GroupRow = {
  type: "group";
  group: GroupCompany;
};

export type DisplayRow = FlatCompanyRow | GroupRow;

export type CompanyOnboardingWizardRendererProps = {
  embedded: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void | Promise<void>;
};

export type CompanyListTableProps = {
  displayRows: DisplayRow[];
  expanded: Set<string>;
  visibleColumns: Set<VisibleColumn>;
  showStatusColumn: boolean;
  dragState: DragPayload | null;
  onToggleGroup: (id: string) => void;
  onOpenCompany: (company: Company) => void;
  onDragStart: (payload: DragPayload) => (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => void;
  onDrop: (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => void;
};

export type CompanyListToolbarProps = {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onClearSearch: () => void;
  searchSuggestions: string[];
  selectedStatusTab: StatusTab;
  onStatusTabChange: (value: StatusTab) => void;
  statusCounts: Record<"active" | "pending" | "inactive", number>;
  appliedFilters: CompanyListAppliedFiltersDraft;
  onApplyFilters: (draft: CompanyListAppliedFiltersDraft) => void;
  onClearAdvancedFilters: () => void | Promise<void>;
  todayIso: string;
  onOpenOnboarding: () => void;
  hasNewCompanyListEvent: boolean;
  suppressAutoEventTooltip?: boolean;
  isRefreshing?: boolean;
  onRefresh: () => void | Promise<void>;
  refreshInitializedAt?: number | null;
};

export const COMPANY_LIST_DATE_OPTIONS = ["7days", "15days", "1month", "custom"] as const;
export const COMPANY_LIST_BOOLEAN_OPTIONS = ["yes", "no"] as const;
export const COMPANY_LIST_SIGNATORY_OPTIONS = [1, 2, 3, 4, 5] as const;

export type CompanyListDateFilterValue = (typeof COMPANY_LIST_DATE_OPTIONS)[number] | null;
export type CompanyListBooleanFilterValue = (typeof COMPANY_LIST_BOOLEAN_OPTIONS)[number] | null;

export type CompanyListAppliedFiltersDraft = {
  incorporationDate: CompanyListDateFilterValue;
  fromDate: string;
  toDate: string;
  gstcode: CompanyListBooleanFilterValue;
  isCode: CompanyListBooleanFilterValue;
  signatoryCount: number[];
};

// export type CompanyListMobileListProps = {
//   displayRows: DisplayRow[];
//   expanded: Set<string>;
//   showStatusColumn: boolean;
//   visibleColumns: Set<VisibleColumn>;
//   onToggleGroup: (id: string) => void;
//   onOpenCompany: (company: Company) => void;
// };

export type CompanyListListState = {
  groups: GroupCompany[];
  expanded: Set<string>;
  searchInput: string;
  appliedSearch: string;
  statusFilter: CompanyStatus;
  selectedCompany: Company | null;
  isPreviewOpen: boolean;
  isOnboardingOpen: boolean;
  visibleColumns: Set<VisibleColumn>;
  isLoading: boolean;
  error: string | null;
  viewMode: ViewMode;
  showStatusColumn: boolean;
  selectedGroupName: string;
  selectedGroupCode: string;
  displayRows: DisplayRow[];
};
