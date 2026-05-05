import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronRight,
  Eye,
  IdCard,
  Mail,
  Maximize2,
  Minimize2,
  Pencil,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import type { AppUser } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDateLabel,
  getAvatarColor,
  getInitials,
} from "@/features/user-management/utils";
import { getPermissionActionLabelFromRoleName } from "@/features/user-management/roleLabels";

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatKey = (key: string) =>
  key.split("_").map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");

const formatDesignation = (value?: string) => {
  const cleaned = (value || "").trim();
  if (!cleaned || cleaned === "-") return "Not available";
  const upper = cleaned.toUpperCase();
  const acronymMap: Record<string, string> = {
    CEO: "CEO",
    CTO: "CTO",
    CFO: "CFO",
    COO: "COO",
    CMO: "CMO",
    CHRO: "CHRO",
    VP: "VP",
  };
  if (acronymMap[upper]) return acronymMap[upper];
  return cleaned
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const cleanDisplayValue = (value?: string) => {
  const cleaned = (value || "").trim();
  return cleaned && cleaned !== "-" ? cleaned : "";
};

const displayOrFallback = (value: string | undefined, fallback: string) => {
  const cleaned = (value || "").trim();
  const placeholderValues = new Set(["-", "n/a", "na", "not available", "not available.", "none"]);
  return cleaned && !placeholderValues.has(cleaned.toLowerCase()) ? cleaned : fallback;
};

const pickFirst = (obj: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const formatToIst = (value?: string) => {
  if (!value?.trim()) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(parsed);
};

const formatLooseDateLabel = (value?: string) => {
  const cleaned = (value || "").trim();
  if (!cleaned) return "-";

  const slashMatch = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(parsed);
    }
  }

  const dashMatch = cleaned.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashMatch) {
    const [, day, month, year] = dashMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(parsed);
    }
  }

  const fallback = formatDateLabel(cleaned);
  return fallback === "-" ? cleaned : fallback;
};

const INITIATOR_FALLBACK = {
  name: "Super Admin",
  email: "admin@globaltech.com",
  initiatedAt: "2026-04-28T12:36:00.615Z",
};

const DEMO_SECONDARY_ACCESS: NonNullable<AppUser["accessDetails"]> = [
  {
    roleCategory: "SYSTEM_ACCESS",
    roleSubCategory: "ORG_STR",
    roleName: "Org Structure Viewer",
    nodeName: "Head Office",
    nodePath: "GLOBALTECH.HEAD_OFFICE",
    accessType: "SECONDARY",
  },
  {
    roleCategory: "TRANSACTIONAL",
    roleSubCategory: "ACCOUNTS",
    roleName: "Accounts User",
    nodeName: "Finance Node",
    nodePath: "GLOBALTECH.FINANCE.NODE",
    accessType: "SECONDARY",
  },
  {
    roleCategory: "OPERATIONAL",
    roleSubCategory: "MASTER",
    roleName: "Master Viewer",
    nodeName: "Operations Node",
    nodePath: "GLOBALTECH.OPERATIONS.NODE",
    accessType: "SECONDARY",
  },
];

// Group accessDetails by nodeName, then by roleCategory
type GroupedByNode = Record<string, {
  nodeName: string;
  nodeType: string; // derived from nodePath depth or fallback ""
  parentSubtitle: string;
  categories: Record<string, Array<{ roleSubCategory: string; roleName: string }>>;
}>;

const formatPathSegment = (segment: string) =>
  segment
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getParentSubtitleFromPath = (nodePath?: string) => {
  const rawSegments = (nodePath || "")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (rawSegments.length <= 1) return "";
  const formattedSegments = rawSegments.map(formatPathSegment);
  const parentSegments = formattedSegments.slice(0, -1);
  if (parentSegments.length === 0) return "";
  const trimmedParents = parentSegments.length > 1 ? parentSegments.slice(1) : parentSegments;
  return trimmedParents.join(" > ");
};

function groupByNode(items: NonNullable<AppUser["accessDetails"]>): GroupedByNode {
  const result: GroupedByNode = {};
  for (const item of items) {
    const key = (item.nodePath || item.nodeName || "Unknown").trim();
    if (!result[key]) {
      result[key] = {
        nodeName: item.nodeName || item.nodePath || "Unknown",
        nodeType: "",
        parentSubtitle: getParentSubtitleFromPath(item.nodePath),
        categories: {},
      };
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

// Branch palette — same as OrgCard / StepSelectNode
const BRANCH_EDGE_BORDER = [
  "!border-l-orange-500",
  "!border-l-sky-500",
  "!border-l-emerald-500",
  "!border-l-rose-500",
  "!border-l-amber-500",
  "!border-l-cyan-500",
];
const BRANCH_BADGE = [
  "bg-orange-100 text-orange-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
];
const BRANCH_HOVER = [
  "hover:border-orange-300 hover:bg-orange-50/70",
  "hover:border-sky-300 hover:bg-sky-50/70",
  "hover:border-emerald-300 hover:bg-emerald-50/70",
  "hover:border-rose-300 hover:bg-rose-50/70",
  "hover:border-amber-300 hover:bg-amber-50/70",
  "hover:border-cyan-300 hover:bg-cyan-50/70",
];

const getPaletteIndex = (nodeIndex: number) => nodeIndex % BRANCH_BADGE.length;

const getNodeEdgeBorderClass = (nodeIndex: number, isPrimary: boolean) =>
  isPrimary ? "!border-l-indigo-500" : BRANCH_EDGE_BORDER[getPaletteIndex(nodeIndex)];

const getNodeBadgeClass = (nodeIndex: number, isPrimary: boolean) =>
  isPrimary ? "bg-indigo-100 text-indigo-700" : BRANCH_BADGE[getPaletteIndex(nodeIndex)];

const getNodeHoverClass = (nodeIndex: number, isPrimary: boolean) =>
  isPrimary ? "hover:border-indigo-300 hover:bg-indigo-50/60" : BRANCH_HOVER[getPaletteIndex(nodeIndex)];

function NodeAccessCard({
  nodeName,
  parentSubtitle,
  nodeIndex,
  categories,
  isPrimary,
  onClose,
}: {
  nodeName: string;
  parentSubtitle?: string;
  nodeIndex: number;
  categories: Record<string, Array<{ roleSubCategory: string; roleName: string }>>;
  isPrimary: boolean;
  onClose?: () => void;
}) {
  const edgeCls = getNodeEdgeBorderClass(nodeIndex, isPrimary);
  const badgeCls = getNodeBadgeClass(nodeIndex, isPrimary);
  const badgeLabel = `${isPrimary ? "P" : "S"}${nodeIndex + 1}`;

  const presentCats = CATEGORY_ORDER.filter((cat) => (categories[cat]?.length ?? 0) > 0);
  const getBadgeStyle = (label: string) => {
    if (label === "Checker") return "bg-violet-50 text-violet-700";
    if (label === "Maker") return "bg-amber-50 text-amber-700";
    return "bg-slate-100 text-slate-600";
  };

  const getBadgeIcon = (label: string) => {
    if (label === "Checker") return ShieldCheck;
    if (label === "Maker") return Pencil;
    return Eye;
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-l-[4px] bg-white p-4",
        edgeCls,
        isPrimary
          ? "border-slate-200 bg-white shadow-sm"
          : "border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]",
      )}
    >
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label={`Close ${nodeName}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {/* Node header */}
      <div className="mb-3 flex items-center gap-3 pl-1">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", badgeCls)}>
          {badgeLabel}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[18px] font-semibold leading-tight text-slate-800">{nodeName}</div>
          {parentSubtitle ? <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{parentSubtitle}</div> : null}
        </div>
      </div>

      {/* Permissions by category */}
      <div className="space-y-3 rounded-xl bg-slate-50/30 p-3 pl-4">
        {presentCats.length === 0 ? (
          <div className="text-xs text-slate-400">No permissions assigned.</div>
        ) : presentCats.map((cat) => {
          const rows = categories[cat] ?? [];
          const groupedRows = rows.reduce<Map<string, Set<string>>>((acc, row) => {
            const key = row.roleSubCategory || "UNKNOWN";
            const labels = acc.get(key) ?? new Set<string>();
            labels.add(getPermissionActionLabelFromRoleName(row.roleName || "Viewer"));
            acc.set(key, labels);
            return acc;
          }, new Map());

          if (cat === "SYSTEM_ACCESS" && groupedRows.has("USER_MANAGEMENT")) {
            const labels = groupedRows.get("USER_MANAGEMENT");
            if (labels) {
              labels.add("Checker");
              labels.add("Maker");
              labels.add("Viewer");
            }
          }

          return (
            <div key={cat} className="space-y-2">
              <div className="border-b border-slate-200 pb-1 text-[11px] font-black uppercase tracking-widest text-slate-500">
                {formatKey(cat)}
              </div>
              {Array.from(groupedRows.entries()).map(([roleSubCategory, labels], i) => {
                const orderedLabels = ["Checker", "Maker", "Viewer"].filter((label) => labels.has(label));
                return (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-7 text-[15px] leading-[1.35]">
                    <span className="min-w-0 truncate pt-0.5 pr-1 font-medium text-slate-600">{formatKey(roleSubCategory)}</span>
                    <span className="flex max-w-[360px] flex-wrap justify-end gap-2">
                      {orderedLabels.map((label) => {
                        const BadgeIcon = getBadgeIcon(label);
                        return (
                          <span
                            key={`${roleSubCategory}-${label}`}
                            className={cn("inline-flex min-w-[96px] items-center justify-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium", getBadgeStyle(label))}
                          >
                            <BadgeIcon className="h-3.5 w-3.5 shrink-0" />
                            {label}
                          </span>
                        );
                      })}
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

export function UserManagePreview({
  member,
  onApprovePending,
  onRejectPending,
  onToggleActiveStatus,
}: {
  member: AppUser;
  onApprovePending?: (member: AppUser, remark?: string) => void;
  onRejectPending?: (member: AppUser, remark?: string) => void;
  onToggleActiveStatus?: (member: AppUser, isActive: boolean) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [collapsedFocusedKey, setCollapsedFocusedKey] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<"approve" | "reject" | null>(null);
  const [pendingRemark, setPendingRemark] = useState("");
  const [remarkTouched, setRemarkTouched] = useState(false);
  const remarkCardRef = useRef<HTMLDivElement | null>(null);
  const remarkInputRef = useRef<HTMLTextAreaElement | null>(null);
  const memberRecord = member as unknown as Record<string, unknown>;
  const basicDetailsRecord =
    typeof memberRecord.basicDetails === "object" && memberRecord.basicDetails !== null
      ? (memberRecord.basicDetails as Record<string, unknown>)
      : {};

  const rawJoiningDate = member.basicDetails?.companyOnboardingDate || member.onboardingDate || "";
  const formattedJoiningDate = formatDateLabel(rawJoiningDate);
  const rawCreatedAt = pickFirst(memberRecord, ["createdAt"]) || pickFirst(basicDetailsRecord, ["createdAt"]);
  const formattedCreatedAt = formatLooseDateLabel(rawCreatedAt);

  const userData = {
    name: displayOrFallback(member.basicDetails?.name || member.name, "Demo User"),
    email: displayOrFallback(member.basicDetails?.email || member.email, "demo.user@globaltech.com"),
    phone: displayOrFallback(member.basicDetails?.phone || member.phone, "9000000000"),
    joiningDate: displayOrFallback(
      formattedJoiningDate === "-" && rawJoiningDate ? rawJoiningDate : formattedJoiningDate,
      "01 Mar 2024",
    ),
    createdAt: displayOrFallback(formattedCreatedAt === "-" && rawCreatedAt ? rawCreatedAt : formattedCreatedAt, "01 Mar 2024"),
    designation: displayOrFallback(member.basicDetails?.designation || member.designation, "Developer"),
    department: displayOrFallback(member.department, "General"),
    employeeId: displayOrFallback(member.basicDetails?.employeeId || member.employeeId, "EMP-0000"),
    reportingManager: displayOrFallback(
      member.basicDetails?.reportingManagerName || member.basicDetails?.reportingManager || member.manager?.name,
      "Amit Sharma",
    ),
    reportingManagerEmail: displayOrFallback(
      member.basicDetails?.reportingManagerEmail || member.manager?.email || pickFirst(basicDetailsRecord, ["reportingManagerEmail"]),
      "amit.sharma@globaltech.com",
    ),
  };

  const formattedDesignation = formatDesignation(userData.designation);
  const formattedDepartment = cleanDisplayValue(userData.department);

  const initiatorName =
    pickFirst(memberRecord, ["requestedByName", "requestedBy", "initiatorName", "requesterName", "createdByName"]) ||
    pickFirst(basicDetailsRecord, ["requestedByName", "requestedBy", "initiatorName", "requesterName", "createdByName"]);
  const initiatorEmail =
    pickFirst(memberRecord, ["requestedByEmail", "initiatorEmail", "requesterEmail", "createdByEmail"]) ||
    pickFirst(basicDetailsRecord, ["requestedByEmail", "initiatorEmail", "requesterEmail", "createdByEmail"]);
  const initiatedOnRaw =
    pickFirst(memberRecord, ["requestedAt", "initiatedAt", "initiatedDate", "createdAt", "requestedOn", "requestDate"]) ||
    pickFirst(basicDetailsRecord, ["requestedAt", "initiatedAt", "initiatedDate", "createdAt", "requestedOn", "requestDate"]);
  const resolvedInitiatorName = initiatorName || INITIATOR_FALLBACK.name;
  const resolvedInitiatorEmail = initiatorEmail || INITIATOR_FALLBACK.email;
  const initiatedOn = formatToIst(initiatedOnRaw || INITIATOR_FALLBACK.initiatedAt);

  const avatar = getAvatarColor(userData.name);

  const accessDetails = member.accessDetails ?? [];
  const primaryItems = accessDetails.filter((a) => a.accessType === "PRIMARY");
  const secondaryItemsRaw = accessDetails.filter((a) => a.accessType !== "PRIMARY");
  const secondaryItems =
    secondaryItemsRaw.length > 0
      ? secondaryItemsRaw
      : member.status === "Pending"
        ? DEMO_SECONDARY_ACCESS
        : [];

  const primaryByNode = groupByNode(primaryItems);
  const secondaryByNode = groupByNode(secondaryItems);
  const primaryEntries = useMemo(() => Object.entries(primaryByNode), [primaryByNode]);
  const secondaryEntries = useMemo(() => Object.entries(secondaryByNode), [secondaryByNode]);

  const isEmpty = accessDetails.length === 0;
  const isRemarkValid = Boolean(pendingRemark.trim());
  const showRemarkError = remarkTouched && !isRemarkValid;
  const isActive = member.status !== "Inactive";
  const showActiveToggle = member.status === "Active" || member.status === "Inactive";

  useEffect(() => {
    if (!pendingDecision) return;
    requestAnimationFrame(() => {
      remarkCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      remarkInputRef.current?.focus();
    });
  }, [pendingDecision]);

  useEffect(() => {
    const selectableKeys = [
      ...primaryEntries.map(([key]) => `p:${key}`),
      ...secondaryEntries.map(([key]) => `s:${key}`),
    ];
    if (selectableKeys.length === 0 || (collapsedFocusedKey && !selectableKeys.includes(collapsedFocusedKey))) {
      setCollapsedFocusedKey(null);
    }
  }, [collapsedFocusedKey, primaryEntries, secondaryEntries]);

  const handleStartPendingAction = (action: "approve" | "reject") => {
    setPendingDecision(action);
    setRemarkTouched(false);
  };

  const handleSubmitPendingAction = (action: "approve" | "reject") => {
    setRemarkTouched(true);
    if (!isRemarkValid) return;

    if (action === "approve") {
      onApprovePending?.(member, pendingRemark.trim());
      return;
    }
    onRejectPending?.(member, pendingRemark.trim());
  };

  const handleCloseRemark = () => {
    setPendingDecision(null);
    setPendingRemark("");
    setRemarkTouched(false);
  };

  // Status badge
  const statusCls =
    member.status === "Inactive" ? "border-rose-200 bg-rose-100 text-rose-700"
      : member.status === "Pending" ? "border-amber-200 bg-amber-100 text-amber-700"
        : "border-emerald-200 bg-emerald-100 text-emerald-700";

  return (
    <div className="flex h-full flex-col bg-white">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 px-6 pt-6 pb-0">
        {/* Name + avatar row — no EDIT here so it doesn't clash with dialog X */}
        <div className="flex items-start justify-between gap-4 pr-8">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ring-1 ring-slate-200/80 shadow-sm", avatar.bg, avatar.text)}>
              {getInitials(userData.name)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">{userData.name}</h2>
                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider", statusCls)}>
                  {member.status || "Active"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">{formattedDesignation}</span>
                {formattedDesignation !== "Not available" && formattedDepartment && (
                  <span className="text-slate-300">•</span>
                )}
                {formattedDepartment ? <span className="text-xs font-medium text-slate-500">{formattedDepartment}</span> : null}
              </div>
            </div>
          </div>
          {showActiveToggle ? (
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => onToggleActiveStatus?.(member, true)}
                className={cn(
                  "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-[#3b5bdb] text-white shadow-[0_4px_12px_rgba(59,91,219,0.35)]"
                    : "text-slate-500 hover:text-slate-700",
                )}
                aria-pressed={isActive}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => onToggleActiveStatus?.(member, false)}
                className={cn(
                  "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
                  !isActive
                    ? "bg-[#3b5bdb] text-white shadow-[0_4px_12px_rgba(59,91,219,0.35)]"
                    : "text-slate-500 hover:text-slate-700",
                )}
                aria-pressed={!isActive}
              >
                Inactive
              </button>
            </div>
          ) : null}
        </div>

        {member.status === "Pending" ? (
          <div className="mb-4 mt-3 rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                <UserCheck size={12} className="text-slate-400" />
                <span className="text-slate-500">By</span>
                <span className="font-medium text-slate-700">{resolvedInitiatorName}</span>
              </span>
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                <Mail size={12} className="text-slate-400" />
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-slate-700 truncate">{resolvedInitiatorEmail}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/70">
                <Calendar size={12} className="text-slate-400" />
                <span className="text-slate-500">Initiated</span>
                <span className="font-medium text-slate-700">{initiatedOn || formatToIst(INITIATOR_FALLBACK.initiatedAt)}</span>
              </span>
            </div>
          </div>
        ) : null}

        <div className="mt-2" />
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-[13px] font-black uppercase tracking-[0.18em] text-slate-500">Access Rights</span>
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-[rgb(53,83,233)] hover:text-[rgb(53,83,233)]"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>
            {/* Toggle button */}
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-16 text-center">
                <ShieldCheck size={28} className="mb-3 text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">No access rights configured</p>
                <p className="mt-1 text-xs text-slate-400">Assign roles to this user via the onboarding flow.</p>
            </div>
            ) : isExpanded ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-indigo-200 bg-[#DDE6FF] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                  <div className="grid items-stretch grid-cols-1 gap-3 xl:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)]">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/70">
                      <div className="mb-3 border-b border-slate-200 pb-2 text-[12px] font-black uppercase tracking-widest text-slate-600">
                        Basic Details
                      </div>
                      <div className="space-y-2.5 text-sm">
                        <div className="grid grid-cols-[136px_10px_1fr] items-center gap-x-2">
                          <span className="text-slate-500">Name</span>
                          <span className="text-slate-400">:</span>
                          <span className="font-semibold text-slate-900">{userData.name || "-"}</span>
                        </div>
                        <div className="grid grid-cols-[136px_10px_1fr] items-center gap-x-2">
                          <span className="text-slate-500">Email</span>
                          <span className="text-slate-400">:</span>
                          <span className="break-all font-semibold text-slate-900">{userData.email || "-"}</span>
                        </div>
                        <div className="grid grid-cols-[136px_10px_1fr] items-center gap-x-2">
                          <span className="text-slate-500">Phone</span>
                          <span className="text-slate-400">:</span>
                          <span className="font-semibold text-slate-900">{userData.phone || "-"}</span>
                        </div>
                        <div className="grid grid-cols-[136px_10px_1fr] items-center gap-x-2">
                          <span className="text-slate-500">Onboarding Date</span>
                          <span className="text-slate-400">:</span>
                          <span className="font-semibold text-slate-900">{userData.createdAt || "-"}</span>
                        </div>
                        <div className="grid grid-cols-[136px_10px_1fr] items-center gap-x-2">
                          <span className="text-slate-500">Designation</span>
                          <span className="text-slate-400">:</span>
                          <span className="font-semibold text-slate-900">{formattedDesignation || "-"}</span>
                        </div>
                        <div className="grid grid-cols-[136px_10px_1fr] items-center gap-x-2">
                          <span className="text-slate-500">Employee ID</span>
                          <span className="text-slate-400">:</span>
                          <span className="font-semibold text-slate-900">{userData.employeeId || "-"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex h-full min-h-[248px] flex-col space-y-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/70">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#4F46E5]" />
                        <span className="text-[12px] font-extrabold uppercase tracking-widest text-[#4F46E5]">Primary Access</span>
                      </div>
                      {Object.keys(primaryByNode).length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-sm text-slate-400">
                          No primary access configured.
                        </div>
                      ) : (
                        Object.entries(primaryByNode).map(([key, group], idx) => (
                          <NodeAccessCard
                            key={key}
                            nodeName={group.nodeName}
                            parentSubtitle={group.parentSubtitle}
                            nodeIndex={idx}
                            categories={group.categories}
                            isPrimary
                          />
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100/70">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-8 lg:whitespace-nowrap">
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="shrink-0 whitespace-nowrap text-slate-500">Reporting Manager</span>
                        <span className="shrink-0 text-slate-400">:</span>
                        <span className="min-w-0 truncate font-semibold text-slate-900">{userData.reportingManager || "-"}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="shrink-0 whitespace-nowrap text-slate-500">Manager Email</span>
                        <span className="shrink-0 text-slate-400">:</span>
                        <span className="min-w-0 truncate font-semibold text-slate-900">{userData.reportingManagerEmail || "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span className="text-[12px] font-black uppercase tracking-widest text-slate-500">Secondary Access</span>
                  </div>
                  {Object.keys(secondaryByNode).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-sm text-slate-400">
                      No secondary access assigned.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {Object.entries(secondaryByNode).map(([key, group], idx) => (
                        <NodeAccessCard
                          key={key}
                          nodeName={group.nodeName}
                          parentSubtitle={group.parentSubtitle}
                          nodeIndex={idx}
                          categories={group.categories}
                          isPrimary={false}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* COLLAPSED — matches StepReviewSubmit collapsed style */
              <div className="space-y-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3.5">
                <div className="rounded-2xl border border-indigo-200 bg-[#DDE6FF] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100/70">
                    <div className="mb-2 border-b border-slate-200 pb-1.5 text-[11px] font-black uppercase tracking-widest text-slate-600">
                      Basic Details
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="grid grid-cols-[96px_10px_1fr] items-center gap-x-2">
                        <span className="text-slate-500">Name</span>
                        <span className="text-slate-400">:</span>
                        <span className="font-semibold text-slate-900">{userData.name || "-"}</span>
                      </div>
                      <div className="grid grid-cols-[96px_10px_1fr] items-center gap-x-2">
                        <span className="text-slate-500">Email</span>
                        <span className="text-slate-400">:</span>
                        <span className="truncate font-semibold text-slate-900">{userData.email || "-"}</span>
                      </div>
                      <div className="grid grid-cols-[96px_10px_1fr] items-center gap-x-2">
                        <span className="text-slate-500">Phone</span>
                        <span className="text-slate-400">:</span>
                        <span className="font-semibold text-slate-900">{userData.phone || "-"}</span>
                      </div>
                      <div className="grid grid-cols-[96px_10px_1fr] items-center gap-x-2">
                        <span className="text-slate-500">Designation</span>
                        <span className="text-slate-400">:</span>
                        <span className="font-semibold text-slate-900">{formattedDesignation || "-"}</span>
                      </div>
                      <div className="grid grid-cols-[96px_10px_1fr] items-center gap-x-2">
                        <span className="text-slate-500">Employee ID</span>
                        <span className="text-slate-400">:</span>
                        <span className="font-semibold text-slate-900">{userData.employeeId || "-"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100/70">
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-6 lg:whitespace-nowrap">
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="shrink-0 whitespace-nowrap text-slate-500">Reporting Manager</span>
                        <span className="shrink-0 text-slate-400">:</span>
                        <span className="min-w-0 truncate font-semibold text-slate-900">{userData.reportingManager || "-"}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="shrink-0 whitespace-nowrap text-slate-500">Manager Email</span>
                        <span className="shrink-0 text-slate-400">:</span>
                        <span className="min-w-0 truncate font-semibold text-slate-900">{userData.reportingManagerEmail || "-"}</span>
                      </div>
                    </div>
                  </div>
                  {/* Primary collapsed */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-[12px] font-black uppercase tracking-widest text-blue-600">Primary Access</span>
                    </div>
                    {primaryEntries.length === 0 ? (
                      <div className="text-xs text-slate-400">No primary access configured.</div>
                    ) : (
                      primaryEntries.map(([key, group], idx) => {
                        const focused = collapsedFocusedKey === `p:${key}`;
                        return (
                          <div key={key}>
                            {focused ? (
                              <NodeAccessCard
                                nodeName={group.nodeName}
                                parentSubtitle={group.parentSubtitle}
                                nodeIndex={idx}
                                categories={group.categories}
                                isPrimary
                                onClose={() => setCollapsedFocusedKey(null)}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setCollapsedFocusedKey(`p:${key}`)}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-md border border-l-[4px] border-slate-200 bg-white px-3 py-2.5 text-left transition-all duration-150 hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]",
                                  getNodeEdgeBorderClass(idx, true),
                                  getNodeHoverClass(idx, true),
                                )}
                              >
                                <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", getNodeBadgeClass(idx, true))}>
                                  P{idx + 1}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-slate-700">{group.nodeName}</div>
                                  {group.parentSubtitle ? <div className="truncate text-[11px] font-medium text-slate-500">{group.parentSubtitle}</div> : null}
                                </div>
                                <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Secondary collapsed */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span className="text-[12px] font-black uppercase tracking-widest text-slate-500">Secondary Access</span>
                  </div>
                  {secondaryEntries.length === 0 ? (
                    <div className="text-xs text-slate-400">No secondary access assigned.</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {secondaryEntries.map(([key, group], idx) => {
                        const focused = collapsedFocusedKey === `s:${key}`;
                        return (
                          <div key={key}>
                            {focused ? (
                              <NodeAccessCard
                                nodeName={group.nodeName}
                                parentSubtitle={group.parentSubtitle}
                                nodeIndex={idx}
                                categories={group.categories}
                                isPrimary={false}
                                onClose={() => setCollapsedFocusedKey(null)}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setCollapsedFocusedKey(`s:${key}`)}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-md border border-l-[4px] border-slate-200 bg-white px-3 py-2.5 text-left transition-all duration-150 hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]",
                                  getNodeEdgeBorderClass(idx, false),
                                  getNodeHoverClass(idx, false),
                                )}
                              >
                                <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", getNodeBadgeClass(idx, false))}>
                                  S{idx + 1}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-slate-700">{group.nodeName}</div>
                                  {group.parentSubtitle ? <div className="truncate text-[11px] font-medium text-slate-500">{group.parentSubtitle}</div> : null}
                                </div>
                                <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          {member.status === "Pending" && pendingDecision ? (
            <div ref={remarkCardRef} className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {pendingDecision === "approve" ? "Approve Remark" : "Reject Remark"}
                </h4>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-slate-500">Remark is required before submitting this action.</p>
                  <div className="text-[11px] text-slate-500">{pendingRemark.length}/100</div>
                </div>
              </div>
              <Textarea
                ref={remarkInputRef}
                value={pendingRemark}
                onChange={(event) => setPendingRemark(event.target.value)}
                onBlur={() => setRemarkTouched(true)}
                maxLength={100}
                placeholder={`Enter remark for ${pendingDecision === "approve" ? "approval" : "rejection"}`}
                className="mt-3 min-h-[88px]"
              />
              {showRemarkError ? <p className="mt-2 text-xs text-rose-600">Please enter a remark.</p> : null}
            </div>
          ) : null}
        </div>
      </div>

      {member.status === "Pending" ? (
        <div className="border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-end gap-3">
            {pendingDecision !== "approve" ? (
              <button
                type="button"
                className={cn(
                  "inline-flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition",
                  pendingDecision === "reject"
                    ? "border-[rgb(220,38,38)] bg-[rgb(220,38,38)] text-white hover:bg-[rgb(220,38,38)]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600",
                )}
                onClick={() =>
                  pendingDecision === "reject" ? handleSubmitPendingAction("reject") : handleStartPendingAction("reject")
                }
                disabled={pendingDecision === "reject" && !isRemarkValid}
              >
                Reject
              </button>
            ) : null}
            {pendingDecision ? (
              <button
                type="button"
                className="inline-flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                onClick={handleCloseRemark}
              >
                Close
              </button>
            ) : null}
            {pendingDecision !== "reject" ? (
              <button
                type="button"
                className={cn(
                  "inline-flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition",
                  pendingDecision === "approve"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-[rgb(53,83,233)] text-white shadow-sm hover:bg-[rgb(45,71,210)]",
                )}
                onClick={() =>
                  pendingDecision === "approve" ? handleSubmitPendingAction("approve") : handleStartPendingAction("approve")
                }
                disabled={pendingDecision === "approve" && !isRemarkValid}
              >
                Approve
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default UserManagePreview;
