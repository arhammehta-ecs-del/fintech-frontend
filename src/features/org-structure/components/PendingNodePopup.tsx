import { useEffect, useState } from "react";
import { X, CheckCircle2, XCircle, Building2, MapPin, Layers3, Briefcase, Boxes, Info, User, Mail, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgNode } from "@/contexts/AppContext";
import { Textarea } from "@/components/ui/textarea";

type PendingNodePopupProps = {
  open: boolean;
  node: OrgNode | null;
  onClose: () => void;
  onApprove: (node: OrgNode, remark: string) => void;
  onReject: (node: OrgNode, remark: string) => void;
};

const getNodeIcon = (nodeType: string) => {
  const normalized = nodeType.trim().toUpperCase();
  if (normalized === "ROOT") return Building2;
  if (normalized === "DIVISION") return Layers3;
  if (normalized === "LOCATION") return MapPin;
  if (normalized === "DEPARTMENT") return Briefcase;
  return Boxes;
};

const formatRequestedAtToIst = (value?: string) => {
  if (!value?.trim()) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(parsed);
};

const DUMMY_REQUEST_INFO = {
  name: "Arham Vipul Mehta",
  email: "arham.mehta@example.com",
  requestedAt: "2026-04-29T10:13:00Z",
};
const REMARK_MAX_LENGTH = 100;

export function PendingNodePopup({ open, node, onClose, onApprove, onReject }: PendingNodePopupProps) {
  const [remark, setRemark] = useState("");
  const [remarkError, setRemarkError] = useState("");

  useEffect(() => {
    if (open) {
      setRemark("");
      setRemarkError("");
    }
  }, [open, node?.id]);

  if (!open || !node) return null;

  const Icon = getNodeIcon(node.nodeType);
  const requesterName = node.requestedByName?.trim() || DUMMY_REQUEST_INFO.name;
  const requesterEmail = node.requestedByEmail?.trim() || DUMMY_REQUEST_INFO.email;
  const requestedOn = formatRequestedAtToIst(node.requestedAt || DUMMY_REQUEST_INFO.requestedAt);
  const nodePathSegments = node.nodePath.split(".").filter(Boolean);

  const validateAndRun = (action: "approve" | "reject") => {
    const cleanedRemark = remark.trim();
    if (!cleanedRemark) {
      setRemarkError("Remark is required before submitting this action.");
      return;
    }

    setRemarkError("");
    if (action === "approve") {
      onApprove(node, cleanedRemark);
      return;
    }
    onReject(node, cleanedRemark);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />

      {/* Content */}
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] animate-in zoom-in-95 fade-in duration-300">
        {/* Header Section */}
        <div className="relative bg-amber-50/50 px-6 pb-5 pt-5">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-400 transition hover:bg-white hover:text-slate-600 shadow-sm"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center gap-2.5 text-center">
            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.13em] text-amber-700">
              New Node Approval
            </span>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-[0_6px_16px_rgba(245,158,11,0.14)]">
              <Icon className="h-6 w-6 text-amber-500" />
            </div>
            <h2 className="text-[2rem] font-bold leading-none tracking-tight text-slate-900">{node.name}</h2>
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-4 px-6 py-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">Node Details</p>
            </div>
            <div className="space-y-2.5">
              <div className="grid grid-cols-[18px_96px_1fr] items-center gap-2 text-sm">
                <Info size={14} className="text-slate-400" />
                <span className="text-slate-500">Node Type</span>
                <span className="font-semibold text-slate-900">{node.nodeType}</span>
              </div>
              <div className="grid grid-cols-[18px_96px_1fr] items-center gap-2 text-sm">
                <Info size={14} className="text-slate-400" />
                <span className="text-slate-500">Node Path</span>
                <span className="font-mono text-[12px] font-semibold text-slate-700 break-words">
                  {nodePathSegments.length > 0
                    ? nodePathSegments.map((segment, index) => (
                      <span key={`${segment}-${index}`}>
                        {segment}
                        {index < nodePathSegments.length - 1 ? "." : ""}
                        <wbr />
                      </span>
                    ))
                    : node.nodePath}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Initiator Info</p>
            <div className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed">
              <div className="flex items-center gap-2">
                <User size={13} className="shrink-0 text-slate-400" />
                <p className="truncate text-slate-600">{requesterName}</p>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={13} className="shrink-0 text-slate-400" />
                <p className="truncate text-slate-500">{requesterEmail}</p>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 size={13} className="shrink-0 text-slate-400" />
                <p className="text-slate-500">{requestedOn}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3.5 py-2 text-[11px] text-slate-500">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <p>Approving this node will add it to the Organization Structure.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Remark</label>
              <span className={cn("text-[11px] tabular-nums text-slate-500", remark.length >= REMARK_MAX_LENGTH && "font-semibold text-amber-600")}>
                {remark.length}/{REMARK_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              value={remark}
              onChange={(event) => {
                setRemark(event.target.value);
                if (remarkError && event.target.value.trim()) {
                  setRemarkError("");
                }
              }}
              maxLength={REMARK_MAX_LENGTH}
              placeholder="Enter approval or rejection remark"
              className={cn("min-h-[96px] resize-none", remarkError ? "border-rose-300 focus-visible:ring-rose-400" : "")}
            />
            {remarkError ? <p className="text-xs font-medium text-rose-600">{remarkError}</p> : null}
          </div>
        </div>

        {/* Actions Section */}
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50/30 px-6 py-5">
          <button
            onClick={() => validateAndRun("reject")}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-rose-600 hover:border-rose-200 shadow-sm"
          >
            <XCircle size={16} />
            Reject
          </button>
          <button
            onClick={() => validateAndRun("approve")}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#3553E9] py-2.5 text-sm font-bold text-white transition hover:bg-[#2f49cf] hover:shadow-lg shadow-md active:scale-[0.98]"
          >
            <CheckCircle2 size={16} />
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
