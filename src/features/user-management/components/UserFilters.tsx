import { ArrowUpDown, Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { MemberStatusTab, SortOrder } from "@/features/user-management/types";

const STATUS_TABS: Array<{ id: MemberStatusTab; label: string }> = [
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "inactive", label: "Inactive" },
];

const STATUS_BADGE_CLASS: Record<MemberStatusTab, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  inactive: "bg-rose-100 text-rose-700",
};

type UserFiltersProps = {
  statusTab: MemberStatusTab;
  onStatusTabChange: (value: MemberStatusTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (value: SortOrder) => void;
  roles: string[];
  departments: string[];
  statusCounts: Record<MemberStatusTab, number>;
};

export default function UserFilters({
  statusTab,
  onStatusTabChange,
  search,
  onSearchChange,
  departmentFilter,
  onDepartmentFilterChange,
  roleFilter,
  onRoleFilterChange,
  onSortOrderChange,
  roles,
  departments,
  statusCounts,
}: UserFiltersProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xl xl:max-w-2xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by name, email, or designation..."
            className="pl-9 pr-9"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1.5 shadow-sm">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusTabChange(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200",
                  statusTab === tab.id
                    ? "bg-[#3553e9] text-white shadow-[0_10px_24px_rgba(53,83,233,0.22)]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                )}
                aria-pressed={statusTab === tab.id}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    statusTab === tab.id ? "bg-white/18 text-white ring-1 ring-white/25" : STATUS_BADGE_CLASS[tab.id],
                  )}
                >
                  {statusCounts[tab.id]}
                </span>
              </button>
            ))}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn((departmentFilter !== "all" || roleFilter !== "all") && "border-primary text-primary")}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Filter members</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      onDepartmentFilterChange("all");
                      onRoleFilterChange("all");
                    }}
                  >
                    Reset
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Select value={roleFilter} onValueChange={onRoleFilterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="All designations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All designations</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={departmentFilter} onValueChange={onDepartmentFilterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department} value={department}>
                          {department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Sort members">
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSortOrderChange("asc")}>Name (A-Z)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortOrderChange("desc")}>Name (Z-A)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
