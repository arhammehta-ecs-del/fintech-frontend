import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Settings2, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CorporateToolbarProps, StatusTab, VisibleColumn } from "@/features/corporate/types";

const STATUS_TABS: Array<{ id: StatusTab; label: string }> = [
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "inactive", label: "Inactive" },
];

const DEFAULT_COLUMNS: Array<{ id: VisibleColumn; label: string }> = [
  { id: "groupName", label: "Group Name" },
  { id: "companyName", label: "Company Name" },
  { id: "code", label: "Code / Legal Name" },
  { id: "createdDate", label: "Incorporation Date" },
  { id: "manage", label: "Manage" },
];

export default function CorporateToolbar({
  searchInput,
  onSearchInputChange,
  onSearchSubmit,
  onClearSearch,
  selectedStatusTab,
  onStatusTabChange,
  visibleColumns,
  onToggleColumn,
  onOpenOnboarding,
}: CorporateToolbarProps) {
  const columns = DEFAULT_COLUMNS;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Corporate List</h1>
        <Button onClick={onOpenOnboarding} className="gap-2">
          <Plus className="h-4 w-4" /> Add New Company
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
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
            {STATUS_TABS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onStatusTabChange(option.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  selectedStatusTab === option.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
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
