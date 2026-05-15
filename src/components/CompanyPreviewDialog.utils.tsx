import { format, isValid, parse, parseISO } from "date-fns";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ApprovalStatusLabel = "Approved" | "Pending" | "Inactive" | "Rejected";

export const statusColors = {
  Approved: "bg-success/10 text-success border-success/20",
  Pending: "bg-warning/10 text-warning border-warning/20",
  Inactive: "bg-destructive/10 text-destructive border-destructive/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
} as const satisfies Record<ApprovalStatusLabel, string>;

export const fieldLabelClassName = "text-[12px] font-medium text-slate-500";
export const fieldValueClassName = "text-[15px] font-semibold text-slate-900";
export const sectionHeadingClassName = "text-[15px] font-semibold text-foreground";

export const displayValue = (value?: string | null) => (value && value.trim() ? value : "—");

export type InfoFieldProps = {
  label: string;
  value: ReactNode;
  className?: string;
};

export function InfoField({ label, value, className }: InfoFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className={fieldLabelClassName}>{label}</p>
      <div className={fieldValueClassName}>{value}</div>
    </div>
  );
}

export function CodePill({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1.5 text-xs font-semibold leading-none tracking-[0.03em] text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {value}
    </span>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_14px_1fr] gap-2 py-1.5">
      <p className="text-sm text-slate-700">{label}</p>
      <span className="text-slate-400">:</span>
      <div className="text-[15px] font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export function SignatoryDetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_14px_1fr] gap-2 py-0.5">
      <p className="text-sm text-slate-700">{label}</p>
      <span className="text-slate-400">:</span>
      <div className="text-sm font-semibold text-slate-900 break-all">{value}</div>
    </div>
  );
}

export const formatDisplayDate = (value?: string) => {
  if (!value) return "—";
  const isoDate = parseISO(value);
  if (isValid(isoDate)) return format(isoDate, "dd MMM yyyy");

  const parsedDate = parse(value, "dd/MM/yyyy", new Date());
  if (isValid(parsedDate)) return format(parsedDate, "dd MMM yyyy");

  return value;
};

export const formatUtcToIstDateTime = (value?: string) => {
  if (!value) return "—";
  const utcDate = new Date(value);
  if (Number.isNaN(utcDate.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(utcDate);
};
