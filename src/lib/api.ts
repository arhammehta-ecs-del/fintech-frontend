import type { Company, CompanyStatus, GroupCompany } from "@/contexts/AppContext";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

type RawCompanyRecord = Record<string, unknown>;
type RawUserRecord = Record<string, unknown>;

const COMPANY_LIST_PATH = "/api/v1/companies/all";
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

const mapCompany = (record: RawCompanyRecord): {
  groupId: string;
  groupName: string;
  groupCode: string;
  groupCreatedDate: string;
  company: Company;
} => {
  const groupRecord =
    record.group && typeof record.group === "object" && record.group !== null
      ? (record.group as RawCompanyRecord)
      : {};

  const companyName = getString(record, ["companyName", "company_name", "name"], "Untitled Company");
  const companyId = getString(record, ["id", "companyId", "company_id"], companyName.toLowerCase().replace(/\s+/g, "-"));

  return {
    groupId: getString(record, ["groupId", "group_id"], getString(groupRecord, ["id"], "ungrouped")),
    groupName: getString(record, ["groupName", "group_name"], getString(groupRecord, ["name", "groupName"], "Ungrouped")),
    groupCode: getString(record, ["groupCode", "group_code"], getString(groupRecord, ["code"], "N/A")),
    groupCreatedDate: getString(
      record,
      ["groupCreatedDate", "group_created_date"],
      getString(groupRecord, ["createdDate", "created_date"], ""),
    ),
    company: {
      id: companyId,
      companyName,
      legalName: getString(record, ["legalName", "legal_name"], companyName),
      incorporationDate: getString(record, ["incorporationDate", "incorporation_date"], ""),
      address: getString(record, ["address", "registeredAddress", "registered_address"], ""),
      gstin: getString(record, ["gstin", "GSTIN"], ""),
      ieCode: getString(record, ["ieCode", "ie_code"], ""),
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
});

export async function login(email: string, password: string) {
  const payload = await apiFetch<{ message: string; user: RawUserRecord }>(LOGIN_PATH, {
    method: "POST",
    body: JSON.stringify({ email, password }),
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
  const payload = await apiFetch<unknown>(COMPANY_LIST_PATH);
  const items = ensureArray(payload);
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
