import type { AppUser } from "@/contexts/AppContext";
import { apiFetch } from "@/services/client";

export type UserOnboardingPermission = {
  roleCategory: "TRANSACTIONAL" | "OPERATIONAL" | "SYSTEM_ACCESS" | "ALL";
  roleSubCategory: string;
  roleName: string;
  nodeName: string;
  nodePath?: string;
  accessCategory?: "ALL_CHILD" | "IMMEDIATE_CHILD" | "NODE" | null;
  accessType?: "PRIMARY" | "SECONDARY";
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

export type UserListStatusTab = "active" | "pending";

export type UserPaginatedRequest = {
  companyCode: string;
  limit: number;
  cursor: string | null;
  topCursor: string | null;
  page?: number | null;
  direction?: "NEXT" | "PREV";
  query?: string | null;
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
const COMPANY_NODES_CACHE_TTL_MS = 5000;
const companyNodesInFlight = new Map<string, Promise<CompanyNodesFetchResult>>();
const companyNodesCache = new Map<string, { expiresAt: number; value: CompanyNodesFetchResult }>();

const toRecord = (value: unknown): RawUserRecord =>
  typeof value === "object" && value !== null ? (value as RawUserRecord) : {};

const readString = (value: unknown) => (typeof value === "string" ? value : "");
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
  }));

  return mappedEntries;
};

const getDepartmentFromAccessDetails = (record: RawUserRecord) => {
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

  return firstSecondaryNode || "";
};

const mapCompanyUser = (record: RawUserRecord, status: AppUser["status"]): AppUser => {
  const basicDetails = toRecord(record.basicDetails);
  const name = readString(basicDetails.name).trim();
  const email = readString(basicDetails.email).trim();
  const designation = readString(basicDetails.designation).trim();
  const phone = readString(basicDetails.phone).trim();
  const onboardingDate = readString(basicDetails.createdAt) || readString(basicDetails.companyOnboardingDate);
  const reportingManagerName = readString(basicDetails.reportingManagerName).trim();
  const reportingManagerEmail = readString(basicDetails.reportingManagerEmail).trim();
  const employeeId = readString(basicDetails.employeeId).trim();
  const initiatorName = readString(basicDetails.initiatorName).trim();
  const initiatorEmail = readString(basicDetails.initiatorEmail).trim();
  const initiatedAt = readString(basicDetails.initiatedDate).trim();
  const workflowName = readString(basicDetails.workflowName).trim();
  const alias = readString(basicDetails.alias).trim();
  const backendId =
    readString(record.id).trim() ||
    readString(record.userId).trim() ||
    readString(basicDetails.id).trim() ||
    readString(basicDetails.userId).trim();
  const uuid = readString(record.uuid).trim() || readString(basicDetails.uuid).trim();
  const companyId = readString(record.companyId).trim();

  return {
    id: backendId || undefined,
    uuid: uuid || undefined,
    name,
    email,
    role: designation,
    designation,
    department: getDepartmentFromAccessDetails(record),
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

export async function fetchUserHistory(email: string, companyCode: string) {
  return apiFetch<UserHistoryResponse>(USER_HISTORY_PATH, {
    method: "POST",
    body: JSON.stringify({
      email,
      companyCode,
    }),
  });
}

export async function fetchCompanyNodesWithAccess(subCategory: string): Promise<CompanyNodesFetchResult> {
  const cacheKey = (subCategory || "").trim().toUpperCase();
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
  const result = await fetchCompanyNodesWithAccess(subCategory);
  return result.nodes;
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
        limit: 100,
        cursor,
        topCursor,
        direction: "NEXT",
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
    type: statusTab,
    limit: payload.limit,
    cursor: payload.cursor ?? null,
    topCursor: payload.topCursor ?? null,
    page: payload.page ?? null,
    direction: payload.direction ?? "NEXT",
    query: readString(payload.query).trim() || null,
  };
  const response = await apiFetch<UserPaginatedResponse>(COMPANY_USERS_PATH, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  const records = Array.isArray(response.data) ? response.data : [];
  const mappedUsers = records.map((record) => mapCompanyUser(record, statusTab === "pending" ? "Pending" : "Active"));

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
