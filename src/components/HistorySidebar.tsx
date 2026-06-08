import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Calendar, ChevronDown, CircleX, Clock, History, ShieldCheck, X } from "lucide-react";
import { getInitials } from "@/lib/userIdentity.utils";

export type HistoryStatus = "pending" | "approved";

export type HistoryEntry = {
  id: string;
  sourceId?: string;
  disableViewMore?: boolean;
  collapseToHeader?: boolean;
  sortEpochMs?: number;
  year: string;
  month: string;
  day: string;
  action: string;
  levelCount?: string;
  details: string;
  remarks?: string;
  timestampMissing?: boolean;
  showActor?: boolean;
  eligibleApprovers?: Array<{
    name: string;
    email: string;
  }>;
  approvalSections?: Array<{
    title: string;
    tone?: "warning" | "success" | "danger";
    items: Array<{
      label?: string;
      rule?: string | null;
      status?: string | null;
      people: Array<{
        name: string;
        email: string;
      }>;
    }>;
  }>;
  initiator: {
    name: string;
    email: string;
    initials: string;
    date: string;
    time: string;
  };
  approver?: {
    name: string;
    email?: string;
    date?: string;
    time: string;
  };
  status: HistoryStatus;
  changeSummaryBadges?: Array<{
    key: string;
    label: string;
    tone?: "added" | "modified" | "removed";
  }>;
};

export type HistorySidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle: string;
  showSystemGenerated?: boolean;
  data: HistoryEntry[];
  isLoading?: boolean;
  dockOffset?: {
    top: number;
    left: number;
  };
  splitView?: boolean;
  panelWidth?: number;
  closeOnOutsideClick?: boolean;
  onViewMore?: (item: HistoryEntry) => void;
};

const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const MONTH_INDEX = new Map(MONTHS.map((month, index) => [month, index] as const));

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

type EventTone = "approved" | "pending" | "initiation" | "rejected" | "inactive" | "modified";

const getEventTone = (action: string, fallbackStatus: HistoryStatus): EventTone => {
  const normalized = action.trim().toLowerCase();
  if (normalized.includes("reject")) return "rejected";
  if (normalized.includes("inactive") || normalized.includes("deactivate")) return "inactive";
  if (
    normalized.includes("modify") ||
    normalized.includes("update") ||
    normalized.includes("updated") ||
    normalized.includes("rmupdated") ||
    normalized.includes("profile update") ||
    normalized.includes("workflow update")
  ) {
    return "modified";
  }
  if (normalized.includes("initiate")) return "initiation";
  if (normalized.includes("pending")) return "pending";
  if (normalized.includes("approve") || normalized.includes("active")) return "approved";
  return fallbackStatus === "pending" ? "pending" : "approved";
};

function StatusHeader({
  item,
  headerAction,
}: {
  item: HistoryEntry;
  headerAction?: ReactNode;
}) {
  const tone = getEventTone(item.action, item.status);
  const badgeClassName =
    tone === "pending"
      ? "border-amber-200/50 bg-amber-50 text-amber-700"
      : tone === "initiation"
        ? "border-sky-200/60 bg-sky-50 text-sky-700"
      : tone === "modified"
        ? "border-orange-200/60 bg-orange-50 text-orange-700"
      : tone === "rejected"
        ? "border-rose-200/50 bg-rose-50 text-rose-700"
        : tone === "inactive"
          ? "border-rose-200/50 bg-rose-50 text-rose-700"
          : "border-emerald-200/50 bg-emerald-50 text-emerald-700";

  return (
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
      <div className={`flex items-center gap-1.5 rounded border px-2 py-1 ${badgeClassName}`}>
        {tone === "pending" ? (
          <Clock className="h-3 w-3" />
        ) : tone === "initiation" ? (
          <History className="h-3 w-3" />
        ) : tone === "modified" ? (
          <History className="h-3 w-3" />
        ) : tone === "rejected" ? (
          <CircleX className="h-3 w-3" />
        ) : (
          <ShieldCheck className="h-3 w-3" />
        )}
        <span className="text-[10px] font-bold uppercase tracking-tight">{item.action}</span>
        {item.levelCount ? (
          <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-sm border px-1 text-[9px] font-bold leading-none ${badgeClassName}`}>
            {item.levelCount}
          </span>
        ) : null}
      </div>
      {item.changeSummaryBadges && item.changeSummaryBadges.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {item.changeSummaryBadges.map((badge) => (
            <span
              key={badge.key}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getChangeSummaryBadgeClassName(badge.tone)}`}
            >
              {badge.label}
            </span>
          ))}
          {headerAction}
        </div>
      ) : headerAction ? <div className="flex items-center justify-end gap-1.5">{headerAction}</div> : null}
    </div>
  );
}

const getChangeSummaryBadgeClassName = (tone?: "added" | "modified" | "removed") => {
  if (tone === "added") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "modified") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "removed") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
};

function ActorFooter({ item }: { item: HistoryEntry }) {
  const actor = item.status === "approved" && item.approver?.name
    ? {
      name: item.approver.name,
      email: item.approver.email || item.initiator.email,
      initials: getInitials(item.approver.name),
      date: item.approver.date || item.initiator.date,
      time: item.approver.time || item.initiator.time,
    }
    : {
      name: item.initiator.name,
      email: item.initiator.email,
      initials: item.initiator.initials,
      date: item.initiator.date,
      time: item.initiator.time,
    };

  return (
    <div className="-mx-4 -mb-4 mt-4 flex items-center justify-between rounded-b-[14px] border-t border-slate-100 bg-slate-50/50 px-4 pb-4 pt-3">
      {item.showActor ? (
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-[9px] font-bold text-slate-600 shadow-sm">
            {actor.initials}
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold leading-tight text-slate-900">{actor.name}</span>
            <span className="text-[9.5px] text-slate-500">{actor.email}</span>
          </div>
        </div>
      ) : (
        <div />
      )}

      {item.timestampMissing ? null : (
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-slate-400" /> {actor.date || "—"}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-slate-400" /> {actor.time || "—"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalSections({ item }: { item: HistoryEntry }) {
  const eligibleApproverSection =
    item.eligibleApprovers && item.eligibleApprovers.length > 0
      ? {
          title: "Eligible Approvers",
          tone: "warning" as const,
          items: [
            {
              people: item.eligibleApprovers,
            },
          ],
        }
      : null;

  const sections = [
    ...(eligibleApproverSection ? [eligibleApproverSection] : []),
    ...(item.approvalSections ?? []),
  ];

  if (sections.length === 0) return null;

  const tone = getEventTone(item.action, item.status);
  const getSectionClassName = (sectionTone?: "warning" | "success" | "danger") => {
    if (sectionTone === "warning") return "border-amber-200 bg-amber-50/40";
    if (sectionTone === "danger") return "border-rose-200 bg-rose-50/40";
    if (sectionTone === "success") return "border-emerald-200 bg-emerald-50/35";
    return tone === "pending"
      ? "border-amber-200 bg-amber-50/40"
      : tone === "initiation"
        ? "border-sky-200 bg-sky-50/35"
        : tone === "modified"
          ? "border-orange-200 bg-orange-50/40"
          : tone === "inactive" || tone === "rejected"
            ? "border-rose-200 bg-rose-50/40"
            : "border-emerald-200 bg-emerald-50/35";
  };

  return (
    <div className="mt-2 space-y-2">
      {sections.map((section, sectionIndex) => (
        <div key={`${section.title}-${sectionIndex}`} className={["rounded-lg border p-2", getSectionClassName(section.tone)].join(" ")}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{section.title}</p>
          <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
            {section.items.map((group, groupIndex) => (
              <div key={`${section.title}-${group.label || "group"}-${groupIndex}`} className="rounded-md border border-white/70 bg-white/70 p-2">
                {group.label || group.rule || group.status ? (
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    {group.label ? <span className="text-[10px] font-semibold text-slate-700">{group.label}</span> : null}
                    {group.rule ? (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        {group.rule}
                      </span>
                    ) : null}
                    {group.status ? (
                      <span
                        className={[
                          "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                          group.status === "APPROVED"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : group.status === "REJECTED"
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : "border-slate-200 bg-white text-slate-500",
                        ].join(" ")}
                      >
                        {group.status}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-1">
                  {group.people.map((person, personIndex) => (
                    <div key={`${person.email}-${personIndex}`} className="flex items-start gap-1.5 text-[11px] leading-tight text-slate-700">
                      <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                      <div className="min-w-0">
                        <span className="font-medium">{person.name}</span>
                        <span className="text-slate-500"> ({person.email})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MilestoneTimeline({ data, onViewMore }: { data: HistoryEntry[]; onViewMore?: (item: HistoryEntry) => void }) {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedItems((current) => {
      const next = { ...current };
      data.forEach((item) => {
        if (!item.collapseToHeader && item.id in next) {
          delete next[item.id];
        }
      });
      return next;
    });
  }, [data]);

  return (
    <div className="relative py-1">
      <div className="space-y-6">
        {data.map((item, index) => (
          <div key={item.id} className="relative pl-14">
            {(() => {
              const isCollapsible = Boolean(item.collapseToHeader);
              const isCollapsed = isCollapsible && !expandedItems[item.id];

              return (
                <>
            {(() => {
              const tone = getEventTone(item.action, item.status);
              const dateBadgeClassName =
                tone === "pending"
                  ? "border-amber-300 text-amber-700 shadow-[0_0_10px_rgba(251,191,36,0.15)]"
                  : tone === "initiation"
                    ? "border-sky-300 text-sky-700 shadow-[0_0_10px_rgba(56,189,248,0.16)]"
                    : tone === "modified"
                      ? "border-orange-300 text-orange-700 shadow-[0_0_10px_rgba(249,115,22,0.18)]"
                      : tone === "inactive"
                        ? "border-rose-300 text-rose-700 shadow-[0_0_10px_rgba(244,63,94,0.16)]"
                      : tone === "approved"
                        ? "border-emerald-300 text-emerald-700 shadow-[0_0_10px_rgba(16,185,129,0.16)]"
                        : "border-slate-200";

              return (
                <div
                  className={[
                    "absolute left-0 top-0 z-10 flex h-9 w-[52px] flex-col items-center justify-center rounded-xl border bg-white font-bold text-slate-700 shadow-sm transition-all",
                    dateBadgeClassName,
                  ].join(" ")}
                >
                  <span className="text-[13px] leading-none tracking-tight">{item.day}</span>
                  <span className="mt-0.5 text-[7px] uppercase tracking-widest opacity-70">{item.month.substring(0, 3)}</span>
                </div>
              );
            })()}

            {index < data.length - 1 ? (
              <div
                className="absolute left-[26px] top-[36px] w-[1.5px] bg-slate-200"
                style={{ height: "calc(100% + 24px)" }}
                aria-hidden="true"
              />
            ) : null}

            <div
              className={[
                isCollapsed ? "rounded-2xl border bg-white px-4 py-3 shadow-sm transition-all" : "rounded-2xl border bg-white p-4 shadow-sm transition-all",
                (() => {
                  const tone = getEventTone(item.action, item.status);
                  return tone === "pending"
                    ? "border-amber-200/70 shadow-[0_2px_12px_rgba(251,191,36,0.08)]"
                    : tone === "initiation"
                      ? "border-sky-200/80 shadow-[0_2px_12px_rgba(56,189,248,0.08)]"
                      : tone === "modified"
                        ? "border-orange-200/80 shadow-[0_2px_12px_rgba(249,115,22,0.1)]"
                        : tone === "inactive"
                          ? "border-rose-200/80 shadow-[0_2px_12px_rgba(244,63,94,0.1)]"
                        : tone === "approved"
                          ? "border-emerald-200/80 shadow-[0_2px_12px_rgba(16,185,129,0.08)]"
                          : "border-slate-200 hover:shadow-md";
                })(),
              ].join(" ")}
            >
              <StatusHeader
                item={item}
                headerAction={
                  isCollapsible ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedItems((current) => ({
                          ...current,
                          [item.id]: !current[item.id],
                        }))
                      }
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                      aria-label={isCollapsed ? "Expand history card" : "Collapse history card"}
                      aria-expanded={!isCollapsed}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${isCollapsed ? "" : "rotate-180"}`} />
                    </button>
                  ) : null
                }
              />
              {!isCollapsed ? (
                <>
                  <div className="mb-2 flex items-start justify-between gap-3 px-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="min-w-0 text-[13px] font-semibold tracking-tight text-slate-900">{item.action}</h4>
                        <div className="flex shrink-0 items-center gap-2">
                          {onViewMore && !item.disableViewMore ? (
                            <button
                              type="button"
                              onClick={() => onViewMore(item)}
                              className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                              View More
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mb-2 px-1">
                    <p className="text-[11.5px] leading-relaxed text-slate-600">{item.details}</p>
                    {item.remarks ? (
                      <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-600">
                        <span className="font-medium text-slate-700">Remarks:</span> {item.remarks}
                      </p>
                    ) : null}
                    <ApprovalSections item={item} />
                  </div>
                  <ActorFooter item={item} />
                </>
              ) : null}
            </div>
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HistorySidebar({
  isOpen,
  onClose,
  title = "Audit Trail",
  subtitle,
  showSystemGenerated = true,
  data,
  isLoading = false,
  dockOffset,
  splitView = false,
  panelWidth = 560,
  closeOnOutsideClick = false,
  onViewMore,
}: HistorySidebarProps) {
  const [expandedYears, setExpandedYears] = useState(new Set<string>([(new Date().getFullYear()).toString()]));
  const [expandedMonths, setExpandedMonths] = useState(new Set<string>());
  const [shellOffset, setShellOffset] = useState({ top: 56, left: 0 });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const effectiveOffset = dockOffset ?? shellOffset;

  const structuredHistory = useMemo(() => {
    const grouped = data.reduce<Record<string, Record<string, HistoryEntry[]>>>((acc, item) => {
      if (!acc[item.year]) acc[item.year] = {};
      if (!acc[item.year][item.month]) acc[item.year][item.month] = [];
      acc[item.year][item.month].push(item);
      return acc;
    }, {});

    Object.values(grouped).forEach((months) => {
      Object.values(months).forEach((entries) => {
        entries.sort((a, b) => {
          const leftEpoch = typeof a.sortEpochMs === "number" && Number.isFinite(a.sortEpochMs) ? a.sortEpochMs : null;
          const rightEpoch = typeof b.sortEpochMs === "number" && Number.isFinite(b.sortEpochMs) ? b.sortEpochMs : null;
          if (leftEpoch !== null && rightEpoch !== null && rightEpoch !== leftEpoch) return rightEpoch - leftEpoch;
          if (leftEpoch !== null && rightEpoch === null) return -1;
          if (leftEpoch === null && rightEpoch !== null) return 1;

          const left = Date.parse(`${a.month} ${a.day}, ${a.year} ${a.initiator.time || "00:00 AM"}`);
          const right = Date.parse(`${b.month} ${b.day}, ${b.year} ${b.initiator.time || "00:00 AM"}`);
          const hasLeftTime = Number.isFinite(left);
          const hasRightTime = Number.isFinite(right);

          if (hasLeftTime && hasRightTime && right !== left) return right - left;

          if (hasLeftTime !== hasRightTime) return hasRightTime ? 1 : -1;
          return 0;
        });
      });
    });

    return grouped;
  }, [data]);

  useEffect(() => {
    if (!isOpen) return;

    const now = new Date();
    const currentYear = String(now.getFullYear());
    const currentMonth = MONTHS[now.getMonth()] ?? "JANUARY";
    const currentMonthKey = `${currentMonth} ${currentYear}`;

    const nextYears = new Set<string>();
    const nextMonths = new Set<string>();

    if (structuredHistory[currentYear]) {
      nextYears.add(currentYear);
      if (structuredHistory[currentYear][currentMonth]) {
        nextMonths.add(currentMonthKey);
      } else {
        const fallbackMonth = Object.keys(structuredHistory[currentYear]).sort(
          (a, b) => (MONTH_INDEX.get(b) ?? -1) - (MONTH_INDEX.get(a) ?? -1),
        )[0];
        if (fallbackMonth) nextMonths.add(`${fallbackMonth} ${currentYear}`);
      }
    } else {
      const latestYear = Object.keys(structuredHistory).sort((a, b) => Number(b) - Number(a))[0];
      if (latestYear) {
        nextYears.add(latestYear);
        const latestMonth = Object.keys(structuredHistory[latestYear]).sort(
          (a, b) => (MONTH_INDEX.get(b) ?? -1) - (MONTH_INDEX.get(a) ?? -1),
        )[0];
        if (latestMonth) nextMonths.add(`${latestMonth} ${latestYear}`);
      }
    }

    setExpandedYears(nextYears);
    setExpandedMonths(nextMonths);
  }, [isOpen, structuredHistory]);

  useEffect(() => {
    if (!isOpen || !closeOnOutsideClick) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [isOpen, closeOnOutsideClick, onClose]);

  useEffect(() => {
    if (dockOffset) {
      setShellOffset(dockOffset);
      return;
    }

    const syncShellOffset = () => {
      const topBar = document.querySelector("header");
      const sideBar = document.querySelector("aside");
      const top = topBar ? Math.ceil(topBar.getBoundingClientRect().height) : 56;
      const left = sideBar ? Math.ceil(sideBar.getBoundingClientRect().width) : 0;
      setShellOffset({ top, left });
    };

    syncShellOffset();
    window.addEventListener("resize", syncShellOffset);
    const topBar = document.querySelector("header");
    const sideBar = document.querySelector("aside");
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncShellOffset) : null;

    if (resizeObserver && topBar) resizeObserver.observe(topBar);
    if (resizeObserver && sideBar) resizeObserver.observe(sideBar);
    topBar?.addEventListener("transitionend", syncShellOffset);
    sideBar?.addEventListener("transitionend", syncShellOffset);

    return () => {
      window.removeEventListener("resize", syncShellOffset);
      topBar?.removeEventListener("transitionend", syncShellOffset);
      sideBar?.removeEventListener("transitionend", syncShellOffset);
      resizeObserver?.disconnect();
    };
  }, [dockOffset]);

  const toggleYear = (year: string) => {
    const next = new Set(expandedYears);
    if (next.has(year)) next.delete(year);
    else next.add(year);
    setExpandedYears(next);
  };

  const toggleMonth = (monthKey: string) => {
    const next = new Set(expandedMonths);
    if (next.has(monthKey)) next.delete(monthKey);
    else next.add(monthKey);
    setExpandedMonths(next);
  };

  if (!isOpen && !splitView) return null;
  const dockedWidth = splitView ? (isOpen ? panelWidth : 0) : panelWidth;

  return (
    <div
      className={[
        "fixed bottom-0 right-0 z-[60] flex min-h-0 justify-end overflow-hidden font-sans transition-[width,height,top] duration-300",
        splitView && !isOpen ? "pointer-events-none" : "pointer-events-auto",
      ].join(" ")}
      style={
        splitView
          ? {
              top: `${effectiveOffset.top}px`,
              width: `${dockedWidth}px`,
              height: `calc(100vh - ${effectiveOffset.top}px)`,
              transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
            }
          : { top: `${effectiveOffset.top}px`, left: `${effectiveOffset.left}px`, transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }
      }
    >
      {!splitView ? <div className="absolute inset-0" onClick={onClose} /> : null}

      <div
        ref={panelRef}
        className={[
          "relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-white transition-[transform,opacity] duration-300 will-change-[transform,opacity]",
          splitView ? "border-l border-slate-200 shadow-none" : "max-w-[560px] border-l border-slate-200 shadow-2xl",
          splitView && !isOpen ? "translate-x-3 opacity-0" : "translate-x-0 opacity-100",
        ].join(" ")}
        style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
      >
        <div
          className={[
            "sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 bg-white px-6 pb-4",
            splitView ? "pt-8" : "pt-6",
          ].join(" ")}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 shadow-sm">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold leading-tight text-slate-900">{title}</h3>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600">{toTitleCase(subtitle || "Unknown Entity")}</span>
                {showSystemGenerated ? (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span className="text-[10px] text-slate-400">System generated</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close audit trail"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="custom-scrollbar flex-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain p-6 pr-3"
          style={{ scrollbarGutter: "stable", WebkitOverflowScrolling: "touch" }}
        >
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`history-loading-${index}`} className="relative pl-14">
                <div className="absolute left-0 top-0 h-9 w-[52px] animate-pulse rounded-xl border border-slate-200 bg-white" />
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="h-7 w-32 animate-pulse rounded-md bg-slate-100" />
                    <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
                  </div>
                  <div className="space-y-2 px-1">
                    <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-b-[14px] border-t border-slate-100 bg-slate-50/50 px-4 pb-4 pt-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-6 w-6 animate-pulse rounded-full bg-slate-100" />
                      <div className="space-y-1">
                        <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                      </div>
                    </div>
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              </div>
            ))
          ) : Object.keys(structuredHistory).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-700">No history available</p>
              <p className="mt-1 text-xs text-slate-500">Timeline entries will appear here once activity is recorded.</p>
            </div>
          ) : Object.entries(structuredHistory)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([year, months], index, array) => {
              const showYearLine = array.length > 1;
              return (
              <div key={year} className="space-y-2">
                <button
                  onClick={() => toggleYear(year)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span className="text-[13px] font-bold text-slate-800">{year}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${expandedYears.has(year) ? "rotate-180" : ""}`} />
                </button>

                {expandedYears.has(year) ? (
                  <div className={`ml-5 space-y-4 py-2 pl-3 ${showYearLine ? 'border-l-2 border-slate-200' : ''}`}>
                    {Object.entries(months)
                      .sort(([a], [b]) => (MONTH_INDEX.get(b) ?? -1) - (MONTH_INDEX.get(a) ?? -1))
                      .map(([month, logs]) => {
                      const monthKey = `${month} ${year}`;
                      const isExpanded = expandedMonths.has(monthKey);

                      return (
                        <div key={monthKey} className="space-y-3">
                          <button
                            onClick={() => toggleMonth(monthKey)}
                            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm transition-all hover:bg-slate-50"
                          >
                            <span className="text-[11px] font-bold text-slate-700">{month}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-medium text-slate-400">{logs.length} entries</span>
                              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                            </div>
                          </button>

                          {isExpanded ? (
                            <div className="animate-in slide-in-from-top-1 fade-in py-2 duration-200">
                          <MilestoneTimeline data={logs} onViewMore={onViewMore} />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )})}
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `.custom-scrollbar::-webkit-scrollbar{width:4px;height:4px}.custom-scrollbar::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:10px}`,
          }}
        />
      </div>
    </div>
  );
}

export default HistorySidebar;
