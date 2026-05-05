import type { AppUser } from "@/contexts/AppContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, SlidersHorizontal, Users, History } from "lucide-react";
import { maskContactNumber, getInitials, getAvatarColor } from "@/features/user-management/utils";
import UserHistorySidebar from "./UserHistorySidebar";
import { useState } from "react";

type UserTableProps = {
  isLoading: boolean;
  currentMembers: AppUser[];
  paginatedMembers: AppUser[];
  onView: (member: AppUser) => void;
};

export default function UserTable({
  isLoading,
  currentMembers,
  paginatedMembers,
  onView,
}: UserTableProps) {
  const [historyOpenForUser, setHistoryOpenForUser] = useState<AppUser | null>(null);

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
        <p className="text-sm font-medium text-foreground">No users found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting the search or filters, or add a new user.
        </p>
      </div>
    );
  }

  return (
    <>
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
          <tr key={member.email} className="border-b border-slate-200 transition hover:bg-slate-50/80">
            <td className="pl-7 pr-4 py-4">
              <button
                type="button"
                onClick={() => onView(member)}
                className="flex items-center gap-3 text-left"
              >
                {(() => {
                  const avatar = getAvatarColor(member.name || member.email || member.id);
                  return (
                    <Avatar className={`h-10 w-10 ${avatar.bg}`}>
                      <AvatarFallback className={`${avatar.bg} ${avatar.text} font-semibold`}>
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                  );
                })()}
                <div>
                  <div className="text-[15px] font-medium text-slate-900">{member.name}</div>
                  <div className="text-[13when px] text-slate-500">{member.email || "No email"}</div>
                </div>
              </button>
            </td>
            <td className="px-4 py-4 text-sm text-slate-700">{member.designation || "—"}</td>
            <td className="px-4 py-4 text-sm text-slate-600">{member.department || "—"}</td>
            <td className="px-4 py-4 font-mono text-sm text-slate-600">{maskContactNumber(member.phone)}</td>
            <td className="px-4 py-4">
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => setHistoryOpenForUser(member)}
                  aria-label={`View history for ${member.name || member.email}`}
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                  onClick={() => onView(member)}
                  aria-label={`Manage ${member.name || member.email || "member"}`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <UserHistorySidebar
      isOpen={!!historyOpenForUser}
      onClose={() => setHistoryOpenForUser(null)}
      user={historyOpenForUser}
    />
    </>
  );
}
