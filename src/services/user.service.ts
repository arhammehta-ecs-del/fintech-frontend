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
};

const COMPANY_USERS_PATH = "/api/v1/company-settings/user/fetch-all-users";
const COMPANY_NODES_PATH = "/api/v1/company-settings/user/fetch-company-nodes";
const NEW_USER_ONBOARD_PATH = "/api/v1/company-settings/user/initiate";
const USER_STATUS_UPDATE_PATH = "/api/v1/company-settings/user/action";
const USER_HISTORY_PATH = "/api/v1/company-settings/user/fetch-history";

const toRecord = (value: unknown): RawUserRecord =>
  typeof value === "object" && value !== null ? (value as RawUserRecord) : {};

const readString = (value: unknown) => (typeof value === "string" ? value : "");
const readNonEmptyString = (value: unknown, fallback: string) => {
  const raw = readString(value).trim();
  return raw || fallback;
};
const normalizeAccessCategory = (value: unknown): "ALL_CHILD" | "IMMEDIATE_CHILD" | "NODE" | null => {
  const normalized = readString(value).trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "ALL_CHILD") return "ALL_CHILD";
  if (normalized === "IMMEDIATE_CHILD") return "IMMEDIATE_CHILD";
  if (normalized === "NODE") return "NODE";
  return null;
};


const mapAccessDetails = (record: RawUserRecord, status: AppUser["status"]): NonNullable<AppUser["accessDetails"]> => {
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
    accessType: detectedType
      ? detectedType
      : readString(entry.accessType).trim().toUpperCase() === "SECONDARY"
        ? "SECONDARY"
        : "PRIMARY",
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
  const name = readNonEmptyString(readString(basicDetails.name), "Not available");
  const email = readNonEmptyString(readString(basicDetails.email), "no-email@example.com");
  const designation = readNonEmptyString(readString(basicDetails.designation), "Not available");
  const phone = readNonEmptyString(readString(basicDetails.phone), "9999999999");
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
    readString(record.id) ||
    readString(record.userId) ||
    readString(basicDetails.id) ||
    readString(basicDetails.userId);
  const uuid = readString(record.uuid) || readString(basicDetails.uuid);

  return {
    id: backendId || email || name,
    uuid,
    name,
    email,
    role: designation,
    designation,
    department: getDepartmentFromAccessDetails(record),
    phone,
    companyId: typeof record.companyId === "string" ? record.companyId : undefined,
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
    accessDetails: mapAccessDetails(record, status),
  };
};

export async function createUserOnboarding(payload: UserOnboardingPayload) {
  console.log("EXACT PAYLOAD BEING SENT TO BACKEND:", JSON.stringify(payload, null, 2));
  return apiFetch<UserOnboardingResponse>(NEW_USER_ONBOARD_PATH, {
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
  return apiFetch<any>(USER_HISTORY_PATH, {
    method: "POST",
    body: JSON.stringify({
      email,
      companyCode,
    }),
  });
}

export async function fetchCompanyNodes(subCategory: string): Promise<CompanyNodeWithWorkflows[]> {
  const payload = await apiFetch<CompanyNodesResponse>(COMPANY_NODES_PATH, {
    method: "POST",
    body: JSON.stringify({
      subCategory,
    }),
  });

  const rows = Array.isArray(payload.data) ? payload.data : [];

  return rows.map((row) => {
    const record = toRecord(row);
    const workflowsRaw = Array.isArray(record.workflows) ? (record.workflows as RawUserRecord[]) : [];
    const workflows = workflowsRaw.map((workflow) => ({
      levelsHash: readString(workflow.levelsHash).trim() || readString(workflow.id).trim(),
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
}



export async function getCompanyUsers(_companyCode: string): Promise<AppUser[]> {
  const payload = await apiFetch<CompanyUsersResponse>(COMPANY_USERS_PATH, {
    method: "POST",
    body: JSON.stringify({ companyCode: _companyCode.trim().toUpperCase() }),
  });

  const activeUsers = Array.isArray(payload.data?.activeUsers)
    ? payload.data.activeUsers.map((record) => mapCompanyUser(record, "Active"))
    : [];
  const pendingUsers = Array.isArray(payload.data?.pendingUsers)
    ? payload.data.pendingUsers.map((record) => mapCompanyUser(record, "Pending"))
    : [];
  const inactiveUsers = Array.isArray(payload.data?.inactiveUsers)
    ? payload.data.inactiveUsers.map((record) => mapCompanyUser(record, "Inactive"))
    : [];

  return [...activeUsers, ...pendingUsers, ...inactiveUsers];
}
