import React from "react";
import { X, CheckCircle2, XCircle, Building2, MapPin, Layers3, Briefcase, Boxes, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgNode } from "@/contexts/AppContext";

type PendingNodePopupProps = {
  open: boolean;
  node: OrgNode | null;
  onClose: () => void;
  onApprove: (node: OrgNode) => void;
  onReject: (node: OrgNode) => void;
};

const getNodeIcon = (nodeType: string) => {
  const normalized = nodeType.trim().toUpperCase();
  if (normalized === "ROOT") return Building2;
  if (normalized === "DIVISION") return Layers3;
  if (normalized === "LOCATION") return MapPin;
  if (normalized === "DEPARTMENT") return Briefcase;
  return Boxes;
};

export function PendingNodePopup({ open, node, onClose, onApprove, onReject }: PendingNodePopupProps) {
  if (!open || !node) return null;

  const Icon = getNodeIcon(node.nodeType);

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
        <div className="relative bg-amber-50/50 px-6 pb-6 pt-8">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-400 transition hover:bg-white hover:text-slate-600 shadow-sm"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_8px_20px_rgba(245,158,11,0.15)]">
              <Icon className="h-7 w-7 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{node.name}</h2>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-700">
                Pending Approval
              </span>
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-4 px-6 py-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-white p-1.5 shadow-sm">
                <Info size={14} className="text-slate-400" />
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Node Type</label>
                  <p className="text-sm font-semibold text-slate-700">{node.nodeType}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Node Path</label>
                  <p className="font-mono text-[11px] text-slate-500 break-all">{node.nodePath}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <p>Approving this node will make it visible to all users.</p>
          </div>
        </div>

        {/* Actions Section */}
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50/30 px-6 py-5">
          <button
            onClick={() => onReject(node)}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-rose-600 hover:border-rose-200 shadow-sm"
          >
            <XCircle size={16} />
            Reject
          </button>
          <button
            onClick={() => onApprove(node)}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 hover:shadow-lg shadow-md active:scale-[0.98]"
          >
            <CheckCircle2 size={16} />
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
