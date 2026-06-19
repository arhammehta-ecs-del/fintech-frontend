import type { AppUser } from "@/contexts/AppContext";
import { apiFetch } from "@/services/client";

export type UserOnboardingPermission = {
  roleCategory: "TRANSACTIONAL" | "OPERATIONAL" | "SYSTEM_ACCESS" | "ALL";
  roleSubCategory: string;
  roleName: string;
  nodeName: string;
  nodePath?: string;
  nodeType?: string;
  accessCategory?: "ALL_CHILD" | "IMMEDIATE_CHILD" | "NODE" | null;
  accessType?: "PRIMARY" | "SECONDARY";
  sourceTag?: string;
  remove?: boolean;
};

export type UserOnboardingPayload = {
  type?: "initiate" | "update" | "archive" | "active" | "inactive";
  targetUserEmail?: string | null;
  basicDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    designation?: string;
    employeeId?: string | null;
    reportingManager?: string | null;
  };
  permissions?: Array<Partial<UserOnboardingPermission>>;
  remarks?: string;
  levelsHash?: string | null;
};

type UserOnboardingResponse = {
  message: string;
  code?: number;
  data?: {
    userId?: string;
    status?: string;
  };
};

type UserStatusUpdateResponse = {
  message?: string;
  code?: number;
  success?: boolean;
  data?: unknown;
};
type UserHistoryResponse = {
  message?: string;
  code?: number;
  success?: boolean;
  data?: unknown;
};

type RawUserRecord = Record<string, unknown>;

type CompanyUsersPayload = {
  activeUsers?: RawUserRecord[];
  pendingUsers?: RawUserRecord[];
  inactiveUsers?: RawUserRecord[];
};

type CompanyUsersResponse = {
  success?: boolean;
  data?: CompanyUsersPayload;
};

type UserPageInfo = {
  page: number;
  totalPages: number;
  nextCursor: string | null;
  prevCursor: string | null;
  topCursor: string | null;
  hasNext: boolean;
  hasPrev: boolean;
  hasNewData: boolean;
  newCount: number;
};

type UserPaginatedResponse = {
  data?: RawUserRecord[];
  activeCount?: number;
  inactiveCount?: number;
  pendingCount?: number;
  pageInfo?: Partial<UserPageInfo>;
};

type UserDetailsResponse = {
  message?: string;
  code?: number;
  data?: RawUserRecord;
};

export type UserListStatusTab = "active" | "pending" | "inactive";

export type UserFilterDateRange = "7DAYS" | "15DAYS" | "1MONTH" | "1YEAR" | "CUSTOM" | null;

export type UserAppliedFilters = {
  designation: string[] | null;
  nodeName: {
    values: string[] | null;
    nodeAccess: Record<string, ("Primary" | "Secondary")[]> | "Primary" | "Secondary" | null;
  } | null;
  nodeType: string[] | null;
  category: string[] | null;
  subCategory: string[] | null;
  reportingManager: string[] | null;
  onboardingDate: {
    dateRange: UserFilterDateRange;
    fromDate: string | null;
    toDate: string | null;
  } | null;
  status: string[] | null;
  currentStatus: "modify" | "initiate" | null;
  role: string[] | null;
  hasPending: "Yes" | "No" | null;
};

export type UserPaginatedRequest = {
  companyCode: string;
  filter?: boolean;
  applied?: UserAppliedFilters | null;
  pagination: {
    limit: number;
    cursor: string | null;
    topCursor: string | null;
    page?: number | null;
    direction?: "NEXT" | "PREV";
    query?: string | null;
    statusType?: UserListStatusTab;
  };
};

export type UserPaginatedResult = {
  users: AppUser[];
  counts: {
    active: number;
    pending: number;
    inactive: number;
  };
  pageInfo: UserPageInfo;
};

export type FetchUserDetailsInput = {
  id?: string | null;
  email?: string | null;
  reportee?: boolean;
};

type CompanyNodeWorkflow = {
  levelsHash: string;
  name: string;
  alias?: string;
};

type CompanyNodeWithWorkflows = {
  nodeName: string;
  nodePath: string;
  nodeType: string;
  roleCode?: string;
  roleName?: string;
  workflows: CompanyNodeWorkflow[];
};

type CompanyNodesResponse = {
  message?: string;
  code?: number;
  data?: Array<Record<string, unknown>>;
  access?: {
    designation?: string;
    isGlobalUser?: boolean;
  };
};

type CompanyNodesFilterResponse = {
  success?: boolean;
  filter?: boolean;
  subCategory?: string;
  dropdowns?: {
    designation?: Array<{ value?: string; count?: number }>;
    nodeName?: Array<{ value?: string; path?: string; nodeType?: string; level?: number; levelCount?: string; count?: number; permissionCount?: number }>;
    nodeType?: Array<{ value?: string; count?: number }>;
    category?: string[];
    subCategory?: Record<string, string[]>;
    reportingManager?: string[];
    userStatusSummary?: Record<string, number>;
    permissionSummary?: Record<string, { count: number }>;
  };
};

export type CompanyNodesAccessMeta = {
  designation: string;
  isGlobalUser: boolean;
  roleName: string;
  roleCode: string;
};

export type CompanyNodesFetchResult = {
  nodes: CompanyNodeWithWorkflows[];
  access: CompanyNodesAccessMeta;
};

export type UserFilterDropdownOption = {
  value: string;
  count?: number;
};

export type UserFilterNodeOption = {
  value: string;
  path: string;
  level?: number;
  nodeType?: string;
  levelCount?: string;
};

export type PermissionSummaryEntry = {
  count: number;
};

export type UserFilterDropdowns = {
  designation: UserFilterDropdownOption[];
  nodeName: UserFilterNodeOption[];
  nodeType: UserFilterDropdownOption[];
  category: string[];
  subCategory: Record<string, string[]>;
  reportingManager: string[];
  userStatusSummary?: Record<string, number>;
  permissionSummary?: Record<string, PermissionSummaryEntry>;
};

export type GlobalSignatoryOnboardingPayload = {
  name: string;
  email: string;
  phone: string;
  designation: string;
  employeeId: string | null;
  isGlobalUser: true;
};

const COMPANY_USERS_PATH = "/api/v1/company-settings/user/fetch-all-user";
const COMPANY_NODES_PATH = "/api/v1/company-settings/user/fetch-company-nodes";
const NEW_USER_ONBOARD_PATH = "/api/v1/company-settings/user/initiate";
const NEW_GLOBAL_SIGNATORY_ONBOARD_PATH = "/api/v1/company-settings/user/initiate-global-signatory";
const USER_STATUS_UPDATE_PATH = "/api/v1/company-settings/user/action";
const USER_HISTORY_PATH = "/api/v1/company-settings/user/fetch-history";
const USER_DETAILS_PATH = "/api/v1/company-settings/user/details";
const COMPANY_NODES_CACHE_TTL_MS = 5000;
const companyNodesInFlight = new Map<string, Promise<CompanyNodesFetchResult>>();
const companyNodesCache = new Map<string, { expiresAt: number; value: CompanyNodesFetchResult }>();

const toRecord = (value: unknown): RawUserRecord =>
  typeof value === "object" && value !== null ? (value as RawUserRecord) : {};

const readString = (value: unknown) => (typeof value === "string" ? value : "");
const readNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const normalizeRoleDisplayName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const compact = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact === "corpadmin") return "Corp Admin";

  return trimmed;
};
const normalizeAccessCategory = (value: unknown): "ALL_CHILD" | "IMMEDIATE_CHILD" | "NODE" | null => {
  const normalized = readString(value).trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "ALL_CHILD") return "ALL_CHILD";
  if (normalized === "IMMEDIATE_CHILD") return "IMMEDIATE_CHILD";
  if (normalized === "NODE") return "NODE";
  return null;
};


const mapAccessDetails = (record: RawUserRecord): NonNullable<AppUser["accessDetails"]> => {
  const primaryArr = Array.isArray(record.primary)
    ? (record.primary as RawUserRecord[])
    : [];
  const secondaryArr = Array.isArray(record.secondary)
    ? (record.secondary as RawUserRecord[])
    : [];
  const entriesWithType: Array<{ entry: RawUserRecord; accessType: "PRIMARY" | "SECONDARY" }> = [
    ...primaryArr.map((entry) => ({ entry, accessType: "PRIMARY" as const })),
    ...secondaryArr.map((entry) => ({ entry, accessType: "SECONDARY" as const })),
  ];

  if (entriesWithType.length === 0) {
    return [];
  }

  const mappedEntries = entriesWithType.map(({ entry, accessType: detectedType }) => ({
    roleCategory: readString(entry.roleCategory).trim().toUpperCase(),
    roleSubCategory: readString(entry.roleSubCategory).trim(),
    roleName: readString(entry.roleName).trim(),
    nodeName: readString(entry.nodeName).trim(),
    nodePath: readString(entry.nodePath).trim(),
    nodeType: readString(entry.nodeType).trim(),
    accessCategory: normalizeAccessCategory(entry.accessCategory),
    accessType: detectedType,
    sourceTag: readString(entry.sourceTag).trim() || undefined,
  }));

  return mappedEntries;
};

const getDepartmentFromAccessDetails = (record: RawUserRecord) => {
  const basicDetails = toRecord(record.basicDetails);
  const primaryArr = Array.isArray(record.primary) ? record.primary : [];
  const secondaryArr = Array.isArray(record.secondary) ? record.secondary : [];
  const firstPrimaryNode = primaryArr
    .filter((item): item is RawUserRecord => typeof item === "object" && item !== null)
    .map((item) => readString(item.nodeName).trim())
    .find(Boolean);

  if (firstPrimaryNode) return firstPrimaryNode;

  const firstSecondaryNode = secondaryArr
    .filter((item): item is RawUserRecord => typeof item === "object" && item !== null)
    .map((item) => readString(item.nodeName).trim())
    .find(Boolean);

  if (firstSecondaryNode) return firstSecondaryNode;

  return readString(basicDetails.nodeName).trim() || "";
};

const getNodePathFromAccessDetails = (record: RawUserRecord) => {
  const basicDetails = toRecord(record.basicDetails);
  const primaryArr = Array.isArray(record.primary) ? record.primary : [];
  const secondaryArr = Array.isArray(record.secondary) ? record.secondary : [];
  const firstPrimaryPath = primaryArr
    .filter((item): item is RawUserRecord => typeof item === "object" && item !== null)
    .map((item) => readString(item.nodePath).trim())
    .find(Boolean);

  if (firstPrimaryPath) return firstPrimaryPath;

  const firstSecondaryPath = secondaryArr
    .filter((item): item is RawUserRecord => typeof item === "object" && item !== null)
    .map((item) => readString(item.nodePath).trim())
    .find(Boolean);

  if (firstSecondaryPath) return firstSecondaryPath;

  return readString((basicDetails as Record<string, unknown>).nodePath).trim() || readString(record.nodePath).trim() || "";
};

const getLevelCountFromPath = (nodePath: string, nodeType?: string) => {
  if ((nodeType || "").trim().toUpperCase() === "ROOT") return 1;
  const segments = nodePath
    .split(".")
    .map((item) => item.trim())
    .filter(Boolean);
  return segments.length > 0 ? segments.length : undefined;
};

const mapCompanyUser = (record: RawUserRecord, status: AppUser["status"]): AppUser => {
  const basicDetails = toRecord(record.basicDetails);
  const pendingRequest = toRecord(record.pendingRequest);
  const pendingOldData = toRecord(pendingRequest.oldData);
  const pendingNewData = toRecord(pendingRequest.newData);
  const oldData = Object.keys(pendingOldData).length > 0 ? pendingOldData : toRecord(record.oldData);
  const newData = Object.keys(pendingNewData).length > 0 ? pendingNewData : toRecord(record.newData);
  const name = readString(basicDetails.name).trim();
  const email = readString(basicDetails.email).trim();
  const designation = normalizeRoleDisplayName(readString(basicDetails.designation));
  const phone = readString(basicDetails.phone).trim();
  const onboardingDate = readString(basicDetails.createdAt) || readString(basicDetails.companyOnboardingDate);
  const reportingManagerName = readString(basicDetails.reportingManagerName).trim();
  const reportingManagerEmail = readString(basicDetails.reportingManagerEmail).trim();
  const employeeId = readString(basicDetails.employeeId).trim();
  const initiatorName = readString(basicDetails.initiatorName).trim();
  const initiatorEmail = readString(basicDetails.initiatorEmail).trim();
  const initiatedAt =
    readString(basicDetails.initiatedDate).trim() ||
    readString(pendingRequest.createdAt).trim() ||
    readString(record.createdAt).trim();
  const workflowName = readString(basicDetails.workflowName).trim();
  const alias = readString(basicDetails.alias).trim();
  const nodeTypeRaw = readString(basicDetails.nodeType).trim();
  const nodeNameRaw = readString(basicDetails.nodeName).trim();
  const nodePathRaw = readString(basicDetails.nodePath).trim();
  const requestType = readString(pendingRequest.type).trim() || readString(record.type).trim();
  const requestImpact = readString(pendingRequest.impact).trim() || readString(record.impact).trim();
  const pendingRequestStatus = readString(pendingRequest.status).trim().toUpperCase();
  const backendId =
    readString(record.id).trim() ||
    readString(record.userId).trim() ||
    readString(basicDetails.id).trim() ||
    readString(basicDetails.userId).trim();
  const requestId =
    readString(pendingRequest.id).trim() ||
    readString(pendingRequest.requestId).trim() ||
    readString(record.requestId).trim();
  const uuid = readString(record.uuid).trim() || readString(basicDetails.uuid).trim();
  const companyId = readString(record.companyId).trim();
  const isPending = Boolean(record.isPending) || pendingRequestStatus === "PENDING";
  const pendingApprovalCount = typeof record.pendingApprovalCount === "number" ? record.pendingApprovalCount : undefined;
  const nodePath = getNodePathFromAccessDetails(record);
  const levelCount =
    readNumber(record.levelCount) ??
    getLevelCountFromPath(nodePath, nodeTypeRaw);

  return {
    id: backendId || undefined,
    uuid: uuid || undefined,
    requestId: requestId || undefined,
    isPending,
    levelCount,
    pendingApprovalCount,
    name,
    email,
    role: designation,
    designation,
    department: getDepartmentFromAccessDetails(record),
    nodeName: nodeNameRaw || undefined,
    nodeType: nodeTypeRaw || undefined,
    nodePath: nodePath || undefined,
    phone,
    companyId: companyId || undefined,
    onboardingDate: onboardingDate || undefined,
    manager: {
      name: reportingManagerName,
      email: reportingManagerEmail,
    },
    status,
    basicDetails: {
      name,
      email,
      phone,
      companyOnboardingDate: onboardingDate || "",
      createdAt: onboardingDate || "",
      designation,
      employeeId,
      reportingManager: reportingManagerName,
      reportingManagerName,
      reportingManagerEmail,
      initiatorName: initiatorName || "",
      initiatorEmail: initiatorEmail || "",
      initiatedDate: initiatedAt || "",
      workflowName: workflowName || "",
      alias: alias || "",
      nodeType: nodeTypeRaw || "",
      nodeName: nodeNameRaw || "",
      nodePath: nodePathRaw || "",
      requestType: requestType || "",
      requestImpact: requestImpact || "",
      requestOldData: oldData,
      requestNewData: newData,
    },
    accessDetails: mapAccessDetails(record),
  };
};

const mapUserPageInfo = (pageInfo?: Partial<UserPageInfo>): UserPageInfo => ({
  page: Number(pageInfo?.page ?? 1) || 1,
  totalPages: Number(pageInfo?.totalPages ?? 0) || 0,
  nextCursor: readString(pageInfo?.nextCursor).trim() || null,
  prevCursor: readString(pageInfo?.prevCursor).trim() || null,
  topCursor: readString(pageInfo?.topCursor).trim() || null,
  hasNext: Boolean(pageInfo?.hasNext),
  hasPrev: Boolean(pageInfo?.hasPrev),
  hasNewData: Boolean(pageInfo?.hasNewData),
  newCount: Number(pageInfo?.newCount ?? 0) || 0,
});

export async function createUserOnboarding(payload: UserOnboardingPayload) {
  return apiFetch<UserOnboardingResponse>(NEW_USER_ONBOARD_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createGlobalSignatoryOnboarding(payload: GlobalSignatoryOnboardingPayload) {
  return apiFetch<UserOnboardingResponse>(NEW_GLOBAL_SIGNATORY_ONBOARD_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUserStatus(id: string, action: string, remark: string) {
  return apiFetch<UserStatusUpdateResponse>(USER_STATUS_UPDATE_PATH, {
    method: "POST",
    body: JSON.stringify({
      id,
      action,
      remark,
    }),
  });
}

export async function fetchUserHistory(email: string) {
  return apiFetch<UserHistoryResponse>(USER_HISTORY_PATH, {
    method: "POST",
    body: JSON.stringify({
      email,
    }),
  });
}

export async function fetchCompanyNodesWithAccess(subCategory: string, filter = false): Promise<CompanyNodesFetchResult> {
  const cacheKey = `${(subCategory || "").trim().toUpperCase()}::${filter ? "filter" : "default"}`;
  const now = Date.now();
  const cached = companyNodesCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inFlight = companyNodesInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const requestPromise = (async () => {
    const payload = await apiFetch<CompanyNodesResponse>(COMPANY_NODES_PATH, {
      method: "POST",
      body: JSON.stringify({
        subCategory,
        filter,
      }),
    });

    if (!Array.isArray(payload.data)) {
      throw new Error("Invalid company nodes response: data must be an array");
    }

    const nodes = payload.data.map((row) => {
      const record = toRecord(row);
      const workflowsRaw = record.workflows;
      if (!Array.isArray(workflowsRaw)) {
        throw new Error("Invalid company nodes response: workflows must be an array");
      }
      const workflows = workflowsRaw.map((workflow) => ({
        levelsHash: readString((workflow as RawUserRecord).levelsHash).trim(),
        name: readString(workflow.name).trim(),
        alias: readString(workflow.alias).trim() || undefined,
      }));

      return {
        nodeName: readString(record.nodeName).trim(),
        nodePath: readString(record.nodePath).trim(),
        nodeType: readString(record.nodeType).trim(),
        roleCode: readString(record.roleCode).trim().toUpperCase() || undefined,
        roleName: readString(record.roleName).trim() || undefined,
        workflows,
      };
    });

    const result: CompanyNodesFetchResult = {
      nodes,
      access: {
        designation: readString(payload.access?.designation).trim(),
        isGlobalUser: Boolean(payload.access?.isGlobalUser),
        roleName:
          readString((payload.access as Record<string, unknown> | undefined)?.roleName).trim() ||
          nodes.find((node) => (node.roleName || "").trim())?.roleName?.trim() ||
          "",
        roleCode:
          readString((payload.access as Record<string, unknown> | undefined)?.roleCode).trim().toUpperCase() ||
          nodes.find((node) => (node.roleCode || "").trim())?.roleCode?.trim().toUpperCase() ||
          "",
      },
    };
    companyNodesCache.set(cacheKey, {
      expiresAt: Date.now() + COMPANY_NODES_CACHE_TTL_MS,
      value: result,
    });
    return result;
  })();

  companyNodesInFlight.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    companyNodesInFlight.delete(cacheKey);
  }
}

export async function fetchCompanyNodes(subCategory: string): Promise<CompanyNodeWithWorkflows[]> {
  const result = await fetchCompanyNodesWithAccess(subCategory, false);
  return result.nodes;
}

export async function fetchUserFilterDropdowns(
  subCategory: string,
  applied: UserAppliedFilters | null = null,
): Promise<UserFilterDropdowns> {
  const payload = await apiFetch<CompanyNodesFilterResponse>(COMPANY_NODES_PATH, {
    method: "POST",
    body: JSON.stringify({
      subCategory,
      filter: true,
      applied,
    }),
  });

  const dropdowns = payload.dropdowns;
  if (!dropdowns) {
    throw new Error("Invalid company node filter response: missing dropdowns");
  }

  return {
    designation: Array.isArray(dropdowns.designation)
      ? dropdowns.designation
        .map((item) => ({
          value: normalizeRoleDisplayName(readString(item?.value)),
          count: typeof item?.count === "number" ? item.count : undefined,
        }))
        .filter((item) => item.value)
      : [],
    nodeName: Array.isArray(dropdowns.nodeName)
      ? dropdowns.nodeName
        .map((item) => ({
          value: readString(item?.value).trim(),
          path: readString(item?.path).trim(),
          level: typeof item?.level === "number" ? item.level : undefined,
          nodeType: typeof item?.nodeType === "string" ? item.nodeType.trim() : undefined,
          levelCount: typeof item?.levelCount === "string" ? item.levelCount.trim() : undefined,
        }))
        .filter((item) => item.value && item.path)
        .sort((a, b) => a.path.localeCompare(b.path))
      : [],
    nodeType: Array.isArray(dropdowns.nodeType)
      ? dropdowns.nodeType
        .map((item) => {
          if (typeof item === "string") return { value: readString(item).trim() };
          return {
            value: readString(item?.value).trim(),
            count: typeof item?.count === "number" ? item.count : undefined,
          };
        })
        .filter((item) => item.value)
      : [],
    category: Array.isArray(dropdowns.category)
      ? dropdowns.category.map((item) => readString(item).trim()).filter(Boolean)
      : [],
    subCategory:
      dropdowns.subCategory && typeof dropdowns.subCategory === "object"
        ? Object.fromEntries(
          Object.entries(dropdowns.subCategory).map(([key, values]) => [
            key,
            Array.isArray(values) ? values.map((item) => readString(item).trim()).filter(Boolean) : [],
          ]),
        )
        : {},
    reportingManager: Array.isArray(dropdowns.reportingManager)
      ? dropdowns.reportingManager.map((item) => readString(item).trim()).filter(Boolean)
      : [],
    userStatusSummary:
      dropdowns.userStatusSummary && typeof dropdowns.userStatusSummary === "object"
        ? (dropdowns.userStatusSummary as Record<string, number>)
        : undefined,
    permissionSummary:
      dropdowns.permissionSummary && typeof dropdowns.permissionSummary === "object"
        ? (dropdowns.permissionSummary as Record<string, PermissionSummaryEntry>)
        : undefined,
  };
}



export async function getCompanyUsers(_companyCode: string): Promise<AppUser[]> {
  const companyCode = _companyCode.trim().toUpperCase();

  // Backward compatibility: older backends may still expose the unified endpoint.
  try {
    const payload = await apiFetch<CompanyUsersResponse>(COMPANY_USERS_PATH, {
      method: "POST",
      body: JSON.stringify({ companyCode }),
    });

    if (!payload.data) {
      throw new Error("Invalid users response: missing data object");
    }
    const { activeUsers, pendingUsers, inactiveUsers } = payload.data;
    if (!Array.isArray(activeUsers) || !Array.isArray(pendingUsers) || !Array.isArray(inactiveUsers)) {
      throw new Error("Invalid users response: user buckets must be arrays");
    }

    const mappedActiveUsers = activeUsers.map((record) => mapCompanyUser(record, "Active"));
    const mappedPendingUsers = pendingUsers.map((record) => mapCompanyUser(record, "Pending"));
    const mappedInactiveUsers = inactiveUsers.map((record) => mapCompanyUser(record, "Inactive"));
    return [...mappedActiveUsers, ...mappedPendingUsers, ...mappedInactiveUsers];
  } catch {
    // Newer backends split user listing by status + cursor pagination.
  }

  const collectUsersByStatus = async (statusTab: UserListStatusTab) => {
    const allUsers: AppUser[] = [];
    let cursor: string | null = null;
    let topCursor: string | null = null;
    let hasNext = true;
    let safetyCounter = 0;

    while (hasNext && safetyCounter < 100) {
      safetyCounter += 1;
      const response = await fetchCompanyUsersPaginated(statusTab, {
        companyCode,
        pagination: {
          limit: 100,
          cursor,
          topCursor,
          direction: "NEXT",
          statusType: statusTab,
        },
      });
      allUsers.push(...response.users);
      cursor = response.pageInfo.nextCursor;
      topCursor = response.pageInfo.topCursor || topCursor;
      hasNext = Boolean(response.pageInfo.hasNext && response.pageInfo.nextCursor);
    }

    return allUsers;
  };

  const [activeUsers, pendingUsers] = await Promise.all([
    collectUsersByStatus("active"),
    collectUsersByStatus("pending"),
  ]);

  return [...activeUsers, ...pendingUsers];
}

export async function fetchCompanyUsersPaginated(
  statusTab: UserListStatusTab,
  payload: UserPaginatedRequest,
): Promise<UserPaginatedResult> {
  const requestBody: Record<string, unknown> = {
    filter: Boolean(payload.filter),
    pagination: {
      cursor: payload.pagination.cursor ?? null,
      direction: payload.pagination.direction ?? "NEXT",
      limit: payload.pagination.limit,
      page: payload.pagination.page ?? null,
      query: readString(payload.pagination.query).trim() || null,
      statusType: payload.pagination.statusType ?? statusTab,
      topCursor: payload.pagination.topCursor ?? null,
    },
    applied: payload.filter ? payload.applied ?? null : null,
  };
  const response = await apiFetch<UserPaginatedResponse>(COMPANY_USERS_PATH, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  const records = Array.isArray(response.data) ? response.data : [];
  const mappedUsers = records.map((record) =>
    mapCompanyUser(record, statusTab === "pending" ? "Pending" : statusTab === "inactive" ? "Inactive" : "Active"),
  );

  return {
    users: mappedUsers,
    counts: {
      active: Number(response.activeCount ?? 0) || 0,
      inactive: Number(response.inactiveCount ?? 0) || 0,
      pending: Number(response.pendingCount ?? 0) || 0,
    },
    pageInfo: mapUserPageInfo(response.pageInfo),
  };
}

export async function fetchUserDetails(
  statusTab: UserListStatusTab,
  payload: FetchUserDetailsInput,
): Promise<AppUser> {
  const id = readString(payload.id).trim();
  const email = readString(payload.email).trim();
  const reportee = Boolean(payload.reportee);
  const requestBody =
    statusTab === "pending"
      ? { id }
      : reportee
        ? { email, reportee: true }
        : { email };

  const response = await apiFetch<UserDetailsResponse>(USER_DETAILS_PATH, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  const record = toRecord(response.data);
  if (Object.keys(record).length === 0) {
    throw new Error("Invalid user details response: missing data object");
  }

  const normalizedRecord: RawUserRecord = {
    ...record,
    id: readString(record.id).trim() || id || undefined,
    isPending: statusTab === "pending" ? true : Boolean(record.isPending),
    type: readString(record.type).trim() || undefined,
    impact: readString(record.impact).trim() || undefined,
    basicDetails: toRecord(record.basicDetails),
    primary: Array.isArray(record.primary) ? record.primary : [],
    secondary: Array.isArray(record.secondary) ? record.secondary : [],
    oldData: toRecord(record.oldData),
    newData: toRecord(record.newData),
  };

  return mapCompanyUser(
    normalizedRecord,
    statusTab === "pending" ? "Pending" : statusTab === "inactive" ? "Inactive" : "Active",
  );
}
