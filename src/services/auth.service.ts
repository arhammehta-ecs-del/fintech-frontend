import { apiFetch } from "@/services/client";
import type { CurrentUser, CurrentUserGroup } from "@/contexts/AppContext";

type RawLoginCompany = {
  legalName?: string | null;
  brandName?: string | null;
  companyCode?: string | null;
  reporteeCount?: number | null;
};

type RawLoginGroup = {
  groupName?: string | null;
  groupCode?: string | null;
  companies?: RawLoginCompany[] | null;
};

type RawLoginUser = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  brand?: string | null;
  companyCode?: string | null;
  groupName?: string | null;
  groupCode?: string | null;
  groups?: RawLoginGroup[] | null;
};

const LOGIN_PATH = "/api/v1/auth/login";
const LOGOUT_PATH = "/api/v1/auth/logout";
const ME_PATH = "/api/v1/auth/me";
const ACCESS_RIGHTS_PATH = "/api/v1/auth/access-rights";

export type AccessRight = {
  roleCategory: string;
  roleSubCategory: string;
  roleName: string;
  nodeName: string;
  nodePath: string;
  nodeType: string;
  accessCategory: string;
  sourceTag?: string;
};

export type AccessRightsResponse = {
  primary: AccessRight[];
  secondary: AccessRight[];
};

export type AccessRightsUser = {
  name: string;
  email: string;
};

export type ReporteeAccessRightsResponse = {
  users: AccessRightsUser[];
};

const getPacketString = (value: string | null | undefined) => (typeof value === "string" ? value.trim() : "");
const toUpperValue = (value: string) => value.toUpperCase();

const mapUserGroups = (groups?: RawLoginGroup[] | null): CurrentUserGroup[] =>
  (groups ?? []).map((group) => {
    const groupName = getPacketString(group.groupName);
    const groupCode = toUpperValue(getPacketString(group.groupCode));
    if (!groupName || !groupCode) {
      throw new Error("Invalid auth/me response: groupName and groupCode are required");
    }
    if (!Array.isArray(group.companies)) {
      throw new Error("Invalid auth/me response: group.companies must be an array");
    }
    const companies = group.companies.map((company) => {
      const companyName = getPacketString(company.legalName);
      const brandName = getPacketString(company.brandName);
      const companyCode = toUpperValue(getPacketString(company.companyCode));
      const reporteeCount = typeof company.reporteeCount === "number" && Number.isFinite(company.reporteeCount)
        ? company.reporteeCount
        : 0;
      if (!companyName || !brandName || !companyCode) {
        throw new Error("Invalid auth/me response: company legalName, brandName and companyCode are required");
      }
      return { companyName, brandName, companyCode, reporteeCount };
    });
    return { groupName, groupCode, companies };
  });

const mapUser = (record?: RawLoginUser | null): CurrentUser => {
  if (!record) {
    throw new Error("Invalid auth/me response: missing user object");
  }
  const name = getPacketString(record.name);
  const email = getPacketString(record.email);
  const phone = getPacketString(record.phone);
  if (!name || !email || !phone) {
    throw new Error("Invalid auth/me response: user name, email and phone are required");
  }

  const groups = mapUserGroups(record?.groups);
  const firstGroup = groups[0] ?? null;
  const firstCompany = firstGroup?.companies[0] ?? null;

  return {
    name,
    email,
    phone,
    company: firstCompany?.companyName,
    brand: firstCompany?.brandName,
    companyCode: firstCompany?.companyCode,
    reporteeCount: firstCompany?.reporteeCount ?? 0,
    groupName: firstGroup?.groupName,
    groupCode: firstGroup?.groupCode,
    groups,
  };
};

export async function login(email: string, password: string, action = false, forceLogToken?: string) {
  const payload = await apiFetch<{ message: string; user: RawLoginUser }>(LOGIN_PATH, {
    method: "POST",
    body: JSON.stringify({ email, password, action: action ? 1 : 0, forceLogToken }),
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

export async function getCurrentUser() {
  const payload = await apiFetch<{ message?: string; user?: RawLoginUser | null }>(ME_PATH, {
    method: "POST",
  });
  if (!payload.user) {
    throw new Error("Invalid auth/me response: missing user");
  }

  return {
    message: payload.message ?? "Current user fetched",
    user: mapUser(payload.user),
  };
}

const mapAccessRights = (value: unknown): AccessRight[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = (item && typeof item === "object") ? (item as Record<string, unknown>) : {};
    return {
      roleCategory: getPacketString(String(row.roleCategory ?? "")),
      roleSubCategory: getPacketString(String(row.roleSubCategory ?? "")),
      roleName: getPacketString(String(row.roleName ?? "")),
      nodeName: getPacketString(String(row.nodeName ?? "")),
      nodePath: getPacketString(String(row.nodePath ?? "")),
      nodeType: getPacketString(String(row.nodeType ?? "")),
      accessCategory: getPacketString(String(row.accessCategory ?? "")),
      sourceTag: getPacketString(String(row.sourceTag ?? "")) || undefined,
    };
  });
};

export async function getAccessRights(email: string, companyCode: string): Promise<AccessRightsResponse> {
  const payload = await apiFetch<unknown>(ACCESS_RIGHTS_PATH, {
    method: "POST",
    body: JSON.stringify({
      email,
      companyCode,
      reportee: false,
    }),
  });

  const root = (payload && typeof payload === "object") ? (payload as Record<string, unknown>) : {};
  const data = (root.data && typeof root.data === "object") ? (root.data as Record<string, unknown>) : root;

  return {
    primary: mapAccessRights(data.primary),
    secondary: mapAccessRights(data.secondary),
  };
}

const mapAccessRightsUsers = (value: unknown): AccessRightsUser[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = (item && typeof item === "object") ? (item as Record<string, unknown>) : {};
      return {
        name: getPacketString(String(row.name ?? "")),
        email: getPacketString(String(row.email ?? "")),
      };
    })
    .filter((row) => row.name || row.email);
};

export async function getReporteeAccessRights(): Promise<ReporteeAccessRightsResponse> {
  const payload = await apiFetch<unknown>(ACCESS_RIGHTS_PATH, {
    method: "POST",
    body: JSON.stringify({
      companyCode: null,
      email: null,
      reportee: true,
    }),
  });

  const root = (payload && typeof payload === "object") ? (payload as Record<string, unknown>) : {};
  const data = (root.data && typeof root.data === "object") ? (root.data as Record<string, unknown>) : root;

  return {
    users: mapAccessRightsUsers(data.users),
  };
}
