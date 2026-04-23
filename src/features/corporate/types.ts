import type { DragEvent } from "react";
import type { Company, CompanyStatus, GroupCompany } from "@/contexts/AppContext";

export type VisibleColumn = "groupName" | "companyName" | "code" | "createdDate" | "status" | "manage";
export type StatusTab = "active" | "pending" | "inactive";

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

export type OnboardingWizardRendererProps = {
  embedded: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type CorporateTableProps = {
  displayRows: DisplayRow[];
  expanded: Set<string>;
  visibleColumns: Set<VisibleColumn>;
  showStatusColumn: boolean;
  dragState: DragPayload | null;
  onToggleGroup: (id: string) => void;
  onOpenCompany: (company: Company) => void;
  onToggleActive: (companyId: string, isActive: boolean) => void;
  onDragStart: (payload: DragPayload) => (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => void;
  onDrop: (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => void;
};

export type CorporateToolbarProps = {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
  onClearSearch: () => void;
  selectedStatusTab: StatusTab;
  onStatusTabChange: (tab: StatusTab) => void;
  visibleColumns: Set<VisibleColumn>;
  onToggleColumn: (column: VisibleColumn, checked: boolean) => void;
  onOpenOnboarding: () => void;
};

export type CorporateMobileListProps = {
  displayRows: DisplayRow[];
  expanded: Set<string>;
  showStatusColumn: boolean;
  visibleColumns: Set<VisibleColumn>;
  onToggleGroup: (id: string) => void;
  onOpenCompany: (company: Company) => void;
};

export type CorporateListState = {
  groups: GroupCompany[];
  expanded: Set<string>;
  searchInput: string;
  appliedSearch: string;
  statusFilter: CompanyStatus;
  selectedStatusTab: StatusTab;
  selectedCompany: Company | null;
  isPreviewOpen: boolean;
  isOnboardingOpen: boolean;
  visibleColumns: Set<VisibleColumn>;
  isLoading: boolean;
  error: string | null;
  showStatusColumn: boolean;
  selectedGroupName: string;
  selectedGroupCode: string;
  displayRows: DisplayRow[];
};
