import type { AppUser } from "@/contexts/AppContext";
import { apiFetch } from "@/services/client";

export type UserOnboardingPermission = {
  roleCategory: "TRANSACTIONAL" | "OPERATIONAL" | "SYSTEM_ACCESS";
  roleSubCategory: string;
  roleName: string;
  nodeName: string;
  nodePath: string;
  accessCategory?: "ALL_CHILD" | "IMMEDIATE_CHILD" | "NODE" | null;
  accessType?: "PRIMARY" | "SECONDARY";
};

export type UserOnboardingPayload = {
  basicDetails: {
    name: string;
    email: string;
    phone: string;
    designation: string;
    employeeId: string | null;
    reportingManager: string;
  };
  permissions: UserOnboardingPermission[];
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

type CompanyNodeWorkflow = {
  levelsHash: string;
  name: string;
  alias?: string;
};

type CompanyNodeWithWorkflows = {
  nodeName: string;
  nodePath: string;
  nodeType: string;
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

const COMPANY_USERS_PATH = "/api/v1/company-settings/user/fetch-all-users";
const COMPANY_NODES_PATH = "/api/v1/company-settings/user/fetch-company-nodes";
const NEW_USER_ONBOARD_PATH = "/api/v1/company-settings/user/initiate";
const NEW_GLOBAL_SIGNATORY_ONBOARD_PATH = "/api/v1/company-settings/user/initiate-global-signatory";
const USER_STATUS_UPDATE_PATH = "/api/v1/company-settings/user/action";
const USER_HISTORY_PATH = "/api/v1/company-settings/user/fetch-history";

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
      workflows,
    };
  });

  return {
    nodes,
    access: {
      designation: readString(payload.access?.designation).trim(),
      isGlobalUser: Boolean(payload.access?.isGlobalUser),
    },
  };
}

export async function fetchCompanyNodes(subCategory: string): Promise<CompanyNodeWithWorkflows[]> {
  const result = await fetchCompanyNodesWithAccess(subCategory);
  return result.nodes;
}



export async function getCompanyUsers(_companyCode: string): Promise<AppUser[]> {
  const payload = await apiFetch<CompanyUsersResponse>(COMPANY_USERS_PATH, {
    method: "POST",
    body: JSON.stringify({ companyCode: _companyCode.trim().toUpperCase() }),
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
}
