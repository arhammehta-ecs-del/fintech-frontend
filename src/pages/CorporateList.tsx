import { useEffect, useMemo, useState, type DragEvent } from "react";
import { format, parseISO } from "date-fns";
import { useLocation, useNavigate } from "react-router-dom";
import { CompanyStatus, GroupCompany, Company } from "@/contexts/AppContext";
import { CompanyPreviewDialog } from "@/components/CompanyPreviewDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronRight, Eye, GripVertical, Pencil, Plus, Search, Settings2, Building2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllCompanies } from "@/lib/api";

const statusColors: Record<CompanyStatus, string> = {
  Approved: "bg-success/10 text-success border-success/20",
  Pending: "bg-warning/10 text-warning border-warning/20",
  Inactive: "bg-destructive/10 text-destructive border-destructive/20",
};

const approvalStatusLabel: Record<CompanyStatus, string> = {
  Approved: "Approved",
  Pending: "Pending",
  Inactive: "Inactive",
};

const formatDisplayDate = (value: string) => {
  if (!value) return "No date";

  try {
    return format(parseISO(value), "dd MMM yyyy");
  } catch {
    return value;
  }
};

const formatGroupDisplayDate = (value: string) => {
  if (!value) return "";

  try {
    return format(parseISO(value), "dd MMM yyyy");
  } catch {
    return value;
  }
};

type AuditEntry = {
  lastUpdatedAt: string;
  approvedBy: string;
  approvedAt: string;
  // approvalHistory: ApprovalEvent[];
};

type VisibleColumn = "groupName" | "companyName" | "code" | "createdDate" | "status" | "manage";
type ViewMode = "all" | "grouped" | "independent";

type DragPayload =
  | { type: "group"; groupId: string }
  | { type: "subsidiary"; groupId: string; companyId: string };

type FlatCompanyRow = {
  type: "company";
  company: Company;
  groupId: string;
  groupName: string;
  isIndependent: boolean;
};

type GroupRow = {
  type: "group";
  group: GroupCompany;
};

type DisplayRow = FlatCompanyRow | GroupRow;

const reorderItems = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

const isUngroupedGroup = (group: GroupCompany) =>
  group.id.trim().toLowerCase() === "ungrouped" || group.groupName.trim().toLowerCase() === "ungrouped";

const getSortableTimestamp = (value: string) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortCompaniesLifo = (companies: Company[]) =>
  [...companies].sort(
    (left, right) => getSortableTimestamp(right.incorporationDate) - getSortableTimestamp(left.incorporationDate),
  );

const sortGroupsLifo = (inputGroups: GroupCompany[]) =>
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

function StandaloneCompanyRow({
  company,
  groupId,
  groupLabel,
  visibleColumns,
  showStatusColumn,
  onManage,
  dragState,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  company: Company;
  groupId: string;
  groupLabel: string;
  visibleColumns: Set<VisibleColumn>;
  showStatusColumn: boolean;
  onManage: (company: Company, editing?: boolean) => void;
  dragState: DragPayload | null;
  onDragStart: (payload: DragPayload) => (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => void;
  onDrop: (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => void;
}) {
  const isDropTarget =
    dragState?.type === "subsidiary" &&
    dragState.groupId === groupId &&
    dragState.companyId !== company.id;

  const isDragging =
    dragState?.type === "subsidiary" &&
    dragState.groupId === groupId &&
    dragState.companyId === company.id;

  return (
    <tbody>
      <tr
        className={cn(
          "border-b border-border transition-colors hover:bg-slate-50",
          isDragging && "opacity-50",
          isDropTarget && "bg-primary/5",
        )}
        onDragOver={onDragOver({ type: "subsidiary", groupId, companyId: company.id })}
        onDrop={onDrop({ type: "subsidiary", groupId, companyId: company.id })}
      >
        <td className="px-4 py-3">
          <button
            type="button"
            draggable
            onDragStart={onDragStart({ type: "subsidiary", groupId, companyId: company.id })}
            onDragEnd={onDragEnd}
            className="text-muted-foreground p-1 -ml-1 cursor-grab active:cursor-grabbing"
            aria-label={`Drag ${company.companyName}`}
          >
            <GripVertical className="h-4 w-4 opacity-50 hover:opacity-100" />
          </button>
        </td>
        {visibleColumns.has("groupName") && (
          <td className="px-4 py-3 text-sm text-muted-foreground">{groupLabel}</td>
        )}
        {visibleColumns.has("companyName") && (
          <td className="px-4 py-3 text-sm font-medium text-foreground">
            <span
              className="text-primary hover:underline cursor-pointer"
              onClick={() => {
                onManage(company);
              }}
            >
              {company.companyName}
            </span>
          </td>
        )}
        {visibleColumns.has("code") && (
          <td className="px-4 py-3 text-sm text-muted-foreground">{company.legalName}</td>
        )}
        {visibleColumns.has("createdDate") && (
          <td className="px-4 py-3 text-sm text-muted-foreground">{formatDisplayDate(company.incorporationDate)}</td>
        )}
        {visibleColumns.has("manage") && (
          <td className="px-4 py-3">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-sky-700 hover:bg-sky-50 hover:text-sky-800" onClick={() => onManage(company)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="h-8 w-8 cursor-default text-slate-400 hover:bg-transparent hover:text-slate-400"
                aria-label={`Edit ${company.companyName}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </td>
        )}
        {showStatusColumn && visibleColumns.has("status") && (
          <td className="px-4 py-3">
            <Badge variant="outline" className={cn("text-xs", statusColors[company.status])}>
              {company.status}
            </Badge>
          </td>
        )}
      </tr>
    </tbody>
  );
}

function SortableSubsidiaryRow({
  sub,
  groupId,
  visibleColumns,
  showStatusColumn,
  onManage,
  dragState,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  sub: Company;
  groupId: string;
  visibleColumns: Set<VisibleColumn>;
  showStatusColumn: boolean;
  onManage: (company: Company, editing?: boolean) => void;
  dragState: DragPayload | null;
  onDragStart: (payload: DragPayload) => (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => void;
  onDrop: (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => void;
}) {
  const isDropTarget =
    dragState?.type === "subsidiary" &&
    dragState.groupId === groupId &&
    dragState.companyId !== sub.id;

  const isDragging =
    dragState?.type === "subsidiary" &&
    dragState.groupId === groupId &&
    dragState.companyId === sub.id;

  return (
    <tr
      className={cn(
        "border-b border-border bg-muted/20 transition-colors hover:bg-slate-50",
        isDragging && "opacity-50",
        isDropTarget && "bg-primary/5",
      )}
      onDragOver={onDragOver({ type: "subsidiary", groupId, companyId: sub.id })}
      onDrop={onDrop({ type: "subsidiary", groupId, companyId: sub.id })}
    >
      <td className="px-4 py-3">
        <button
          type="button"
          draggable
          onDragStart={onDragStart({ type: "subsidiary", groupId, companyId: sub.id })}
          onDragEnd={onDragEnd}
          onClick={(event) => event.stopPropagation()}
          className="ml-8 text-muted-foreground p-1 cursor-grab active:cursor-grabbing"
          aria-label={`Drag ${sub.companyName}`}
        >
          <GripVertical className="h-4 w-4 opacity-50 hover:opacity-100" />
        </button>
      </td>
      {visibleColumns.has("groupName") && (
        <td className="px-4 py-3 text-sm text-muted-foreground"></td>
      )}
      {visibleColumns.has("companyName") && (
        <td className="px-4 py-3 text-sm">
            <span
              className="text-primary hover:underline cursor-pointer font-medium"
              onClick={(event) => {
                event.stopPropagation();
                onManage(sub);
            }}
          >
            {sub.companyName}
          </span>
        </td>
      )}
      {visibleColumns.has("code") && (
        <td className="px-4 py-3 text-sm text-muted-foreground">{sub.legalName}</td>
      )}
      {visibleColumns.has("createdDate") && (
        <td className="px-4 py-3 text-sm text-muted-foreground">{formatDisplayDate(sub.incorporationDate)}</td>
      )}
      {visibleColumns.has("manage") && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
              onClick={(event) => {
                event.stopPropagation();
                onManage(sub);
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-8 w-8 cursor-default text-slate-400 hover:bg-transparent hover:text-slate-400"
              aria-label={`Edit ${sub.companyName}`}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </td>
      )}
      {showStatusColumn && visibleColumns.has("status") && (
        <td className="px-4 py-3">
          <Badge variant="outline" className={cn("text-xs", statusColors[sub.status])}>
            {sub.status}
          </Badge>
        </td>
      )}
    </tr>
  );
}

function SortableGroupBody({
  group,
  expanded,
  visibleColumns,
  showStatusColumn,
  onToggle,
  onManage,
  dragState,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  group: GroupCompany;
  expanded: boolean;
  visibleColumns: Set<VisibleColumn>;
  showStatusColumn: boolean;
  onToggle: () => void;
  onManage: (company: Company, editing?: boolean) => void;
  dragState: DragPayload | null;
  onDragStart: (payload: DragPayload) => (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => void;
  onDrop: (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => void;
}) {
  const isDropTarget = dragState?.type === "group" && dragState.groupId !== group.id;
  const isDragging = dragState?.type === "group" && dragState.groupId === group.id;

  return (
    <tbody>
      <tr
        className={cn(
          "border-b border-border cursor-pointer transition-colors hover:bg-slate-50",
          isDragging && "opacity-50",
          isDropTarget && "bg-primary/5",
        )}
        onClick={onToggle}
        onDragOver={onDragOver({ type: "group", groupId: group.id })}
        onDrop={onDrop({ type: "group", groupId: group.id })}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              draggable
              onDragStart={onDragStart({ type: "group", groupId: group.id })}
              onDragEnd={onDragEnd}
              onClick={(event) => event.stopPropagation()}
              className="text-muted-foreground p-1 -ml-1 cursor-grab active:cursor-grabbing"
              aria-label={`Drag ${group.groupName}`}
            >
              <GripVertical className="h-4 w-4 opacity-50 hover:opacity-100" />
            </button>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </td>
        {visibleColumns.has("groupName") && (
          <td className="px-4 py-3 text-sm font-medium text-foreground">
            {group.groupName} ({group.subsidiaries.length})
          </td>
        )}
        {visibleColumns.has("companyName") && (
          <td className="px-4 py-3 text-sm text-muted-foreground"></td>
        )}
        {visibleColumns.has("code") && (
          <td className="px-4 py-3 text-sm text-muted-foreground"></td>
        )}
        {visibleColumns.has("createdDate") && (
          <td className="px-4 py-3 text-sm text-muted-foreground">{formatGroupDisplayDate(group.createdDate)}</td>
        )}
        {visibleColumns.has("manage") && <td className="px-4 py-3 text-sm text-muted-foreground"></td>}
        {showStatusColumn && visibleColumns.has("status") && <td className="px-4 py-3 text-sm text-muted-foreground">Group</td>}
      </tr>

      {expanded && (
        <>
          {group.subsidiaries.map((sub) => (
            <SortableSubsidiaryRow
              key={sub.id}
              sub={sub}
              groupId={group.id}
              visibleColumns={visibleColumns}
              showStatusColumn={showStatusColumn}
              onManage={onManage}
              dragState={dragState}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </>
      )}
    </tbody>
  );
}

export default function CorporateList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [groups, setGroups] = useState<GroupCompany[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CompanyStatus>(location.state?.statusFilter || "Approved");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [defaultEditing, setDefaultEditing] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<VisibleColumn>>(
    new Set(["groupName", "companyName", "code", "createdDate", "manage", "status"]),
  );
  const [dragState, setDragState] = useState<DragPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const shouldShowStatusColumn = statusFilter !== "Approved";

  useEffect(() => {
    let ignore = false;

    async function loadCompanies() {
      try {
        setIsLoading(true);
        setError(null);
        const nextGroups = await getAllCompanies();
        if (!ignore) {    
          setGroups(nextGroups);
          setExpanded(new Set(nextGroups.map((group) => group.id)));
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load companies");
          setGroups([]);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadCompanies();

    return () => {
      ignore = true;
    };
  }, []);

  const selectedGroupName = useMemo(
    () => {
      const parentGroup = groups.find((group) => group.subsidiaries.some((company) => company.id === selectedCompany?.id));
      if (!parentGroup || isUngroupedGroup(parentGroup)) {
        return "";
      }
      return parentGroup.groupName;
    },
    [groups, selectedCompany],
  );
  const selectedGroupCode = useMemo(
    () => {
      const parentGroup = groups.find((group) => group.subsidiaries.some((company) => company.id === selectedCompany?.id));
      if (!parentGroup || isUngroupedGroup(parentGroup)) {
        return "";
      }
      return parentGroup.code;
    },
    [groups, selectedCompany],
  );

  // const selectedCompanyAudit = selectedCompany
  //   ? { lastUpdatedAt: "", approvedBy: "", approvedAt: "", approvalHistory: [] as ApprovalEvent[] }
  //   : undefined;

  const filteredGroups = useMemo(() => {
    const result = sortGroupsLifo(groups)
      .map((g) => ({
        ...g,
        subsidiaries: g.subsidiaries.filter((s) => s.status === statusFilter),
      }))
      .filter((g) => g.subsidiaries.length > 0);

    const term = appliedSearch.trim().toLowerCase();
    if (!term) return result;

    return result
      .map((group) => {
        const groupMatches =
          group.groupName.toLowerCase().includes(term) ||
          group.code.toLowerCase().includes(term);

        if (groupMatches) {
          return group;
        }

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

        return {
          ...group,
          subsidiaries: matchingSubsidiaries,
        };
      })
      .filter((group) => group.subsidiaries.length > 0);
  }, [appliedSearch, groups, statusFilter]);

  const groupedDisplayRows = useMemo<DisplayRow[]>(
    () =>
      filteredGroups
        .filter((group) => !isUngroupedGroup(group))
        .map((group) => ({ type: "group", group })),
    [filteredGroups],
  );

  const independentDisplayRows = useMemo<DisplayRow[]>(
    () =>
      filteredGroups
        .filter((group) => isUngroupedGroup(group))
        .flatMap((group) =>
          sortCompaniesLifo(group.subsidiaries).map((company) => ({
            type: "company",
            company,
            groupId: group.id,
            groupName: "Independent",
            isIndependent: true,
          })),
        ),
    [filteredGroups],
  );

  const allDisplayRows = useMemo<DisplayRow[]>(
    () =>
      filteredGroups
        .flatMap((group) =>
          sortCompaniesLifo(group.subsidiaries).map((company) => ({
            type: "company",
            company,
            groupId: group.id,
            groupName: isUngroupedGroup(group) ? "Independent" : group.groupName,
            isIndependent: isUngroupedGroup(group),
          })),
        )
        .sort(
          (left, right) =>
            getSortableTimestamp(right.company.incorporationDate) - getSortableTimestamp(left.company.incorporationDate),
        ),
    [filteredGroups],
  );

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (viewMode === "grouped") return groupedDisplayRows;
    if (viewMode === "independent") return independentDisplayRows;
    return allDisplayRows;
  }, [allDisplayRows, groupedDisplayRows, independentDisplayRows, viewMode]);

  const handleSearchSubmit = () => {
    setAppliedSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setAppliedSearch("");
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openModal = (company: Company, editing = false) => {
    setSelectedCompany(company);
    setDefaultEditing(editing);
    setIsPreviewOpen(true);
  };

  const handleDragStart = (payload: DragPayload) => (event: DragEvent<HTMLElement>) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    setDragState(payload);
  };

  const handleDragEnd = () => {
    setDragState(null);
  };

  const handleDragOver = (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => {
    if (!dragState) return;
    const isSameGroupMove = dragState.type === "group" && payload.type === "group" && dragState.groupId !== payload.groupId;
    const isSameSubsidiaryMove =
      dragState.type === "subsidiary" &&
      payload.type === "subsidiary" &&
      dragState.groupId === payload.groupId &&
      dragState.companyId !== payload.companyId;

    if (isSameGroupMove || isSameSubsidiaryMove) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  };

  const handleDrop = (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => {
    event.preventDefault();
    if (!dragState) return;

    if (dragState.type === "group" && payload.type === "group" && dragState.groupId !== payload.groupId) {
      setGroups((previousGroups) => {
        const fromIndex = previousGroups.findIndex((group) => group.id === dragState.groupId);
        const toIndex = previousGroups.findIndex((group) => group.id === payload.groupId);
        if (fromIndex === -1 || toIndex === -1) return previousGroups;
        return reorderItems(previousGroups, fromIndex, toIndex);
      });
    }

    if (
      dragState.type === "subsidiary" &&
      payload.type === "subsidiary" &&
      dragState.groupId === payload.groupId &&
      dragState.companyId !== payload.companyId
    ) {
      setGroups((previousGroups) =>
        previousGroups.map((group) => {
          if (group.id !== payload.groupId) return group;
          const fromIndex = group.subsidiaries.findIndex((company) => company.id === dragState.companyId);
          const toIndex = group.subsidiaries.findIndex((company) => company.id === payload.companyId);
          if (fromIndex === -1 || toIndex === -1) return group;
          return {
            ...group,
            subsidiaries: reorderItems(group.subsidiaries, fromIndex, toIndex),
          };
        }),
      );
    }

    setDragState(null);
  };

  const updateSpecificCompany = (companyId: string, updater: (company: Company) => Company) => {
    setGroups((previousGroups) =>
      previousGroups.map((group) => ({
        ...group,
        subsidiaries: group.subsidiaries.map((company) => (company.id === companyId ? updater(company) : company)),
      })),
    );
  };

  const handleSaveCompany = (updatedCompany: Company) => {
    updateSpecificCompany(updatedCompany.id, () => updatedCompany);
    setSelectedCompany(updatedCompany);
  };

  const handleToggleCompanyActive = (companyId: string, isActive: boolean) => {
    const existingCompany = groups.flatMap((group) => group.subsidiaries).find((company) => company.id === companyId);
    const nextStatus: CompanyStatus = isActive ? "Approved" : "Inactive";
    if (!existingCompany || existingCompany.status === nextStatus) return;

    updateSpecificCompany(companyId, (company) => ({
      ...company,
      status: nextStatus,
    }));
    setSelectedCompany((previous) =>
      previous && previous.id === companyId
        ? { ...previous, status: nextStatus }
        : previous,
    );
  };

  const toggleColumn = (column: VisibleColumn, checked: boolean) => {
    setVisibleColumns((previous) => {
      const next = new Set(previous);
      if (checked) next.add(column);
      else next.delete(column);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Corporate List</h1>
        </div>
        <Button onClick={() => navigate("/onboarding")} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> New Onboarding
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search groups..."
              className="pl-9 pr-9"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearchSubmit();
                }
              }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="button" variant="outline" onClick={handleSearchSubmit} className="w-full sm:w-auto">
            Search
          </Button>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 self-start sm:w-auto sm:self-end">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            {[
              { id: "all", label: "All" },
              { id: "grouped", label: "Groups" },
              { id: "independent", label: "Independent" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setViewMode(option.id as ViewMode)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  viewMode === option.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-slate-50 hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56">
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">View Columns</p>
                {[
                  { id: "groupName", label: "Group Name" },
                  { id: "companyName", label: "Company Name" },
                  { id: "code", label: "Code / Legal Name" },
                  { id: "createdDate", label: "Incorporation Date" },
                  { id: "manage", label: "Manage" },
                  ...(shouldShowStatusColumn ? [{ id: "status", label: "Status" }] : []),
                ].map((column) => (
                  <label key={column.id} className="flex items-center gap-3 text-sm text-foreground">
                    <Checkbox
                      checked={visibleColumns.has(column.id as VisibleColumn)}
                      onCheckedChange={(checked) => toggleColumn(column.id as VisibleColumn, Boolean(checked))}
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {isLoading ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center shadow-sm">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4 animate-pulse" />
          <h3 className="text-lg font-medium text-foreground">Loading companies</h3>
          <p className="text-muted-foreground text-sm mt-1">Fetching the latest company list</p>
        </Card>
      ) : error ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center shadow-sm">
          <Building2 className="h-12 w-12 text-destructive/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground">Unable to load companies</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </Card>
      ) : displayRows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center shadow-sm">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground">No companies found</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            {viewMode === "grouped"
              ? "No grouped companies match the current filters."
              : viewMode === "independent"
                ? "No independent companies match the current filters."
                : "Get started by onboarding a new corporate client"}
          </p>
          <Button onClick={() => navigate("/onboarding")} className="gap-2">
            <Plus className="h-4 w-4" /> New Onboarding
          </Button>
        </Card>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {displayRows.map((row) =>
              row.type === "group" ? (
                <Card key={row.group.id} className="overflow-hidden shadow-sm">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
                    onClick={() => toggle(row.group.id)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {row.group.groupName} ({row.group.subsidiaries.length})
                      </p>
                    </div>
                    {expanded.has(row.group.id) ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {expanded.has(row.group.id) && (
                    <div className="border-t border-border bg-muted/10">
                      {row.group.subsidiaries.map((sub) => (
                        <div key={sub.id} className="flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <button
                                type="button"
                                className="text-left text-sm font-medium text-primary hover:underline"
                                onClick={() => openModal(sub)}
                              >
                                {sub.companyName}
                              </button>
                              <p className="mt-1 text-sm text-muted-foreground">{sub.legalName}</p>
                            </div>
                            {shouldShowStatusColumn && visibleColumns.has("status") && (
                              <Badge variant="outline" className={cn("text-xs", statusColors[sub.status])}>
                                {sub.status}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            {visibleColumns.has("createdDate") ? (
                              <p className="text-xs text-muted-foreground">{formatDisplayDate(sub.incorporationDate)}</p>
                            ) : (
                              <span />
                            )}
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                                onClick={() => openModal(sub)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                className="h-8 w-8 cursor-default text-slate-400 hover:bg-transparent hover:text-slate-400"
                                aria-label={`Edit ${sub.companyName}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ) : (
                <Card key={row.company.id} className="shadow-sm">
                  <div className="flex flex-col gap-3 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {visibleColumns.has("groupName") ? (
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{row.groupName}</p>
                        ) : null}
                        <button
                          type="button"
                          className="text-left text-sm font-semibold text-primary hover:underline"
                          onClick={() => openModal(row.company)}
                        >
                          {row.company.companyName}
                        </button>
                        <p className="mt-1 text-sm text-muted-foreground">{row.company.legalName}</p>
                      </div>
                      {shouldShowStatusColumn && visibleColumns.has("status") && (
                        <Badge variant="outline" className={cn("text-xs", statusColors[row.company.status])}>
                          {row.company.status}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      {visibleColumns.has("createdDate") ? (
                        <p className="text-xs text-muted-foreground">{formatDisplayDate(row.company.incorporationDate)}</p>
                      ) : (
                        <span />
                      )}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                          onClick={() => openModal(row.company)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          className="h-8 w-8 cursor-default text-slate-400 hover:bg-transparent hover:text-slate-400"
                          aria-label={`Edit ${row.company.companyName}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ),
            )}
          </div>

          <Card className="hidden overflow-hidden shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-16"></th>
                    {visibleColumns.has("groupName") && (
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Group Name
                      </th>
                    )}
                    {visibleColumns.has("companyName") && (
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Company Name
                      </th>
                    )}
                    {visibleColumns.has("code") && (
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Legal Name
                      </th>
                    )}
                    {visibleColumns.has("createdDate") && (
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Incorporation Date
                      </th>
                    )}
                    {visibleColumns.has("manage") && (
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Manage
                      </th>
                    )}
                    {shouldShowStatusColumn && visibleColumns.has("status") && (
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                    )}
                  </tr>
                </thead>
                {displayRows.map((row) =>
                  row.type === "group" ? (
                    <SortableGroupBody
                      key={row.group.id}
                      group={row.group}
                      expanded={expanded.has(row.group.id)}
                      visibleColumns={visibleColumns}
                      showStatusColumn={shouldShowStatusColumn}
                      onToggle={() => toggle(row.group.id)}
                      onManage={openModal}
                      dragState={dragState}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    />
                  ) : (
                    <StandaloneCompanyRow
                      key={row.company.id}
                      company={row.company}
                      groupId={row.groupId}
                      groupLabel={row.groupName}
                      visibleColumns={visibleColumns}
                      showStatusColumn={shouldShowStatusColumn}
                      onManage={openModal}
                      dragState={dragState}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    />
                  ),
                )}
              </table>
            </div>
          </Card>
        </>
      )}

      <CompanyPreviewDialog
        company={selectedCompany}
        companyCode={selectedCompany?.companyCode ?? ""}
        groupName={selectedGroupName}
        groupCode={selectedGroupCode}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        onSave={handleSaveCompany}
        onToggleActive={handleToggleCompanyActive}
        // approvalHistory={selectedCompanyAudit?.approvalHistory ?? []}
        approvalStatusLabel={selectedCompany ? approvalStatusLabel[selectedCompany.status] : undefined}
        defaultEditing={defaultEditing}
        // onAuditEvent={() => {}}
      />
    </div>
  );
}
