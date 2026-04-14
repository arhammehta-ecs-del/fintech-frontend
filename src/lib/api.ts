import type { AppUser, Company, CompanyStatus, GroupCompany, OrgNode } from "@/contexts/AppContext";
import { v7 as uuidv7 } from "uuid";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

type RawCompanyRecord = Record<string, unknown>;
type RawUserRecord = Record<string, unknown>;

const COMPANY_LIST_PATH = "/api/v1/admin/companies/all";
const COMPANY_ORG_PATH = "/api/v1/company-settings/org";
const COMPANY_USERS_PATH = "/api/v1/company-settings/all-users";
const LOGIN_PATH = "/api/v1/auth/login";
const LOGOUT_PATH = "/api/v1/auth/logout";

const generateTrackId = () => uuidv7();

const getString = (record: RawCompanyRecord, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return fallback;
};

const toUpperValue = (value: string) => value.toUpperCase();

const toRecord = (value: unknown): RawCompanyRecord | null =>
  typeof value === "object" && value !== null ? (value as RawCompanyRecord) : null;

const getRecordArray = (record: RawCompanyRecord, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is RawCompanyRecord => typeof item === "object" && item !== null);
    }
  }
  return [] as RawCompanyRecord[];
};

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

const toStatus = (value: string): CompanyStatus => {
  const normalized = value.toLowerCase();
  if (normalized === "pending") return "Pending";
  if (normalized === "inactive" || normalized === "rejected") return "Inactive";
  return "Approved";
};

const ensureArray = (payload: unknown): RawCompanyRecord[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is RawCompanyRecord => typeof item === "object" && item !== null);
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const nested = record.data ?? record.items ?? record.results ?? record.companies;
    if (Array.isArray(nested)) {
      return nested.filter((item): item is RawCompanyRecord => typeof item === "object" && item !== null);
    }
  }

  return [];
};

const normalizeCompanyRecords = (items: RawCompanyRecord[]) =>
  items.flatMap((item) => {
    const nestedCompanies = getRecordArray(item, ["companies", "companydetails", "comapnydetails", "subsidiaries"]);
    if (nestedCompanies.length === 0) {
      return [item];
    }

    const groupRecord = toRecord(item.groupdetails) ?? toRecord(item.group) ?? {};
    const groupCode = getString(item, ["groupCode", "group_code", "groupcode"], getString(groupRecord, ["groupCode", "group_code", "groupcode", "code"], ""));
    const groupName = getString(item, ["groupName", "group_name", "groupname"], getString(groupRecord, ["groupName", "group_name", "groupname", "name"], ""));
    const groupId =
      getString(item, ["groupId", "group_id"], getString(groupRecord, ["id"], "")) ||
      groupCode ||
      groupName ||
      "ungrouped";
    const groupCreatedDate = getString(
      item,
      ["groupCreatedDate", "group_created_date"],
      getString(groupRecord, ["createdDate", "created_date"], ""),
    );

    return nestedCompanies.map((company) => ({
      ...company,
      groupId,
      groupCode,
      groupName,
      groupCreatedDate,
    }));
  });

const mapCompany = (record: RawCompanyRecord): {
  groupId: string;
  groupName: string;
  groupCode: string;
  groupCreatedDate: string;
  company: Company;
} => {
  const groupRecord =
    (record.group && typeof record.group === "object" && record.group !== null
      ? (record.group as RawCompanyRecord)
      : null) ??
    (record.groupdetails && typeof record.groupdetails === "object" && record.groupdetails !== null
      ? (record.groupdetails as RawCompanyRecord)
      : {});

  const companyName = getString(record, ["companyName", "company_name", "brand", "companyBrand"], "Untitled Company");
  const companyId = getString(record, ["id", "companyId", "company_id"], companyName.toLowerCase().replace(/\s+/g, "-"));
  const groupCode = toUpperValue(
    getString(record, ["groupCode", "group_code", "groupcode"], getString(groupRecord, ["groupCode", "group_code", "groupcode", "code"], "")),
  );
  const groupName = getString(
    record,
    ["groupName", "group_name", "groupname"],
    getString(groupRecord, ["groupName", "group_name", "groupname", "name"], ""),
  );
  const groupId =
    getString(record, ["groupId", "group_id"], getString(groupRecord, ["id"], "")) ||
    groupCode ||
    groupName ||
    "ungrouped";

  return {
    groupId,
    groupName,
    groupCode,
    groupCreatedDate: getString(
      record,
      ["groupCreatedDate", "group_created_date"],
      getString(groupRecord, ["createdDate", "created_date"], ""),
    ),
    company: {
      id: companyId,
      brand: getString(record, ["brand", "companyBrand", "company_brand"], companyName),
      companyCode: toUpperValue(getString(record, ["companyCode", "company_code", "companycode"], "")),
      companyName,
      legalName: getString(record, ["legalName", "legal_name", "name"], companyName),
      incorporationDate: getString(record, ["registeredAt", "incorporationDate", "incorporation_date"], ""),
      address: getString(record, ["address", "registeredAddress", "registered_address"], ""),
      gstin: getString(record, ["gstin", "GSTIN", "gst"], ""),
      ieCode: getString(record, ["ieCode", "ie_code", "iecode"], ""),
      status: toStatus(getString(record, ["status"], "Approved")),
      signatories: [],
    },
  };
};

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "track-id": generateTrackId(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

const mapUser = (record: RawUserRecord) => ({
  id: getString(record, ["id"], ""),
  name: getString(record, ["name"], "User"),
  email: getString(record, ["email"], ""),
  phone: getString(record, ["phone", "mobile", "phoneNumber", "phone_number"], ""),
  company: getString(record, ["company", "companyName", "company_name"], ""),
  brand: getString(record, ["brand", "companyBrand", "company_brand"], ""),
  companyCode: toUpperValue(getString(record, ["companyCode", "company_code"], "")),
  groupName: getString(record, ["groupName", "group_name"], ""),
  groupCode: toUpperValue(getString(record, ["groupCode", "group_code"], "")),
});

export async function login(email: string, password: string, action = false) {
  const payload = await apiFetch<{ message: string; user: RawUserRecord }>(LOGIN_PATH, {
    method: "POST",
    body: JSON.stringify({ email, password, action: action ? "1" : "0", }),
  });

  return {
    message: payload.message,
    user: mapUser(payload.user),
  };
}

export async function logout() {
  return apiFetch<{ message: string }>(LOGOUT_PATH, {
    method: "POST",
  });
}

export async function getAllCompanies(): Promise<GroupCompany[]> {
  const payload = await apiFetch<unknown>(COMPANY_LIST_PATH, {
    method: "POST",
    body: JSON.stringify({
      type: "A",
    }),
  });
  const items = normalizeCompanyRecords(ensureArray(payload));
  const grouped = new Map<string, GroupCompany>();
  for (const item of items) {
    const mapped = mapCompany(item);

    if (!grouped.has(mapped.groupId)) {
      grouped.set(mapped.groupId, {
        id: mapped.groupId,
        groupName: mapped.groupName,
        code: mapped.groupCode,
        createdDate: mapped.groupCreatedDate,
        remarks: "",
        subsidiaries: [],
      });
    }

    grouped.get(mapped.groupId)?.subsidiaries.push(mapped.company);
  }

  return Array.from(grouped.values());
}

type RawOrgRecord = Record<string, unknown>;

type OrgApiResponse = {
  success?: boolean;
  data?: RawOrgRecord[];
};

const mapOrgNode = (record: RawOrgRecord): OrgNode => {
  const nodePath = getString(record, ["node_path", "nodePath"], "");

  return {
    id: getString(record, ["id"], nodePath || crypto.randomUUID()),
    companyId: getNullableString(record, ["company_id", "companyId"]) ?? undefined,
    name: getString(record, ["node_name", "nodeName"], "Untitled Node"),
    nodeType: getString(record, ["node_type", "nodeType"], "NODE"),
    nodePath,
    children: [],
  };
};

const buildOrgTree = (items: RawOrgRecord[]): OrgNode | null => {
  if (!items.length) return null;

  const nodes = items.map(mapOrgNode);
  const getDerivedParentPath = (nodePath: string) => {
    const segments = nodePath
      .split(".")
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length <= 1) return null;

    // When payload omits parent IDs, first-level nodes are usually emitted as
    // COMPANY.DIVISION while root is COMPANY.ROOT.
    if (segments.length === 2 && segments[1].toUpperCase() !== "ROOT") {
      return `${segments[0]}.ROOT`;
    }

    return segments.slice(0, -1).join(".");
  };

  // Decode the flat payload with a path map so parent/child links can be resolved from nodePath alone.
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

  const parseNodePath = (nodePath: string) =>
    nodePath
      .split(".")
      .map((segment) => segment.trim())
      .filter(Boolean);

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

export async function getCompanyOrgStructure(companyCode: string): Promise<OrgNode | null> {
  const payload = await apiFetch<OrgApiResponse>(COMPANY_ORG_PATH, {
    method: "POST",
    body: JSON.stringify({
      companyCode: companyCode.trim().toUpperCase(),
    }),
  });

  return buildOrgTree(Array.isArray(payload.data) ? payload.data : []);
}

type CompanyUsersPayload = {
  activeUsers?: RawUserRecord[];
  inactiveUsers?: RawUserRecord[];
};

type CompanyUsersResponse = {
  success?: boolean;
  data?: CompanyUsersPayload;
};

export type RoleCapabilitySet = {
  view: boolean;
  modify: boolean;
  approve: boolean;
  initiate: boolean;
};

export type CompanyRole = {
  role_code: string;
  role_name: string;
  category: string;
  sub_category: string;
  permission_level: string;
  capabilities: RoleCapabilitySet;
  is_active: boolean;
};

type CompanyRolesResponse = {
  success: boolean;
  data: CompanyRole[];
};

const MOCK_COMPANY_ROLES_RESPONSE: CompanyRolesResponse = {
  success: true,
  data: [
    { role_code: "ACCOUNTS_VIEWER", role_name: "Accounts Viewer", category: "TRANSACTIONAL", sub_category: "ACCOUNTS", permission_level: "VIEWER", capabilities: { view: true, modify: false, approve: false, initiate: false }, is_active: true },
    { role_code: "ACCOUNTS_USER", role_name: "Accounts User", category: "TRANSACTIONAL", sub_category: "ACCOUNTS", permission_level: "USER", capabilities: { view: true, modify: true, approve: false, initiate: true }, is_active: true },
    { role_code: "ACCOUNTS_MGR", role_name: "Accounts Manager", category: "TRANSACTIONAL", sub_category: "ACCOUNTS", permission_level: "MANAGER", capabilities: { view: true, modify: false, approve: true, initiate: false }, is_active: true },
    { role_code: "PAYMENTS_VIEWER", role_name: "Payments Viewer", category: "TRANSACTIONAL", sub_category: "PAYMENTS", permission_level: "VIEWER", capabilities: { view: true, modify: false, approve: false, initiate: false }, is_active: true },
    { role_code: "PAYMENTS_USER", role_name: "Payments User", category: "TRANSACTIONAL", sub_category: "PAYMENTS", permission_level: "USER", capabilities: { view: true, modify: true, approve: false, initiate: true }, is_active: true },
    { role_code: "PAYMENTS_MGR", role_name: "Payments Manager", category: "TRANSACTIONAL", sub_category: "PAYMENTS", permission_level: "MANAGER", capabilities: { view: true, modify: false, approve: true, initiate: false }, is_active: true },
    { role_code: "PURCHASE_VIEWER", role_name: "Purchase Viewer", category: "TRANSACTIONAL", sub_category: "PURCHASE", permission_level: "VIEWER", capabilities: { view: true, modify: false, approve: false, initiate: false }, is_active: true },
    { role_code: "PURCHASE_USER", role_name: "Purchase User", category: "TRANSACTIONAL", sub_category: "PURCHASE", permission_level: "USER", capabilities: { view: true, modify: true, approve: false, initiate: true }, is_active: true },
    { role_code: "PURCHASE_MGR", role_name: "Purchase Manager", category: "TRANSACTIONAL", sub_category: "PURCHASE", permission_level: "MANAGER", capabilities: { view: true, modify: false, approve: true, initiate: false }, is_active: true },
    { role_code: "FINOPS_VIEWER", role_name: "Fin Ops Viewer", category: "OPERATIONAL", sub_category: "FIN_OPS", permission_level: "VIEWER", capabilities: { view: true, modify: false, approve: false, initiate: false }, is_active: true },
    { role_code: "FINOPS_USER", role_name: "Fin Ops User", category: "OPERATIONAL", sub_category: "FIN_OPS", permission_level: "USER", capabilities: { view: true, modify: true, approve: false, initiate: true }, is_active: true },
    { role_code: "FINOPS_MGR", role_name: "Fin Ops Manager", category: "OPERATIONAL", sub_category: "FIN_OPS", permission_level: "MANAGER", capabilities: { view: true, modify: false, approve: true, initiate: false }, is_active: true },
    { role_code: "MASTER_VIEWER", role_name: "Master Viewer", category: "OPERATIONAL", sub_category: "MASTER", permission_level: "VIEWER", capabilities: { view: true, modify: false, approve: false, initiate: false }, is_active: true },
    { role_code: "MASTER_USER", role_name: "Master User", category: "OPERATIONAL", sub_category: "MASTER", permission_level: "USER", capabilities: { view: true, modify: true, approve: false, initiate: true }, is_active: true },
    { role_code: "MASTER_MGR", role_name: "Master Manager", category: "OPERATIONAL", sub_category: "MASTER", permission_level: "MANAGER", capabilities: { view: true, modify: false, approve: true, initiate: false }, is_active: true },
    { role_code: "SYS_ADMIN_VIEWER", role_name: "System Admin Viewer", category: "SYSTEM_ACCESS", sub_category: "ADMIN", permission_level: "VIEWER", capabilities: { view: true, modify: false, approve: false, initiate: false }, is_active: true },
    { role_code: "SYS_ADMIN_USER", role_name: "System Admin User", category: "SYSTEM_ACCESS", sub_category: "ADMIN", permission_level: "USER", capabilities: { view: true, modify: true, approve: false, initiate: true }, is_active: true },
    { role_code: "SYS_ADMIN_MGR", role_name: "System Admin Manager", category: "SYSTEM_ACCESS", sub_category: "ADMIN", permission_level: "MANAGER", capabilities: { view: true, modify: false, approve: true, initiate: false }, is_active: true },
    { role_code: "ORG_STR_VIEWER", role_name: "Org Structure Viewer", category: "SYSTEM_ACCESS", sub_category: "ORG_STR", permission_level: "VIEWER", capabilities: { view: true, modify: false, approve: false, initiate: false }, is_active: true },
    { role_code: "ORG_STR_USER", role_name: "Org Structure User", category: "SYSTEM_ACCESS", sub_category: "ORG_STR", permission_level: "USER", capabilities: { view: true, modify: true, approve: false, initiate: true }, is_active: true },
    { role_code: "ORG_STR_MGR", role_name: "Org Structure Manager", category: "SYSTEM_ACCESS", sub_category: "ORG_STR", permission_level: "MANAGER", capabilities: { view: true, modify: false, approve: true, initiate: false }, is_active: true },
    { role_code: "USER_ACC_VIEWER", role_name: "User Access Viewer", category: "SYSTEM_ACCESS", sub_category: "USER_ACC", permission_level: "VIEWER", capabilities: { view: true, modify: false, approve: false, initiate: false }, is_active: true },
    { role_code: "USER_ACC_USER", role_name: "User Access User", category: "SYSTEM_ACCESS", sub_category: "USER_ACC", permission_level: "USER", capabilities: { view: true, modify: true, approve: false, initiate: true }, is_active: true },
    { role_code: "USER_ACC_MGR", role_name: "User Access Manager", category: "SYSTEM_ACCESS", sub_category: "USER_ACC", permission_level: "MANAGER", capabilities: { view: true, modify: false, approve: true, initiate: false }, is_active: true },
    { role_code: "WORK_FLOW_VIEWER", role_name: "Workflow Viewer", category: "SYSTEM_ACCESS", sub_category: "WORK_FLOW", permission_level: "VIEWER", capabilities: { view: true, modify: false, approve: false, initiate: false }, is_active: true },
    { role_code: "WORK_FLOW_USER", role_name: "Workflow User", category: "SYSTEM_ACCESS", sub_category: "WORK_FLOW", permission_level: "USER", capabilities: { view: true, modify: true, approve: false, initiate: true }, is_active: true },
    { role_code: "WORK_FLOW_MGR", role_name: "Workflow Manager", category: "SYSTEM_ACCESS", sub_category: "WORK_FLOW", permission_level: "MANAGER", capabilities: { view: true, modify: false, approve: true, initiate: false }, is_active: true },
  ],
};

const MOCK_COMPANY_USERS: AppUser[] = [
  {
    id: "mock-user-1",
    name: "Anjali Desai",
    email: "anjali.d@tatasteel.com",
    role: "Signatory",
    designation: "VP Finance",
    department: "Finance",
    phone: "+91 91234 56783",
    companyId: "MOCK",
    status: "Active",
  },
  {
    id: "mock-user-2",
    name: "Bob Smith",
    email: "bob@acme.com",
    role: "Manager",
    designation: "HR Manager",
    department: "Human Resources",
    phone: "+91 98765 43211",
    companyId: "MOCK",
    status: "Active",
  },
  {
    id: "mock-user-3",
    name: "Carol Davis",
    email: "carol@acme.com",
    role: "User",
    designation: "Developer",
    department: "Engineering",
    phone: "+91 98765 43212",
    companyId: "MOCK",
    status: "Active",
  },
  {
    id: "mock-user-4",
    name: "Deepika Padukone",
    email: "deepika.p@tatasteel.com",
    role: "Manager",
    designation: "Brand Ambassador",
    department: "Marketing",
    phone: "+91 90000 00009",
    companyId: "MOCK",
    status: "Active",
  },
  {
    id: "mock-user-5",
    name: "Example User 10",
    email: "example10@tatasteel.com",
    role: "User",
    designation: "Staff",
    department: "Quality Assurance",
    phone: "+91 90000 00009",
    companyId: "MOCK",
    status: "Active",
  },
  {
    id: "mock-user-6",
    name: "Pending Member",
    email: "pending.member@tatasteel.com",
    role: "User",
    designation: "Analyst",
    department: "Finance",
    phone: "+91 90000 00111",
    companyId: "MOCK",
    status: "Pending",
  },
  {
    id: "mock-user-7",
    name: "Inactive Member",
    email: "inactive.member@tatasteel.com",
    role: "Viewer",
    designation: "Coordinator",
    department: "Operations",
    phone: "+91 90000 00222",
    companyId: "MOCK",
    status: "Inactive",
  },
  {
    id: "mock-user-8",
    name: "Rahul Mehta",
    email: "rahul.mehta@tatasteel.com",
    role: "User",
    designation: "Operations Analyst",
    department: "Operations",
    phone: "+91 90000 00301",
    companyId: "MOCK",
    status: "Active",
  },
  {
    id: "mock-user-9",
    name: "Sneha Kapoor",
    email: "sneha.kapoor@tatasteel.com",
    role: "Manager",
    designation: "Regional Manager",
    department: "Sales",
    phone: "+91 90000 00302",
    companyId: "MOCK",
    status: "Active",
  },
  {
    id: "mock-user-10",
    name: "Vikram Nair",
    email: "vikram.nair@tatasteel.com",
    role: "User",
    designation: "Procurement Specialist",
    department: "Procurement",
    phone: "+91 90000 00303",
    companyId: "MOCK",
    status: "Active",
  },
  {
    id: "mock-user-11",
    name: "Pooja Iyer",
    email: "pooja.iyer@tatasteel.com",
    role: "Signatory",
    designation: "Senior Finance Lead",
    department: "Finance",
    phone: "+91 90000 00304",
    companyId: "MOCK",
    status: "Active",
  },
  {
    id: "mock-user-12",
    name: "Aman Verma",
    email: "aman.verma@tatasteel.com",
    role: "Viewer",
    designation: "Audit Coordinator",
    department: "Compliance",
    phone: "+91 90000 00305",
    companyId: "MOCK",
    status: "Active",
  },
  {
    id: "mock-user-13",
    name: "Kavya Reddy",
    email: "kavya.reddy@tatasteel.com",
    role: "User",
    designation: "HR Executive",
    department: "Human Resources",
    phone: "+91 90000 00306",
    companyId: "MOCK",
    status: "Active",
  },
  {
    id: "mock-user-14",
    name: "Nitin Arora",
    email: "nitin.arora@tatasteel.com",
    role: "Manager",
    designation: "Engineering Manager",
    department: "Engineering",
    phone: "+91 90000 00307",
    companyId: "MOCK",
    status: "Active",
  },
  {
    id: "mock-user-15",
    name: "Shreya Bansal",
    email: "shreya.bansal@tatasteel.com",
    role: "User",
    designation: "Data Associate",
    department: "Data",
    phone: "+91 90000 00308",
    companyId: "MOCK",
    status: "Active",
  },
  {
    id: "mock-user-16",
    name: "Onboarding Candidate",
    email: "candidate.onboard@tatasteel.com",
    role: "User",
    designation: "Trainee",
    department: "Finance",
    phone: "+91 90000 00309",
    companyId: "MOCK",
    status: "Pending",
  },
  {
    id: "mock-user-17",
    name: "Former Employee",
    email: "former.employee@tatasteel.com",
    role: "Viewer",
    designation: "Support Associate",
    department: "Support",
    phone: "+91 90000 00310",
    companyId: "MOCK",
    status: "Inactive",
  },
];

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

export async function getCompanyUsersMock(companyCode = "MOCK"): Promise<AppUser[]> {
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  return MOCK_COMPANY_USERS.map((user) => ({
    ...user,
    companyId: companyCode,
  }));
}

export async function getCompanyRolesMock(): Promise<CompanyRole[]> {
  await new Promise((resolve) => window.setTimeout(resolve, 350));
  return MOCK_COMPANY_ROLES_RESPONSE.data;
}
