import type { AppUser } from "@/contexts/AppContext";
import { apiFetch } from "@/services/client";
const USE_MOCK_DATA = String(import.meta.env.VITE_USE_ORG_MOCK).toLowerCase() === "true";

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
const USER_STATUS_UPDATE_PATH = "/api/v1/company-settings/user/update-status";

const toRecord = (value: unknown): RawUserRecord =>
  typeof value === "object" && value !== null ? (value as RawUserRecord) : {};

const readString = (value: unknown) => (typeof value === "string" ? value : "");
const readNonEmptyString = (value: unknown, fallback: string) => {
  const raw = readString(value).trim();
  return raw || fallback;
};

const buildDemoSecondaryAccess = (): NonNullable<AppUser["accessDetails"]> => [
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
    return [
      {
        roleCategory: "SYSTEM_ACCESS",
        roleSubCategory: "USER_ACC",
        roleName: "User Access Viewer",
        nodeName: "Default Node",
        nodePath: "DEFAULT.ROOT.NODE",
        accessType: "PRIMARY",
      },
    ];
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

  // For pending-user demo flow, ensure we always show a few secondary nodes.
  if (status === "Pending" && !mappedEntries.some((entry) => entry.accessType === "SECONDARY")) {
    return [...mappedEntries, ...buildDemoSecondaryAccess()];
  }

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
      companyOnboardingDate: onboardingDate || "01-01-2026",
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
  if (USE_MOCK_DATA) {
    return {
      message: "User onboarding initiated successfully (mock)",
      code: 200,
      data: {
        userId: `mock-${Date.now()}`,
        status: "Pending",
      },
    };
  }
  return apiFetch<UserOnboardingResponse>(NEW_USER_ONBOARD_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUserStatusByEmail(email: string) {
  if (USE_MOCK_DATA) {
    return {
      message: `User status updated for ${email} (mock)`,
      code: 200,
      success: true,
    };
  }
  return apiFetch<UserStatusUpdateResponse>(USER_STATUS_UPDATE_PATH, {
    method: "POST",
    body: JSON.stringify({
      email,
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
          email: "don",
          phone: "09324041063",
          companyOnboardingDate: "01-03-2024",
          designation: "CEO",
          reportingManager: "N/A",
          reportingManagerName: "Amit Sharma",
          reportingManagerEmail: "amit.sharma@globaltech.com",
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
        secondary: [],
      },
      {
        basicDetails: {
          name: "Priya Sharma",
          email: "priya.sharma@techsolutions.com",
          phone: "09812345678",
          companyOnboardingDate: "15-06-2023",
          designation: "Finance Head",
          reportingManager: "Amit Sharma",
          reportingManagerName: "Amit Sharma",
          reportingManagerEmail: "amit.sharma@globaltech.com",
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
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "USER_MANAGEMENT",
            roleName: "User Management Viewer",
            nodeName: "Admin Portal",
            nodePath: "TECH_SOLUTIONS_LTD.ADMIN.PORTAL",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "OPERATIONAL",
            roleSubCategory: "MASTER",
            roleName: "Master Viewer",
            nodeName: "Operations",
            nodePath: "TECH_SOLUTIONS_LTD.OPERATIONS",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "ORG_STRUCTURE",
            roleName: "Org Structure Viewer",
            nodeName: "Head Office",
            nodePath: "TECH_SOLUTIONS_LTD.ROOT",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "PAYMENT",
            roleName: "Payment Viewer",
            nodeName: "Treasury",
            nodePath: "TECH_SOLUTIONS_LTD.TREASURY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "OPERATIONAL",
            roleSubCategory: "MASTER",
            roleName: "Master User",
            nodeName: "Warehouse",
            nodePath: "TECH_SOLUTIONS_LTD.WAREHOUSE",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "INVOICE",
            roleName: "Invoice Viewer",
            nodeName: "Billing",
            nodePath: "TECH_SOLUTIONS_LTD.BILLING",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "TRACK_WORKFLOW",
            roleName: "Track Workflow Viewer",
            nodeName: "Workflow",
            nodePath: "TECH_SOLUTIONS_LTD.WORKFLOW",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "PURCHASE_ORDER",
            roleName: "Purchase Order Viewer",
            nodeName: "Procurement Hub",
            nodePath: "TECH_SOLUTIONS_LTD.PROCUREMENT.HUB",
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
          reportingManager: "Amit Sharma",
          reportingManagerName: "Amit Sharma",
          reportingManagerEmail: "amit.sharma@globaltech.com",
        },
        primary: [
          {
            roleCategory: "OPERATIONAL",
            roleSubCategory: "MASTER",
            roleName: "Master Manager",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "PRIMARY",
          },
        ],
        secondary: [
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "PURCHASE_ORDER",
            roleName: "Purchase Order Checker",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "PURCHASE_ORDER",
            roleName: "Purchase Order Maker",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "PURCHASE_ORDER",
            roleName: "Purchase Order Viewer",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "ACCOUNTS",
            roleName: "Accounts Checker",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "ACCOUNTS",
            roleName: "Accounts Maker",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "ACCOUNTS",
            roleName: "Accounts Viewer",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "INVOICE",
            roleName: "Invoice Checker",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "INVOICE",
            roleName: "Invoice Maker",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "INVOICE",
            roleName: "Invoice Viewer",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "OPERATIONAL",
            roleSubCategory: "MASTER",
            roleName: "Master Checker",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "OPERATIONAL",
            roleSubCategory: "MASTER",
            roleName: "Master Maker",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "OPERATIONAL",
            roleSubCategory: "MASTER",
            roleName: "Master Viewer",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "ORG_STRUCTURE",
            roleName: "Org Structure Checker",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "ORG_STRUCTURE",
            roleName: "Org Structure Maker",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "ORG_STRUCTURE",
            roleName: "Org Structure Viewer",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "USER_MANAGEMENT",
            roleName: "User Management Checker",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "USER_MANAGEMENT",
            roleName: "User Management Maker",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "USER_MANAGEMENT",
            roleName: "User Management Viewer",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "TRACK_WORKFLOW",
            roleName: "Track Workflow Checker",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "TRACK_WORKFLOW",
            roleName: "Track Workflow Maker",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "TRACK_WORKFLOW",
            roleName: "Track Workflow Viewer",
            nodeName: "TEST Company",
            nodePath: "TECH_SOLUTIONS_LTD.TEST_COMPANY",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "ACCOUNTS",
            roleName: "Accounts Viewer",
            nodeName: "Finance Hub",
            nodePath: "TECH_SOLUTIONS_LTD.FINANCE_HUB",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "TRANSACTIONAL",
            roleSubCategory: "INVOICE",
            roleName: "Invoice Checker",
            nodeName: "Finance Hub",
            nodePath: "TECH_SOLUTIONS_LTD.FINANCE_HUB",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "OPERATIONAL",
            roleSubCategory: "MASTER",
            roleName: "Master User",
            nodeName: "Operations Hub",
            nodePath: "TECH_SOLUTIONS_LTD.OPERATIONS_HUB",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "OPERATIONAL",
            roleSubCategory: "MASTER",
            roleName: "Master Viewer",
            nodeName: "Operations Hub",
            nodePath: "TECH_SOLUTIONS_LTD.OPERATIONS_HUB",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "ORG_STRUCTURE",
            roleName: "Org Structure Viewer",
            nodeName: "Control Center",
            nodePath: "TECH_SOLUTIONS_LTD.CONTROL_CENTER",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "USER_MANAGEMENT",
            roleName: "User Management User",
            nodeName: "Control Center",
            nodePath: "TECH_SOLUTIONS_LTD.CONTROL_CENTER",
            accessType: "SECONDARY",
          },
          {
            roleCategory: "SYSTEM_ACCESS",
            roleSubCategory: "TRACK_WORKFLOW",
            roleName: "Track Workflow Manager",
            nodeName: "Control Center",
            nodePath: "TECH_SOLUTIONS_LTD.CONTROL_CENTER",
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
          reportingManager: "Amit Sharma",
          reportingManagerName: "Amit Sharma",
          reportingManagerEmail: "amit.sharma@globaltech.com",
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
          reportingManager: "Amit Sharma",
          reportingManagerName: "Amit Sharma",
          reportingManagerEmail: "amit.sharma@globaltech.com",
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
  const payload: CompanyUsersResponse = USE_MOCK_DATA
    ? MOCK_USERS_RESPONSE
    : await apiFetch<CompanyUsersResponse>(COMPANY_USERS_PATH, {
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
