import { useMemo, useState } from "react";
import { AlertTriangle, CircleCheck, Search, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useApiMonitoring } from "@/features/api-monitoring/hooks/useApiMonitoring";
import type { ApiMonitoringLog } from "@/features/api-monitoring/types";
import ApiMonitoringDetailsDialog from "@/features/api-monitoring/components/ApiMonitoringDetailsDialog";

const getStatusIcon = (status: number | null) => {
  if (status === null) return <AlertTriangle className="h-5 w-5 text-slate-400" />;
  if (status >= 200 && status < 300) return <CircleCheck className="h-5 w-5 text-emerald-600" />;
  if (status >= 400 && status < 500) return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  return <XCircle className="h-5 w-5 text-red-600" />;
};

const companyBadgeClass = (code: string) => {
  const palette = [
    "bg-blue-100 text-blue-700",
    "bg-teal-100 text-teal-700",
    "bg-rose-100 text-rose-700",
    "bg-amber-100 text-amber-700",
    "bg-indigo-100 text-indigo-700",
    "bg-emerald-100 text-emerald-700",
    "bg-cyan-100 text-cyan-700",
    "bg-fuchsia-100 text-fuchsia-700",
    "bg-violet-100 text-violet-700",
    "bg-orange-100 text-orange-700",
    "bg-lime-100 text-lime-700",
    "bg-sky-100 text-sky-700",
  ];
  const hash = code.split("").reduce((acc, ch, index) => acc + (ch.charCodeAt(0) * (index + 1)), 0);
  return palette[Math.abs(hash) % palette.length];
};

export default function ApiMonitoringView() {
  const { filteredLogs, loading, error, searchText, setSearchText, fetchDetailsForTrack } = useApiMonitoring();
  const [selectedLog, setSelectedLog] = useState<ApiMonitoringLog | null>(null);

  const emptyMessage = useMemo(() => {
    if (loading) return "Loading API logs...";
    if (error) return error;
    if (searchText.trim()) return "No logs found for this search.";
    return "No API monitoring logs available.";
  }, [loading, error, searchText]);

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border border-border px-6 py-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">API Monitor</h1>
        <p className="mt-1 text-sm text-muted-foreground">Real-time traffic and latency tracking</p>
      </Card>

      <Card className="flex h-[760px] flex-col overflow-hidden border border-border shadow-sm">
        <div className="border-b border-border bg-muted/40 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="pl-9"
              placeholder="Search logs..."
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-left">
            <thead className="text-sm uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="sticky top-0 z-20 border-b border-border bg-muted px-6 py-4 font-semibold">Company</th>
                <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-4 font-semibold">User</th>
                <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-4 font-semibold">Time</th>
                <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-4 font-semibold">Date</th>
                <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-4 font-semibold">API Endpoint</th>
                <th className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  onClick={async () => {
                    setSelectedLog(log);
                    try {
                      const details = await fetchDetailsForTrack(log.id);
                      setSelectedLog((current) => {
                        if (!current || current.trackId !== log.trackId) return current;
                        const parsed = details.mainRequest.timeString.split(" ");
                        const nextDate = parsed[0] || current.dateStr;
                        const nextTime = parsed.slice(1).join(" ") || current.timeStr;
                        return {
                          ...current,
                          id: details.mainRequest.id,
                          trackId: details.mainRequest.trackId,
                          method: details.mainRequest.method,
                          path: details.mainRequest.path,
                          status: details.mainRequest.status,
                          timeString: details.mainRequest.timeString,
                          timeStr: nextTime,
                          dateStr: nextDate,
                          subApis: details.childSpans,
                        };
                      });
                    } catch {
                      // Keep table payload as fallback if details call fails.
                    }
                  }}
                  className="cursor-pointer border-b border-border/70 transition hover:bg-muted/40"
                >
                  <td className="px-6 py-3 align-top">
                    <p className="text-sm font-medium text-foreground">{log.company.name}</p>
                    <span className={cn("mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold", companyBadgeClass(log.company.code))}>
                      {log.company.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="text-sm font-medium text-foreground">{log.user.name}</p>
                    <p className="mt-0.5 text-[11px] text-sky-700">{log.user.email}</p>
                    {log.clientIp ? (
                      <p className="mt-0.5 text-[11px] text-amber-700">{log.clientIp}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{log.timeStr || "-"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{log.dateStr || "-"}</td>
                  <td className="px-4 py-3 align-top">
                    <p className="max-w-[280px] truncate font-mono text-sm text-foreground">{log.path}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                      {log.totalSpanCount} sub-tasks
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-start">
                      {getStatusIcon(log.status)}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredLogs.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ApiMonitoringDetailsDialog log={selectedLog} open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)} />
    </div>
  );
}
