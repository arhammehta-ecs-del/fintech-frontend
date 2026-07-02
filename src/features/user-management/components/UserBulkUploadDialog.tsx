import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Play,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type UserBulkUploadHistoryItem = {
  id: string;
  fileName: string;
  createdAtMs: number;
  uploadedAt: string;
  fileSizeLabel: string;
  file: File;
};

type UserBulkUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: (entry: UserBulkUploadHistoryItem) => void;
};

type UserBulkUploadHistorySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: UserBulkUploadHistoryItem[];
  dockOffset?: {
    top: number;
    left: number;
  };
};

type UploadStage = "choose" | "checking" | "result";

const TEMPLATE_HEADERS = [
  "Full Name *",
  "Email *",
  "Phone *",
  "Designation",
  "Employee ID",
  "Reporting Manager Email",
  "Access 1 Type *",
  "Access 1 Role Name *",
  "Access 1 Role Category *",
  "Access 1 Role Sub Category *",
  "Access 1 Node Name *",
  "Access 1 Node Path *",
  "Access 1 Category *",
];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const order = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** order;
  return `${value >= 10 || order === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[order]}`;
};

const formatTimestamp = (value: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);

const downloadFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const downloadTemplate = () => {
  const csv = `${TEMPLATE_HEADERS.join(",")}\n`;
  downloadFile(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "user_bulk_upload_template.csv");
};

const stepMeta: Array<{ step: 1 | 2 | 3; label: string }> = [
  { step: 1, label: "Choose File" },
  { step: 2, label: "Check Data" },
  { step: 3, label: "Result" },
];

const WORKFLOW_OPTIONS = [
  { value: "maker-checker", label: "Maker Checker Workflow" },
  { value: "ops-review", label: "Ops Review Workflow" },
  { value: "admin-approval", label: "Admin Approval Workflow" },
];

export function UserBulkUploadDialog({
  open,
  onOpenChange,
  onUploadComplete,
}: UserBulkUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadTimerRef = useRef<number | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const [stage, setStage] = useState<UploadStage>("choose");
  const [progressValue, setProgressValue] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const [selectedWorkflow, setSelectedWorkflow] = useState("");
  const [remark, setRemark] = useState("");

  const currentStep = stage === "choose" ? 1 : stage === "checking" ? 2 : 3;

  const resetState = () => {
    setStage("choose");
    setProgressValue(0);
    setSelectedFile(null);
    setDragging(false);
    setFileError("");
    setSelectedWorkflow("");
    setRemark("");
    if (inputRef.current) inputRef.current.value = "";
    if (uploadTimerRef.current) {
      window.clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = null;
    }
    if (completionTimerRef.current) {
      window.clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (uploadTimerRef.current) window.clearInterval(uploadTimerRef.current);
      if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current);
    };
  }, []);

  const isValidXlsxFile = (file: File) => file.name.trim().toLowerCase().endsWith(".xlsx");

  const beginUploadFlow = (file: File) => {
    setSelectedFile(file);
    setFileError("");
    setStage("checking");
    setProgressValue(8);

    if (uploadTimerRef.current) window.clearInterval(uploadTimerRef.current);
    if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current);

    uploadTimerRef.current = window.setInterval(() => {
      setProgressValue((current) => {
        if (current >= 100) return 100;
        const next = Math.min(current + Math.floor(Math.random() * 18) + 9, 100);
        if (next >= 100 && uploadTimerRef.current) {
          window.clearInterval(uploadTimerRef.current);
          uploadTimerRef.current = null;
          completionTimerRef.current = window.setTimeout(() => {
            const now = new Date();
            onUploadComplete({
              id: nanoid(),
              fileName: file.name,
              createdAtMs: now.getTime(),
              uploadedAt: formatTimestamp(now),
              fileSizeLabel: formatBytes(file.size),
              file,
            });
            setStage("result");
          }, 350);
        }
        return next;
      });
    }, 180);
  };

  const handleFileSelection = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    if (!isValidXlsxFile(file)) {
      setSelectedFile(null);
      setFileError("Only .xlsx files are supported in this upload flow.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setSelectedFile(null);
      setFileError("File size must be 10 MB or smaller.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFileError("");
    setSelectedFile(file);
  };

  const handleDialogClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[rgba(15,23,42,0.18)] backdrop-blur-[3px]"
        className="max-w-[min(80vw,700px)] gap-0 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-0 shadow-[0_24px_70px_rgba(15,23,42,0.16)]"
      >
        <DialogTitle className="sr-only">Import staff using excel sheet</DialogTitle>
        <DialogDescription className="sr-only">
          Local UI flow for uploading a user excel file.
        </DialogDescription>

        <div className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#faf7ff_100%)] px-5 py-3.5 text-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[hsl(235,60%,50%)] ring-1 ring-blue-100">
                <UploadCloud className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-[19px] font-bold leading-none tracking-[-0.02em] text-slate-900">Import Staff Using Excel Sheet</p>
                <p className="mt-1 text-[12px] text-slate-500">Add multiple staff members in one go</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDialogClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close bulk upload dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pb-4 pt-3.5 sm:px-5">
          <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-2">
            <div className="grid grid-cols-3 gap-2">
              {stepMeta.map((item, index) => {
                const isComplete = currentStep > item.step;
                const isActive = currentStep === item.step;
                return (
                  <div key={item.step} className="flex items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition",
                          isComplete || isActive
                            ? "bg-[hsl(235,60%,50%)] text-white shadow-[0_8px_18px_rgba(30,35,80,0.18)]"
                            : "bg-slate-200 text-slate-500",
                        )}
                      >
                        {item.step}
                      </div>
                      <span className={cn("text-[13px] font-semibold", isActive || isComplete ? "text-slate-800" : "text-slate-400")}>
                        {item.label}
                      </span>
                    </div>
                    {index < stepMeta.length - 1 ? (
                      <div className={cn("mx-3 h-[2px] flex-1 rounded-full", currentStep > item.step ? "bg-[hsl(235,60%,50%)]" : "bg-slate-200")} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {stage === "choose" ? (
            <div className="mt-3.5 space-y-3.5">
              <div className="rounded-[18px] border border-blue-100/80 bg-[linear-gradient(180deg,rgba(247,249,255,0.95)_0%,rgba(255,255,255,1)_100%)] p-3.5">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[hsl(235,60%,50%)]">
                  <Sparkles className="h-4 w-4" />
                  <span>Please match your column names exactly:</span>
                </div>
                <div className="mt-3 rounded-[16px] border border-slate-100 bg-white p-3.5">
                  <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    {TEMPLATE_HEADERS.map((header, index) => (
                      <div key={header} className="flex items-center gap-2.5 text-[13px] text-slate-600">
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-50 px-1 text-[10px] font-semibold leading-none text-[hsl(235,60%,50%)] ring-1 ring-blue-100">
                          {index + 1}
                        </span>
                        <span>{header}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  handleFileSelection(event.dataTransfer.files);
                }}
                className={cn(
                  "group flex min-h-[142px] w-full flex-col items-center justify-center rounded-[18px] border border-dashed bg-white px-4 text-center transition",
                  dragging
                    ? "border-[hsl(235,60%,50%)] bg-blue-50 shadow-[0_14px_34px_rgba(53,83,233,0.08)]"
                    : selectedFile
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-blue-200 hover:border-[hsl(235,60%,50%)] hover:bg-blue-50/30",
                )}
              >
                {selectedFile ? (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <FileSpreadsheet className="h-6 w-6" />
                    </div>
                    <p className="mt-3 max-w-full truncate text-[15px] font-semibold text-slate-900">{selectedFile.name}</p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      Ready to process | {formatBytes(selectedFile.size)} | XLSX file selected
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedFile(null);
                          setFileError("");
                          if (inputRef.current) inputRef.current.value = "";
                        }}
                        className="h-8 rounded-xl border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Remove
                      </Button>
                      <span className="text-[12px] text-slate-500">Click the card again to replace the file</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <FileSpreadsheet className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-[15px] font-semibold text-slate-900">
                      <span className="text-[hsl(235,60%,50%)]">Click here</span> to pick the file, or drag it inside
                    </p>
                    <p className="mt-1 text-[12px] text-slate-500">Accepts only Excel (.xlsx) files up to 10MB</p>
                  </>
                )}
              </button>

              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                onChange={(event) => handleFileSelection(event.target.files)}
                className="hidden"
              />

              {fileError ? (
                <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
                  {fileError}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 rounded-[16px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-[13px] text-slate-500">
                  <UploadCloud className="h-4 w-4 text-slate-400" />
                  <span>Don&apos;t have a file ready yet?</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadTemplate}
                  className="h-9 rounded-xl border-blue-200 bg-white px-4 text-[13px] font-semibold text-[hsl(235,60%,50%)] hover:bg-blue-50"
                >
                  Get Template
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {stage === "checking" ? (
            <div className="mt-4 px-2 py-6.5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-[hsl(235,60%,50%)]">
                <LoaderCircle className="h-8 w-8 animate-spin" />
              </div>
              <p className="mt-4 text-[21px] font-bold tracking-[-0.02em] text-slate-900">Checking the file contents...</p>
              <p className="mx-auto mt-2 max-w-xl text-[14px] leading-6 text-slate-500">
                We are reading each row to make sure the uploaded columns line up with the user management structure.
              </p>
              <div className="mx-auto mt-5 max-w-lg">
                <Progress value={progressValue} className="h-2 rounded-full bg-slate-200 [&>div]:bg-[hsl(235,60%,50%)]" />
                <p className="mt-2 text-[13px] font-semibold text-slate-700">{progressValue}% completed</p>
                {selectedFile ? (
                  <p className="mt-1.5 text-[13px] text-slate-500">
                    Processing <span className="font-semibold text-slate-700">{selectedFile.name}</span>
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {stage === "result" ? (
            <div className="mt-3.5 space-y-3.5">
              <div className="rounded-[18px] border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Check className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Upload Summary</p>
                      <p className="mt-0.5 text-[20px] font-semibold tracking-[-0.02em] text-slate-900">File Captured Successfully</p>
                    </div>
                  </div>

                </div>

                <div className="space-y-3 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3">
                      <p className="text-[24px] font-semibold leading-none text-emerald-700">--</p>
                      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700/75">Uploaded</p>
                    </div>
                    <div className="rounded-2xl border border-rose-200/80 bg-rose-50/60 px-4 py-3">
                      <p className="text-[24px] font-semibold leading-none text-rose-600">--</p>
                      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-600/75">Failures</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fafcff_100%)] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Captured File</p>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-[16px] font-semibold text-slate-900">{selectedFile?.name || "Selected spreadsheet"}</p>
                       
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-600 sm:min-w-[170px]">
                        <p>Size: <span className="font-semibold text-slate-800">{formatBytes(selectedFile?.size ?? 0)}</span></p>
                        <p className="mt-1">Status: <span className="font-semibold text-[hsl(235,60%,50%)]">Ready for integration</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {stage === "choose" ? (
            <div className="mt-4 rounded-[16px] border border-slate-200 bg-slate-50/80 p-3.5">
              <div className="space-y-2.5">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Remark</p>
                  <input
                    value={remark}
                    onChange={(event) => setRemark(event.target.value)}
                    placeholder="Add a short remark for this upload"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="w-full lg:max-w-[280px]">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workflow</p>
                    <Select value={selectedWorkflow} onValueChange={setSelectedWorkflow}>
                      <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-[13px]">
                        <SelectValue placeholder="Select workflow" />
                      </SelectTrigger>
                      <SelectContent>
                        {WORKFLOW_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDialogClose}
                      className="h-10 rounded-xl border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        if (selectedFile) beginUploadFlow(selectedFile);
                      }}
                      disabled={!selectedFile}
                      className="h-10 rounded-xl bg-[hsl(235,60%,50%)] px-4 text-[13px] font-semibold text-white hover:bg-[hsl(235,60%,45%)]"
                    >
                      <Play className="h-4 w-4" />
                      Process File
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {stage === "result" ? (
            <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-4">
              <Button
                type="button"
                onClick={handleDialogClose}
                className="h-10 rounded-xl bg-[hsl(235,60%,50%)] px-5 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(30,35,80,0.2)] hover:bg-[hsl(235,60%,45%)]"
              >
                <Check className="h-4 w-4" />
                Everything Looks Good
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UserBulkUploadHistorySheet({
  open,
  onOpenChange,
  items,
  dockOffset,
}: UserBulkUploadHistorySheetProps) {
  const sortedItems = useMemo(
    () => [...items].sort((left, right) => right.createdAtMs - left.createdAtMs),
    [items],
  );

  if (!open || typeof document === "undefined") return null;

  const topOffset = dockOffset?.top ?? 0;
  const leftOffset = dockOffset?.left ?? 0;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close bulk import logs"
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 z-40 cursor-default bg-[rgba(15,23,42,0.18)]"
        style={{ top: topOffset, left: leftOffset }}
      />

      <aside
        className="fixed bottom-0 right-0 z-50 border-l border-slate-200 bg-[linear-gradient(180deg,#fafbff_0%,#ffffff_24%)] shadow-[-16px_0_38px_rgba(15,23,42,0.08)]"
        style={{ top: topOffset, width: `min(calc(100vw - ${leftOffset}px), 440px)` }}
      >
        <div className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#faf7ff_100%)] px-5 py-4 text-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div className="pr-6">
            <p className="text-[22px] font-bold tracking-[-0.02em]">Bulk Import Logs</p>
            <p className="mt-1 text-[13px] text-slate-500">Inspect recent uploads created in this browser session</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close bulk import logs"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex h-[calc(100vh-86px)] flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {sortedItems.length === 0 ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-[24px] border border-dashed border-blue-200 bg-white/80 px-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-[hsl(235,60%,50%)]">
                  <FileSpreadsheet className="h-8 w-8" />
                </div>
                <p className="mt-5 text-lg font-semibold text-slate-900">No upload history yet</p>
                <p className="mt-2 max-w-sm text-[13px] leading-6 text-slate-500">
                  Your upload cards will appear here after you complete a bulk upload from the user management screen.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[22px] border border-blue-100 bg-white p-4 shadow-[0_12px_28px_rgba(53,83,233,0.06)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                          <FileSpreadsheet className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-slate-900">{item.fileName}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{item.uploadedAt}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-[hsl(235,60%,50%)]">
                        Session Only
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                      <div className="rounded-[18px] border border-emerald-200 bg-emerald-50/70 p-4">
                        <p className="text-xl font-bold text-emerald-700">{item.fileSizeLabel}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700/80">File Size</p>
                      </div>
                      <div className="rounded-[18px] border border-blue-200 bg-blue-50/70 p-4">
                        <p className="text-xl font-bold text-[hsl(235,60%,50%)]">UI</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(235,60%,50%)]/80">Status</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => downloadFile(item.file, item.fileName)}
                        className="h-10 w-full rounded-xl border-emerald-500 bg-white text-[13px] font-semibold text-emerald-600 hover:bg-emerald-50"
                      >
                        <Download className="h-4 w-4" />
                        Download Original File
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white/90 px-5 py-4 text-center text-[11px] text-slate-500">
            History is tracked locally for this session only. Logs update in real-time.
          </div>
        </div>
      </aside>
    </>,
    document.body,
  );
}
