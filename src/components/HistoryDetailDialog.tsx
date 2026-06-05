import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type HistoryDetailRecord = Record<string, unknown>;
export type HistoryDetailPreviewEvent = {
  action: string;
  levelCount?: string;
  status?: "pending" | "approved";
};

export type HistoryDetailViewModel =
  | {
      mode: "single";
      record: HistoryDetailRecord;
      previewEvent?: HistoryDetailPreviewEvent;
    }
  | {
      mode: "comparison";
      oldData: HistoryDetailRecord;
      newData: HistoryDetailRecord;
      previewEvent?: HistoryDetailPreviewEvent;
    };

type HistoryDetailDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sourceId: string;
  loading: boolean;
  detail: HistoryDetailViewModel | null;
};

const isPlainRecord = (value: unknown): value is HistoryDetailRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toRecord = (value: unknown): HistoryDetailRecord => (isPlainRecord(value) ? value : {});

const formatFieldLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const stringifyValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const primitiveItems = value.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item));
    if (primitiveItems) return value.map((item) => stringifyValue(item)).join(", ");
    return JSON.stringify(value, null, 2);
  }
  if (isPlainRecord(value)) return JSON.stringify(value, null, 2);
  return String(value);
};

const flattenRecord = (value: unknown, prefix = ""): Array<{ key: string; label: string; value: string }> => {
  if (!isPlainRecord(value)) {
    return prefix
      ? [{ key: prefix, label: formatFieldLabel(prefix), value: stringifyValue(value) }]
      : [];
  }

  const entries: Array<{ key: string; label: string; value: string }> = [];
  Object.entries(value).forEach(([key, rawValue]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (isPlainRecord(rawValue)) {
      entries.push(...flattenRecord(rawValue, nextKey));
      return;
    }
    if (Array.isArray(rawValue)) {
      const primitiveArray = rawValue.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item));
      if (primitiveArray) {
        entries.push({
          key: nextKey,
          label: formatFieldLabel(nextKey),
          value: rawValue.length > 0 ? rawValue.map((item) => stringifyValue(item)).join(", ") : "—",
        });
        return;
      }
      entries.push({
        key: nextKey,
        label: formatFieldLabel(nextKey),
        value: JSON.stringify(rawValue, null, 2),
      });
      return;
    }

    entries.push({
      key: nextKey,
      label: formatFieldLabel(nextKey),
      value: stringifyValue(rawValue),
    });
  });

  return entries;
};

const isComparisonPayload = (value: unknown): value is { oldData: HistoryDetailRecord; newData: HistoryDetailRecord } => {
  if (!isPlainRecord(value)) return false;
  return isPlainRecord(value.oldData) && isPlainRecord(value.newData);
};

export const normalizeHistoryDetail = (response: unknown): HistoryDetailViewModel | null => {
  if (!response) return null;

  if (isComparisonPayload(response)) {
    return { mode: "comparison", oldData: response.oldData, newData: response.newData };
  }

  const root = toRecord(response);
  const rootData = root.data;
  if (isComparisonPayload(rootData)) {
    return { mode: "comparison", oldData: rootData.oldData, newData: rootData.newData };
  }

  const oldDataCandidate = isPlainRecord(root.oldData)
    ? root.oldData
    : isPlainRecord(rootData) && isPlainRecord(rootData.oldData)
      ? rootData.oldData
      : isPlainRecord(root.previousData)
        ? root.previousData
        : null;
  const newDataCandidate = isPlainRecord(root.newData)
    ? root.newData
    : isPlainRecord(rootData) && isPlainRecord(rootData.newData)
      ? rootData.newData
      : isPlainRecord(root.currentData)
        ? root.currentData
        : null;

  if (oldDataCandidate && newDataCandidate) {
    return { mode: "comparison", oldData: oldDataCandidate, newData: newDataCandidate };
  }

  if (isPlainRecord(rootData)) {
    return { mode: "single", record: rootData };
  }

  const rootClone = { ...root };
  delete rootClone.message;
  delete rootClone.code;
  delete rootClone.success;
  delete rootClone.oldData;
  delete rootClone.newData;
  delete rootClone.previousData;
  delete rootClone.currentData;
  delete rootClone.data;

  return Object.keys(rootClone).length > 0 ? { mode: "single", record: rootClone } : null;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{value}</div>
    </div>
  );
}

function ComparisonRow({
  label,
  oldValue,
  newValue,
}: {
  label: string;
  oldValue: string;
  newValue: string;
}) {
  const hasChanged = oldValue !== newValue;
  const isRemoved = oldValue !== "—" && newValue === "—";
  const isAdded = oldValue === "—" && newValue !== "—";

  return (
    <div className="grid gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] md:items-start">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className={`rounded-lg border px-3 py-2 text-sm leading-6 ${isRemoved ? "border-rose-200 bg-rose-50 text-rose-700 line-through" : hasChanged ? "border-slate-200 bg-slate-50 text-slate-700" : "border-slate-200 bg-white text-slate-800"}`}>
        {oldValue}
      </div>
      <div className={`rounded-lg border px-3 py-2 text-sm leading-6 ${isAdded ? "border-emerald-200 bg-emerald-50 text-emerald-700" : hasChanged ? "border-slate-200 bg-slate-50 text-slate-800" : "border-slate-200 bg-white text-slate-800"}`}>
        {newValue}
      </div>
    </div>
  );
}

export function HistoryDetailDialog({ isOpen, onClose, title, sourceId, loading, detail }: HistoryDetailDialogProps) {
  const singleRows = detail?.mode === "single" ? flattenRecord(detail.record) : [];
  const oldRows = detail?.mode === "comparison" ? flattenRecord(detail.oldData) : [];
  const newRows = detail?.mode === "comparison" ? flattenRecord(detail.newData) : [];
  const rowKeys = detail?.mode === "comparison" ? Array.from(new Set([...oldRows.map((item) => item.key), ...newRows.map((item) => item.key)])) : [];
  const rowLookup = new Map<string, { oldValue?: string; newValue?: string; label: string }>();

  if (detail?.mode === "comparison") {
    oldRows.forEach((row) => {
      rowLookup.set(row.key, {
        label: row.label,
        oldValue: row.value,
        newValue: rowLookup.get(row.key)?.newValue,
      });
    });
    newRows.forEach((row) => {
      const current = rowLookup.get(row.key);
      rowLookup.set(row.key, {
        label: row.label,
        oldValue: current?.oldValue,
        newValue: row.value,
      });
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}>
      <DialogContent className="max-h-[90vh] w-[min(92vw,920px)] overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl">
        <DialogHeader className="border-b border-slate-200 px-6 py-4">
          <DialogTitle className="flex flex-col gap-1 text-slate-900">
            <span>{title}</span>
            <span className="text-xs font-medium text-slate-500">Record ID: {sourceId || "—"}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(90vh-88px)] overflow-y-auto bg-slate-50/60 p-5">
          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 text-center">
              <p className="text-sm font-semibold text-slate-700">Loading details...</p>
            </div>
          ) : detail?.mode === "comparison" ? (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Field</div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Old Data</div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">New Data</div>
              </div>
              {rowKeys.length > 0 ? (
                <div className="space-y-3">
                  {rowKeys.map((key) => {
                    const row = rowLookup.get(key);
                    if (!row) return null;
                    return (
                      <ComparisonRow
                        key={key}
                        label={row.label}
                        oldValue={row.oldValue ?? "—"}
                        newValue={row.newValue ?? "—"}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 text-center">
                  <p className="text-sm font-semibold text-slate-700">No comparison data available.</p>
                </div>
              )}
            </div>
          ) : detail?.mode === "single" ? (
            <div className="space-y-3">
              {singleRows.length > 0 ? (
                singleRows.map((row) => <DetailRow key={row.key} label={row.label} value={row.value} />)
              ) : (
                <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 text-center">
                  <p className="text-sm font-semibold text-slate-700">No detail data available.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 text-center">
              <p className="text-sm font-semibold text-slate-700">No details found.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default HistoryDetailDialog;
