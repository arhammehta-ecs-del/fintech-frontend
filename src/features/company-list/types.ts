import type { DragEvent } from "react";
import type { Company, CompanyStatus, GroupCompany } from "@/contexts/AppContext";

export type VisibleColumn = "groupName" | "companyName" | "code" | "createdDate" | "status" | "manage";
export type ViewMode = "all" | "grouped" | "independent";

export type DragPayload =
  | { type: "group"; groupId: string }
  | { type: "subsidiary"; groupId: string; companyId: string };

export type FlatCompanyRow = {
  type: "company";
  company: Company;
  groupId: string;
  groupName: string;
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
  onSearchSubmit: () => void;
  onClearSearch: () => void;
  statusCounts: Record<"active" | "pending" | "inactive", number>;
  visibleColumns: Set<VisibleColumn>;
  onToggleColumn: (column: VisibleColumn, checked: boolean) => void;
  onOpenOnboarding: () => void;
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
