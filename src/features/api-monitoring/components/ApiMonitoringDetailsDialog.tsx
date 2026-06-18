import { useMemo, useState } from "react";
import { AlertTriangle, CircleCheck, X, XCircle, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

const parseBooleanHeader = (value: string | undefined) => {
  if (!value) return false;
  return value.toString().trim().toLowerCase() === "true";
};

const readAuthCookieFlag = (headers: Record<string, string>, keys: string[]) => {
  for (const key of keys) {
    const direct = headers[key];
    if (direct !== undefined) {
      return parseBooleanHeader(direct);
    }
    const lowerKey = key.toLowerCase();
    const matchedKey = Object.keys(headers).find((headerKey) => headerKey.toLowerCase() === lowerKey);
    if (matchedKey) {
      return parseBooleanHeader(headers[matchedKey]);
    }
  }
  return false;
};

const companyBadgeStyle = (code: string) => {
  const source = (code || "N/A").trim();
  const hash = source.split("").reduce((acc, ch, index) => acc + (ch.charCodeAt(0) * (index + 1)), 0);
  const hue = Math.abs(hash) % 360;
  return {
    backgroundColor: `hsl(${hue} 85% 92%)`,
    color: `hsl(${hue} 65% 28%)`,
    borderColor: `hsl(${hue} 70% 78%)`,
  };
};

function StepPathText({ path }: { path: string }) {
  const text = path || "-";
  const needsMarquee = text.length > 24;

  if (!needsMarquee) {
    return <span className="max-w-[165px] truncate font-mono text-[11px]">{text}</span>;
  }

  const parts = text.split("/");
  let lastPart = "";
  let firstPart = text;
  if (parts.length > 1) {
    lastPart = `/${parts.pop()}`;
    firstPart = parts.join("/");
  }

  return (
    <div className="relative flex w-full max-w-[165px] items-center overflow-hidden font-mono text-[11px]">
      <span className="flex w-full items-center transition-opacity duration-300 group-hover:opacity-0">
        <span className="truncate">{firstPart}</span>
        <span className="shrink-0">{lastPart}</span>
      </span>
      <div className="absolute inset-0 flex items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <span className="api-marquee-wrap w-full">
          <span className="api-marquee-track group-hover:animate-[api-marquee_9s_linear_infinite]">
            <span>{text}</span>
            <span className="px-6">{text}</span>
          </span>
        </span>
      </div>
    </div>
  );
}

function PayloadCard({ title, headers, body, bodyTone = "text-emerald-300" }: {
  title: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
  bodyTone?: string;
}) {
  const [isHeadersExpanded, setIsHeadersExpanded] = useState(false);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground">{title}</div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-muted/20 p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Headers</p>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsHeadersExpanded((value) => !value)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-[rgb(53,83,233)] hover:text-[rgb(53,83,233)]"
                    aria-label={isHeadersExpanded ? "Collapse Headers" : "Expand Headers"}
                    aria-expanded={isHeadersExpanded}
                  >
                    {isHeadersExpanded ? <X className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {isHeadersExpanded ? "Collapse" : "Expand"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {isHeadersExpanded ? (
            <pre className="max-h-44 overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-3 text-[11px] leading-relaxed text-green-400">
              {Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join("\n") || "-"}
            </pre>
          ) : null}
        </div>
        <div className="flex flex-col min-h-0">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Body (JSON)</p>
          <pre className={cn("max-h-56 flex-1 overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-3 text-[11px]", bodyTone)}>
            {JSON.stringify(body ?? {}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

const formatPayloadTitle = (title: string, responseSize?: string) => {
  const normalizedSize = (responseSize || "").trim();
  return normalizedSize && normalizedSize !== "-"
    ? `${title} (${normalizedSize})`
    : title;
};

export default function ApiMonitoringDetailsDialog({ log, open, onOpenChange }: ApiMonitoringDetailsDialogProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const steps = useMemo<ApiMonitoringStep[]>(() => {
    if (!log) return [];
    if ((log.subApis ?? []).length > 0) {
      return log.subApis;
    }
    return [log];
  }, [log]);

  const activeStep = steps[activeIndex] ?? null;
  const parentStep = steps[0] ?? null;
  const authBadges = useMemo(() => {
    if (!parentStep) {
      return [
        { label: "Access token", enabled: false },
        { label: "Refresh Token", enabled: false },
        { label: "Version", enabled: false },
      ];
    }

    return [
      {
        label: "Access token",
        enabled: readAuthCookieFlag(parentStep.reqHeaders, ["cookieAccessToken", "cookie_access_token"]),
      },
      {
        label: "Refresh Token",
        enabled: readAuthCookieFlag(parentStep.reqHeaders, ["cookieRefreshToken", "cookie_refresh_token"]),
      },
      {
        label: "Version",
        enabled: readAuthCookieFlag(parentStep.reqHeaders, ["cookiesHashVersion", "cookies_hash_version"]),
      },
    ];
  }, [parentStep]);

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
          <DialogDescription className="sr-only">
            Inspect request, response, and processing details for the selected API monitoring log.
          </DialogDescription>
          <DialogTitle className="flex items-start gap-2">
            <span className="mt-0.5">{getStatusIcon(log.status)}</span>
            <span className="flex flex-col">
              <span className="font-mono text-sm md:text-base">{log.path}</span>
              <span className="font-mono text-xs text-muted-foreground">{log.trackId}</span>
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
                    )}
                    style={companyBadgeStyle(log.company.code)}
                  >
                    {log.company.code}
                  </span>
                </div>
                <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Latency</p>
                {typeof activeStep.latency === "number" ? (
                  <p className="text-sm font-semibold text-emerald-700">
                    {activeStep.latency} ms
                  </p>
                ) : (
                  <p className="text-sm font-normal text-muted-foreground">-</p>
                )}
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">User</p>
                <p className="text-base font-semibold text-foreground">{log.user.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{log.user.email}</p>
                {log.clientIp ? (
                  <p className="mt-0.5 text-sm text-amber-700">{log.clientIp}</p>
                ) : null}
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
                  {authBadges.map((item) => (
                    <Badge
                      key={item.label}
                      variant="outline"
                      className={cn("text-[10px]", item.enabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}
                    >
                      {item.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-border bg-white p-2.5 pb-3 [&::-webkit-scrollbar-thumb]:bg-slate-400 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar]:h-2">
            <div className="flex min-w-max items-stretch">
            {steps.map((step, index) => (
              <button
                key={`${step.id}-${index}`}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "group relative -ml-4 h-[54px] min-w-[180px] shrink-0 px-6 text-white transition first:ml-0 focus:outline-none",
                  activeIndex === index ? "z-20 saturate-110 brightness-[1.02]" : "z-10 hover:brightness-95",
                )}
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
                  <span className="flex max-w-[170px] flex-col items-center leading-tight">
                    <span className="pb-0.5 text-[11px] font-extrabold uppercase tracking-wide opacity-100">
                      {(step.spanType || "UNKNOWN")}({step.method || "UNKNOWN"})
                    </span>
                    <StepPathText path={step.path || "-"} />
                  </span>
                </span>
              </button>
            ))}
            </div>
          </div>

          <div className="grid h-[380px] grid-cols-1 gap-4 lg:grid-cols-2">
            <PayloadCard title="Request Payload" headers={activeStep.reqHeaders} body={activeStep.reqBody} bodyTone="text-indigo-300" />
            <PayloadCard
              title={formatPayloadTitle("Response Payload", activeStep.responseSize)}
              headers={activeStep.resHeaders}
              body={activeStep.resBody}
              bodyTone="text-green-300"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
