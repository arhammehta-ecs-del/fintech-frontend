import { useMemo, useState } from "react";
import { AlertTriangle, CircleCheck, X, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { ApiMonitoringLog, ApiMonitoringStep } from "@/features/api-monitoring/types";
import { cn } from "@/lib/utils";

type ApiMonitoringDetailsDialogProps = {
  log: ApiMonitoringLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const chevronColors = ["#2ca58d", "#8fb54a", "#f59f00", "#cf3427", "#324a5f", "#2a9d8f", "#6c757d"];

const getStatusIcon = (status: number | null) => {
  if (status === null) return <AlertTriangle className="h-5 w-5 text-slate-400" />;
  if (status >= 200 && status < 300) return <CircleCheck className="h-5 w-5 text-emerald-600" />;
  if (status >= 400 && status < 500) return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  return <XCircle className="h-5 w-5 text-red-600" />;
};

const hasValue = (value?: string) => Boolean(value && value.trim() && value !== "N/A");

const companyBadgeClass = (code: string) => {
  const palette = [
    "bg-blue-100 text-blue-700 border-blue-200",
    "bg-teal-100 text-teal-700 border-teal-200",
    "bg-rose-100 text-rose-700 border-rose-200",
    "bg-amber-100 text-amber-700 border-amber-200",
    "bg-indigo-100 text-indigo-700 border-indigo-200",
  ];
  const hash = code.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return palette[Math.abs(hash) % palette.length];
};

function PayloadCard({ title, headers, body, bodyTone = "text-emerald-300" }: {
  title: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
  bodyTone?: string;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground">{title}</div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-muted/20 p-4">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Headers</p>
          <pre className="max-h-44 overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-3 text-[11px] leading-relaxed text-green-400">
            {Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join("\n") || "-"}
          </pre>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Body (JSON)</p>
          <pre className={cn("max-h-56 overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-3 text-[11px]", bodyTone)}>
            {JSON.stringify(body ?? {}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function ApiMonitoringDetailsDialog({ log, open, onOpenChange }: ApiMonitoringDetailsDialogProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const steps = useMemo<ApiMonitoringStep[]>(() => {
    if (!log) return [];
    return [log, ...(log.subApis ?? [])];
  }, [log]);

  const activeStep = steps[activeIndex] ?? null;

  if (!log || !activeStep) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setActiveIndex(0);
      }}
    >
      <DialogContent showCloseButton={false} className="h-[88vh] w-[min(96vw,1200px)] max-w-none overflow-hidden p-0">
        <DialogHeader className="flex-row items-center justify-between border-b border-border bg-muted/40 px-6 py-3.5">
          <DialogTitle className="flex items-start gap-2">
            <span className="mt-0.5">{getStatusIcon(activeStep.status)}</span>
            <span className="flex flex-col">
              <span className="font-mono text-sm md:text-base">{activeStep.path}</span>
              <span className="font-mono text-xs text-muted-foreground">{activeStep.id}</span>
            </span>
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close API monitoring details"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="flex h-full flex-col gap-4 overflow-y-auto bg-muted/20 p-5">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Execution Overview</p>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-4">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Company</p>
                <p className="text-base font-semibold text-foreground">{log.company.name}</p>
                <div className="mt-1">
                  <span
                    className={cn(
                      "inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                      companyBadgeClass(log.company.code),
                    )}
                  >
                    {log.company.code}
                  </span>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">User</p>
                <p className="text-base font-semibold text-foreground">{log.user.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{log.user.email}</p>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Time</p>
                <p className="text-sm font-normal text-muted-foreground">{log.timeStr || "-"}</p>
                <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Date</p>
                <p className="text-sm font-normal text-muted-foreground">{log.dateStr || "-"}</p>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Auth</p>
                <div className="flex flex-col items-start gap-2 pt-1">
                  <Badge variant="outline" className={cn("text-[10px]", hasValue(activeStep.accessToken) ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>Access Token</Badge>
                  <Badge variant="outline" className={cn("text-[10px]", hasValue(activeStep.refreshToken) ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>Refresh Token</Badge>
                  <Badge variant="outline" className={cn("text-[10px]", hasValue(activeStep.cookies) ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>Cookies</Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-border bg-white p-2.5">
            <div className="flex min-w-max items-stretch">
            {steps.map((step, index) => (
              <button
                key={`${step.id}-${index}`}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "relative -ml-4 h-[54px] min-w-[180px] shrink-0 px-6 text-white transition first:ml-0 focus:outline-none",
                  activeIndex === index ? "z-20 saturate-110 brightness-[1.02]" : "z-10 hover:brightness-95",
                )}
                title={step.path}
              >
                <span
                  className="absolute inset-0"
                  style={{
                    clipPath: index === 0
                      ? "polygon(0 0, calc(100% - 26px) 0, 100% 50%, calc(100% - 26px) 100%, 0 100%)"
                      : "polygon(0 0, calc(100% - 26px) 0, 100% 50%, calc(100% - 26px) 100%, 0 100%, 26px 50%)",
                    backgroundColor: chevronColors[index % chevronColors.length],
                  }}
                />
                {index > 0 ? (
                  <span
                    className="absolute left-0 top-0 z-[1] h-full w-[28px] bg-white"
                    style={{ clipPath: "polygon(0 0, 8px 0, 28px 50%, 8px 100%, 0 100%, 20px 50%)" }}
                  />
                ) : null}
                <span className="relative z-10 flex h-full items-center justify-center px-2 text-[12px] font-bold tracking-[0.02em]">
                  <span className="max-w-[150px] truncate font-mono">{step.id}</span>
                </span>
              </button>
            ))}
            </div>
          </div>

          <div className="grid h-[380px] grid-cols-1 gap-4 lg:grid-cols-2">
            <PayloadCard title="Request Payload" headers={activeStep.reqHeaders} body={activeStep.reqBody} bodyTone="text-indigo-300" />
            <PayloadCard title="Response Payload" headers={activeStep.resHeaders} body={activeStep.resBody} bodyTone="text-green-300" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
