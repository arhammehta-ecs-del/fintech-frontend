import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CompanyStatus, GroupCompany, Company } from "@/contexts/AppContext";
import { CompanyPreviewDialog, type ApprovalEvent } from "@/components/CompanyPreviewDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, GripVertical, Plus, Search, Settings2, Building2, X } from "lucide-react";
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

type AuditEntry = {
  lastUpdatedAt: string;
  approvedBy: string;
  approvedAt: string;
  approvalHistory: ApprovalEvent[];
};

const COMPANY_AUDIT: Record<string, AuditEntry> = {
  "1a": {
    lastUpdatedAt: "2026-03-31T10:20:00.000Z",
    approvedBy: "Priya M.",
    approvedAt: "2026-03-28T08:30:00.000Z",
    approvalHistory: [
      { name: "Priya M.", action: "Approved", at: "2026-03-28T08:30:00.000Z" },
      { name: "Rohit S.", action: "Risk cleared", at: "2026-03-27T12:00:00.000Z" },
      { name: "Ananya G.", action: "Submitted", at: "2026-03-26T09:10:00.000Z" },
    ],
  },
  "1b": {
    lastUpdatedAt: "2026-03-30T09:10:00.000Z",
    approvedBy: "Awaiting approval",
    approvedAt: "2026-03-30T09:10:00.000Z",
    approvalHistory: [
      { name: "Mehul V.", action: "Pending review", at: "2026-03-30T09:10:00.000Z" },
      { name: "Tata Motors Ops", action: "Submitted", at: "2026-03-29T16:20:00.000Z" },
    ],
  },
  "1c": {
    lastUpdatedAt: "2026-03-25T14:40:00.000Z",
    approvedBy: "Compliance Board",
    approvedAt: "2026-03-25T14:40:00.000Z",
    approvalHistory: [
      { name: "Compliance Board", action: "Rejected", at: "2026-03-25T14:40:00.000Z" },
      { name: "Nidhi K.", action: "Returned for corrections", at: "2026-03-24T11:05:00.000Z" },
      { name: "Tata Chemicals", action: "Company created", at: "2026-03-23T07:45:00.000Z" },
    ],
  },
  "2a": {
    lastUpdatedAt: "2026-03-31T06:50:00.000Z",
    approvedBy: "Rahul D.",
    approvedAt: "2026-03-29T13:25:00.000Z",
    approvalHistory: [
      { name: "Rahul D.", action: "Approved", at: "2026-03-29T13:25:00.000Z" },
      { name: "Aparna J.", action: "Financials verified", at: "2026-03-28T10:15:00.000Z" },
      { name: "Jio Platforms", action: "Company created", at: "2026-03-27T15:55:00.000Z" },
    ],
  },
};

const getAuditEntry = (company: Company): AuditEntry =>
  COMPANY_AUDIT[company.id] ?? {
    lastUpdatedAt: "2026-03-31T00:00:00.000Z",
    approvedBy: "Admin Portal",
    approvedAt: "2026-03-31T00:00:00.000Z",
    approvalHistory: [{ name: company.companyName, action: "Company created", at: "2026-03-31T00:00:00.000Z" }],
  };

type VisibleColumn = "groupName" | "code" | "createdDate" | "status" | "manage";

type DragPayload =
  | { type: "group"; groupId: string }
  | { type: "subsidiary"; groupId: string; companyId: string };

const reorderItems = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

const isUngroupedGroup = (group: GroupCompany) =>
  group.id.trim().toLowerCase() === "ungrouped" || group.groupName.trim().toLowerCase() === "ungrouped";

function StandaloneCompanyRow({
  company,
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
  company: Company;
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
    dragState.companyId !== company.id;

  const isDragging =
    dragState?.type === "subsidiary" &&
    dragState.groupId === groupId &&
    dragState.companyId === company.id;

  return (
    <tbody>
      <tr
        className={cn(
          "border-b border-border hover:bg-muted/30 transition-colors",
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
          <td className="px-4 py-3 text-sm text-muted-foreground">{company.incorporationDate}</td>
        )}
        {visibleColumns.has("manage") && (
          <td className="px-4 py-3">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => onManage(company)}>
              Manage
            </Button>
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
        "border-b border-border bg-muted/20 hover:bg-muted/40 transition-colors",
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
        <td className="px-4 py-3 text-sm pl-1">
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
        <td className="px-4 py-3 text-sm text-muted-foreground">{sub.incorporationDate}</td>
      )}
      {visibleColumns.has("manage") && (
        <td className="px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onManage(sub);
            }}
          >
            Manage
          </Button>
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
          "border-b border-border hover:bg-muted/30 cursor-pointer transition-colors",
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
          <td className="px-4 py-3 text-sm font-medium text-foreground">{group.groupName}</td>
        )}
        {visibleColumns.has("code") && (
          <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{group.code}</td>
        )}
        {visibleColumns.has("createdDate") && (
          <td className="px-4 py-3 text-sm text-muted-foreground">{group.createdDate}</td>
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
  const [auditEntries, setAuditEntries] = useState<Record<string, AuditEntry>>(COMPANY_AUDIT);
  const [visibleColumns, setVisibleColumns] = useState<Set<VisibleColumn>>(
    new Set(["groupName", "code", "createdDate", "manage", "status"]),
  );
  const [dragState, setDragState] = useState<DragPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const approvedCount = useMemo(
    () => groups.reduce((acc, group) => acc + group.subsidiaries.filter((company) => company.status === "Approved").length, 0),
    [groups],
  );
  const pendingCount = useMemo(
    () => groups.reduce((acc, group) => acc + group.subsidiaries.filter((company) => company.status === "Pending").length, 0),
    [groups],
  );
  const inactiveCount = useMemo(
    () => groups.reduce((acc, group) => acc + group.subsidiaries.filter((company) => company.status === "Inactive").length, 0),
    [groups],
  );

  const selectedGroupName = useMemo(
    () => {
      const parentGroup = groups.find((group) => group.subsidiaries.some((company) => company.id === selectedCompany?.id));
      if (!parentGroup || isUngroupedGroup(parentGroup)) {
        return "Independent company";
      }
      return parentGroup.groupName;
    },
    [groups, selectedCompany],
  );

  const selectedCompanyAudit = selectedCompany ? auditEntries[selectedCompany.id] ?? getAuditEntry(selectedCompany) : undefined;

  const filtered = useMemo(() => {
    const result = groups
      .map((g) => ({
        ...g,
        subsidiaries: g.subsidiaries.filter((s) => s.status === statusFilter),
      }))
      .filter((g) => g.subsidiaries.length > 0);

    const term = appliedSearch.trim().toLowerCase();
    if (!term) return result;

    return result.filter(
      (g) =>
        g.groupName.toLowerCase().includes(term) ||
        g.code.toLowerCase().includes(term) ||
        g.subsidiaries.some(
          (s) => s.companyName.toLowerCase().includes(term) || s.legalName.toLowerCase().includes(term),
        ),
    );
  }, [appliedSearch, groups, statusFilter]);

  const displayRows = useMemo(
    () =>
      filtered.flatMap((group) =>
        isUngroupedGroup(group)
          ? group.subsidiaries.map((company) => ({ type: "company" as const, company, groupId: group.id }))
          : [{ type: "group" as const, group } as const],
      ),
    [filtered],
  );

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

  const appendAuditEvent = (companyId: string, event: ApprovalEvent, approvedBy?: string) => {
    const company = groups.flatMap((group) => group.subsidiaries).find((item) => item.id === companyId);
    if (!company) return;

    setAuditEntries((previous) => {
      const baseEntry = previous[companyId] ?? getAuditEntry(company);
      return {
        ...previous,
        [companyId]: {
          ...baseEntry,
          lastUpdatedAt: event.at,
          approvedBy: approvedBy ?? baseEntry.approvedBy,
          approvedAt: event.at,
          approvalHistory: [event, ...baseEntry.approvalHistory],
        },
      };
    });
  };

  const handleSaveCompany = (updatedCompany: Company) => {
    updateSpecificCompany(updatedCompany.id, () => updatedCompany);
    setSelectedCompany(updatedCompany);
    setAuditEntries((previous) => ({
      ...previous,
      [updatedCompany.id]: {
        ...(previous[updatedCompany.id] ?? getAuditEntry(updatedCompany)),
        lastUpdatedAt: new Date().toISOString(),
      },
    }));
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
    const action = isActive ? "Approved" : "Marked inactive";
    const lastEvent = (auditEntries[companyId] ?? getAuditEntry(existingCompany)).approvalHistory[0];
    if (!lastEvent || lastEvent.action !== action || lastEvent.name !== "Admin Portal") {
      appendAuditEvent(
        companyId,
        {
          name: "Admin Portal",
          action,
          at: new Date().toISOString(),
        },
        "Admin Portal",
      );
    }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Corporate List</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage group companies and subsidiaries</p>
        </div>
        <Button onClick={() => navigate("/onboarding")} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Onboard new corporate
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
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as CompanyStatus)}>
            <SelectTrigger className="h-9 w-full bg-white sm:w-[150px]">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="Approved">{`Approved (${approvedCount})`}</SelectItem>
              <SelectItem value="Pending">{`Pending (${pendingCount})`}</SelectItem>
              {inactiveCount > 0 && <SelectItem value="Inactive">{`Inactive (${inactiveCount})`}</SelectItem>}
            </SelectContent>
          </Select>

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
                  { id: "code", label: "Code / Legal Name" },
                  { id: "createdDate", label: "Created Date" },
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
          <p className="text-muted-foreground text-sm mt-1 mb-4">Get started by onboarding a new corporate client</p>
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
                      <p className="text-sm font-semibold text-foreground">{row.group.groupName}</p>
                      {visibleColumns.has("code") && (
                        <p className="mt-1 text-sm text-muted-foreground">{row.group.code}</p>
                      )}
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
                              <p className="text-xs text-muted-foreground">{sub.incorporationDate || "No date"}</p>
                            ) : (
                              <span />
                            )}
                            <Button variant="ghost" size="sm" className="h-8 px-0 text-xs" onClick={() => openModal(sub)}>
                              Manage
                            </Button>
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
                        <p className="text-xs text-muted-foreground">{row.company.incorporationDate || "No date"}</p>
                      ) : (
                        <span />
                      )}
                      <Button variant="ghost" size="sm" className="h-8 px-0 text-xs" onClick={() => openModal(row.company)}>
                        Manage
                      </Button>
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
                    {visibleColumns.has("code") && (
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Legal Name
                      </th>
                    )}
                    {visibleColumns.has("createdDate") && (
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Created Date
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
        groupName={selectedGroupName}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        onSave={handleSaveCompany}
        onToggleActive={handleToggleCompanyActive}
        approvalHistory={selectedCompanyAudit?.approvalHistory ?? []}
        approvalStatusLabel={selectedCompany ? approvalStatusLabel[selectedCompany.status] : undefined}
        defaultEditing={defaultEditing}
        onAuditEvent={(event) => {
          if (!selectedCompany) return;
          appendAuditEvent(selectedCompany.id, event);
        }}
      />
    </div>
  );
}
