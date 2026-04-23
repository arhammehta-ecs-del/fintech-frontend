import type { AppUser } from "@/contexts/AppContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Check, Edit, Eye, Users, X } from "lucide-react";
import { maskContactNumber, getInitials } from "@/features/user-management/utils";

type UserTableProps = {
  isLoading: boolean;
  currentMembers: AppUser[];
  paginatedMembers: AppUser[];
  onView: (member: AppUser) => void;
  onEdit: (member: AppUser) => void;
  onApprove: (member: AppUser) => void;
  onActivate: (member: AppUser) => void;
  onRemove: (member: AppUser) => void;
};

export default function UserTable({
  isLoading,
  currentMembers,
  paginatedMembers,
  onView,
  onEdit,
  onApprove,
  onActivate,
  onRemove,
}: UserTableProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowUpDown className="h-4 w-4 animate-spin" />
          Loading users...
        </div>
      </div>
    );
  }

  if (currentMembers.length === 0) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
        <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">No members found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting the search or filters, or add a new member.
        </p>
      </div>
    );
  }

  return (
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
                onClick={() => onView(member)}
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
                <Button variant="ghost" size="icon" className="h-8 w-8 text-[rgb(53,83,233)] hover:text-[rgb(53,83,233)]" onClick={() => onView(member)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(member)}>
                  <Edit className="h-4 w-4" />
                </Button>
                {member.status === "Pending" ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-emerald-600"
                      onClick={() => onApprove(member)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => onRemove(member)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : member.status === "Inactive" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-emerald-600"
                    onClick={() => onActivate(member)}
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
  );
}
