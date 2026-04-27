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
    reportingManager: string;
  };
  primary: UserOnboardingPermission[];
  secondary: UserOnboardingPermission[];
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

const COMPANY_USERS_PATH = "/api/v1/company-settings/user/fetch-all-users";
const NEW_USER_ONBOARD_PATH = "/api/v1/company-settings/user/initiate";
const USER_ACTION_PATH = "/api/v1/company-settings/user/action";

const toRecord = (value: unknown): RawUserRecord =>
  typeof value === "object" && value !== null ? (value as RawUserRecord) : {};

const readString = (value: unknown) => (typeof value === "string" ? value : "");

const mapAccessDetails = (record: RawUserRecord): NonNullable<AppUser["accessDetails"]> => {
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

  const entries = primaryArr.length > 0 || secondaryArr.length > 0
    ? [...primaryArr, ...secondaryArr]
    : legacyArr;

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
  const name = readString(record.name) || readString(basicDetails.name);
  const email = readString(record.email) || readString(basicDetails.email);
  const designation = readString(record.designation) || readString(basicDetails.designation);
  const phone = readString(record.phone) || readString(basicDetails.phone);
  const onboardingDate = readString(record.onboardingDate) || readString(basicDetails.companyOnboardingDate);
  const reportingManager = readString(basicDetails.reportingManager);
  const employeeId = readString(record.employeeId) || readString(basicDetails.employeeId);
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
  console.log("EXACT PAYLOAD BEING SENT TO BACKEND:", JSON.stringify(payload, null, 2));
  return apiFetch<UserOnboardingResponse>(NEW_USER_ONBOARD_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUserOnboardingAction(
  id: string,
  action: UserOnboardingAction,
  remark: string,
) {
  return apiFetch<UserOnboardingActionResponse>(USER_ACTION_PATH, {
    method: "POST",
    body: JSON.stringify({
      id,
      action,
      remark,
    }),
  });
}

// ─── Realistic mock (replace apiFetch call below once backend is live) ────────
const MOCK_USERS_RESPONSE = {
  message: "Users fetched successfully!",
  code: 200,
  data: {
    activeUsers: [
      {
        basicDetails: {
          name: "Arham Vipul Mehta",
          email: "arhammehta26@gmail.com",
          phone: "09324041063",
          companyOnboardingDate: "01-03-2024",
          designation: "CEO",
          reportingManager: "N/A",
        },
        primary: [
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "PURCHASE_ORDER",
            roleName: "Purchase Order Manager",
            nodeName: "Mumbai",
            nodePath: "TECH_SOLUTIONS_LTD.ALUMINUM.MUMBAI",
            accessType: "PRIMARY",
          },
        ],
        secondary: [
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "USER_MANAGEMENT",
            roleName: "User Management Manager",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.ROOT",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "ACCOUNTS",
            roleName: "Accounts Viewer",
            nodeName: "Finance",
            nodePath: "TECH_SOLUTIONS_LTD.ALUMINUM.MUMBAI.FINANCE",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "OPERATIONAL",
            roleSubCategory: "MASTER",
            roleName: "Master User",
            nodeName: "Strategy",
            nodePath: "TECH_SOLUTIONS_LTD.STRATEGY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "ORG_STRUCTURE",
            roleName: "Org Structure Viewer",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.ROOT",
            accessType: "SECONDARY",
          },
        ],
      },
      {
        basicDetails: {
          name: "Priya Sharma",
          email: "priya.sharma@techsolutions.com",
          phone: "09812345678",
          companyOnboardingDate: "15-06-2023",
          designation: "Finance Head",
          reportingManager: "arhammehta26@gmail.com",
        },
        primary: [
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "ACCOUNTS",
            roleName: "Accounts Manager",
            nodeName: "Finance",
            nodePath: "TECH_SOLUTIONS_LTD.ALUMINUM.MUMBAI.FINANCE",
            accessType: "PRIMARY",
          },
        ],
        secondary: [
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "INVOICE",
            roleName: "Invoice Manager",
            nodeName: "Finance",
            nodePath: "TECH_SOLUTIONS_LTD.STEEL.FINANCE",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "PURCHASE_ORDER",
            roleName: "Purchase Order Viewer",
            nodeName: "Procurement",
            nodePath: "TECH_SOLUTIONS_LTD.ALUMINUM.MUMBAI.FINANCE.PROCUREMENT",
            accessType: "SECONDARY",
          },
        ],
      },
      {
        basicDetails: {
          name: "Rohan Desai",
          email: "rohan.desai@techsolutions.com",
          phone: "09876543210",
          companyOnboardingDate: "10-01-2024",
          designation: "Operations Manager",
          reportingManager: "arhammehta26@gmail.com",
        },
        primary: [
          {
            roleCategory: "OPERATIONAL",
            roleSubCategory: "MASTER",
            roleName: "Master Manager",
            nodeName: "Aluminum",
            nodePath: "TECH_SOLUTIONS_LTD.ALUMINUM",
            accessType: "PRIMARY",
          },
        ],
        secondary: [
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "TRACK_WORKFLOW",
            roleName: "Track Workflow Viewer",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.ROOT",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "PURCHASE_ORDER",
            roleName: "Purchase Order User",
            nodeName: "Kolkata",
            nodePath: "TECH_SOLUTIONS_LTD.ALUMINUM.KOLKATA",
            accessType: "SECONDARY",
          },
        ],
      },
    ],
    pendingUsers: [
      {
        basicDetails: {
          name: "Sneha Kulkarni",
          email: "sneha.kulkarni@techsolutions.com",
          phone: "09765432100",
          companyOnboardingDate: "22-04-2026",
          designation: "Procurement Analyst",
          reportingManager: "priya.sharma@techsolutions.com",
        },
        primary: [
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "PURCHASE_ORDER",
            roleName: "Purchase Order User",
            nodeName: "Procurement",
            nodePath: "TECH_SOLUTIONS_LTD.ALUMINUM.MUMBAI.FINANCE.PROCUREMENT",
            accessType: "PRIMARY",
          },
        ],
        secondary: [
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "INVOICE",
            roleName: "Invoice Viewer",
            nodeName: "Finance",
            nodePath: "TECH_SOLUTIONS_LTD.ALUMINUM.MUMBAI.FINANCE",
            accessType: "SECONDARY",
          },
        ],
      },
    ],
    inactiveUsers: [
      {
        basicDetails: {
          name: "Vikram Nair",
          email: "vikram.nair@techsolutions.com",
          phone: "09123456780",
          companyOnboardingDate: "05-09-2022",
          designation: "Strategy Lead",
          reportingManager: "arhammehta26@gmail.com",
        },
        primary: [
          {
            roleCategory: "OPERATIONAL",
            roleSubCategory: "MASTER",
            roleName: "Master Manager",
            nodeName: "Strategy",
            nodePath: "TECH_SOLUTIONS_LTD.STRATEGY",
            accessType: "PRIMARY",
          },
        ],
        secondary: [
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "ORG_STRUCTURE",
            roleName: "Org Structure Viewer",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.ROOT",
            accessType: "SECONDARY",
          },
        ],
      },
    ],
  },
};
// ─────────────────────────────────────────────────────────────────────────────

export async function getCompanyUsers(_companyCode: string): Promise<AppUser[]> {
  const payload = await apiFetch<CompanyUsersResponse>(COMPANY_USERS_PATH, {
    method: "POST",
    body: JSON.stringify({ companyCode: _companyCode.trim().toUpperCase() }),
  });
  // const payload: CompanyUsersResponse = MOCK_USERS_RESPONSE;

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
