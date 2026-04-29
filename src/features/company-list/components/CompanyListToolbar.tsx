import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Settings2, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompanyListToolbarProps, StatusTab, VisibleColumn } from "@/features/company-list/types";

const STATUS_TABS: Array<{ id: StatusTab; label: string; badgeClassName: string }> = [
  { id: "active", label: "Active", badgeClassName: "bg-emerald-100 text-emerald-700" },
  { id: "pending", label: "Pending", badgeClassName: "bg-amber-100 text-amber-700" },
  { id: "inactive", label: "Inactive", badgeClassName: "bg-rose-100 text-rose-700" },
];

const DEFAULT_COLUMNS: Array<{ id: VisibleColumn; label: string }> = [
  { id: "groupName", label: "Group Name" },
  { id: "companyName", label: "Company Name" },
  { id: "code", label: "Code / Legal Name" },
  { id: "createdDate", label: "Registration Date" },
  { id: "manage", label: "Manage" },
];

export default function CompanyListToolbar({
  searchInput,
  onSearchInputChange,
  onSearchSubmit,
  onClearSearch,
  selectedStatusTab,
  onStatusTabChange,
  statusCounts,
  visibleColumns,
  onToggleColumn,
  onOpenOnboarding,
}: CompanyListToolbarProps) {
  const columns = DEFAULT_COLUMNS;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Company List</h1>
          <p className="mt-1 text-sm text-muted-foreground">Switch between active, pending, and inactive companies at a glance.</p>
        </div>
        <Button onClick={onOpenOnboarding} className="gap-2">
          <Plus className="h-4 w-4" /> Add New Company
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies or groups..."
              className="pl-9 pr-9"
              value={searchInput}
              onChange={(event) => onSearchInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSearchSubmit();
                }
              }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={onClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="button" variant="outline" onClick={onSearchSubmit} className="w-full sm:w-auto">
            Search
          </Button>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 self-start sm:w-auto sm:self-end">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1.5 shadow-sm">
            {STATUS_TABS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onStatusTabChange(option.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200",
                  selectedStatusTab === option.id
                    ? "bg-[#3553e9] text-white shadow-[0_10px_24px_rgba(53,83,233,0.22)]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                )}
                aria-pressed={selectedStatusTab === option.id}
              >
                <span>{option.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    selectedStatusTab === option.id ? "bg-white/18 text-white ring-1 ring-white/25" : option.badgeClassName,
                  )}
                >
                  {statusCounts[option.id]}
                </span>
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
                {columns.map((column) => (
                  <label key={column.id} className="flex items-center gap-3 text-sm text-foreground">
                    <Checkbox
                      checked={visibleColumns.has(column.id)}
                      onCheckedChange={(checked) => onToggleColumn(column.id, Boolean(checked))}
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </>
  );
}
