import type { AppUser } from "@/contexts/AppContext";
import type { HistoryDetailViewModel } from "@/components/HistoryDetailDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpDown, SlidersHorizontal, Users, History, Trash2 } from "lucide-react";
import { maskContactNumber, getInitials, getAvatarColor, formatCollapsedNodePath } from "@/features/user-management/utils";
import UserHistorySidebar from "./UserHistorySidebar";
import { useEffect, useRef, useState } from "react";

type UserTableProps = {
  isLoading: boolean;
  currentMembers: AppUser[];
  paginatedMembers: AppUser[];
  onView: (member: AppUser) => void;
  onOpenHistoryDetail?: (member: AppUser, detail: HistoryDetailViewModel) => void;
  onDelete?: (member: AppUser) => void;
};

const getPrimaryNodeMeta = (member: AppUser) => {
  const primaryAccess = (member.accessDetails ?? []).find((entry) => entry.accessType === "PRIMARY");
  if (!primaryAccess) {
    return {
      departmentLabel: member.department || "",
      primaryNodePath: "",
      showPath: false,
    };
  }

  const nodeType = (primaryAccess.nodeType || "").trim().toUpperCase();
  const nodePath = (primaryAccess.nodePath || "").trim();
  const nodeName = (primaryAccess.nodeName || "").trim();
  const nodeDepth = nodePath.split(".").map((part) => part.trim()).filter(Boolean).length;
  const isRootByType = nodeType === "ROOT";
  const isRootByPath = nodeDepth <= 1;
  const showPath = Boolean(nodePath) && !isRootByType && !isRootByPath;

  return {
    departmentLabel: nodeName || member.department || "",
    primaryNodePath: nodePath,
    showPath,
  };
};

function NodePathMarquee({ text }: { text: string }) {
  const viewportRef = useRef<HTMLSpanElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [overflowPx, setOverflowPx] = useState(0);

  useEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current;
      const label = textRef.current;
      if (!viewport || !label) return;
      const nextOverflow = Math.max(0, Math.ceil(label.scrollWidth - viewport.clientWidth));
      setOverflowPx(nextOverflow);
    };

    measure();
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    if (textRef.current) observer.observe(textRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [text]);

  const shouldAnimate = isHovered && overflowPx > 0;
  const durationSeconds = Math.min(12, Math.max(2, overflowPx / 34));

  return (
    <span
      className="mt-1 inline-flex max-w-full rounded-md border border-sky-100 bg-sky-50/70 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.02em] text-sky-700"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span ref={viewportRef} className="block max-w-full overflow-hidden whitespace-nowrap">
        <span
          ref={textRef}
          className="inline-block whitespace-nowrap will-change-transform"
          style={
            shouldAnimate
              ? {
                  animation: `user-node-path-marquee ${durationSeconds}s linear infinite alternate`,
                  ["--node-path-shift" as string]: `${overflowPx}px`,
                }
              : undefined
          }
        >
          {text}
        </span>
      </span>
    </span>
  );
}

export default function UserTable({
  isLoading,
  currentMembers,
  paginatedMembers,
  onView,
  onOpenHistoryDetail,
  onDelete,
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
    <table className="min-w-[980px] w-full table-fixed">
      <thead className="bg-slate-50">
        <tr className="border-b border-slate-200">
          <th className="sticky top-0 z-20 w-[28%] bg-slate-50 pl-7 pr-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Name</th>
          <th className="sticky top-0 z-20 w-[18%] bg-slate-50 px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Designation</th>
          <th className="sticky top-0 z-20 w-[20%] bg-slate-50 px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Node Name</th>
          <th className="sticky top-0 z-20 w-[20%] bg-slate-50 px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Contact Number</th>
          <th className="sticky top-0 z-20 w-[14%] bg-slate-50 px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Manage</th>
        </tr>
      </thead>
      <tbody>
        {paginatedMembers.map((member) => {
          const isPending = Boolean(member.isPending);

          return (
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
                  {isPending ? (
                    <div className="mt-0.5 text-[12px] font-medium leading-5 text-amber-700">Modification in progress</div>
                  ) : null}
                </div>
              </button>
            </td>
            <td className="px-4 py-4 text-sm text-slate-700">{member.designation || "—"}</td>
            <td className="px-4 py-4 text-sm text-slate-600">
              {(() => {
                const { departmentLabel, primaryNodePath, showPath } = getPrimaryNodeMeta(member);
                const formattedPath = showPath ? formatCollapsedNodePath(primaryNodePath) : "";
                return (
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-700">{departmentLabel || "—"}</p>
                    {formattedPath ? (
                      <NodePathMarquee text={formattedPath} />
                    ) : null}
                  </div>
                );
              })()}
            </td>
            <td className="px-4 py-4 font-mono text-sm text-slate-600">{maskContactNumber(member.phone)}</td>
            <td className="px-4 py-4">
              <TooltipProvider delayDuration={120}>
                <div className="flex items-center justify-center gap-3">
                  {historyOpenForUser ? (
                    <>
                      {member.status !== "Pending" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          onClick={() => setHistoryOpenForUser(member)}
                          aria-label={`View history for ${member.name || member.email}`}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                        onClick={() => onView(member)}
                        aria-label={`Manage ${member.name || member.email || "member"}`}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      {member.status !== "Pending" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              onClick={() => setHistoryOpenForUser(member)}
                              aria-label={`View history for ${member.name || member.email}`}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">View History</TooltipContent>
                        </Tooltip>
                      ) : null}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                            onClick={() => onView(member)}
                            aria-label={`Manage ${member.name || member.email || "member"}`}
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Manage User</TooltipContent>
                      </Tooltip>

                      {onDelete && member.status !== "Pending" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              onClick={() => onDelete(member)}
                              aria-label={`Delete ${member.name || member.email || "member"}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Delete User</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </>
                  )}
                </div>
              </TooltipProvider>
            </td>
          </tr>
          );
        })}
      </tbody>
    </table>
    <UserHistorySidebar
      isOpen={!!historyOpenForUser}
      onClose={() => setHistoryOpenForUser(null)}
      user={historyOpenForUser}
      onOpenHistoryDetail={(detail) => {
        if (!historyOpenForUser) return;
        setHistoryOpenForUser(null);
        onOpenHistoryDetail?.(historyOpenForUser, detail);
      }}
    />
    <style
      dangerouslySetInnerHTML={{
        __html:
          "@keyframes user-node-path-marquee{from{transform:translateX(0)}to{transform:translateX(calc(-1 * var(--node-path-shift, 0px)))}}",
      }}
    />
    </>
  );
}
