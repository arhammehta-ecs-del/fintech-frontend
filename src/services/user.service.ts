import type { AppUser } from "@/contexts/AppContext";
import { apiFetch } from "@/services/client";

type UserOnboardingPermission = {
  roleCategory: "TRANSACTIONAL" | "OPERATIONAL" | "SYSTEM_ACCESS";
  role_code: string;
  nodeName: string;
  nodePath: string;
  accessType?: "primary" | "secondary";
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

const COMPANY_USERS_PATH = "/api/v1/company-settings/all-users";
const NEW_USER_ONBOARD_PATH = "/api/v1/admin/users/onboard";

const toRecord = (value: unknown): RawUserRecord =>
  typeof value === "object" && value !== null ? (value as RawUserRecord) : {};

const readString = (value: unknown) => (typeof value === "string" ? value : "");

const getDepartmentFromAccessDetails = (record: RawUserRecord) => {
  const permissions = record.permissions;
  if (Array.isArray(permissions) && permissions.length > 0) {
    const firstPermission = permissions.find(
      (item): item is RawUserRecord => typeof item === "object" && item !== null,
    );
    if (firstPermission && typeof firstPermission.nodeName === "string") {
      return firstPermission.nodeName;
    }
  }

  const accessDetails = record.accessDetails;
  if (!Array.isArray(accessDetails) || accessDetails.length === 0) return "";

  const entries = accessDetails.filter(
    (item): item is RawUserRecord => typeof item === "object" && item !== null,
  );
  if (entries.length === 0) return "";

  const primaryEntry = entries.find(
    (entry) =>
      typeof entry.accessType === "string" &&
      entry.accessType.trim().toUpperCase() === "PRIMARY",
  );
  const selectedEntry = primaryEntry ?? entries[0];

  return typeof selectedEntry.nodeName === "string" ? selectedEntry.nodeName : "";
};

const mapCompanyUser = (record: RawUserRecord, status: AppUser["status"]): AppUser => {
  const basicDetails = toRecord(record.basicDetails);
  const employeeId = readString(record.employeeId) || readString(basicDetails.employeeId);
  const name = readString(record.name) || readString(basicDetails.name);
  const email = readString(record.email) || readString(basicDetails.email);
  const designation = readString(record.designation) || readString(basicDetails.designation);
  const phone = readString(record.phone) || readString(basicDetails.phone);
  const onboardingDate = readString(record.onboardingDate) || readString(basicDetails.companyOnboardingDate);
  const reportingManager = readString(basicDetails.reportingManager);

  return {
  id: employeeId || email || name,
  name,
  email,
  role: designation,
  designation,
  department: getDepartmentFromAccessDetails(record),
  phone,
  companyId: typeof record.companyId === "string" ? record.companyId : undefined,
  onboardingDate: onboardingDate || undefined,
  employeeId: employeeId || undefined,
  manager: reportingManager
    ? {
        name: reportingManager,
        email: reportingManager,
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
};
};

export async function createUserOnboarding(payload: UserOnboardingPayload) {
  return apiFetch<UserOnboardingResponse>(NEW_USER_ONBOARD_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCompanyUsers(companyCode: string): Promise<AppUser[]> {
  const payload = await apiFetch<CompanyUsersResponse>(COMPANY_USERS_PATH, {
    method: "POST",
    body: JSON.stringify({
      companyCode: companyCode.trim().toUpperCase(),
    }),
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
