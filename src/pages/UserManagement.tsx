import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppContext, type AppUser } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { getCompanyUsers } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  EyeOff,
  Filter,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";

const DEFAULT_PAGE_SIZE = 15;
const PAGE_SIZE_OPTIONS = [15, 25, 35, 50] as const;
const SEARCH_DEBOUNCE_MS = 300;

type MemberStatusTab = "members" | "pending" | "inactive";

const statusButtonStyles: Record<MemberStatusTab, string> = {
  members: "bg-primary/10 text-primary hover:bg-primary/15",
  pending: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/15",
  inactive: "bg-slate-200 text-slate-700 hover:bg-slate-300",
};

const memberBadgeStyles = {
  Active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  Pending: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  Inactive: "bg-slate-200 text-slate-700 border-slate-300",
} as const;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function maskContactNumber(phone?: string) {
if (!phone) return "-";

const digits = phone.replace(/\D/g, "");
if (digits.length <= 4) return digits;

return "*".repeat(digits.length - 4) + digits.slice(-4);
}

export default function UserManagement() {
  const { currentUser, users, setUsers } = useAppContext();
  const { toast } = useToast();
  const [statusTab, setStatusTab] = useState<MemberStatusTab>("members");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(DEFAULT_PAGE_SIZE);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [viewingMember, setViewingMember] = useState<AppUser | null>(null);
  const [editingMember, setEditingMember] = useState<AppUser | null>(null);
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    role: "User",
    designation: "",
    department: "",
    phone: "",
  });

  const loadUsers = useCallback(
    async (showRefreshToast = false) => {
      const companyCode = currentUser?.companyCode?.trim().toUpperCase();
      if (!companyCode) return;

      setIsLoading(true);
      try {
        const nextUsers = await getCompanyUsers(companyCode);
        setUsers(nextUsers);
        if (showRefreshToast) {
          toast({
            title: "Users refreshed",
            description: "The member list was updated from the latest company data.",
          });
        }
      } catch {
        setUsers([]);
        toast({
          title: "Unable to load users",
          description: "Live user API failed. Please verify backend response and try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [currentUser?.companyCode, setUsers, toast],
  );

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) {
      setDebouncedSearch("");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(trimmedSearch);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusTab, debouncedSearch, departmentFilter, roleFilter, sortOrder, pageSize]);

  const departments = useMemo(
    () => Array.from(new Set(users.map((user) => user.department).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [users],
  );
  const roles = useMemo(
    () => Array.from(new Set(users.map((user) => user.designation).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [users],
  );

  const filterMembers = useCallback(
    (list: AppUser[]) => {
      const normalizedTerm = debouncedSearch.toLowerCase();

      return list
        .filter((user) => {
          const matchesDepartment = departmentFilter === "all" || user.department === departmentFilter;
          const matchesRole = roleFilter === "all" || user.designation === roleFilter;
          const matchesSearch =
            !normalizedTerm ||
            user.name.toLowerCase().includes(normalizedTerm) ||
            user.email.toLowerCase().includes(normalizedTerm) ||
            user.designation.toLowerCase().includes(normalizedTerm) ||
            user.department.toLowerCase().includes(normalizedTerm) ||
            (user.phone ?? "").toLowerCase().includes(normalizedTerm);

          return matchesDepartment && matchesRole && matchesSearch;
        })
        .sort((left, right) => {
          const comparison = left.name.localeCompare(right.name);
          return sortOrder === "asc" ? comparison : -comparison;
        });
    },
    [debouncedSearch, departmentFilter, roleFilter, sortOrder],
  );

  const activeMembers = useMemo(
    () => filterMembers(users.filter((user) => user.status !== "Pending" && user.status !== "Inactive")),
    [filterMembers, users],
  );
  const pendingMembers = useMemo(
    () => filterMembers(users.filter((user) => user.status === "Pending")),
    [filterMembers, users],
  );
  const inactiveMembers = useMemo(
    () => filterMembers(users.filter((user) => user.status === "Inactive")),
    [filterMembers, users],
  );

  const currentMembers = statusTab === "pending" ? pendingMembers : statusTab === "inactive" ? inactiveMembers : activeMembers;
  const totalPages = Math.max(1, Math.ceil(currentMembers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedMembers = currentMembers.slice((safePage - 1) * pageSize, safePage * pageSize);

  const updateUsersStatus = (ids: Set<string>, status: AppUser["status"]) => {
    setUsers((previous) => previous.map((user) => (ids.has(user.id) ? { ...user, status } : user)));
  };

// function to add new member currently not worked out 👇🏻

  const handleAddMember = () => {
    if (!newMember.name.trim() || !newMember.email.trim()) return;

    const member: AppUser = {
      id: crypto.randomUUID(),
      name: newMember.name.trim(),
      email: newMember.email.trim(),
      role: newMember.role,
      designation: newMember.designation.trim(),
      department: newMember.department.trim(),
      phone: newMember.phone.trim(),
      companyId: currentUser?.companyCode,
      status: "Pending",
    };

    setUsers((previous) => [member, ...previous]);
    setNewMember({
      name: "",
      email: "",
      role: "User",
      designation: "",
      department: "",
      phone: "",
    });
    setAddDialogOpen(false);
    setStatusTab("pending");

    toast({
      title: "Member added",
      description: `${member.name} was created as a pending member request.`,
    });
  };

  const handleSaveEdit = () => {
    if (!editingMember) return;

    setUsers((previous) => previous.map((user) => (user.id === editingMember.id ? editingMember : user)));
    setEditingMember(null);
    toast({
      title: "Member updated",
      description: "The member details were saved successfully.",
    });
  };

  const removeMember = (userId: string) => {
    setUsers((previous) => previous.filter((user) => user.id !== userId));
    toast({
      title: "Member removed",
      description: "The member was removed from the company list.",
      variant: "destructive",
    });
  };

  const statusHeading = statusTab === "pending" ? "Pending Requests" : statusTab === "inactive" ? "Inactive Members" : "Members";

  return (
    
    <div className="space-y-4">
      {/*
      <div className="flex flex-wrap items-center gap-2">
        {(["members", "pending", "inactive"] as const).map((tab) => {
          const count = tab === "pending" ? pendingMembers.length : tab === "inactive" ? inactiveMembers.length : activeMembers.length;
          return (
            <Button
              key={tab}
              size="sm"
              variant={statusTab === tab ? "secondary" : "ghost"}
              onClick={() => setStatusTab(tab)}
              className={cn("rounded-full capitalize", statusTab === tab && statusButtonStyles[tab])}
            >
              {tab === "members" ? "Active" : tab} ({count})
            </Button>
          );
        })}
      </div>

      {/*
      <div className="flex flex-wrap items-center gap-2">
        {(["members", "pending", "inactive"] as const).map((tab) => {
          const count = tab === "pending" ? pendingMembers.length : tab === "inactive" ? inactiveMembers.length : activeMembers.length;
          return (
            <Button
              key={tab}
              size="sm"
              variant={statusTab === tab ? "secondary" : "ghost"}
              onClick={() => setStatusTab(tab)}
              className={cn("rounded-full capitalize", statusTab === tab && statusButtonStyles[tab])}
            >
              {tab === "members" ? "Active" : tab} ({count})
            </Button>
          );
        })}
      </div>
      */}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl xl:max-w-2xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, or designation..."
              className="pl-9 pr-9"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
                        setDepartmentFilter("all");
                        setRoleFilter("all");
                      }}
                    >
                      Reset
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Designation</Label>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
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
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
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
                <DropdownMenuItem onClick={() => setSortOrder("asc")}>Name (A-Z)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("desc")}>Name (Z-A)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-slate-200 bg-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              {statusTab === "inactive" ? <EyeOff className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {statusHeading} ({currentMembers.length})
            </CardTitle>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              Add Member
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            {isLoading ? (
              <div className="flex min-h-[260px] items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ArrowUpDown className="h-4 w-4 animate-spin" />
                  Loading users...
                </div>
              </div>
            ) : currentMembers.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
                <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No members found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting the search or filters, or add a new member.
                </p>
              </div>
            ) : (
              <table className="min-w-[920px] w-full table-fixed">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="w-[34%] pl-7 pr-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Name</th>
                    <th className="w-[18%] px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Designation</th>
                    <th className="w-[18%] px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Department</th>
                    <th className="w-[18%] px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Contact Number</th>
                    <th className="w-[12%] px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMembers.map((member) => (
                    <tr key={member.id} className="border-b border-slate-200 transition hover:bg-slate-50/80">
                      <td className="pl-7 pr-4 py-4">
                        <button
                          type="button"
                          onClick={() => setViewingMember(member)}
                          className="flex items-center gap-3 text-left"
                        >
                            <Avatar className="h-10 w-10 border border-sky-100 bg-sky-50">
                              <AvatarFallback className="bg-sky-50 text-sky-700">{getInitials(member.name)}</AvatarFallback>
                            </Avatar>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{member.name}</div>
                            <div className="text-sm text-slate-500">{member.email || "No email"}</div>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{member.designation || "—"}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{member.department || "General"}</td>
                      <td className="px-4 py-4 font-mono text-sm text-slate-600">{maskContactNumber(member.phone)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setViewingMember(member)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingMember(member)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {member.status === "Pending" ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600"
                                onClick={() => updateUsersStatus(new Set([member.id]), "Active")}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => removeMember(member.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : member.status === "Inactive" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600"
                              onClick={() => updateUsersStatus(new Set([member.id]), "Active")}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {currentMembers.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows/page</span>
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value) as (typeof PAGE_SIZE_OPTIONS)[number])}>
                  <SelectTrigger className="h-9 w-[84px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setPage((previous) => Math.max(1, previous - 1))} disabled={safePage === 1}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Prev
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                  disabled={safePage === totalPages}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add New Member</DialogTitle>
            <DialogDescription>Create a new member request for this company.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="member-name">Full Name</Label>
              <Input id="member-name" value={newMember.name} onChange={(event) => setNewMember((previous) => ({ ...previous, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-email">Email</Label>
              <Input id="member-email" type="email" value={newMember.email} onChange={(event) => setNewMember((previous) => ({ ...previous, email: event.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newMember.role} onValueChange={(value) => setNewMember((previous) => ({ ...previous, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="User">User</SelectItem>
                    <SelectItem value="Signatory">Signatory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-phone">Phone</Label>
                <Input id="member-phone" value={newMember.phone} onChange={(event) => setNewMember((previous) => ({ ...previous, phone: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="member-designation">Designation</Label>
                <Input id="member-designation" value={newMember.designation} onChange={(event) => setNewMember((previous) => ({ ...previous, designation: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-department">Department</Label>
                <Input id="member-department" value={newMember.department} onChange={(event) => setNewMember((previous) => ({ ...previous, department: event.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={!newMember.name.trim() || !newMember.email.trim()}>
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewingMember)} onOpenChange={(open) => !open && setViewingMember(null)}>
        <DialogContent className="sm:max-w-[460px]">
          {viewingMember ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border border-sky-100 bg-sky-50">
                    <AvatarFallback className="bg-sky-50 text-sky-700">{getInitials(viewingMember.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div>{viewingMember.name}</div>
                    <Badge variant="outline" className={cn("mt-1 text-xs", memberBadgeStyles[viewingMember.status ?? "Active"])}>
                      {viewingMember.status ?? "Active"}
                    </Badge>
                  </div>
                </DialogTitle>
                <DialogDescription>View member profile details.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Email</p>
                  <p className="mt-1 text-slate-900">{viewingMember.email}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Designation</p>
                    <p className="mt-1 text-slate-900">{viewingMember.designation || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Department</p>
                    <p className="mt-1 text-slate-900">{viewingMember.department || "General"}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Designation</p>
                    <p className="mt-1 text-slate-900">{viewingMember.designation || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Phone</p>
                    <p className="mt-1 font-mono text-slate-900">{viewingMember.phone || "—"}</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewingMember(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setEditingMember(viewingMember);
                    setViewingMember(null);
                  }}
                >
                  Edit Member
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingMember)} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="sm:max-w-[480px]">
          {editingMember ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit Member</DialogTitle>
                <DialogDescription>Update member details and save them immediately.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input id="edit-name" value={editingMember.name} onChange={(event) => setEditingMember((previous) => previous ? { ...previous, name: event.target.value } : previous)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input id="edit-email" value={editingMember.email} onChange={(event) => setEditingMember((previous) => previous ? { ...previous, email: event.target.value } : previous)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input id="edit-phone" value={editingMember.phone || ""} onChange={(event) => setEditingMember((previous) => previous ? { ...previous, phone: event.target.value } : previous)} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-designation">Designation</Label>
                    <Input id="edit-designation" value={editingMember.designation} onChange={(event) => setEditingMember((previous) => previous ? { ...previous, designation: event.target.value } : previous)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-department">Department</Label>
                    <Input id="edit-department" value={editingMember.department} onChange={(event) => setEditingMember((previous) => previous ? { ...previous, department: event.target.value } : previous)} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={editingMember.role} onValueChange={(value) => setEditingMember((previous) => previous ? { ...previous, role: value } : previous)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="User">User</SelectItem>
                        <SelectItem value="Signatory">Signatory</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={editingMember.status ?? "Active"}
                      onValueChange={(value) =>
                        setEditingMember((previous) => previous ? { ...previous, status: value as AppUser["status"] } : previous)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingMember(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={!editingMember.name.trim() || !editingMember.email.trim()}>
                  Save Changes
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

    </div>
  );
}
