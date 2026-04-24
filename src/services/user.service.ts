import type { AppUser } from "@/contexts/AppContext";
import { apiFetch } from "@/services/client";

type UserOnboardingPermission = {
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
  accessDetails: UserOnboardingPermission[];
};

type UserOnboardingResponse = {
  message: string;
  code?: number;
  data?: {
    userId?: string;
    status?: string;
  };
};

type UserOnboardingAction = "approve" | "reject";

type UserOnboardingActionResponse = {
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

const COMPANY_USERS_PATH = "/api/v1/users/fetch-all-users";
const NEW_USER_ONBOARD_PATH = "/api/v1/onboarding/user/initiate";
const USER_ACTION_PATH = "/api/v1/onboarding/user/action";

export function getFallbackCompanyUsers(companyCode: string): AppUser[] {
  const normalizedCompanyCode = companyCode.trim().toUpperCase();

  return [
    {
      id: `${normalizedCompanyCode}-ACTIVE-1`,
      name: "Aarav Sharma",
      email: "aarav.sharma@example.com",
      role: "Operations Manager",
      designation: "Operations Manager",
      department: "Operations",
      phone: "+91 98765 43210",
      companyId: normalizedCompanyCode,
      employeeId: "EMP-ACT-101",
      status: "Active",
      basicDetails: {
        name: "Aarav Sharma",
        email: "aarav.sharma@example.com",
        phone: "9876543210",
        companyOnboardingDate: "2026-04-14",
        designation: "Operations Manager",
        employeeId: "EMP-ACT-101",
        reportingManager: "lead@example.com",
      },
      accessDetails: [
        {
          roleCategory: "TRANSACTIONAL",
          roleSubCategory: "PAYMENTS",
          roleName: "Payments Viewer",
          accessType: "PRIMARY",
          nodeName: "Mumbai",
          nodePath: `${normalizedCompanyCode}.ALUMINUM.MUMBAI`,
        },
      ],
    },
    {
      id: `${normalizedCompanyCode}-PENDING-1`,
      name: "Neha Verma",
      email: "neha.verma@example.com",
      role: "Finance Analyst",
      designation: "Finance Analyst",
      department: "Finance",
      phone: "+91 91234 56780",
      companyId: normalizedCompanyCode,
      employeeId: "EMP-PEN-102",
      status: "Pending",
      basicDetails: {
        name: "Neha Verma",
        email: "neha.verma@example.com",
        phone: "9123456780",
        companyOnboardingDate: "2026-03-21",
        designation: "Finance Analyst",
        employeeId: "EMP-PEN-102",
        reportingManager: "lead@example.com",
      },
      accessDetails: [
        {
          roleCategory: "OPERATIONAL",
          roleSubCategory: "FINOPS",
          roleName: "Fin Ops User",
          nodeName: "Delhi",
          nodePath: `${normalizedCompanyCode}.ALUMINUM.DELHI`,
        },
      ],
    },
    {
      id: `${normalizedCompanyCode}-INACTIVE-1`,
      name: "Rohit Mehta",
      email: "rohit.mehta@example.com",
      role: "Procurement Lead",
      designation: "Procurement Lead",
      department: "Procurement",
      phone: "+91 90123 45678",
      companyId: normalizedCompanyCode,
      employeeId: "EMP-INACT-103",
      status: "Inactive",
      basicDetails: {
        name: "Rohit Mehta",
        email: "rohit.mehta@example.com",
        phone: "9012345678",
        companyOnboardingDate: "2026-02-10",
        designation: "Procurement Lead",
        employeeId: "EMP-INACT-103",
        reportingManager: "opslead@example.com",
      },
      accessDetails: [
        {
          roleCategory: "SYSTEM_ACCESS",
          roleSubCategory: "USER_ACC",
          roleName: "User Access Viewer",
          nodeName: "Kolkata",
          nodePath: `${normalizedCompanyCode}.ALUMINUM.KOLKATA`,
        },
      ],
    },
  ];
}

const toRecord = (value: unknown): RawUserRecord =>
  typeof value === "object" && value !== null ? (value as RawUserRecord) : {};

const readString = (value: unknown) => (typeof value === "string" ? value : "");

const mapAccessDetails = (record: RawUserRecord): NonNullable<AppUser["accessDetails"]> => {
  const entries = Array.isArray(record.accessDetails)
    ? record.accessDetails.filter((item): item is RawUserRecord => typeof item === "object" && item !== null)
    : [];

  return entries.map((entry) => ({
    roleCategory:
      readString(entry.roleCategory).trim().toUpperCase() === "OPERATIONAL"
        ? "OPERATIONAL"
        : readString(entry.roleCategory).trim().toUpperCase() === "SYSTEM_ACCESS"
          ? "SYSTEM_ACCESS"
          : "TRANSACTIONAL",
    roleSubCategory: readString(entry.roleSubCategory),
    roleName: readString(entry.roleName),
    nodeName: readString(entry.nodeName),
    nodePath: readString(entry.nodePath),
    accessType:
      readString(entry.accessType).trim().toUpperCase() === "SECONDARY"
        ? "SECONDARY"
        : readString(entry.accessType).trim().toUpperCase() === "PRIMARY"
          ? "PRIMARY"
          : undefined,
  }));
};

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
  const backendId =
    readString(record.id) ||
    readString(record.userId) ||
    readString(basicDetails.id) ||
    readString(basicDetails.userId);

  return {
    id: backendId || employeeId || email || name,
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
    basicDetails: {
      name,
      email,
      phone,
      companyOnboardingDate: onboardingDate,
      designation,
      employeeId,
      reportingManager,
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

export async function updateUserOnboardingAction(
  id: string,
  action: UserOnboardingAction,
  remark = "dpsdfadf",
) {
  return apiFetch<UserOnboardingActionResponse>(USER_ACTION_PATH, {
    method: "POST",
    body: JSON.stringify({
      action,
      remark,
      id,
    }),
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
