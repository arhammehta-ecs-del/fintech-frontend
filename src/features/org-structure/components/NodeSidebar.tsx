import { useEffect, useMemo, useRef, useState } from "react";
import { History, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCollapsedNodePath } from "@/features/user-management/utils";
import {
  type PermissionAction,
  type PermissionMatrixSection,
} from "@/features/org-structure/hooks/orgStructureViewModel.utils";
import type { DepartmentSidebarDepartment } from "@/features/org-structure/types";

export type { DepartmentSidebarDepartment };

const ACTIONS: PermissionAction[] = ["checker", "maker", "viewer"];

const formatNodeTypeLabel = (value?: string) => {
  const normalized = (value || "").trim();
  if (!normalized) return "Node";

  return normalized
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const getNodeLevel = (department: DepartmentSidebarDepartment | null) => {
  if (!department) return null;
  if (typeof department.levelCount === "number" && Number.isFinite(department.levelCount)) {
    return department.levelCount;
  }

  const nodeType = (department.nodeType || "").trim().toUpperCase();
  if (nodeType === "ROOT") return 1;

  const nodePath = (department.nodePath || "").trim();
  if (!nodePath) return null;

  const pathSegments = nodePath
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return pathSegments.length || null;
};

function NodePathMarquee({ text }: { text: string }) {
  const MARQUEE_DURATION_SECONDS = 6;
  const MARQUEE_GAP_PX = 24;
  const viewportRef = useRef<HTMLSpanElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [overflowPx, setOverflowPx] = useState(0);
  const [textWidthPx, setTextWidthPx] = useState(0);

  useEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current;
      const label = textRef.current;
      if (!viewport || !label) return;
      const fullTextWidth = Math.ceil(label.scrollWidth);
      const nextOverflow = Math.max(0, Math.ceil(fullTextWidth - viewport.clientWidth));
      setTextWidthPx(fullTextWidth);
      setOverflowPx(nextOverflow);
    };

    measure();
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    if (textRef.current) observer.observe(textRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [text]);

  const shouldAnimate = isHovered && overflowPx > 0;
  const marqueeTravelPx = textWidthPx + MARQUEE_GAP_PX;

  return (
    <span className="mt-2 inline-flex max-w-full items-center gap-1.5" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      {overflowPx > 0 ? (
        <span
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-600 transition hover:border-sky-300 hover:bg-sky-100"
          aria-label="Preview full node path"
          role="img"
        >
          <Info className="h-3 w-3" />
        </span>
      ) : null}
      <span className="inline-flex min-w-0 max-w-full rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold leading-none tracking-normal text-sky-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
        <span ref={viewportRef} className="block max-w-full overflow-hidden whitespace-nowrap">
          <span
            className={shouldAnimate ? "inline-flex items-center whitespace-nowrap will-change-transform" : "inline-flex items-center whitespace-nowrap"}
            style={shouldAnimate
              ? {
                  animation: `org-node-path-marquee ${MARQUEE_DURATION_SECONDS}s linear infinite`,
                  ["--node-path-shift" as string]: `${marqueeTravelPx}px`,
                }
              : undefined}
          >
            <span ref={textRef} className="inline-block whitespace-nowrap antialiased">
              {text}
            </span>
            {overflowPx > 0 ? (
              <span aria-hidden className="inline-flex items-center whitespace-nowrap">
                <span className="inline-block" style={{ width: `${MARQUEE_GAP_PX}px` }} />
                <span className="inline-block whitespace-nowrap antialiased">{text}</span>
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </span>
  );
}

function NodeSidebarContent({
  department,
  permissionSections,
  countsLoading,
  onNavigateToUsers,
  onClose,
  onOpenHistory,
  onRequestStatusChange,
}: {
  department: DepartmentSidebarDepartment | null;
  permissionSections: PermissionMatrixSection[];
  countsLoading: boolean;
  onNavigateToUsers: (input: { nodeName: string; nodePath: string; category: string; subCategory: string; action: PermissionAction }) => void;
  onClose: () => void;
  onOpenHistory: (input?: { nodeName: string; nodePath: string }) => void;
  onRequestStatusChange?: (isActive: boolean) => void;
}) {
  const [showPrevious, setShowPrevious] = useState(false);
  const isUpdateRequest = (department?.pendingRequestType || "").trim().toUpperCase() === "UPDATE";

  useEffect(() => {
    setShowPrevious(false);
  }, [department?.id]);

  const displayDepartment = useMemo(() => {
    if (!department || !isUpdateRequest) return department;
    const source = (showPrevious ? department.pendingOldData : department.pendingNewData) || {};
    const next = { ...department };
    const sourceRecord = typeof source === "object" && source !== null ? (source as Record<string, unknown>) : {};
    const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    const nextName = readString(sourceRecord.nodeName) || readString(sourceRecord.newNodeName);
    const nextType = readString(sourceRecord.nodeType);
    const nextPath = readString(sourceRecord.nodePath) || readString(sourceRecord.targetNodePath);

    if (nextName) next.name = nextName;
    if (nextType) next.nodeType = nextType;
    if (nextPath) next.nodePath = nextPath;

    const levelValue = sourceRecord.levelCount;
    if (typeof levelValue === "number" && Number.isFinite(levelValue)) next.levelCount = levelValue;
    if (typeof levelValue === "string") {
      const parsedLevel = Number(levelValue.trim());
      if (Number.isFinite(parsedLevel)) next.levelCount = parsedLevel;
    }

    const statusValue = typeof sourceRecord.status === "string" ? sourceRecord.status.trim().toUpperCase() : "";
    if (statusValue === "ACTIVE") next.status = "Active";
    if (statusValue === "INACTIVE") next.status = "Inactive";
    return next;
  }, [department, isUpdateRequest, showPrevious]);

  const effectiveStatus = displayDepartment?.status === "Inactive" ? "Inactive" : "Active";
  const isRootDepartment = String(displayDepartment?.nodeType || department?.nodeType || "").trim().toUpperCase() === "ROOT";
  const isStatusToggleLocked = Boolean(department?.isPending) || isUpdateRequest;
  const currentNodeName = (displayDepartment?.name || department?.name || "Organisation").trim() || "Organisation";
  const currentNodeType = formatNodeTypeLabel(displayDepartment?.nodeType || department?.nodeType);
  const currentNodeLevel = getNodeLevel(displayDepartment || department);
  const currentNodePath = (displayDepartment?.nodePath || department?.nodePath || "").trim();
  const formattedNodePath = !isRootDepartment && currentNodePath ? formatCollapsedNodePath(currentNodePath, 3) : "";

  return (
    <div className="flex h-full min-h-full w-full flex-col">
      <style>{"@keyframes org-node-path-marquee{from{transform:translateX(0)}to{transform:translateX(calc(-1 * var(--node-path-shift, 0px)))}}"}</style>
      <div className="shrink-0 border-b border-black/10 px-6 pb-6 pt-4 lg:pt-5">
        <div className="mb-3 flex items-start justify-end gap-2">
          <button
            type="button"
            onClick={() =>
              onOpenHistory({
                nodeName: (displayDepartment?.name || department?.name || "").trim(),
                nodePath: (displayDepartment?.nodePath || department?.nodePath || "").trim(),
              })
            }
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Open organisation history"
            title="View org history"
          >
            <History className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close department sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {currentNodeLevel ? (
              <span className="inline-flex h-7 shrink-0 items-center justify-center rounded-md bg-violet-100 px-2 text-[11px] font-bold text-violet-700">
                L{currentNodeLevel}
              </span>
            ) : null}
            <div className="min-w-0 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-slate-900">
              <span className="break-words">{currentNodeName}</span>
              <span className="ml-2 text-[18px] font-medium text-slate-500">({currentNodeType})</span>
            </div>
          </div>
          {formattedNodePath ? <NodePathMarquee text={formattedNodePath} /> : null}
        </div>

        {!isRootDepartment ? (
          <div className="mt-4 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm">
            <button
              type="button"
              disabled={isStatusToggleLocked}
              onClick={() => onRequestStatusChange?.(true)}
              className={cn(
                "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
                effectiveStatus === "Active"
                  ? "bg-[#3b5bdb] text-white shadow-[0_4px_12px_rgba(59,91,219,0.35)]"
                  : "text-slate-500 hover:text-slate-700",
                "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-40",
              )}
            >
              Active
            </button>
            <button
              type="button"
              disabled={isStatusToggleLocked}
              onClick={() => onRequestStatusChange?.(false)}
              className={cn(
                "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
                effectiveStatus === "Inactive"
                  ? "bg-[#3b5bdb] text-white shadow-[0_4px_12px_rgba(59,91,219,0.35)]"
                  : "text-slate-500 hover:text-slate-700",
                "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-40",
              )}
            >
              Inactive
            </button>
          </div>
        ) : null}
        {isUpdateRequest ? (
          <button
            type="button"
            onClick={() => setShowPrevious((current) => !current)}
            className={cn(
              "mt-3 rounded-full border px-3 py-1 text-xs font-semibold transition",
              showPrevious
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-emerald-300 bg-emerald-50 text-emerald-700",
            )}
          >
            {showPrevious ? "Show Updated" : "Show Previous"}
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {countsLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4 text-xs text-slate-500">Loading access counts...</div>
        ) : permissionSections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-5 text-sm text-slate-500">
            No access counts available for this node.
          </div>
        ) : (
          <div className="space-y-4">
            {permissionSections.map((section) => (
              <div key={section.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60">
                <div className="border-b border-slate-200 bg-white/70 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {section.label}
                  </p>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_64px_64px_64px] gap-3 border-b border-slate-200 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <span>Access Group</span>
                  <span className="text-center">Checker</span>
                  <span className="text-center">Maker</span>
                  <span className="text-center">Viewer</span>
                </div>
                {section.rows.map((row) => (
                  <div
                    key={`${section.key}-${row.key}`}
                    className="grid grid-cols-[minmax(0,1fr)_64px_64px_64px] items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                  >
                    <span className="pr-2 text-sm font-medium leading-5 text-slate-700 break-words">{row.label}</span>
                    {ACTIONS.map((action) => (
                      <button
                        type="button"
                        key={`${row.label}-${action}`}
                        disabled={row.counts[action] === 0}
                        onClick={() => {
                          if (!department?.name || !department?.nodePath || row.counts[action] === 0) return;
                          onNavigateToUsers({
                            nodeName: displayDepartment?.name || department.name,
                            nodePath: displayDepartment?.nodePath || department.nodePath,
                            category: row.categoryKey,
                            subCategory: row.key,
                            action,
                          });
                        }}
                        className={cn(
                          "mx-auto inline-flex min-h-7 min-w-[32px] items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold transition",
                          row.counts[action] === 0
                            ? "cursor-not-allowed border-slate-200 bg-white text-slate-500/70"
                            : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
                        )}
                      >
                        {row.counts[action] === 0 ? "-" : row.counts[action]}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function NodeSidebar({
  open,
  onOpenChange,
  department,
  permissionSections,
  countsLoading,
  onNavigateToUsers,
  onOpenHistory,
  onRequestStatusChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: DepartmentSidebarDepartment | null;
  permissionSections: PermissionMatrixSection[];
  countsLoading: boolean;
  onNavigateToUsers: (input: { nodeName: string; nodePath: string; category: string; subCategory: string; action: PermissionAction }) => void;
  onOpenHistory: (input?: { nodeName: string; nodePath: string }) => void;
  onRequestStatusChange?: (department: DepartmentSidebarDepartment, isActive: boolean) => void;
}) {
  return (
    <aside
      className={cn(
        "h-full min-w-0 self-stretch overflow-hidden border-l border-slate-200 bg-white transition-[opacity,transform] duration-300",
        open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-8 opacity-0",
      )}
      style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      aria-hidden={!open}
    >
      <NodeSidebarContent
        department={department}
        permissionSections={permissionSections}
        countsLoading={countsLoading}
        onNavigateToUsers={onNavigateToUsers}
        onClose={() => onOpenChange(false)}
        onOpenHistory={onOpenHistory}
        onRequestStatusChange={
          department && onRequestStatusChange
            ? (isActive) => onRequestStatusChange(department, isActive)
            : undefined
        }
      />
    </aside>
  );
}

export default NodeSidebar;
