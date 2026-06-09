import type { AppUser } from "@/contexts/AppContext";
import type { HistoryDetailViewModel } from "@/components/HistoryDetailDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpDown, SlidersHorizontal, Users, History, Trash2, Info } from "lucide-react";
import { maskContactNumber, getInitials, getAvatarColor, formatCollapsedNodePath } from "@/features/user-management/utils";
import UserHistorySidebar from "./UserHistorySidebar";
import { useEffect, useRef, useState } from "react";

type UserTableProps = {
  isLoading: boolean;
  currentMembers: AppUser[];
  paginatedMembers: AppUser[];
  onView: (member: AppUser) => void;
  onOpenHistoryDetail?: (member: AppUser, detail: HistoryDetailViewModel, sourceId: string) => void;
  onDelete?: (member: AppUser) => void;
};

const getPrimaryNodeMeta = (member: AppUser) => {
  const accessEntries = member.accessDetails ?? [];
  const preferredAccess =
    accessEntries.find((entry) => entry.accessType === "PRIMARY" && (entry.nodePath || "").trim()) ??
    accessEntries.find((entry) => (entry.nodePath || "").trim());
  const fallbackNodePath = (member.nodePath || member.basicDetails?.nodePath || "").trim();

  if (!preferredAccess && !fallbackNodePath) {
    return {
      departmentLabel: member.department || member.basicDetails?.nodeName || member.nodeName || "",
      primaryNodePath: "",
      nodeType: (member.nodeType || member.basicDetails?.nodeType || "").trim(),
      showPath: false,
    };
  }

  const nodeType = (preferredAccess?.nodeType || member.nodeType || member.basicDetails?.nodeType || "").trim().toUpperCase();
  const nodePath = (preferredAccess?.nodePath || fallbackNodePath).trim();
  const nodeName = (preferredAccess?.nodeName || member.nodeName || member.basicDetails?.nodeName || "").trim();
  const nodeDepth = nodePath.split(".").map((part) => part.trim()).filter(Boolean).length;
  const isRootByType = nodeType === "ROOT";
  const isRootByPath = nodeDepth <= 1;
  const showPath = Boolean(nodePath) && !isRootByType && !isRootByPath;

  console.log("DEBUG_NODE_TYPE", {
    extractedNodeType: nodeType,
    preferredAccessType: preferredAccess?.nodeType,
    memberNodeType: member.nodeType,
    basicDetailsNodeType: member.basicDetails?.nodeType,
    member
  });

  return {
    departmentLabel: nodeName || member.department || "",
    primaryNodePath: nodePath,
    nodeType,
    showPath,
  };
};

function NodePathMarquee({ text }: { text: string }) {
  const MARQUEE_DURATION_SECONDS = 6;
  const MARQUEE_GAP_PX = 24;
  const viewportRef = useRef<HTMLSpanElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [overflowPx, setOverflowPx] = useState(0);
  const [textWidthPx, setTextWidthPx] = useState(0);

  useEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current;
      const label = textRef.current;
      if (!viewport || !label) return;
      const fullTextWidth = Math.ceil(label.scrollWidth);
      const nextOverflow = Math.max(0, Math.ceil(fullTextWidth - viewport.clientWidth));
      setTextWidthPx(fullTextWidth);
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
  const marqueeTravelPx = textWidthPx + MARQUEE_GAP_PX;

  return (
    <span className="mt-1 inline-flex max-w-full items-center gap-1.5">
      {overflowPx > 0 ? (
        <span
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-600 transition hover:border-sky-300 hover:bg-sky-100"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label="Preview full node path"
          role="img"
        >
          <Info className="h-3 w-3" />
        </span>
      ) : null}
      <span className="inline-flex min-w-0 max-w-full rounded-md border border-sky-100 bg-sky-50/70 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.02em] text-sky-700">
        <span ref={viewportRef} className="block max-w-full overflow-hidden whitespace-nowrap">
          <span
            className="inline-flex items-center whitespace-nowrap will-change-transform"
            style={
              shouldAnimate
                ? {
                  animation: `user-node-path-marquee ${MARQUEE_DURATION_SECONDS}s linear infinite`,
                  ["--node-path-shift" as string]: `${marqueeTravelPx}px`,
                  transform: "translate3d(0,0,0)",
                }
                : undefined
            }
          >
            <span ref={textRef} className="inline-block whitespace-nowrap">
              {text}
            </span>
            {overflowPx > 0 ? (
              <span aria-hidden className="inline-flex items-center whitespace-nowrap">
                <span className="inline-block" style={{ width: `${MARQUEE_GAP_PX}px` }} />
                <span className="inline-block whitespace-nowrap">{text}</span>
              </span>
            ) : null}
          </span>
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
          const canDeleteMember = member.status !== "Pending" && member.status !== "Inactive";

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
                const { departmentLabel, primaryNodePath, showPath, nodeType } = getPrimaryNodeMeta(member);
                const formattedPath = showPath ? formatCollapsedNodePath(primaryNodePath) : "";
                const displayNodeType = nodeType ? nodeType.charAt(0).toUpperCase() + nodeType.slice(1).toLowerCase() : "";
                
                return (
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-700">
                      {departmentLabel || "—"}
                      {displayNodeType ? (
                        <span className="ml-1 text-[13px] text-slate-500">({displayNodeType})</span>
                      ) : null}
                    </p>
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

                      {onDelete && canDeleteMember ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isPending}
                              className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:bg-rose-50 disabled:text-rose-300 disabled:opacity-40"
                              onClick={() => {
                                if (isPending) return;
                                onDelete(member);
                              }}
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
      onOpenHistoryDetail={(detail, sourceId) => {
        if (!historyOpenForUser) return;
        setHistoryOpenForUser(null);
        onOpenHistoryDetail?.(historyOpenForUser, detail, sourceId);
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
