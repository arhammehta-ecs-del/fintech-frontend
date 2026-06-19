import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bell, Check, ChevronDown, LogOut, Menu, Pencil, Settings, ShieldCheck, User, X } from "lucide-react";
import type { NavigateFunction } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AppSidebar } from "@/features/dashboard-layout/components/AppSidebar";
import { getBranchAppearance, getNodeAccentBorderLeft } from "@/features/org-structure/nodeTheme.utils";
import { cn } from "@/lib/utils";
import {
  connectNotificationStream,
  fetchNotificationPage,
  fetchNotificationSettings,
  type NotificationFetchDateRange,
  type NotificationFetchRefType,
  type NotificationFetchStatus,
  type NotificationSettingsCompany,
  type NotificationSettingsModule,
  type NotificationSettingsUpdateRequest,
  type NotificationSsePacket,
  updateNotificationReadStatus,
  updateNotificationSettings,
} from "@/services/notification.service";
import { getApiErrorMessage } from "@/services/client";
import { setNotificationsPanelOpenFlag } from "@/hooks/useNotificationsPanelOpen";

type AppTopBarProps = {
  mobileNavOpen: boolean;
  onMobileNavOpenChange: (open: boolean) => void;
  onToggleCollapsed: () => void;
  locationPathname: string;
  currentUser: {
    name?: string;
    email?: string;
    role?: string;
  } | null;
  navigate: NavigateFunction;
  onLogout: () => void;
};

type NotificationTone = "blue" | "green" | "orange" | "red" | "slate";
type NotificationEntity = "User" | "Workflow" | "Org" | "Company List";
type NotificationRefTypeFilter = "ALL" | "USER" | "WORKFLOW" | "ORG";
type NotificationIntent = "approve" | "view";
type NotificationStatusFilterValue = Exclude<NotificationFetchStatus, "ALL">;
type NotificationModuleFilterValue = Exclude<NotificationRefTypeFilter, "ALL">;

type NotificationItem = {
  id: string;
  status: string;
  badgeLabel: string;
  badgeTone: NotificationTone;
  title: string;
  entity: NotificationEntity;
  refType: string | null;
  referenceId: string | null;
  target: string | null;
  rawType: string;
  message: string;
  previewMessage: string;
  initiatedByName: string;
  initiatedByEmail: string;
  occurredAt: string;
  unread: boolean;
  isPending: boolean;
  affectedSegments: string[];
  affectedHeading: string;
  extractedEmail: string;
  extractedEntityName: string;
};

type NotificationSettingsTreeNode = {
  nodePath: string;
  nodeName: string;
  levelCount: number;
  nodeEnabled: boolean;
  settings: NotificationSettingsModule[];
  children: NotificationSettingsTreeNode[];
};

type NotificationSettingsCompanyState = Omit<NotificationSettingsCompany, "nodes"> & {
  nodes: NotificationSettingsTreeNode[];
};

type NotificationSettingsFlowNode = {
  node: NotificationSettingsTreeNode;
  depth: number;
  branchIndex: number | null;
  branchDepth: number;
  isRoot: boolean;
};

const COMPACT_NOTIFICATIONS_LIMIT = 10;
const DIALOG_PAGE_SIZE = 50;
const MESSAGE_PREVIEW_LIMIT = 150;
const MAX_VISIBLE_TRACKS = 8;
const DEFAULT_DATE_RANGE: NotificationFetchDateRange = "7DAYS";
const DATE_RANGE_OPTIONS: NotificationFetchDateRange[] = ["7DAYS", "15DAYS", "1MONTH"];
const STATUS_FILTER_OPTIONS: Array<{ value: NotificationStatusFilterValue; label: string }> = [
  { value: "READ", label: "Read" },
  { value: "UNREAD", label: "Unread" },
  { value: "HIDDEN", label: "Hidden" },
];
const MODULE_FILTER_OPTIONS: Array<{ value: NotificationModuleFilterValue; label: string }> = [
  { value: "USER", label: "User" },
  { value: "WORKFLOW", label: "Workflow" },
  { value: "ORG", label: "Org" },
];

const toggleArrayValue = <T extends string>(values: T[], value: T) =>
  values.includes(value) ? values.filter((current) => current !== value) : [...values, value];

const toggleSingleSelectValue = <T extends string>(values: T[], value: T) =>
  values.includes(value) ? [] : [value];

const formatMultiFilterLabel = (values: string[], allLabel: string) => {
  if (values.length === 0) return allLabel;
  if (values.length === 1) return values[0];
  return `${values.length} Selected`;
};

const filterNotificationsBySelection = (
  items: NotificationItem[],
  selectedStatusFilters: NotificationStatusFilterValue[],
  selectedModuleFilters: NotificationModuleFilterValue[],
) =>
  items.filter((item) => {
    const itemStatus = item.status;
    const itemModule = (item.refType || "").trim().toUpperCase() as NotificationModuleFilterValue;
    const matchesStatus = selectedStatusFilters.length === 0 || selectedStatusFilters.includes(itemStatus);
    const matchesModule = selectedModuleFilters.length === 0 || selectedModuleFilters.includes(itemModule);
    return matchesStatus && matchesModule;
  });

const formatRelativeTime = (occurredAt: string) => {
  const parsed = new Date(occurredAt);
  if (Number.isNaN(parsed.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const timeLabel = parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  if (parsed >= startOfToday && parsed < startOfTomorrow) return `Today, ${timeLabel}`;
  if (parsed >= startOfYesterday && parsed < startOfToday) return `Yesterday, ${timeLabel}`;
  return `${parsed.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}, ${timeLabel}`;
};

const formatPastTimeline = (occurredAt: string) => formatRelativeTime(occurredAt);

const truncateMessage = (value: string, limit = MESSAGE_PREVIEW_LIMIT) => {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
};

const toUtcDayStart = (value: string) => (value ? `${value}T00:00:00.000Z` : null);
const toUtcDayEnd = (value: string) => (value ? `${value}T23:59:59.999Z` : null);

const buildNotificationPreview = (message: string) => {
  const normalizedMessage = message.replace(/\s+/g, " ").trim();
  if (!normalizedMessage) return "";

  const impactedIndex = normalizedMessage.indexOf("Impacted:");
  if (impactedIndex >= 0) {
    const impactedSection = normalizedMessage.slice(impactedIndex);
    const impactedTail = impactedSection.match(/^Impacted:\s*[^,]+/i)?.[0];
    if (impactedTail) {
      const preview = `${normalizedMessage.slice(0, impactedIndex)}${impactedTail}`.trimEnd();
      return preview.endsWith("...") ? preview : `${preview}...`;
    }
  }

  return truncateMessage(normalizedMessage);
};

const extractEmailFromText = (value: string) => {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? "";
};

const extractEntityName = (name: string, message: string, refType?: string | null) => {
  const normalizedRefType = String(refType ?? "").trim().toUpperCase();
  if (normalizedRefType === "USER") {
    const match = message.match(/for\s+(.+?)\s+\([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\)/i);
    return match?.[1]?.trim() || name.trim();
  }

  const forMatch = message.match(/for\s+([^,.()]+)/i);
  if (forMatch?.[1]) return forMatch[1].trim();

  const titleMatch = name.match(/(?:initiated|approved|rejected|blocked|updated|onboarded|generated)\s+for\s+(.+)$/i);
  if (titleMatch?.[1]) return titleMatch[1].trim();

  return name.trim();
};

const getAffectedSegments = (message: string) => {
  const base = message.includes(":") ? message.slice(message.indexOf(":") + 1) : message;
  return base
    .split(",")
    .map((segment) => segment.replace(/\n/g, " ").trim())
    .filter(Boolean);
};

const mapTypeToBadge = (value?: string): { label: string; tone: NotificationTone } => {
  const normalized = String(value ?? "").trim().toUpperCase();
  const rawLabel = normalized || "INITIATED";
  if (normalized.includes("INACTIV")) return { label: rawLabel, tone: "red" };
  if (normalized.includes("ACTIV")) return { label: rawLabel, tone: "green" };
  if (normalized.includes("APPROV") || normalized.includes("ONBOARD")) return { label: rawLabel, tone: "green" };
  if (normalized.includes("INITIAT")) return { label: rawLabel, tone: "blue" };
  if (normalized.includes("MODIF")) return { label: rawLabel, tone: "orange" };
  if (normalized.includes("REJECT")) return { label: rawLabel, tone: "red" };
  return { label: rawLabel, tone: normalized ? "slate" : "blue" };
};

const mapRefTypeToEntity = (value?: string | null): NotificationEntity => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "WORKFLOW") return "Workflow";
  if (normalized === "ORG") return "Org";
  if (normalized === "COMPANYLIST" || normalized === "COMPANY LIST") return "Company List";
  return "User";
};

const statusStyles: Record<
  NotificationTone,
  { unreadBorder: string; readBorder: string; badge: string }
> = {
  blue: {
    unreadBorder: "border-l-blue-500",
    readBorder: "border-l-blue-500/40",
    badge: "bg-blue-100/70 text-blue-700 border-transparent",
  },
  red: {
    unreadBorder: "border-l-red-500",
    readBorder: "border-l-red-500/40",
    badge: "bg-red-100/70 text-red-700 border-transparent",
  },
  green: {
    unreadBorder: "border-l-emerald-500",
    readBorder: "border-l-emerald-500/40",
    badge: "bg-emerald-100/70 text-emerald-700 border-transparent",
  },
  orange: {
    unreadBorder: "border-l-amber-500",
    readBorder: "border-l-amber-500/40",
    badge: "bg-amber-100/80 text-amber-700 border-transparent",
  },
  slate: {
    unreadBorder: "border-l-slate-500",
    readBorder: "border-l-slate-400/50",
    badge: "bg-slate-100 text-slate-700 border-transparent",
  },
};

const formatModuleLabel = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Module";

const formatNodeLevelLabel = (levelCount?: number) => `L${Math.max(1, Number(levelCount ?? 1))}`;

const getNodePathSegments = (nodePath: string) =>
  nodePath
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

const getParentNodePath = (nodePath: string) => {
  const segments = getNodePathSegments(nodePath);
  return segments.length > 1 ? segments.slice(0, -1).join(".") : null;
};

const sortNotificationSettingsTree = (nodes: NotificationSettingsTreeNode[]) => {
  nodes.sort((left, right) => left.nodePath.localeCompare(right.nodePath, undefined, { numeric: true, sensitivity: "base" }));
  nodes.forEach((node) => sortNotificationSettingsTree(node.children));
};

const buildNotificationSettingsTree = (nodes: NotificationSettingsCompany["nodes"]): NotificationSettingsTreeNode[] => {
  const byPath = new Map<string, NotificationSettingsTreeNode>();
  nodes.forEach((node) => {
    const nodePath = String(node.nodePath ?? "").trim();
    if (!nodePath) return;
    byPath.set(nodePath, {
      nodePath,
      nodeName: String(node.nodeName ?? "").trim() || "Unnamed Node",
      levelCount: Number(node.levelCount ?? Math.max(getNodePathSegments(nodePath).length - 1, 0)),
      settings: Array.isArray(node.settings)
        ? node.settings.map((setting) => ({
          module: String(setting.module ?? "").trim(),
          isEnabled: Boolean(setting.isEnabled),
        }))
        : [],
      nodeEnabled: Array.isArray(node.settings)
        ? node.settings.every((setting) => Boolean(setting.isEnabled))
        : false,
      children: [],
    });
  });

  const roots: NotificationSettingsTreeNode[] = [];
  byPath.forEach((node, nodePath) => {
    const parentPath = getParentNodePath(nodePath);
    const parent = parentPath ? byPath.get(parentPath) : null;
    if (parent) {
      parent.children.push(node);
      return;
    }
    roots.push(node);
  });

  sortNotificationSettingsTree(roots);
  return roots;
};

const normalizeNotificationSettingsCompanies = (
  companies: NotificationSettingsCompany[],
): NotificationSettingsCompanyState[] =>
  companies.map((company) => ({
    companyName: String(company.companyName ?? "").trim() || "Company",
    companyCode: String(company.companyCode ?? "").trim() || String(company.companyName ?? "").trim() || "COMPANY",
    nodes: buildNotificationSettingsTree(Array.isArray(company.nodes) ? company.nodes : []),
  }));

const cloneNotificationSettingsNodes = (nodes: NotificationSettingsTreeNode[]): NotificationSettingsTreeNode[] =>
  nodes.map((node) => ({
    ...node,
    settings: node.settings.map((setting) => ({ ...setting })),
    children: cloneNotificationSettingsNodes(node.children),
  }));

const cloneNotificationSettingsCompanies = (
  companies: NotificationSettingsCompanyState[],
): NotificationSettingsCompanyState[] =>
  companies.map((company) => ({
    ...company,
    nodes: cloneNotificationSettingsNodes(company.nodes),
  }));

const flattenNotificationSettingsTree = (
  nodes: NotificationSettingsTreeNode[],
  collapsedNodePaths: string[] = [],
): NotificationSettingsFlowNode[] => {
  const items: NotificationSettingsFlowNode[] = [];
  const collapsedSet = new Set(collapsedNodePaths);

  const walk = (
    node: NotificationSettingsTreeNode,
    depth: number,
    branchIndex: number | null,
    branchDepth: number,
    isRoot: boolean,
  ) => {
    items.push({ node, depth, branchIndex, branchDepth, isRoot });
    if (collapsedSet.has(node.nodePath)) return;
    node.children.forEach((child, childIndex) => {
      walk(child, depth + 1, isRoot ? childIndex : branchIndex, isRoot ? 0 : branchDepth + 1, false);
    });
  };

  nodes.forEach((node) => walk(node, 0, null, 0, true));
  return items;
};

const findNotificationSettingsNode = (
  nodes: NotificationSettingsTreeNode[],
  nodePath: string,
): NotificationSettingsTreeNode | null => {
  for (const node of nodes) {
    if (node.nodePath === nodePath) return node;
    const childMatch = findNotificationSettingsNode(node.children, nodePath);
    if (childMatch) return childMatch;
  }
  return null;
};

const mapNotificationSettingsNodes = (
  nodes: NotificationSettingsTreeNode[],
  nodePath: string,
  updater: (node: NotificationSettingsTreeNode) => NotificationSettingsTreeNode,
): NotificationSettingsTreeNode[] =>
  nodes.map((node) => {
    if (node.nodePath === nodePath) {
      return updater({
        ...node,
        settings: node.settings.map((setting) => ({ ...setting })),
        children: node.children.map((child) => child),
      });
    }

    if (node.children.length === 0) return node;
    return {
      ...node,
      children: mapNotificationSettingsNodes(node.children, nodePath, updater),
    };
  });

const getNotificationSettingsNodeToggleState = (node: NotificationSettingsTreeNode | null) =>
  Boolean(node?.nodeEnabled);

const isNotificationSettingsDescendantPath = (candidatePath: string, parentPath: string) =>
  candidatePath === parentPath || candidatePath.startsWith(`${parentPath}.`);

const getNotificationSettingsAncestorPaths = (nodePath: string) => {
  const segments = getNodePathSegments(nodePath);
  return segments
    .map((_, index) => segments.slice(0, index + 1).join("."))
    .slice(0, -1);
};

const collectNotificationSettingsEntries = (
  companyCode: string,
  nodes: NotificationSettingsTreeNode[],
  bucket: Array<{ companyCode: string; nodePath: string; module: string; isEnabled: boolean }>,
) => {
  nodes.forEach((node) => {
    node.settings.forEach((setting) => {
      bucket.push({
        companyCode,
        nodePath: node.nodePath,
        module: setting.module,
        isEnabled: setting.isEnabled,
      });
    });
    collectNotificationSettingsEntries(companyCode, node.children, bucket);
  });
};

const buildNotificationSettingsUpdatePayload = (
  currentCompanies: NotificationSettingsCompanyState[],
  originalCompanies: NotificationSettingsCompanyState[],
): NotificationSettingsUpdateRequest => {
  const originalState = new Map<string, boolean>();
  originalCompanies.forEach((company) => {
    const entries: Array<{ companyCode: string; nodePath: string; module: string; isEnabled: boolean }> = [];
    collectNotificationSettingsEntries(company.companyCode, company.nodes, entries);
    entries.forEach((entry) => {
      originalState.set(`${entry.companyCode}::${entry.nodePath}::${entry.module}`, entry.isEnabled);
    });
  });

  return currentCompanies.reduce<NotificationSettingsUpdateRequest>((payload, company) => {
    const entries: Array<{ companyCode: string; nodePath: string; module: string; isEnabled: boolean }> = [];
    collectNotificationSettingsEntries(company.companyCode, company.nodes, entries);

    const changedSettings = entries
      .filter((entry) => originalState.get(`${entry.companyCode}::${entry.nodePath}::${entry.module}`) !== entry.isEnabled)
      .map((entry) => ({
        nodePath: entry.nodePath,
        module: entry.module,
        isEnabled: entry.isEnabled,
      }));

    if (changedSettings.length > 0) {
      payload.push({
        companyCode: company.companyCode,
        settings: changedSettings,
      });
    }

    return payload;
  }, []);
};

export function AppTopBar({
  mobileNavOpen,
  onMobileNavOpenChange,
  onToggleCollapsed,
  locationPathname,
  currentUser,
  navigate,
  onLogout,
}: AppTopBarProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dialogNotifications, setDialogNotifications] = useState<NotificationItem[]>([]);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogLoadingMore, setDialogLoadingMore] = useState(false);
  const [dialogOffset, setDialogOffset] = useState(COMPACT_NOTIFICATIONS_LIMIT);
  const [dialogHasNextPage, setDialogHasNextPage] = useState(false);
  const [unreadTotalCount, setUnreadTotalCount] = useState(0);
  const [allNotificationCount, setAllNotificationCount] = useState(0);
  const [allNotificationsOpen, setAllNotificationsOpen] = useState(false);
  const [notificationsPopoverOpen, setNotificationsPopoverOpen] = useState(false);
  const [notificationStatusFilters, setNotificationStatusFilters] = useState<NotificationStatusFilterValue[]>([]);
  const [notificationModuleFilters, setNotificationModuleFilters] = useState<NotificationModuleFilterValue[]>([]);
  const [notificationDateRange, setNotificationDateRange] = useState<NotificationFetchDateRange>(DEFAULT_DATE_RANGE);
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [expandedNotificationIds, setExpandedNotificationIds] = useState<string[]>([]);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const [notificationSettingsLoading, setNotificationSettingsLoading] = useState(false);
  const [notificationSettingsError, setNotificationSettingsError] = useState("");
  const [notificationSettingsCompanies, setNotificationSettingsCompanies] = useState<NotificationSettingsCompanyState[]>([]);
  const [notificationSettingsInitialCompanies, setNotificationSettingsInitialCompanies] = useState<NotificationSettingsCompanyState[]>([]);
  const [selectedNotificationSettingsCompanyCode, setSelectedNotificationSettingsCompanyCode] = useState("");
  const [selectedNotificationSettingsNodePath, setSelectedNotificationSettingsNodePath] = useState("");
  const [notificationSettingsEditMode, setNotificationSettingsEditMode] = useState(false);
  const [notificationSettingsSaving, setNotificationSettingsSaving] = useState(false);
  const [notificationSettingsSubmitError, setNotificationSettingsSubmitError] = useState("");
  const [notificationSettingsArrowPosition, setNotificationSettingsArrowPosition] = useState<{ left: number; top: number } | null>(null);
  const [collapsedNotificationSettingsNodePaths, setCollapsedNotificationSettingsNodePaths] = useState<string[]>([]);
  const notificationSettingsPanelsRef = useRef<HTMLDivElement | null>(null);
  const notificationSettingsNodesScrollRef = useRef<HTMLDivElement | null>(null);
  const notificationSettingsLeftPanelRef = useRef<HTMLDivElement | null>(null);
  const notificationSettingsRightPanelRef = useRef<HTMLDivElement | null>(null);
  const notificationSettingsNodeButtonRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const notificationSettingsSelectedNodeRef = useRef<HTMLDivElement | null>(null);

  const resetNotificationFilters = useCallback(() => {
    setNotificationStatusFilters([]);
    setNotificationModuleFilters([]);
    setNotificationDateRange(DEFAULT_DATE_RANGE);
    setCustomFromDate("");
    setCustomToDate("");
  }, []);

  useEffect(() => {
    setNotificationsPanelOpenFlag(allNotificationsOpen || notificationsPopoverOpen || notificationSettingsOpen);
    return () => setNotificationsPanelOpenFlag(false);
  }, [allNotificationsOpen, notificationSettingsOpen, notificationsPopoverOpen]);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const activeDateRange = customFromDate && customToDate ? "CUSTOM" : notificationDateRange;
  const customDateRangeIsComplete = notificationDateRange !== "CUSTOM" || Boolean(customFromDate && customToDate);
  const visibleNotifications = useMemo(
    () => filterNotificationsBySelection(notifications, notificationStatusFilters, notificationModuleFilters),
    [notifications, notificationModuleFilters, notificationStatusFilters],
  );
  const visibleDialogNotifications = useMemo(
    () => filterNotificationsBySelection(dialogNotifications, notificationStatusFilters, notificationModuleFilters),
    [dialogNotifications, notificationModuleFilters, notificationStatusFilters],
  );
  const hasAnyNotificationFilter = notificationStatusFilters.length > 0 || notificationModuleFilters.length > 0;
  const selectedNotificationSettingsCompany = useMemo(
    () =>
      notificationSettingsCompanies.find((company) => company.companyCode === selectedNotificationSettingsCompanyCode)
      ?? notificationSettingsCompanies[0]
      ?? null,
    [notificationSettingsCompanies, selectedNotificationSettingsCompanyCode],
  );
  const notificationSettingsFlowNodes = useMemo(
    () => flattenNotificationSettingsTree(selectedNotificationSettingsCompany?.nodes ?? [], collapsedNotificationSettingsNodePaths),
    [collapsedNotificationSettingsNodePaths, selectedNotificationSettingsCompany],
  );
  const selectedNotificationSettingsNode = useMemo(
    () =>
      selectedNotificationSettingsCompany
        ? findNotificationSettingsNode(selectedNotificationSettingsCompany.nodes, selectedNotificationSettingsNodePath)
        : null,
    [selectedNotificationSettingsCompany, selectedNotificationSettingsNodePath],
  );
  const pendingNotificationSettingsPayload = useMemo(
    () => buildNotificationSettingsUpdatePayload(notificationSettingsCompanies, notificationSettingsInitialCompanies),
    [notificationSettingsCompanies, notificationSettingsInitialCompanies],
  );
  const pendingNotificationSettingsChangeCount = useMemo(
    () => pendingNotificationSettingsPayload.reduce((count, company) => count + company.settings.length, 0),
    [pendingNotificationSettingsPayload],
  );

  const expandNotificationSettingsPath = useCallback((nodePath: string) => {
    const ancestorPaths = getNotificationSettingsAncestorPaths(nodePath);
    if (ancestorPaths.length === 0) return;
    setCollapsedNotificationSettingsNodePaths((current) => current.filter((path) => !ancestorPaths.includes(path)));
  }, []);

  const focusNotificationSettingsNode = useCallback((nodePath: string) => {
    expandNotificationSettingsPath(nodePath);
    setSelectedNotificationSettingsNodePath(nodePath);
  }, [expandNotificationSettingsPath]);

  const toggleNotificationSettingsBranch = useCallback((nodePath: string) => {
    setCollapsedNotificationSettingsNodePaths((current) => {
      const isCollapsed = current.includes(nodePath);
      if (isCollapsed) {
        return current.filter((path) => path !== nodePath);
      }

      if (
        selectedNotificationSettingsNodePath &&
        isNotificationSettingsDescendantPath(selectedNotificationSettingsNodePath, nodePath)
      ) {
        setSelectedNotificationSettingsNodePath(nodePath);
      }

      return [...current, nodePath];
    });
  }, [selectedNotificationSettingsNodePath]);

  const registerNotificationSettingsNodeButton = useCallback(
    (nodePath: string) => (node: HTMLDivElement | null) => {
      if (node) {
        notificationSettingsNodeButtonRefs.current[nodePath] = node;
        return;
      }
      delete notificationSettingsNodeButtonRefs.current[nodePath];
    },
    [],
  );

  const updateNotificationSettingsArrowPosition = useCallback(() => {
    if (!notificationSettingsOpen) {
      setNotificationSettingsArrowPosition(null);
      return;
    }

    const container = notificationSettingsPanelsRef.current;
    const leftPanel = notificationSettingsLeftPanelRef.current;
    const rightPanel = notificationSettingsRightPanelRef.current;
    const selectedButton = notificationSettingsSelectedNodeRef.current
      ?? notificationSettingsNodeButtonRefs.current[selectedNotificationSettingsNodePath];

    if (!container || !leftPanel || !rightPanel || !selectedButton) {
      setNotificationSettingsArrowPosition(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const leftPanelRect = leftPanel.getBoundingClientRect();
    const rightPanelRect = rightPanel.getBoundingClientRect();
    const selectedButtonRect = selectedButton.getBoundingClientRect();

    setNotificationSettingsArrowPosition({
      left: (leftPanelRect.right + rightPanelRect.left) / 2 - containerRect.left,
      top: selectedButtonRect.top - containerRect.top + selectedButtonRect.height / 2,
    });
  }, [notificationSettingsOpen, selectedNotificationSettingsNodePath]);

  useEffect(() => {
    if (!selectedNotificationSettingsCompany) {
      if (selectedNotificationSettingsCompanyCode) setSelectedNotificationSettingsCompanyCode("");
      if (selectedNotificationSettingsNodePath) setSelectedNotificationSettingsNodePath("");
      return;
    }

    if (selectedNotificationSettingsCompany.companyCode !== selectedNotificationSettingsCompanyCode) {
      setSelectedNotificationSettingsCompanyCode(selectedNotificationSettingsCompany.companyCode);
      return;
    }

    const currentSelection = selectedNotificationSettingsNodePath
      ? findNotificationSettingsNode(selectedNotificationSettingsCompany.nodes, selectedNotificationSettingsNodePath)
      : null;
    if (currentSelection) return;

    const firstNodePath = notificationSettingsFlowNodes[0]?.node.nodePath ?? "";
    if (firstNodePath !== selectedNotificationSettingsNodePath) {
      setSelectedNotificationSettingsNodePath(firstNodePath);
    }
  }, [
    notificationSettingsFlowNodes,
    selectedNotificationSettingsCompany,
    selectedNotificationSettingsCompanyCode,
    selectedNotificationSettingsNodePath,
  ]);

  useLayoutEffect(() => {
    updateNotificationSettingsArrowPosition();
    let frameTwo = 0;
    const frameOne = window.requestAnimationFrame(() => {
      updateNotificationSettingsArrowPosition();
      frameTwo = window.requestAnimationFrame(() => {
        updateNotificationSettingsArrowPosition();
      });
    });

    return () => {
      window.cancelAnimationFrame(frameOne);
      if (frameTwo) {
        window.cancelAnimationFrame(frameTwo);
      }
    };
  }, [
    notificationSettingsFlowNodes,
    notificationSettingsLoading,
    notificationSettingsOpen,
    selectedNotificationSettingsNodePath,
    updateNotificationSettingsArrowPosition,
  ]);

  useEffect(() => {
    if (!notificationSettingsOpen) return undefined;

    const handleArrowPositionChange = () => {
      updateNotificationSettingsArrowPosition();
    };

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
        updateNotificationSettingsArrowPosition();
      })
      : null;
    const nodesScrollElement = notificationSettingsNodesScrollRef.current;
    const selectedButton = notificationSettingsSelectedNodeRef.current
      ?? notificationSettingsNodeButtonRefs.current[selectedNotificationSettingsNodePath];
    const container = notificationSettingsPanelsRef.current;
    const leftPanel = notificationSettingsLeftPanelRef.current;
    const rightPanel = notificationSettingsRightPanelRef.current;

    if (container) resizeObserver?.observe(container);
    if (leftPanel) resizeObserver?.observe(leftPanel);
    if (rightPanel) resizeObserver?.observe(rightPanel);
    if (nodesScrollElement) resizeObserver?.observe(nodesScrollElement);
    if (selectedButton) resizeObserver?.observe(selectedButton);
    window.addEventListener("resize", handleArrowPositionChange);
    nodesScrollElement?.addEventListener("scroll", handleArrowPositionChange);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleArrowPositionChange);
      nodesScrollElement?.removeEventListener("scroll", handleArrowPositionChange);
    };
  }, [notificationSettingsOpen, selectedNotificationSettingsNodePath, updateNotificationSettingsArrowPosition]);

  useEffect(() => {
    if (!notificationSettingsOpen || notificationSettingsLoading || !selectedNotificationSettingsNodePath) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      updateNotificationSettingsArrowPosition();
    }, 80);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    notificationSettingsLoading,
    notificationSettingsOpen,
    selectedNotificationSettingsNodePath,
    updateNotificationSettingsArrowPosition,
  ]);

  const mapPacketToNotification = useCallback((packet: NotificationSsePacket): NotificationItem => {
    const badge = mapTypeToBadge(packet.type);
    const message = String(packet.message ?? "").trim();
    const affectedSegments = getAffectedSegments(message);
    const title = String(packet.name ?? "").trim();
    const createdAt = String(packet.createat_timestamp ?? "").trim() || new Date().toISOString();
    const extractedEmail = extractEmailFromText(message);
    const extractedEntityName = extractEntityName(title, message, packet.refType);

    return {
      id: String(packet.id ?? `${createdAt}-${Math.random().toString(36).slice(2, 10)}`),
      status: String(packet.status ?? "").trim().toUpperCase() || "READ",
      badgeLabel: badge.label,
      badgeTone: badge.tone,
      title: title || `${mapRefTypeToEntity(packet.refType)} ${badge.label}`,
      entity: mapRefTypeToEntity(packet.refType),
      refType: packet.refType?.trim().toUpperCase() || null,
      referenceId: packet.referenceId?.trim() || null,
      target: packet.target?.trim() || null,
      rawType: String(packet.type ?? "").trim().toUpperCase(),
      message,
      previewMessage: buildNotificationPreview(message),
      initiatedByName: String(packet.createdByname ?? "").trim() || "-",
      initiatedByEmail: String(packet.createdByemail ?? "").trim() || "-",
      occurredAt: createdAt,
      unread: String(packet.status ?? "").trim().toUpperCase() === "UNREAD",
      isPending: Boolean(packet.isPending),
      affectedSegments,
      affectedHeading: affectedSegments.length > 1 ? `${affectedSegments.length} tracks affected` : "",
      extractedEmail,
      extractedEntityName,
    };
  }, []);

  const buildNotificationPayload = useCallback(
    (limit: number, offset: number) => ({
      limit,
      offset,
      status: notificationStatusFilters[0] ?? ("ALL" as NotificationFetchStatus),
      refType: notificationModuleFilters[0] ?? (null as NotificationFetchRefType),
      dateRange: activeDateRange,
      fromDate: activeDateRange === "CUSTOM" ? toUtcDayStart(customFromDate) : null,
      toDate: activeDateRange === "CUSTOM" ? toUtcDayEnd(customToDate) : null,
    }),
    [activeDateRange, customFromDate, customToDate, notificationModuleFilters, notificationStatusFilters],
  );

  const handleCustomFromDateChange = useCallback((value: string) => {
    setCustomFromDate(value);
    if (value && customToDate && value > customToDate) {
      setCustomToDate(value);
    }
  }, [customToDate]);

  const handleCustomToDateChange = useCallback((value: string) => {
    setCustomToDate(value);
    if (value && customFromDate && value < customFromDate) {
      setCustomFromDate(value);
    }
  }, [customFromDate]);

  const loadCompactNotifications = useCallback(async () => {
    try {
      const response = await fetchNotificationPage(buildNotificationPayload(COMPACT_NOTIFICATIONS_LIMIT, 0));
      const mapped = response.data
        .map(mapPacketToNotification)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      setNotifications(mapped);
      setAllNotificationCount(response.allCount || response.count || mapped.length);
      setUnreadTotalCount(
        response.unreadCount
        ?? mapped.filter((item) => item.unread).length,
      );
    } catch {
      setNotifications([]);
      setAllNotificationCount(0);
    }
  }, [buildNotificationPayload, mapPacketToNotification]);

  const loadDialogNotifications = useCallback(async () => {
    setDialogLoading(true);
    setDialogLoadingMore(false);
    try {
      const response = await fetchNotificationPage(buildNotificationPayload(DIALOG_PAGE_SIZE, COMPACT_NOTIFICATIONS_LIMIT));
      const mapped = response.data
        .map(mapPacketToNotification)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      const compactIds = new Set(notifications.map((item) => item.id));
      const combined = [...notifications, ...mapped.filter((item) => !compactIds.has(item.id))]
        .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      setDialogNotifications(combined);
      const resolvedAllCount = response.allCount || response.count || combined.length;
      setAllNotificationCount(resolvedAllCount);
      setDialogOffset(COMPACT_NOTIFICATIONS_LIMIT + response.data.length);
      setDialogHasNextPage(COMPACT_NOTIFICATIONS_LIMIT + response.data.length < resolvedAllCount);
    } catch {
      setDialogNotifications([...notifications]);
      setDialogHasNextPage(false);
    } finally {
      setDialogLoading(false);
    }
  }, [buildNotificationPayload, mapPacketToNotification, notifications]);

  useEffect(() => {
    if (!currentUser?.email) return;
    if (!customDateRangeIsComplete) return;
    void loadCompactNotifications();
  }, [currentUser?.email, customDateRangeIsComplete, loadCompactNotifications]);

  useEffect(() => {
    if (!allNotificationsOpen) return;
    if (!customDateRangeIsComplete) return;
    void loadDialogNotifications();
  }, [allNotificationsOpen, customDateRangeIsComplete, loadDialogNotifications]);

  useEffect(() => {
    const disconnect = connectNotificationStream({
      onNotification: () => {
        void loadCompactNotifications();
        if (allNotificationsOpen) {
          void loadDialogNotifications();
        }
      },
    });

    return disconnect;
  }, [allNotificationsOpen, loadCompactNotifications, loadDialogNotifications]);

  const groupedDialogNotifications = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    return {
      today: visibleDialogNotifications.filter((item) => {
        const date = new Date(item.occurredAt);
        return date >= startOfToday && date < startOfTomorrow;
      }),
      yesterday: visibleDialogNotifications.filter((item) => {
        const date = new Date(item.occurredAt);
        return date >= startOfYesterday && date < startOfToday;
      }),
      earlier: visibleDialogNotifications.filter((item) => new Date(item.occurredAt) < startOfYesterday),
      upcoming: visibleDialogNotifications.filter((item) => new Date(item.occurredAt) >= startOfTomorrow),
    };
  }, [visibleDialogNotifications]);

  const unreadCountBadgeLabel = unreadTotalCount > 99 ? "99+" : String(unreadTotalCount);
  const visibleHiddenNotificationsCount = visibleNotifications.filter((item) => item.status === "HIDDEN").length;
  const hiddenStatusSelected = notificationStatusFilters.includes("HIDDEN");
  const notificationCountLabel = hasAnyNotificationFilter
    ? String(hiddenStatusSelected ? visibleHiddenNotificationsCount : visibleNotifications.length)
    : allNotificationCount > 99
      ? "99+"
      : String(allNotificationCount || notifications.length);
  const unreadCountLabel = unreadTotalCount === 1 ? "1 unread" : `${unreadTotalCount} unread`;
  const remainingNotificationCount = Math.max(0, allNotificationCount - notifications.length);
  const dialogRemainingNotificationCount = Math.max(0, allNotificationCount - dialogNotifications.length);
  const shouldShowSeeAll = allNotificationCount > notifications.length;

  const toggleNotificationExpansion = (id: string) => {
    setExpandedNotificationIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const clearNotificationIntentParams = useCallback((search: URLSearchParams) => {
    const next = new URLSearchParams(search);
    [
      "notif_action",
      "notif_ref_type",
      "notif_ref_id",
      "notif_target",
      "notif_type",
      "notif_email",
      "notif_entity_name",
    ].forEach((key) => next.delete(key));
    return next;
  }, []);

  const navigateFromNotification = async (notification: NotificationItem, intent: NotificationIntent) => {
    if (notification.unread) {
      await markAsRead(notification.id);
    }

    const refType = String(notification.refType ?? "").trim().toUpperCase();
    const searchParams = new URLSearchParams();
    const type = notification.rawType;
    const targetTab =
      refType === "WORKFLOW" ? "workflows" : refType === "ORG" ? "org" : "users";

    if (intent === "approve") {
      searchParams.set("tab", targetTab);
      searchParams.set("notif_action", "approve");
      searchParams.set("notif_target_status", "pending");
    } else {
      const targetStatus = notification.isPending
        ? "pending"
        : type.includes("INACTIV") || type.includes("ARCHIVE")
          ? "inactive"
          : "active";
      searchParams.set("tab", targetTab);
      searchParams.set("notif_action", "view");
      searchParams.set("notif_target_status", targetStatus);
    }

    if (notification.refType) searchParams.set("notif_ref_type", notification.refType);
    if (notification.referenceId) searchParams.set("notif_ref_id", notification.referenceId);
    if (intent !== "approve" && notification.target) searchParams.set("notif_target", notification.target);
    if (notification.rawType) searchParams.set("notif_type", notification.rawType);
    if (notification.extractedEmail) searchParams.set("notif_email", notification.extractedEmail);
    if (notification.extractedEntityName) searchParams.set("notif_entity_name", notification.extractedEntityName);

    setNotificationsPopoverOpen(false);
    setAllNotificationsOpen(false);
    resetNotificationFilters();
    navigate(`/settings?${searchParams.toString()}`);
  };

  const markAllAsRead = async () => {
    const unreadIds = Array.from(
      new Set([...notifications, ...dialogNotifications].filter((item) => item.unread).map((item) => item.id)),
    );
    if (unreadIds.length === 0) return;

    const previousNotifications = notifications;
    const previousDialogNotifications = dialogNotifications;
    const previousUnreadTotalCount = unreadTotalCount;
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })));
    setDialogNotifications((current) => current.map((item) => ({ ...item, unread: false })));
    setUnreadTotalCount(0);

    try {
      await Promise.all(unreadIds.map((id) => updateNotificationReadStatus({ id, status: "READ" })));
      void loadCompactNotifications();
      if (allNotificationsOpen) void loadDialogNotifications();
    } catch {
      setNotifications(previousNotifications);
      setDialogNotifications(previousDialogNotifications);
      setUnreadTotalCount(previousUnreadTotalCount);
    }
  };

  const markAsRead = async (id: string) => {
    const selected = notifications.find((item) => item.id === id) || dialogNotifications.find((item) => item.id === id);
    if (!selected || !selected.unread) return;

    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, unread: false } : item)));
    setDialogNotifications((current) => current.map((item) => (item.id === id ? { ...item, unread: false } : item)));
    setUnreadTotalCount((current) => Math.max(0, current - 1));

    try {
      await updateNotificationReadStatus({ id, status: "READ" });
    } catch {
      setNotifications((current) => current.map((item) => (item.id === id ? { ...item, unread: true } : item)));
      setDialogNotifications((current) => current.map((item) => (item.id === id ? { ...item, unread: true } : item)));
      setUnreadTotalCount((current) => current + 1);
    }
  };

  const handleSeeAllNotifications = async () => {
    setNotificationsPopoverOpen(false);
    setAllNotificationsOpen(true);
  };

  const handleSeeMoreNotifications = async () => {
    if (dialogLoadingMore || !dialogHasNextPage) return;
    setDialogLoadingMore(true);
    try {
      const response = await fetchNotificationPage(buildNotificationPayload(DIALOG_PAGE_SIZE, dialogOffset));
      const nextBatch = response.data
        .map(mapPacketToNotification)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      setDialogNotifications((current) =>
        [...current, ...nextBatch]
          .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
          .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
      );
      const nextOffset = dialogOffset + response.data.length;
      setDialogOffset(nextOffset);
      const resolvedAllCount = response.allCount || response.count || allNotificationCount;
      setAllNotificationCount((current) => Math.max(current, resolvedAllCount));
      setDialogHasNextPage(nextOffset < resolvedAllCount);
    } finally {
      setDialogLoadingMore(false);
    }
  };

  const loadNotificationSettings = useCallback(async () => {
    setNotificationsPopoverOpen(false);
    setNotificationSettingsOpen(true);
    setNotificationSettingsLoading(true);
    setNotificationSettingsError("");
    setNotificationSettingsSubmitError("");
    setNotificationSettingsEditMode(false);
    setNotificationSettingsSaving(false);

    try {
      const response = await fetchNotificationSettings();
      const normalizedCompanies = normalizeNotificationSettingsCompanies(response);
      setNotificationSettingsCompanies(normalizedCompanies);
      setNotificationSettingsInitialCompanies(cloneNotificationSettingsCompanies(normalizedCompanies));
      setCollapsedNotificationSettingsNodePaths([]);

      const nextCompanyCode =
        normalizedCompanies.find((company) => company.companyCode === selectedNotificationSettingsCompanyCode)?.companyCode
        ?? normalizedCompanies[0]?.companyCode
        ?? "";
      setSelectedNotificationSettingsCompanyCode(nextCompanyCode);
      setSelectedNotificationSettingsNodePath(
        flattenNotificationSettingsTree(
          normalizedCompanies.find((company) => company.companyCode === nextCompanyCode)?.nodes ?? [],
        )[0]?.node.nodePath ?? "",
      );
    } catch (error) {
      setNotificationSettingsCompanies([]);
      setNotificationSettingsInitialCompanies([]);
      setCollapsedNotificationSettingsNodePaths([]);
      setSelectedNotificationSettingsCompanyCode("");
      setSelectedNotificationSettingsNodePath("");
      setNotificationSettingsError(getApiErrorMessage(error, "Unable to load notification settings."));
    } finally {
      setNotificationSettingsLoading(false);
    }
  }, [selectedNotificationSettingsCompanyCode]);

  const updateNotificationSettingsNode = useCallback(
    (nodePath: string, updater: (node: NotificationSettingsTreeNode) => NotificationSettingsTreeNode) => {
      if (!selectedNotificationSettingsCompany) return;

      setNotificationSettingsCompanies((current) =>
        current.map((company) =>
          company.companyCode !== selectedNotificationSettingsCompany.companyCode
            ? company
            : {
              ...company,
              nodes: mapNotificationSettingsNodes(company.nodes, nodePath, updater),
            },
        ),
      );
    },
    [selectedNotificationSettingsCompany],
  );

  const handleNotificationSettingsNodeToggle = useCallback(
    (nodePath: string, checked: boolean) => {
      if (!notificationSettingsEditMode || notificationSettingsSaving) return;
      updateNotificationSettingsNode(nodePath, (node) => ({
        ...node,
        nodeEnabled: checked,
        settings: node.settings.map((setting) => ({
          ...setting,
          isEnabled: checked,
        })),
      }));
      focusNotificationSettingsNode(nodePath);
    },
    [focusNotificationSettingsNode, notificationSettingsEditMode, notificationSettingsSaving, updateNotificationSettingsNode],
  );

  const handleNotificationSettingsModuleToggle = useCallback(
    (nodePath: string, moduleName: string, checked: boolean) => {
      if (!notificationSettingsEditMode || notificationSettingsSaving) return;
      updateNotificationSettingsNode(nodePath, (node) => ({
        ...node,
        settings: node.settings.map((setting) =>
          setting.module === moduleName
            ? {
              ...setting,
              isEnabled: checked,
            }
            : setting,
        ),
      }));
    },
    [notificationSettingsEditMode, notificationSettingsSaving, updateNotificationSettingsNode],
  );

  const handleNotificationSettingsDialogChange = useCallback((nextOpen: boolean) => {
    setNotificationSettingsOpen(nextOpen);
    if (!nextOpen) {
      setNotificationSettingsEditMode(false);
      setNotificationSettingsSaving(false);
      setNotificationSettingsSubmitError("");
      setNotificationSettingsCompanies(cloneNotificationSettingsCompanies(notificationSettingsInitialCompanies));
      setCollapsedNotificationSettingsNodePaths([]);
    }
  }, [notificationSettingsInitialCompanies]);

  const handleNotificationSettingsSubmit = useCallback(async () => {
    if (pendingNotificationSettingsChangeCount === 0 || notificationSettingsSaving) return;

    setNotificationSettingsSaving(true);
    setNotificationSettingsSubmitError("");

    try {
      await updateNotificationSettings(pendingNotificationSettingsPayload);
      const nextBaseline = cloneNotificationSettingsCompanies(notificationSettingsCompanies);
      setNotificationSettingsInitialCompanies(nextBaseline);
      setNotificationSettingsCompanies(cloneNotificationSettingsCompanies(nextBaseline));
      setNotificationSettingsEditMode(false);
    } catch (error) {
      setNotificationSettingsSubmitError(getApiErrorMessage(error, "Unable to save notification settings."));
    } finally {
      setNotificationSettingsSaving(false);
    }
  }, [
    notificationSettingsCompanies,
    notificationSettingsSaving,
    pendingNotificationSettingsChangeCount,
    pendingNotificationSettingsPayload,
  ]);

  const renderNotificationCard = (notification: NotificationItem, key: string, compact = false) => {
    const styles = statusStyles[notification.badgeTone];
    const isExpanded = expandedNotificationIds.includes(notification.id);
    const messageToShow = isExpanded ? notification.message : notification.previewMessage;
    const normalizedTitle = notification.title.trim().toUpperCase();
    const cardStateClassName = notification.unread
      ? "border-slate-300 bg-slate-200/80"
      : "border-slate-200 bg-white";
    const canShowViewDetails =
      !notification.isPending &&
      normalizedTitle !== "ORGANIZATION REMOVED" &&
      normalizedTitle !== "WORKFLOW ARCHIVE APPROVED" &&
      normalizedTitle !== "USER ARCHIVE APPROVED";
    const expandedTrackListMaxHeight = `${MAX_VISIBLE_TRACKS * 28}px`;

    return (
      <div
        key={key}
        className={`w-full overflow-hidden rounded-xl border border-l-4 ${notification.unread ? styles.unreadBorder : styles.readBorder
          } ${cardStateClassName} px-4 py-4 text-left shadow-sm transition-colors`}
        onDoubleClick={() => void markAsRead(notification.id)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              {notification.unread ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500 ring-2 ring-blue-100" />
              ) : null}
              <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
            </div>
            {notification.affectedHeading ? (
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {notification.affectedHeading}
              </p>
            ) : null}
          </div>
          <div className="shrink-0">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles.badge}`}>
              {notification.badgeLabel}
            </span>
          </div>
        </div>
        <div className="mt-2 w-full">
          {notification.affectedSegments.length > 1 && isExpanded ? (
            <div
              className="w-full space-y-1 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300"
              style={{ maxHeight: expandedTrackListMaxHeight }}
            >
              {notification.affectedSegments.map((segment, index) => (
                <p key={`${notification.id}-segment-${index}`} className="whitespace-normal break-words text-sm font-medium leading-5 text-slate-800">
                  {segment}
                </p>
              ))}
            </div>
          ) : (
            <p className="whitespace-normal break-words text-sm font-medium leading-5 text-slate-800">{messageToShow}</p>
          )}
          <p className="mt-1 text-xs leading-[1.35] text-slate-500">
            Initiated by {notification.initiatedByName} ({notification.initiatedByEmail})
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {notification.message.length > MESSAGE_PREVIEW_LIMIT || notification.affectedSegments.length > 1 ? (
              <button
                type="button"
                onClick={() => toggleNotificationExpansion(notification.id)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                {isExpanded ? "See less" : "See more"}
              </button>
            ) : null}
            {notification.isPending ? (
              <button
                type="button"
                onClick={() => void navigateFromNotification(notification, "approve")}
                className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
              >
                Approve Req
              </button>
            ) : canShowViewDetails ? (
              <button
                type="button"
                onClick={() => void navigateFromNotification(notification, "view")}
                className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
              >
                View Details
              </button>
            ) : null}
          </div>
          <p className="text-right text-xs font-medium text-slate-500">
            {compact ? formatRelativeTime(notification.occurredAt) : formatPastTimeline(notification.occurredAt)}
          </p>
        </div>
      </div>
    );
  };

  const renderNotificationFilters = (compact = false) => (
    <div className={`flex flex-col gap-3 border-b border-slate-200 bg-white ${compact ? "px-4 py-3" : "px-4 py-4"}`}>
      <div
        className={cn(
          "flex items-center",
          compact
            ? "flex-nowrap gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "flex-nowrap gap-2",
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                compact
                  ? "inline-flex h-9 min-w-[104px] items-center justify-between gap-1.5 rounded-xl border px-2.5 text-[12px] font-medium transition"
                  : "inline-flex h-9 min-w-[112px] items-center justify-between gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition",
                hasAnyNotificationFilter
                  ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <span className="truncate">{formatMultiFilterLabel(notificationStatusFilters, "All Status")}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-52 rounded-2xl border-slate-200 bg-white p-2 shadow-[0_22px_60px_rgba(15,23,42,0.18)]"
          >
            <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Status
            </div>
            <DropdownMenuCheckboxItem
              checked={notificationStatusFilters.length === 0}
              onCheckedChange={() => {
                setNotificationStatusFilters([]);
              }}
              onSelect={(event) => event.preventDefault()}
              className="rounded-lg py-2.5 pl-8 pr-2 text-sm"
            >
              <span>All</span>
            </DropdownMenuCheckboxItem>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={notificationStatusFilters.includes(option.value)}
                onCheckedChange={() => {
                  setNotificationStatusFilters((current) => toggleSingleSelectValue(current, option.value));
                }}
                onSelect={(event) => event.preventDefault()}
                className="rounded-lg py-2.5 pl-8 pr-2 text-sm"
              >
                <span>{option.label}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                compact
                  ? "inline-flex h-9 min-w-[104px] items-center justify-between gap-1.5 rounded-xl border px-2.5 text-[12px] font-medium transition"
                  : "inline-flex h-9 min-w-[112px] items-center justify-between gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition",
                hasAnyNotificationFilter
                  ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <span className="truncate">{formatMultiFilterLabel(notificationModuleFilters, "All Module")}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-56 rounded-2xl border-slate-200 bg-white p-2 shadow-[0_22px_60px_rgba(15,23,42,0.18)]"
          >
            <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Module
            </div>
            <DropdownMenuCheckboxItem
              checked={notificationModuleFilters.length === 0}
              onCheckedChange={() => {
                setNotificationModuleFilters([]);
              }}
              onSelect={(event) => event.preventDefault()}
              className="rounded-lg py-2.5 pl-8 pr-2 text-sm"
            >
              <span>All</span>
            </DropdownMenuCheckboxItem>
            {MODULE_FILTER_OPTIONS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={notificationModuleFilters.includes(option.value)}
                onCheckedChange={() => {
                  setNotificationModuleFilters((current) => toggleSingleSelectValue(current, option.value));
                }}
                onSelect={(event) => event.preventDefault()}
                className="rounded-lg py-2.5 pl-8 pr-2 text-sm"
              >
                <span>{option.label}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {DATE_RANGE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setNotificationDateRange(option);
              setCustomFromDate("");
              setCustomToDate("");
            }}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full font-semibold leading-none transition-colors",
              compact ? "px-2.5 py-[5px] text-[10px]" : "px-3 py-[5px] text-[11px]",
              activeDateRange === option
                ? "bg-blue-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            {option === "1MONTH" ? "1 Month" : option === "15DAYS" ? "15 Days" : "7 Days"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            if (notificationDateRange === "CUSTOM") {
              setNotificationDateRange(DEFAULT_DATE_RANGE);
              setCustomFromDate("");
              setCustomToDate("");
              return;
            }
            setNotificationDateRange("CUSTOM");
          }}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full font-semibold leading-none transition-colors",
            compact ? "px-3 py-[5px] text-[10px]" : "px-3.5 py-[5px] text-[11px]",
            activeDateRange === "CUSTOM"
              ? "bg-blue-600 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          )}
        >
          Custom
        </button>
      </div>
      {notificationDateRange === "CUSTOM" ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input
            type="date"
            max={customToDate || todayIso}
            value={customFromDate}
            onChange={(event) => handleCustomFromDateChange(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          />
          <input
            type="date"
            max={todayIso}
            min={customFromDate || undefined}
            value={customToDate}
            onChange={(event) => handleCustomToDateChange(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          />
        </div>
      ) : null}
    </div>
  );

  const renderNotificationSettingsNodeTree = () => {
    if (notificationSettingsLoading) {
      return (
        <div className="flex min-h-[20rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center">
          <p className="text-sm font-semibold text-slate-700">Loading notification settings...</p>
        </div>
      );
    }

    if (notificationSettingsError) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          {notificationSettingsError}
        </div>
      );
    }

    if (notificationSettingsFlowNodes.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No notification settings were returned for this company.
        </div>
      );
    }

    return (
      <div ref={notificationSettingsNodesScrollRef} className="max-h-[32rem] overflow-auto rounded-xl border border-slate-200 bg-white/80">
        <div className="space-y-2 p-3">
          {notificationSettingsFlowNodes.map((item) => {
            const appearance = getBranchAppearance(item.branchIndex, item.branchDepth, item.isRoot);
            const borderLeftClass = item.isRoot
              ? "border-l-indigo-400"
              : getNodeAccentBorderLeft(item.branchIndex, item.branchDepth, item.isRoot);
            const isSelected = selectedNotificationSettingsNodePath === item.node.nodePath;
            const isEnabled = getNotificationSettingsNodeToggleState(item.node);
            const hasChildren = item.node.children.length > 0;
            const isCollapsed = collapsedNotificationSettingsNodePaths.includes(item.node.nodePath);

            return (
              <div key={item.node.nodePath} className="w-full" style={{ paddingLeft: `${item.depth * 20}px` }}>
                <div
                  ref={(node) => {
                    registerNotificationSettingsNodeButton(item.node.nodePath)(node);
                    if (isSelected) {
                      notificationSettingsSelectedNodeRef.current = node;
                    } else if (notificationSettingsSelectedNodeRef.current === node) {
                      notificationSettingsSelectedNodeRef.current = null;
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => focusNotificationSettingsNode(item.node.nodePath)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      focusNotificationSettingsNode(item.node.nodePath);
                    }
                  }}
                  className={cn(
                    "group relative w-full overflow-hidden rounded-xl border bg-white px-3 py-2.5 text-left transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    isSelected
                      ? item.isRoot
                        ? "border border-indigo-200 bg-indigo-50/70 text-slate-800 shadow-[0_10px_22px_rgba(99,102,241,0.16)] border-l-[4px] border-l-indigo-400"
                        : cn(
                          "border-[rgb(53,83,233)] shadow-[0_0_0_3px_rgba(53,83,233,0.08)] bg-[rgb(53,83,233,0.02)] border-l-[4px]",
                          borderLeftClass,
                        )
                      : cn(
                        item.isRoot
                          ? "border border-indigo-100 bg-indigo-50/35 text-slate-800 shadow-[0_6px_16px_rgba(99,102,241,0.1)]"
                          : appearance.defaultSurfaceClass,
                        appearance.hoverBorderClass,
                        "border-l-[4px]",
                        borderLeftClass,
                      ),
                  )}
                >
                  <span
                    className={cn("absolute left-0 top-0 h-full w-[4px] rounded-r-full", item.isRoot ? "bg-indigo-400" : borderLeftClass)}
                    aria-hidden="true"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {hasChildren ? (
                          <button
                            type="button"
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleNotificationSettingsBranch(item.node.nodePath);
                            }}
                            aria-label={isCollapsed ? `Expand ${item.node.nodeName}` : `Collapse ${item.node.nodeName}`}
                          >
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isCollapsed ? "-rotate-90" : "rotate-0")} />
                          </button>
                        ) : (
                          <span className="h-6 w-6 shrink-0" aria-hidden="true" />
                        )}
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                          {formatNodeLevelLabel(item.node.levelCount || item.depth + 1)}
                        </span>
                        <div className={cn("truncate text-[13px] font-semibold", "text-slate-800")}>{item.node.nodeName}</div>
                      </div>
                      <div className="mt-1 truncate pl-8 text-[10px] text-slate-500">{item.node.nodePath}</div>
                    </div>
                    <div
                      className="shrink-0"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Switch
                              checked={isEnabled}
                              disabled={!notificationSettingsEditMode || notificationSettingsSaving}
                              onCheckedChange={(checked) => handleNotificationSettingsNodeToggle(item.node.nodePath, checked)}
                              aria-label={`Toggle notifications for ${item.node.nodeName}`}
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{isEnabled ? "Enabled" : "Disabled"}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderNotificationSettingsDetails = () => {
    if (notificationSettingsLoading) {
      return (
        <div className="flex min-h-[20rem] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 text-center">
          <p className="text-sm font-semibold text-slate-700">Preparing node settings...</p>
        </div>
      );
    }

    if (!selectedNotificationSettingsNode) {
      return (
        <div className="flex min-h-[20rem] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 text-center">
          <div>
            <p className="text-sm font-semibold text-slate-800">Select a node</p>
            <p className="mt-1 text-xs text-slate-500">Its module notification settings will appear here.</p>
          </div>
        </div>
      );
    }

    const nodeEnabled = getNotificationSettingsNodeToggleState(selectedNotificationSettingsNode);

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="inline-flex flex-col">
              <p className="text-sm font-semibold text-slate-800">Node Notifications</p>
              <span className="mt-1 h-px w-16 rounded-full bg-slate-300" aria-hidden="true" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">
                {formatNodeLevelLabel(selectedNotificationSettingsNode.levelCount)}
              </span>
              <h3 className="text-lg font-semibold text-slate-900">{selectedNotificationSettingsNode.nodeName}</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">{selectedNotificationSettingsNode.nodePath}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Node Level</p>
            <div className="mt-2 flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Switch
                      checked={nodeEnabled}
                      disabled={!notificationSettingsEditMode || notificationSettingsSaving}
                      onCheckedChange={(checked) => handleNotificationSettingsNodeToggle(selectedNotificationSettingsNode.nodePath, checked)}
                      aria-label={`Toggle notifications for ${selectedNotificationSettingsNode.nodeName}`}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">{nodeEnabled ? "Enabled" : "Disabled"}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="inline-flex flex-col">
            <p className="text-sm font-semibold text-slate-800">Module Notifications</p>
            <span className="mt-1 h-px w-16 rounded-full bg-slate-300" aria-hidden="true" />
          </div>
          {selectedNotificationSettingsNode.settings.length > 0 ? (
            selectedNotificationSettingsNode.settings.map((setting) => (
              <div
                key={`${selectedNotificationSettingsNode.nodePath}-${setting.module}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{formatModuleLabel(setting.module)}</p>
                </div>
                <div className="flex items-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Switch
                          checked={setting.isEnabled}
                          disabled={!notificationSettingsEditMode || notificationSettingsSaving}
                          onCheckedChange={(checked) =>
                            handleNotificationSettingsModuleToggle(selectedNotificationSettingsNode.nodePath, setting.module, checked)
                          }
                          aria-label={`Toggle ${formatModuleLabel(setting.module)} notifications`}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{setting.isEnabled ? "Enabled" : "Disabled"}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
              No module-level notification settings are available for this node.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-card px-3 sm:px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <Sheet open={mobileNavOpen} onOpenChange={onMobileNavOpenChange}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <AppSidebar mobile locationPathname={locationPathname} onNavigate={() => onMobileNavOpenChange(false)} onLogout={onLogout} />
          </SheetContent>
        </Sheet>
        <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={onToggleCollapsed}>
          <Menu className="h-4 w-4" />
        </Button>
        <div className="md:hidden">
          <p className="text-sm font-semibold text-foreground">Admin Portal</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Popover
          open={notificationsPopoverOpen}
          onOpenChange={(nextOpen) => {
            setNotificationsPopoverOpen(nextOpen);
            if (!nextOpen) resetNotificationFilters();
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {!hiddenStatusSelected && unreadTotalCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                  {unreadCountBadgeLabel}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="mr-0 w-[min(560px,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl sm:mr-2" align="end">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center gap-2">
                <p className="text-[1.05rem] font-semibold tracking-tight text-slate-900">Notifications ({notificationCountLabel})</p>
                {!hiddenStatusSelected ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {unreadCountLabel}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => void loadNotificationSettings()}
                  className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                >
                  Manage Notifications
                </button>
                <button
                  type="button"
                  onClick={() => void markAllAsRead()}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                >
                  Mark all read
                </button>
              </div>
            </div>
            {renderNotificationFilters(true)}
            <div className="flex h-[560px] flex-col bg-slate-50/60">
              <div className="flex-1 overflow-y-auto p-3">
                {visibleNotifications.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 px-4 text-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">All caught up</p>
                      <p className="mt-1 text-xs text-slate-500">No recent notifications available.</p>
                    </div>
                  </div>
                ) : visibleNotifications.map((notification, index) => (
                  <div key={notification.id} className={index === visibleNotifications.length - 1 ? "" : "mb-3"}>
                    {renderNotificationCard(notification, notification.id, true)}
                  </div>
                ))}
              </div>
              {shouldShowSeeAll ? (
                <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => void handleSeeAllNotifications()}
                    className="w-full rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                  >
                    See all notifications {remainingNotificationCount > 0 ? `+${remainingNotificationCount}` : ""}
                  </button>
                </div>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>

        <Dialog
          open={allNotificationsOpen}
          onOpenChange={(nextOpen) => {
            setAllNotificationsOpen(nextOpen);
            if (!nextOpen) resetNotificationFilters();
          }}
        >
          <DialogContent showCloseButton={false} className="flex flex-col gap-0 max-h-[88vh] w-[min(94vw,760px)] max-w-[760px] overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl">
            <DialogHeader className="border-b border-slate-200 px-6 py-4">
              <DialogDescription className="sr-only">
                Review, filter, and manage all notifications.
              </DialogDescription>
              <DialogTitle className="flex items-center justify-between text-slate-900">
                <span>All Notifications ({hasAnyNotificationFilter ? visibleDialogNotifications.length : (allNotificationCount || dialogNotifications.length)})</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAllNotificationsOpen(false);
                      resetNotificationFilters();
                      void loadNotificationSettings();
                    }}
                    className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    Manage Notifications
                  </button>
                  <button
                    type="button"
                    onClick={() => void markAllAsRead()}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                  >
                    Mark all read
                  </button>
                  <button type="button" onClick={() => {
                    setAllNotificationsOpen(false);
                    resetNotificationFilters();
                  }} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Close notifications">
                    ×
                  </button>
                </div>
              </DialogTitle>
            </DialogHeader>
            {renderNotificationFilters()}
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-4">
              {dialogLoading ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 px-4 text-center">
                  <p className="text-sm font-semibold text-slate-700">Loading notifications...</p>
                </div>
              ) : null}

              {!dialogLoading &&
                groupedDialogNotifications.today.length +
                groupedDialogNotifications.yesterday.length +
                groupedDialogNotifications.earlier.length +
                groupedDialogNotifications.upcoming.length ===
                0 ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 px-4 text-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">No notifications</p>
                    <p className="mt-1 text-xs text-slate-500">Latest updates will appear here.</p>
                  </div>
                </div>
              ) : null}

              {!dialogLoading ? (
                <div className="space-y-3">
                  {([
                    ["Today", groupedDialogNotifications.today],
                    ["Yesterday", groupedDialogNotifications.yesterday],
                    ["Earlier", groupedDialogNotifications.earlier],
                    ["Upcoming", groupedDialogNotifications.upcoming],
                  ] as const).map(([label, rows]) =>
                    rows.length > 0 ? (
                      <div key={label} className="space-y-3">
                        <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
                        {rows.map((notification) => renderNotificationCard(notification, `${label}-${notification.id}`))}
                      </div>
                    ) : null,
                  )}
                </div>
              ) : null}
            </div>
            {dialogHasNextPage ? (
              <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
                <button
                  type="button"
                  onClick={() => void handleSeeMoreNotifications()}
                  disabled={dialogLoadingMore}
                  className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {dialogLoadingMore
                    ? "Loading..."
                    : `See more notifications${dialogRemainingNotificationCount > 0 ? ` +${dialogRemainingNotificationCount}` : ""}`}
                </button>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={notificationSettingsOpen} onOpenChange={handleNotificationSettingsDialogChange}>
          <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} showCloseButton={false} className={cn("flex flex-col gap-0 w-[min(96vw,1120px)] max-w-[1120px] overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl", (selectedNotificationSettingsCompany && flattenNotificationSettingsTree(selectedNotificationSettingsCompany.nodes, []).length > 3) ? "h-[88vh]" : "max-h-[88vh]")}>
            <DialogHeader className="border-b border-slate-200 px-6 py-5">
              <DialogDescription className="sr-only">
                Configure notification settings for companies, nodes, and modules.
              </DialogDescription>
              <DialogTitle className="flex flex-col gap-4 text-slate-900 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <span className="block text-[1.05rem] font-semibold">Manage Notifications</span>
                </div>
                <div className="flex items-center gap-2">
                  {!notificationSettingsEditMode && (
                    <button
                      type="button"
                      onClick={() => setNotificationSettingsEditMode(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleNotificationSettingsDialogChange(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close notification settings"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col bg-slate-50/60">
              <div className="border-b border-slate-200 bg-white px-6 py-3">
                <div className="flex flex-col gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Company</p>
                  </div>
                  {notificationSettingsCompanies.length > 1 ? (
                    <div className="w-full xl:w-[22rem]">
                      <Select
                        value={selectedNotificationSettingsCompany?.companyCode ?? ""}
                        onValueChange={(value) => {
                          setCollapsedNotificationSettingsNodePaths([]);
                          setSelectedNotificationSettingsCompanyCode(value);
                          const nextCompany = notificationSettingsCompanies.find((company) => company.companyCode === value);
                          setSelectedNotificationSettingsNodePath(flattenNotificationSettingsTree(nextCompany?.nodes ?? [])[0]?.node.nodePath ?? "");
                        }}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white">
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                        <SelectContent>
                          {notificationSettingsCompanies.map((company) => (
                            <SelectItem key={company.companyCode} value={company.companyCode}>
                              {company.companyName} ({company.companyCode})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : selectedNotificationSettingsCompany ? (
                    <p className="truncate text-sm font-medium text-slate-900">
                      {selectedNotificationSettingsCompany.companyName} ({selectedNotificationSettingsCompany.companyCode})
                    </p>
                  ) : null}
                </div>
              </div>

              <div ref={notificationSettingsPanelsRef} className="relative grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-hidden p-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
                {notificationSettingsArrowPosition ? (
                  <div
                    className="pointer-events-none absolute z-10 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm lg:flex"
                    style={{
                      left: `${notificationSettingsArrowPosition.left}px`,
                      top: `${notificationSettingsArrowPosition.top}px`,
                    }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </div>
                ) : null}
                <div ref={notificationSettingsLeftPanelRef} className="min-h-0 rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-slate-800">Organization Nodes</h3>
                  </div>
                  {renderNotificationSettingsNodeTree()}
                </div>

                <div ref={notificationSettingsRightPanelRef} className="min-h-0 overflow-auto">
                  {notificationSettingsSubmitError ? (
                    <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {notificationSettingsSubmitError}
                    </div>
                  ) : null}
                  {renderNotificationSettingsDetails()}
                </div>
              </div>
            </div>
            {notificationSettingsEditMode && (
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationSettingsCompanies(cloneNotificationSettingsCompanies(notificationSettingsInitialCompanies));
                    setNotificationSettingsEditMode(false);
                    setNotificationSettingsSubmitError("");
                  }}
                  disabled={notificationSettingsSaving}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleNotificationSettingsSubmit()}
                  disabled={pendingNotificationSettingsChangeCount === 0 || notificationSettingsSaving}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#3553e9] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2847dc] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {notificationSettingsSaving ? "Saving..." : `Submit Changes${pendingNotificationSettingsChangeCount > 0 ? ` (${pendingNotificationSettingsChangeCount})` : ""}`}
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:opacity-90"
              aria-label="Open profile details"
            >
              {(currentUser?.name || currentUser?.email || "U").charAt(0).toUpperCase()}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border-border bg-white p-0 text-foreground shadow-2xl">
            <div className="border-b border-border bg-white px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                  {(currentUser?.name || currentUser?.email || "User")
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[1.05rem] font-semibold leading-5 text-foreground">{currentUser?.name || "User"}</p>
                  <p className="truncate pt-0.5 text-sm text-muted-foreground">{currentUser?.email || "No email available"}</p>
                  {currentUser?.role ? (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      <ShieldCheck className="h-3 w-3" />
                      {currentUser.role}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-muted/20 p-4">
              {[
                { label: "My profile", icon: User, tone: "text-blue-700 bg-blue-50 border-blue-100" },
                { label: "Company Settings", icon: Settings, tone: "text-zinc-700 bg-zinc-100 border-zinc-200" },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="rounded-2xl border border-border bg-white px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => {
                    if (item.label === "My profile") {
                      navigate("/profile");
                      return;
                    }
                    if (item.label === "Company Settings") {
                      navigate("/settings");
                    }
                  }}
                >
                  <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl border ${item.tone}`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                </button>
              ))}
            </div>

            <div className="space-y-2 px-4 pb-4">
              <Button variant="outline" className="w-full justify-start rounded-xl border-slate-200 text-slate-700" onClick={() => navigate("/profile")}>
                <User className="mr-2 h-4 w-4" />
                View Profile
              </Button>
              <Button variant="destructive" className="w-full justify-start rounded-xl" onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
