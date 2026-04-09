import type { Company, CompanyStatus, GroupCompany, OrgNode } from "@/contexts/AppContext";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

type RawCompanyRecord = Record<string, unknown>;
type RawUserRecord = Record<string, unknown>;

const COMPANY_LIST_PATH = "/api/v1/admin/companies/all";
const COMPANY_ORG_PATH = "/api/v1/company-settings/org";
const LOGIN_PATH = "/api/v1/auth/login";
const LOGOUT_PATH = "/api/v1/auth/logout";
const AUTH_STATUS_PATH = "/api/v1/auth/status";

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

export async function getAuthStatus() {
  const payload = await apiFetch<{ message: string; user: RawUserRecord }>(AUTH_STATUS_PATH);

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

const mapOrgNode = (record: RawOrgRecord): OrgNode => ({
  id: getString(record, ["id"], crypto.randomUUID()),
  companyId: getNullableString(record, ["company_id", "companyId"]) ?? undefined,
  name: getString(record, ["node_name", "nodeName"], "Untitled Node"),
  nodeType: getString(record, ["node_type", "nodeType"], "NODE"),
  nodePath: getString(record, ["node_path", "nodePath"], ""),
  parentId: getNullableString(record, ["parent_id", "parentId"]),
  children: [],
});

const buildOrgTree = (items: RawOrgRecord[]): OrgNode | null => {
  if (!items.length) return null;

  const nodes = items.map(mapOrgNode);
  // Decode the flat payload with a hash map so parent/child links can be resolved in O(1).
  const nodeHashMap = new Map(nodes.map((node) => [node.id, node] as const));
  const rootNodes: OrgNode[] = [];

  for (const node of nodes) {
    if (node.parentId) {
      const parent = nodeHashMap.get(node.parentId);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }

    rootNodes.push(node);
  }

  const sortNodes = (branch: OrgNode[]) => {
    branch.sort((left, right) => {
      const leftDepth = left.nodePath.split(".").length;
      const rightDepth = right.nodePath.split(".").length;
      if (leftDepth !== rightDepth) return leftDepth - rightDepth;
      return left.name.localeCompare(right.name);
    });

    branch.forEach((node) => sortNodes(node.children));
  };

  sortNodes(rootNodes);
  return rootNodes[0] ?? null;
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
