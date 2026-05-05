import type { AppUser } from "@/contexts/AppContext";
import { apiFetch } from "@/services/client";

export type UserOnboardingPermission = {
  roleCategory: "TRANSACTIONAL" | "OPERATIONAL" | "SYSTEM_ACCESS";
  roleSubCategory: string;
  roleName: string;
  nodeName: string;
  nodePath: string;
  accessType?: "PRIMARY" | "SECONDARY";
};

export type UserOnboardingPayload = {
  basicDetails: {
    name: string;
    email: string;
    phone: string;
    designation: string;
    employeeId: string;
    reportingManager: string;
  };
  permissions: UserOnboardingPermission[];
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

const COMPANY_USERS_PATH = "/api/v1/company-settings/user/fetch-all-users";
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


const mapAccessDetails = (record: RawUserRecord, status: AppUser["status"]): NonNullable<AppUser["accessDetails"]> => {
  // Support both new format { primary: [...], secondary: [...] }
  // and old format { accessDetails: [...] }
  const primaryArr = Array.isArray(record.primary)
    ? (record.primary as RawUserRecord[])
    : [];
  const secondaryArr = Array.isArray(record.secondary)
    ? (record.secondary as RawUserRecord[])
    : [];
  const legacyArr = Array.isArray(record.accessDetails)
    ? (record.accessDetails as RawUserRecord[]).filter(
      (item): item is RawUserRecord => typeof item === "object" && item !== null,
    )
    : [];

  const entriesWithType: Array<{ entry: RawUserRecord; accessType?: "PRIMARY" | "SECONDARY" }> =
    primaryArr.length > 0 || secondaryArr.length > 0
      ? [
        ...primaryArr.map((entry) => ({ entry, accessType: "PRIMARY" as const })),
        ...secondaryArr.map((entry) => ({ entry, accessType: "SECONDARY" as const })),
      ]
      : legacyArr.map((entry) => ({ entry, accessType: undefined }));

  if (entriesWithType.length === 0) {
    return [];
  }

  const mappedEntries = entriesWithType.map(({ entry, accessType: detectedType }) => ({
    roleCategory:
      readString(entry.roleCategory).trim().toUpperCase() === "OPERATIONAL"
        ? "OPERATIONAL"
        : readString(entry.roleCategory).trim().toUpperCase() === "SYSTEM_ACCESS"
          ? "SYSTEM_ACCESS"
          : "TRANSACTIONAL",
    roleSubCategory: readNonEmptyString(entry.roleSubCategory, "USER_ACC"),
    roleName: readNonEmptyString(entry.roleName, "User Access Viewer"),
    nodeName: readNonEmptyString(entry.nodeName, "Default Node"),
    nodePath: readNonEmptyString(entry.nodePath, "DEFAULT.ROOT.NODE"),
    accessType: detectedType
      ? detectedType
      : readString(entry.accessType).trim().toUpperCase() === "SECONDARY"
        ? "SECONDARY"
        : "PRIMARY",
  }));


  return mappedEntries;
};

const getDepartmentFromAccessDetails = (record: RawUserRecord) => {
  // New format: primary[] → secondary[] → legacy accessDetails[]
  const primaryArr = Array.isArray(record.primary) ? record.primary : [];
  const secondaryArr = Array.isArray(record.secondary) ? record.secondary : [];
  const legacyArr = Array.isArray(record.accessDetails) ? record.accessDetails : [];

  const pool = primaryArr.length > 0 ? primaryArr
    : secondaryArr.length > 0 ? secondaryArr
      : legacyArr;

  const first = pool.find(
    (item): item is RawUserRecord => typeof item === "object" && item !== null,
  );
  return first && typeof first.nodeName === "string" ? first.nodeName : "";
};

const mapCompanyUser = (record: RawUserRecord, status: AppUser["status"]): AppUser => {
  const basicDetails = toRecord(record.basicDetails);
  const name = readNonEmptyString(readString(record.name) || readString(basicDetails.name), "Not available");
  const email = readNonEmptyString(readString(record.email) || readString(basicDetails.email), "no-email@example.com");
  const designation = readNonEmptyString(readString(record.designation) || readString(basicDetails.designation), "Not available");
  const phone = readNonEmptyString(readString(record.phone) || readString(basicDetails.phone), "9999999999");
  const onboardingDate =
    readString(record.onboardingDate) || readString(basicDetails.companyOnboardingDate) || readString(basicDetails.createdAt);
  const reportingManagerName = readNonEmptyString(
    readString(basicDetails.reportingManagerName) || readString(basicDetails.reportingManager),
    "Not available",
  );
  const reportingManagerEmail = readNonEmptyString(
    readString(basicDetails.reportingManagerEmail) || readString(record.manager && typeof record.manager === "object" ? (record.manager as RawUserRecord).email : ""),
    "not-available@example.com",
  );
  const employeeId = readNonEmptyString(readString(record.employeeId) || readString(basicDetails.employeeId), "EMP-0001");
  const initiatorName = readString(basicDetails.initiatorName).trim();
  const initiatorEmail = readString(basicDetails.initiatorEmail).trim();
  const initiatedAt = readString(basicDetails.initiatedDate).trim();
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
    manager: reportingManagerName
      ? {
        name: reportingManagerName,
        email: reportingManagerEmail,
      }
      : record.manager && typeof record.manager === "object"
        ? {
          name:
            typeof (record.manager as RawUserRecord).name === "string"
              ? ((record.manager as RawUserRecord).name as string)
              : "",
          email:
            typeof (record.manager as RawUserRecord).email === "string"
              ? ((record.manager as RawUserRecord).email as string)
              : "",
        }
        : undefined,
    status,
    basicDetails: {
      name,
      email,
      phone,
      companyOnboardingDate: onboardingDate || "",
      designation,
      employeeId,
      reportingManager: reportingManagerName,
      reportingManagerName,
      reportingManagerEmail,
      ...(initiatorName ? { initiatorName } : {}),
      ...(initiatorEmail ? { initiatorEmail } : {}),
      ...(initiatedAt ? { initiatedDate: initiatedAt } : {}),
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
