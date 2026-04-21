import type { AppUser, Company, GroupCompany, OrgNode } from "@/contexts/AppContext";
import { v7 as uuidv7 } from "uuid";

type CreateOrgNodePayload = {
  companyCode: string;
  newNodeName: string;
  nodeType: string;
  parentNode: {
    nodeName: string;
    nodeType: string;
    nodePath: string;
  };
};

type CreateOrgNodeResponse = {
  message: string;
  code?: number;
  data?: unknown;
};

export type OnboardingPayload = {
  group: {
    name: string;
    groupCode: string;
    remarks?: string;
  };
  company: {
    companyCode: string;
    name: string;
    gst: string;
    brand: string;
    ieCode: string;
    incorporationDate: string;
    address: string;
  };
  signatories: Array<{
    name: string;
    email: string;
    phone: string;
    designation: string;
    employeeId: string;
  }>;
};

type OnboardingResponse = {
  message: string;
  code?: number;
  data?: {
    companyId?: string;
    groupId?: string;
    status?: string;
  };
};
//not used currently but will be used in future for user onboarding flow
type UserOnboardingPermissionAction = "manager" | "user" | "viewer";

type UserOnboardingPermission = {
  roleCategory: "TRANSACTIONAL" | "OPERATIONAL" | "SYSTEM_ACCESS";
  roleName: string;
  nodeName: string;
  nodePath: string;
  accessType?: "primary" | "secondary";
};

export type UserOnboardingPayload = {
  basicDetails: {
    name: string;
    email: string;
    phone: string;
    onboardingDate: string;
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

//not used currently but will be used in future for user onboarding flow
type RoleCapabilitySet = {
  view: boolean;
  modify: boolean;
  approve: boolean;
  initiate: boolean;
};

//not used currently but will be used in future for user onboarding flow
type CompanyRole = {
  role_code: string;
  role_name: string;
  category: string;
  sub_category: string;
  permission_level: string;
  capabilities: RoleCapabilitySet;
  is_active: boolean;
};

type RawCompanyRecord = Record<string, unknown>;
type RawUserRecord = Record<string, unknown>;
type RawOrgRecord = Record<string, unknown>;

type RawCompanyListItem = {
  companyCode?: string | null;
  name?: string | null;
  gst?: string | null;
  brand?: string | null;
  iecode?: string | null;
  registeredAt?: string | null;
  address?: string | null;
};

type RawCompanyGroup = {
  groupName?: string | null;
  groupCode?: string | null;
  companies?: RawCompanyListItem[] | null;
};

type RawLoginUser = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  brand?: string | null;
  companyCode?: string | null;
  groupName?: string | null;
  groupCode?: string | null;
};

type CompanyListApiResponse = {
  message?: string;
  code?: number;
  data?: RawCompanyGroup[];
};

type OrgApiResponse = {
  success?: boolean;
  data?: RawOrgRecord[];
};

type CompanyUsersPayload = {
  activeUsers?: RawUserRecord[];
  inactiveUsers?: RawUserRecord[];
};

type CompanyUsersResponse = {
  success?: boolean;
  data?: CompanyUsersPayload;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");

const LOGIN_PATH = "/api/v1/auth/login";
const LOGOUT_PATH = "/api/v1/auth/logout";
const COMPANY_LIST_PATH = "/api/v1/admin/companies/all";
const COMPANY_CREATE_PATH = "/api/v1/admin/companies";
const COMPANY_ORG_PATH = "/api/v1/company-settings/org";
const NEW_NODE_PATH = "/api/v1/company-settings/new-node";
const COMPANY_USERS_PATH = "/api/v1/company-settings/all-users";
const NEW_USER_ONBOARD_PATH = "/api/v1/admin/users/onboard";

// Creates a unique id for each API request and sends it as `track-id`.
// Impact: helps backend teams trace and debug requests from this file.
const generateTrackId = () => uuidv7();

// Checks many possible keys and returns the first non-empty string.
// Impact: handles backend field-name differences without breaking UI mapping.
const getString = (record: RawCompanyRecord, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return fallback;
};

// Converts text to uppercase.
// Impact: keeps company and group codes in one consistent format.
const toUpperValue = (value: string) => value.toUpperCase();

// Returns a trimmed string if present, keeps explicit null, else returns null.
// Impact: keeps nullable fields like `companyId` correct in mapped data.
const getNullableString = (record: RawCompanyRecord, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
    if (value === null) {
      return null;
    }
  }
  return null;
};

// Returns a clean string value, else empty string.
// Impact: keeps mapper code readable without heavy fallback chains.
const getPacketString = (value: string | null | undefined) => (typeof value === "string" ? value.trim() : "");

// Maps one company item into the `Company` shape.
// Impact: used by `getAllCompanies` before data reaches context/pages.
const mapCompany = (company: RawCompanyListItem): Company => {
  const companyName = getPacketString(company.name) || "Untitled Company";
  const companyCode = toUpperValue(getPacketString(company.companyCode));

  return {
    id: companyCode || companyName.toLowerCase().replace(/\s+/g, "-"),
    brand: getPacketString(company.brand) || companyName,
    companyCode,
    companyName,
    legalName: companyName,
    incorporationDate: getPacketString(company.registeredAt),
    address: getPacketString(company.address),
    gstin: getPacketString(company.gst),
    ieCode: getPacketString(company.iecode),
    status: "Approved",
    signatories: [],
  };
};

// Shared fetch wrapper: adds base URL, cookies, `track-id`, and correct headers.
// Impact: every exported API function in this file uses this.
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers ?? {});
  headers.set("track-id", generateTrackId());

  if (options.body instanceof FormData) {
    headers.delete("Content-Type");
  } else if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Maps login user data into the frontend user shape.
// Impact: used inside `login` before saving or using auth data.
const mapUser = (record: RawLoginUser) => ({
  id: getPacketString(record.id),
  name: getPacketString(record.name),
  email: getPacketString(record.email),
  phone: getPacketString(record.phone),
  company: getPacketString(record.company),
  brand: getPacketString(record.brand),
  companyCode: toUpperValue(getPacketString(record.companyCode)),
  groupName: getPacketString(record.groupName),
  groupCode: toUpperValue(getPacketString(record.groupCode)),
});

// Calls login API and returns normalized user data.
// Impact files:
// - src/pages/Login.tsx (primary login submit flow)
export async function login(email: string, password: string, action = false) {
  const payload = await apiFetch<{ message: string; user: RawLoginUser }>(LOGIN_PATH, {
    method: "POST",
    body: JSON.stringify({ email, password, action: action ? "1" : "0" }),
  });

  return {
    message: payload.message,
    user: mapUser(payload.user),
  };
}

// Calls logout API to end the current session.
// Impact files:
// - src/components/DashboardLayout.tsx (logout action in app shell)
export async function logout() {
  return apiFetch<{ message: string }>(LOGOUT_PATH, {
    method: "POST",
  });
}

// Fetches all companies, cleans response shape, and returns grouped data for UI.
// Impact files:
// - src/contexts/AppContext.tsx (session restore + initial company load)
// - src/pages/Login.tsx (post-login company fetch)
// - src/pages/CorporateList.tsx (corporate list data source)
export async function getAllCompanies(): Promise<GroupCompany[]> {
  const payload = await apiFetch<CompanyListApiResponse>(COMPANY_LIST_PATH, {
    method: "POST",
    body: JSON.stringify({
      type: "A",
    }),
  });
  const groups = payload.data;

  return groups.map((group, index) => {
    const rawGroupName = getPacketString(group.groupName);
    const groupCode = toUpperValue(getPacketString(group.groupCode));
    const isIndependentGroup = !rawGroupName && !groupCode;
    const groupName = isIndependentGroup ? "ungrouped" : rawGroupName;
    const groupId = isIndependentGroup ? `ungrouped-${index + 1}` : groupCode || rawGroupName;
    const subsidiaries = Array.isArray(group.companies) ? group.companies.map(mapCompany) : [];

    return {
      id: groupId,
      groupName,
      code: groupCode,
      createdDate: "",
      remarks: "",
      subsidiaries,
    };
  });
}

// Creates company onboarding request.
// If file is present, sends multipart; otherwise sends JSON.
// Impact files:
// - src/pages/OnboardingWizard.tsx (company onboarding submit)
export async function createCompanyOnboarding(payload: OnboardingPayload, file?: File | null) {
  if (file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("payload", JSON.stringify(payload));

    return apiFetch<OnboardingResponse>(COMPANY_CREATE_PATH, {
      method: "POST",
      body: formData,
    });
  }

  return apiFetch<OnboardingResponse>(COMPANY_CREATE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Creates a new org node under the selected parent node.
// Impact files:
// - src/pages/SaasOrganisation.tsx (add-node flow in org editor)
export async function createNewOrgNode(payload: CreateOrgNodePayload) {
  return apiFetch<CreateOrgNodeResponse>(NEW_NODE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Sends user onboarding payload to create a new company user.
// Impact files:
// - src/pages/UserManagement.tsx (member onboarding submit)
export async function createUserOnboarding(payload: UserOnboardingPayload) {
  return apiFetch<UserOnboardingResponse>(NEW_USER_ONBOARD_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Converts one raw org node into the `OrgNode` shape used by UI tree components.
// Impact: used by `buildOrgTree` before rendering org structure screens.
const mapOrgNode = (record: RawOrgRecord): OrgNode => {
  const nodePath = getString(record, ["nodePath"], "");

  return {
    id: getString(record, ["id"], nodePath || crypto.randomUUID()),
    companyId: getNullableString(record, ["companyId"]) ?? undefined,
    name: getString(record, ["nodeName"], "Untitled Node"),
    nodeType: getString(record, ["nodeType"], "NODE"),
    nodePath,
    children: [],
  };
};

// Builds a nested org tree from flat node list using parent path logic.
// Impact: output is used by `getCompanyOrgStructure` for org management UI.
const buildOrgTree = (items: RawOrgRecord[]): OrgNode | null => {
  if (!items.length) return null;

  const nodes = items.map(mapOrgNode);

  // Finds parent from dot path when backend does not send parent id directly.
  const getDerivedParentPath = (nodePath: string) => {
    const segments = nodePath
      .split(".")
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length <= 1) return null;

    if (segments.length === 2 && segments[1].toUpperCase() !== "ROOT") {
      return `${segments[0]}.ROOT`;
    }

    return segments.slice(0, -1).join(".");
  };

  const nodePathMap = new Map(
    nodes
      .filter((node) => node.nodePath)
      .map((node) => [node.nodePath, node] as const),
  );
  const rootNodes: OrgNode[] = [];

  for (const node of nodes) {
    const parent = node.nodePath ? nodePathMap.get(getDerivedParentPath(node.nodePath) ?? "") : null;

    if (parent) {
      parent.children.push(node);
      continue;
    }

    rootNodes.push(node);
  }

  // Breaks dot path into parts for consistent comparisons.
  const parseNodePath = (nodePath: string) =>
    nodePath
      .split(".")
      .map((segment) => segment.trim())
      .filter(Boolean);

  // Compares paths in human order, so `...2` comes before `...10`.
  const compareNodePath = (leftPath: string, rightPath: string) => {
    const leftSegments = parseNodePath(leftPath);
    const rightSegments = parseNodePath(rightPath);
    const maxLength = Math.max(leftSegments.length, rightSegments.length);

    for (let index = 0; index < maxLength; index += 1) {
      const leftSegment = leftSegments[index];
      const rightSegment = rightSegments[index];

      if (leftSegment === undefined) return -1;
      if (rightSegment === undefined) return 1;

      if (leftSegment !== rightSegment) {
        const leftAsNumber = Number(leftSegment);
        const rightAsNumber = Number(rightSegment);
        const bothNumeric = !Number.isNaN(leftAsNumber) && !Number.isNaN(rightAsNumber);

        if (bothNumeric) {
          return leftAsNumber - rightAsNumber;
        }

        return leftSegment.localeCompare(rightSegment, undefined, { numeric: true, sensitivity: "base" });
      }
    }

    return 0;
  };

  // Sorts all branches so tree order stays stable across renders.
  const sortNodes = (branch: OrgNode[]) => {
    branch.sort((left, right) => {
      const pathComparison = compareNodePath(left.nodePath, right.nodePath);
      if (pathComparison !== 0) return pathComparison;
      return left.name.localeCompare(right.name);
    });

    branch.forEach((node) => sortNodes(node.children));
  };

  sortNodes(rootNodes);
  return rootNodes.find((node) => node.nodeType.trim().toUpperCase() === "ROOT") ?? rootNodes[0] ?? null;
};

// Fetches company org structure and converts flat API data into sorted tree.
// Impact files:
// - src/pages/SaasOrganisation.tsx (org tree load + refresh after updates)
export async function getCompanyOrgStructure(companyCode: string): Promise<OrgNode | null> {
  const payload = await apiFetch<OrgApiResponse>(COMPANY_ORG_PATH, {
    method: "POST",
    body: JSON.stringify({
      companyCode: companyCode.trim().toUpperCase(),
    }),
  });

  return buildOrgTree(Array.isArray(payload.data) ? payload.data : []);
}

// Gets department name from access details.
// Uses PRIMARY entry first, else first available entry.
// Impact: used by `mapCompanyUser` to fill `department`.
const getDepartmentFromAccessDetails = (record: RawUserRecord) => {
  const accessDetails = record.accessDetails;
  if (!Array.isArray(accessDetails)) return "";

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

// Maps raw company-user payload into `AppUser`.
// Also maps manager details and status safely.
// Impact: used by `getCompanyUsers` before data reaches user tables/forms.
const mapCompanyUser = (record: RawUserRecord, status: AppUser["status"]): AppUser => ({
  id: typeof record.employeeId === "string" ? record.employeeId : "",
  name: typeof record.name === "string" ? record.name : "",
  email: typeof record.email === "string" ? record.email : "",
  role: typeof record.designation === "string" ? record.designation : "",
  designation: typeof record.designation === "string" ? record.designation : "",
  department: getDepartmentFromAccessDetails(record),
  phone: typeof record.phone === "string" ? record.phone : "",
  companyId: typeof record.companyId === "string" ? record.companyId : undefined,
  onboardingDate: typeof record.onboardingDate === "string" ? record.onboardingDate : undefined,
  employeeId: typeof record.employeeId === "string" ? record.employeeId : undefined,
  manager:
    record.manager && typeof record.manager === "object"
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
});

// Fetches active and inactive users for a company.
// Normalizes both lists and returns one combined list.
// Impact files:
// - src/pages/UserManagement.tsx (members list load and refresh)
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
  const inactiveUsers = Array.isArray(payload.data?.inactiveUsers)
    ? payload.data.inactiveUsers.map((record) => mapCompanyUser(record, "Inactive"))
    : [];

  return [...activeUsers, ...inactiveUsers];
}
