import React, { useState } from "react";
import {
  Building2,
  Calendar,
  ChevronRight,
  Edit2,
  IdCard,
  Mail,
  Maximize2,
  Minimize2,
  Phone,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { AppUser } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import {
  formatDateLabel,
  getAvatarColor,
  getInitials,
} from "@/features/user-management/utils";

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatKey = (key: string) =>
  key.split("_").map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");

// Group accessDetails by nodeName, then by roleCategory
type GroupedByNode = Record<string, {
  nodeName: string;
  nodeType: string; // derived from nodePath depth or fallback ""
  categories: Record<string, Array<{ roleSubCategory: string; roleName: string }>>;
}>;

function groupByNode(items: NonNullable<AppUser["accessDetails"]>): GroupedByNode {
  const result: GroupedByNode = {};
  for (const item of items) {
    const key = (item.nodeName || item.nodePath || "Unknown").trim();
    if (!result[key]) {
      result[key] = { nodeName: item.nodeName || item.nodePath || "Unknown", nodeType: "", categories: {} };
    }
    const cat = item.roleCategory || "OTHER";
    if (!result[key].categories[cat]) {
      result[key].categories[cat] = [];
    }
    result[key].categories[cat].push({
      roleSubCategory: item.roleSubCategory,
      roleName: item.roleName,
    });
  }
  return result;
}

const CATEGORY_ORDER = ["TRANSACTIONAL", "OPERATIONAL", "SYSTEM_ACCESS"];

// ── Sub-components ─────────────────────────────────────────────────────────────

function BasicRow({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <div className="mt-0.5 rounded-lg bg-slate-100/60 p-2 text-slate-400">
        <Icon size={13} />
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-800">{value || "—"}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

// Branch palette — same as OrgCard / StepSelectNode
const BRANCH_EDGE = ["bg-orange-500", "bg-sky-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-cyan-500"];
const BRANCH_BADGE = [
  "bg-orange-100 text-orange-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
];
const BRANCH_BORDER = [
  "border-orange-100",
  "border-sky-100",
  "border-emerald-100",
  "border-rose-100",
  "border-amber-100",
  "border-cyan-100",
];

function NodeAccessCard({
  nodeName,
  nodeIndex,
  categories,
  isPrimary,
}: {
  nodeName: string;
  nodeIndex: number;
  categories: Record<string, Array<{ roleSubCategory: string; roleName: string }>>;
  isPrimary: boolean;
}) {
  const paletteIdx = nodeIndex % BRANCH_EDGE.length;
  const edgeCls   = isPrimary ? "bg-blue-500"              : BRANCH_EDGE[paletteIdx];
  const badgeCls  = isPrimary ? "bg-blue-100 text-blue-700" : BRANCH_BADGE[paletteIdx];
  const borderCls = isPrimary ? "border-blue-100"           : BRANCH_BORDER[paletteIdx];

  const presentCats = CATEGORY_ORDER.filter((cat) => (categories[cat]?.length ?? 0) > 0);

  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm", borderCls)}>
      {/* Left accent edge */}
      <span className={cn("absolute left-0 top-[10%] h-[80%] w-[4px] rounded-r-full", edgeCls)} />

      {/* Node header */}
      <div className="mb-3 flex items-center gap-3 pl-1">
        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", badgeCls)}>
          {nodeIndex + 1}
        </div>
        <div className="text-sm font-semibold text-slate-800">{nodeName}</div>
      </div>

      {/* Permissions by category */}
      <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3 pl-4">
        {presentCats.length === 0 ? (
          <div className="text-xs text-slate-400">No permissions configured.</div>
        ) : presentCats.map((cat) => {
          const rows = categories[cat] ?? [];
          return (
            <div key={cat} className="space-y-2">
              <div className="border-b border-slate-200 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                {formatKey(cat)}
              </div>
              {rows.map((row, i) => {
                const lower = (row.roleName || "").toLowerCase();
                const rightLabel = lower.endsWith("manager") ? "Manager"
                  : lower.endsWith("user") ? "User"
                  : "Viewer";
                const dotCls  = lower.endsWith("manager") ? "bg-violet-500"
                  : lower.endsWith("user") ? "bg-amber-400" : "bg-slate-400";
                const textCls = lower.endsWith("manager") ? "text-violet-700"
                  : lower.endsWith("user") ? "text-amber-700" : "text-slate-500";
                const bgCls   = lower.endsWith("manager") ? "bg-violet-50"
                  : lower.endsWith("user") ? "bg-amber-50" : "bg-slate-100";
                return (
                  <div key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">{formatKey(row.roleSubCategory || "")}</span>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium", bgCls, textCls)}>
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotCls)} />
                      {rightLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function UserManagePreview({ member }: { member: AppUser }) {
  const [activeTab, setActiveTab] = useState<"basic" | "access">("basic");
  const [isExpanded, setIsExpanded] = useState(true);

  const rawJoiningDate = member.basicDetails?.companyOnboardingDate || member.onboardingDate || "";
  const formattedJoiningDate = formatDateLabel(rawJoiningDate);

  const userData = {
    name: member.basicDetails?.name || member.name || "-",
    email: member.basicDetails?.email || member.email || "-",
    phone: member.basicDetails?.phone || member.phone || "-",
    joiningDate: formattedJoiningDate === "-" && rawJoiningDate ? rawJoiningDate : formattedJoiningDate,
    designation: member.basicDetails?.designation || member.designation || "-",
    department: member.department || "-",
    employeeId: member.basicDetails?.employeeId || member.employeeId || "-",
    reportingManager: member.basicDetails?.reportingManager || member.manager?.name || "-",
    reportingManagerEmail: member.manager?.email || member.basicDetails?.reportingManager || "",
  };

  const avatar = getAvatarColor(userData.name);

  const accessDetails = member.accessDetails ?? [];
  const primaryItems = accessDetails.filter((a) => a.accessType === "PRIMARY");
  const secondaryItems = accessDetails.filter((a) => a.accessType !== "PRIMARY");

  const primaryByNode = groupByNode(primaryItems);
  const secondaryByNode = groupByNode(secondaryItems);

  const isEmpty = accessDetails.length === 0;

  // Status badge
  const statusCls =
    member.status === "Inactive" ? "border-rose-100 bg-rose-50 text-rose-600"
      : member.status === "Pending" ? "border-amber-100 bg-amber-50 text-amber-600"
        : "border-emerald-100 bg-emerald-50 text-emerald-600";

  const statusDot =
    member.status === "Inactive" ? "bg-rose-500"
      : member.status === "Pending" ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="flex h-full flex-col bg-white">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 px-6 pt-6 pb-0">
        {/* Name + avatar row — no EDIT here so it doesn't clash with dialog X */}
        <div className="flex items-center gap-4 pr-8">
          <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold", avatar.bg, avatar.text)}>
            {getInitials(userData.name)}
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{userData.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500">{userData.designation}</span>
              {userData.designation !== "-" && userData.department !== "-" && (
                <span className="text-slate-300">•</span>
              )}
              <span className="text-xs font-medium text-slate-500">{userData.department}</span>
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", statusCls)}>
                <span className={cn("h-1 w-1 rounded-full", statusDot)} />
                {member.status || "Active"}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs row — EDIT lives here, well away from the dialog X button */}
        <div className="mt-4 flex items-center gap-6">
          {(["basic", "access"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative pb-3 text-xs font-black uppercase tracking-widest transition-colors",
                activeTab === tab ? "text-[rgb(53,83,233)]" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {tab === "basic" ? "Basic Details" : "Access Rights"}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[rgb(53,83,233)]" />
              )}
            </button>
          ))}

          <button
            type="button"
            className="ml-auto mb-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <Edit2 size={13} />
            EDIT
          </button>
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* BASIC DETAILS */}
        {activeTab === "basic" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">General Information</span>
              </div>
              <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <BasicRow icon={Mail} label="Official Email" value={userData.email} />
                <BasicRow icon={Phone} label="Mobile Number" value={userData.phone} />
              </div>
              <div className="grid grid-cols-1 divide-y divide-slate-100 border-t border-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <BasicRow icon={Calendar} label="Joining Date" value={userData.joiningDate} />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Reporting Structure</span>
              </div>
              <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <BasicRow
                  icon={UserCheck}
                  label="Reporting Manager"
                  value={userData.reportingManager}
                  sub={userData.reportingManagerEmail !== userData.reportingManager ? userData.reportingManagerEmail : ""}
                />
                <BasicRow
                  icon={Building2}
                  label="Current Designation"
                  value={userData.designation}
                  sub={userData.department !== "-" ? `${userData.department} Department` : ""}
                />
              </div>
            </div>
          </div>
        )}

        {/* ACCESS RIGHTS */}
        {activeTab === "access" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* Toggle button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-[rgb(53,83,233)] hover:text-[rgb(53,83,233)]"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>

            {isEmpty ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-16 text-center">
                <ShieldCheck size={28} className="mb-3 text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">No access rights configured</p>
                <p className="mt-1 text-xs text-slate-400">Assign roles to this user via the onboarding flow.</p>
              </div>
            ) : isExpanded ? (
              <div className="space-y-6">
                {/* PRIMARY — expanded */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Primary Access</span>
                  </div>
                  {Object.keys(primaryByNode).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-sm text-slate-400">
                      No primary access configured.
                    </div>
                  ) : (
                    Object.entries(primaryByNode).map(([key, group], idx) => (
                      <NodeAccessCard key={key} nodeName={group.nodeName} nodeIndex={idx} categories={group.categories} isPrimary />
                    ))
                  )}
                </div>

                {/* SECONDARY — expanded */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Secondary Access</span>
                  </div>
                  {Object.keys(secondaryByNode).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-sm text-slate-400">
                      No secondary access configured.
                    </div>
                  ) : (
                    Object.entries(secondaryByNode).map(([key, group], idx) => (
                      <NodeAccessCard key={key} nodeName={group.nodeName} nodeIndex={idx} categories={group.categories} isPrimary={false} />
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* COLLAPSED — matches StepReviewSubmit collapsed style */
              <div className="space-y-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3">

                {/* Primary collapsed */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Primary Access</span>
                  </div>
                  {Object.keys(primaryByNode).length === 0 ? (
                    <div className="text-xs text-slate-400">No primary access configured.</div>
                  ) : (
                    Object.entries(primaryByNode).map(([key, group], idx) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setIsExpanded(true)}
                        className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-slate-700">{group.nodeName}</div>
                        </div>
                        <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
                      </button>
                    ))
                  )}
                </div>

                {/* Secondary collapsed */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Secondary Access</span>
                  </div>
                  {Object.keys(secondaryByNode).length === 0 ? (
                    <div className="text-xs text-slate-400">No secondary access configured.</div>
                  ) : (
                    Object.entries(secondaryByNode).map(([key, group], idx) => {
                      const pi = idx % BRANCH_BADGE.length;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setIsExpanded(true)}
                          className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                        >
                          <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", BRANCH_BADGE[pi])}>
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-slate-700">{group.nodeName}</div>
                          </div>
                          <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default UserManagePreview;
