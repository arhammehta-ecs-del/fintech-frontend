import { Calendar, CircleX, Clock, History, ShieldCheck } from "lucide-react";
import type { HistoryEntry, HistoryStatus } from "@/components/HistorySidebar";

export const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
export const MONTH_INDEX = new Map(MONTHS.map((month, index) => [month, index] as const));

export const toTitleCase = (value: string) =>
  value.toLowerCase().split(" ").filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

type EventTone = "approved" | "pending" | "initiation" | "rejected" | "inactive";

export const getEventTone = (action: string, fallbackStatus: HistoryStatus): EventTone => {
  const normalized = action.trim().toLowerCase();
  if (normalized.includes("reject")) return "rejected";
  if (normalized.includes("inactive") || normalized.includes("deactivate")) return "inactive";
  if (normalized.includes("initiate")) return "initiation";
  if (normalized.includes("pending")) return "pending";
  if (normalized.includes("approve") || normalized.includes("active")) return "approved";
  return fallbackStatus === "pending" ? "pending" : "approved";
};

export const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};

export const formatDateParts = (isoLike?: string) => {
  const parsed = isoLike ? new Date(isoLike) : new Date();
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const year = safeDate.getFullYear().toString();
  const month = MONTHS[safeDate.getMonth()] ?? "JANUARY";
  const day = String(safeDate.getDate()).padStart(2, "0");
  const date = safeDate.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  const time = safeDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return { year, month, day, date, time };
};

export function StatusHeader({ item }: { item: HistoryEntry }) {
  const tone = getEventTone(item.action, item.status);
  const badgeClassName =
    tone === "pending"
      ? "border-amber-200/50 bg-amber-50 text-amber-700"
      : tone === "initiation"
        ? "border-sky-200/60 bg-sky-50 text-sky-700"
        : tone === "rejected"
          ? "border-rose-200/50 bg-rose-50 text-rose-700"
          : tone === "inactive"
            ? "border-slate-300/70 bg-slate-100 text-slate-700"
            : "border-emerald-200/50 bg-emerald-50 text-emerald-700";

  return (
    <div className="mb-3 flex items-center border-b border-slate-100 pb-3">
      <div className={`flex items-center gap-1.5 rounded border px-2 py-1 ${badgeClassName}`}>
        {tone === "pending" ? <Clock className="h-3 w-3" /> : tone === "initiation" ? <History className="h-3 w-3" /> : tone === "rejected" ? <CircleX className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
        <span className="text-[10px] font-bold uppercase tracking-tight">{item.action}</span>
      </div>
    </div>
  );
}

export function ActorFooter({ item }: { item: HistoryEntry }) {
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
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-[9px] font-bold text-slate-600 shadow-sm">{actor.initials}</div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold leading-tight text-slate-900">{actor.name}</span>
            <span className="text-[9.5px] text-slate-500">{actor.email}</span>
          </div>
        </div>
      ) : <div />}
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

export function MilestoneTimeline({ data }: { data: HistoryEntry[] }) {
  return (
    <div className="relative py-1">
      <div className="space-y-6">
        {data.map((item, index) => (
          <div key={item.id} className="relative pl-14">
            {(() => {
              const tone = getEventTone(item.action, item.status);
              const dateBadgeClassName = tone === "pending" ? "border-amber-300 text-amber-700 shadow-[0_0_10px_rgba(251,191,36,0.15)]" : tone === "initiation" ? "border-sky-300 text-sky-700 shadow-[0_0_10px_rgba(56,189,248,0.16)]" : tone === "approved" ? "border-emerald-300 text-emerald-700 shadow-[0_0_10px_rgba(16,185,129,0.16)]" : "border-slate-200";
              return (
                <div className={["absolute left-0 top-0 z-10 flex h-9 w-[52px] flex-col items-center justify-center rounded-xl border bg-white font-bold text-slate-700 shadow-sm transition-all", dateBadgeClassName].join(" ")}>
                  <span className="text-[13px] leading-none tracking-tight">{item.day}</span>
                  <span className="mt-0.5 text-[7px] uppercase tracking-widest opacity-70">{item.month.substring(0, 3)}</span>
                </div>
              );
            })()}
            {index < data.length - 1 ? <div className="absolute left-[26px] top-[36px] w-[1.5px] bg-slate-200" style={{ height: "calc(100% + 24px)" }} aria-hidden="true" /> : null}
            <div className={["rounded-2xl border bg-white p-4 shadow-sm transition-all", (() => {
              const tone = getEventTone(item.action, item.status);
              return tone === "pending" ? "border-amber-200/70 shadow-[0_2px_12px_rgba(251,191,36,0.08)]" : tone === "initiation" ? "border-sky-200/80 shadow-[0_2px_12px_rgba(56,189,248,0.08)]" : tone === "rejected" ? "border-rose-200/80 shadow-[0_2px_12px_rgba(244,63,94,0.08)]" : tone === "inactive" ? "border-slate-300/90 shadow-[0_2px_12px_rgba(100,116,139,0.08)]" : "border-emerald-200/80 shadow-[0_2px_12px_rgba(16,185,129,0.08)]";
            })()].join(" ")}>
              <StatusHeader item={item} />
              <div className="space-y-2.5 text-sm text-slate-700">
                <div><span className="font-semibold text-slate-900">{item.details}</span></div>
                {item.remarks ? <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700"><span className="font-semibold text-slate-900">Remarks:</span> {item.remarks}</div> : null}
              </div>
              <ActorFooter item={item} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
