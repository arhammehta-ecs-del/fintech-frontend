import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, ChevronDown, Clock, History, ShieldCheck, X } from "lucide-react";
import type { Company } from "@/contexts/AppContext";

type HistoryStatus = "pending" | "approved";

type HistoryEntry = {
  id: string;
  year: string;
  month: string;
  day: string;
  action: string;
  details: string;
  initiator: {
    name: string;
    email: string;
    initials: string;
    date: string;
    time: string;
  };
  approver?: {
    name: string;
    time: string;
  };
  status: HistoryStatus;
};

type CompanyHistorySidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  data: HistoryEntry[];
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

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};

const formatDateParts = (isoLike?: string) => {
  const parsed = isoLike ? new Date(isoLike) : new Date();
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const year = safeDate.getFullYear().toString();
  const month = MONTHS[safeDate.getMonth()] ?? "JANUARY";
  const day = String(safeDate.getDate()).padStart(2, "0");
  const date = safeDate.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  const time = safeDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return { year, month, day, date, time };
};

export const buildCompanyHistoryData = (company: Company): HistoryEntry[] => {
  const initiatedAt = company.requestInitiatedAt || company.incorporationDate;
  const initiated = formatDateParts(initiatedAt);
  const requesterName = company.requesterName?.trim() || "System Admin";
  const requesterEmail = company.requesterEmail?.trim() || "admin@system.local";

  const statusAction =
    company.status === "Pending"
      ? "Company Onboarding Pending"
      : company.status === "Inactive"
        ? "Company Marked Inactive"
        : "Company Approved";

  const statusDetails =
    company.status === "Pending"
      ? `Onboarding for ${company.companyName} is awaiting checker approval.`
      : company.status === "Inactive"
        ? `${company.companyName} access has been deactivated after review.`
        : `${company.companyName} completed onboarding and is now active.`;

  const approvedAt = formatDateParts(company.incorporationDate);

  const events: HistoryEntry[] = [
    {
      id: `${company.id}-status`,
      year: initiated.year,
      month: initiated.month,
      day: initiated.day,
      action: statusAction,
      details: statusDetails,
      initiator: {
        name: requesterName,
        email: requesterEmail,
        initials: getInitials(requesterName),
        date: initiated.date,
        time: initiated.time,
      },
      approver:
        company.status === "Pending"
          ? undefined
          : {
            name: "Checker",
            time: approvedAt.time,
          },
      status: company.status === "Pending" ? "pending" : "approved",
    },
    {
      id: `${company.id}-legal`,
      year: approvedAt.year,
      month: approvedAt.month,
      day: approvedAt.day,
      action: "Legal Profile Captured",
      details: `Legal name synced as ${company.legalName}. GSTIN/IEC registration metadata stored.`,
      initiator: {
        name: requesterName,
        email: requesterEmail,
        initials: getInitials(requesterName),
        date: approvedAt.date,
        time: approvedAt.time,
      },
      approver: {
        name: "Compliance Bot",
        time: approvedAt.time,
      },
      status: "approved",
    },
  ];

  return events.sort((a, b) => {
    const left = Date.parse(`${a.month} ${a.day}, ${a.year} ${a.initiator.time || "00:00 AM"}`);
    const right = Date.parse(`${b.month} ${b.day}, ${b.year} ${b.initiator.time || "00:00 AM"}`);
    return right - left;
  });
};

function StatusHeader({ item }: { item: HistoryEntry }) {
  return (
    <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
      {item.status === "pending" ? (
        <div className="flex items-center gap-1.5 rounded border border-amber-200/50 bg-amber-50 px-2 py-1 text-amber-700">
          <Clock className="h-3 w-3" />
          <span className="text-[10px] font-bold uppercase tracking-tight">Pending Approval</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 rounded border border-emerald-200/50 bg-emerald-50 px-2 py-1 text-emerald-700">
          <ShieldCheck className="h-3 w-3" />
          <span className="text-[10px] font-bold uppercase tracking-tight">Approved: {item.approver?.name ?? "Checker"}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-slate-400">
        {item.status === "approved" ? (
          <span className="flex items-center gap-1 text-[10px] font-medium tracking-tight">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {item.approver?.time ?? "-"}
          </span>
        ) : (
          <span className="text-[10px] font-medium tracking-tight text-amber-600/70">Awaiting</span>
        )}
      </div>
    </div>
  );
}

function InitiatorFooter({ initiator }: { initiator: HistoryEntry["initiator"] }) {
  return (
    <div className="-mx-4 -mb-4 mt-4 flex items-center justify-between rounded-b-[14px] border-t border-slate-100 bg-slate-50/50 px-4 pb-4 pt-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-[9px] font-bold text-slate-600 shadow-sm">
          {initiator.initials}
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold leading-tight text-slate-900">{initiator.name}</span>
          <span className="text-[9.5px] text-slate-500">{initiator.email}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className="text-[8.5px] font-bold uppercase tracking-widest text-slate-400">Initiated</span>
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-slate-400" /> {initiator.date}</span>
          <span className="text-slate-300">-</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-slate-400" /> {initiator.time}</span>
        </div>
      </div>
    </div>
  );
}

function MilestoneTimeline({ data }: { data: HistoryEntry[] }) {
  return (
    <div className="relative py-1">
      <div className="space-y-6">
        {data.map((item, index) => (
          <div key={item.id} className="relative pl-14">
            {index < data.length - 1 ? (
              <div
                className="absolute left-[26px] top-[36px] w-[1.5px] bg-slate-200"
                style={{ height: "calc(100% + 24px)" }}
                aria-hidden="true"
              />
            ) : null}
            <div
              className={[
                "absolute left-0 top-0 z-10 flex h-9 w-[52px] flex-col items-center justify-center rounded-xl border bg-white font-bold text-slate-700 shadow-sm transition-all",
                item.status === "pending"
                  ? "border-amber-300 text-amber-700 shadow-[0_0_10px_rgba(251,191,36,0.15)]"
                  : "border-slate-200",
              ].join(" ")}
            >
              <span className="text-[13px] leading-none tracking-tight">{item.day}</span>
              <span className="mt-0.5 text-[7px] uppercase tracking-widest opacity-70">{item.month.substring(0, 3)}</span>
            </div>

            <div
              className={[
                "rounded-2xl border bg-white p-4 shadow-sm transition-all",
                item.status === "pending"
                  ? "border-amber-200/70 shadow-[0_2px_12px_rgba(251,191,36,0.08)]"
                  : "border-slate-200 hover:shadow-md",
              ].join(" ")}
            >
              <StatusHeader item={item} />
              <div className="mb-2 px-1">
                <h4 className="mb-1.5 text-[13px] font-semibold tracking-tight text-slate-900">{item.action}</h4>
                <p className="text-[11.5px] leading-relaxed text-slate-600">{item.details}</p>
              </div>
              <InitiatorFooter initiator={item.initiator} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompanyHistorySidebar({ isOpen, onClose, company, data }: CompanyHistorySidebarProps) {
  const [expandedYears, setExpandedYears] = useState(new Set<string>([(new Date().getFullYear()).toString()]));
  const [expandedMonths, setExpandedMonths] = useState(new Set<string>());
  const [shellOffset, setShellOffset] = useState({ top: 56, left: 0 });

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
          const left = Date.parse(`${a.month} ${a.day}, ${a.year} ${a.initiator.time || "00:00 AM"}`);
          const right = Date.parse(`${b.month} ${b.day}, ${b.year} ${b.initiator.time || "00:00 AM"}`);
          return right - left;
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
    const syncShellOffset = () => {
      const topBar = document.querySelector("header");
      const sideBar = document.querySelector("aside");
      const top = topBar ? Math.ceil(topBar.getBoundingClientRect().height) : 56;
      const left = sideBar ? Math.ceil(sideBar.getBoundingClientRect().width) : 0;
      setShellOffset({ top, left });
    };

    syncShellOffset();
    window.addEventListener("resize", syncShellOffset);
    return () => window.removeEventListener("resize", syncShellOffset);
  }, []);

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

  if (!isOpen || !company) return null;

  return (
    <div
      className="fixed bottom-0 right-0 z-30 flex justify-end font-sans"
      style={{ top: `${shellOffset.top}px`, left: `${shellOffset.left}px` }}
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative flex h-full w-full max-w-[560px] flex-col border-l border-slate-200 bg-slate-50 shadow-2xl animate-in slide-in-from-right duration-300 ease-out">
        <div className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="rounded-lg border border-slate-200 bg-slate-100 p-2 text-slate-600">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold leading-tight text-slate-900">Audit Trail</h3>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600">{toTitleCase(company.companyName || "Unknown Entity")}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="text-[10px] text-slate-400">System generated</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close audit trail"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-6">
          {Object.entries(structuredHistory)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([year, months]) => (
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
                  <div className="ml-5 space-y-4 border-l-2 border-slate-200 py-2 pl-3">
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
                              <MilestoneTimeline data={logs} />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
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

export default CompanyHistorySidebar;
