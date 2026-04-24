import { apiFetch } from "@/services/client";
import type { CurrentUser, CurrentUserGroup } from "@/contexts/AppContext";

type RawLoginCompany = {
  legalName?: string | null;
  brandName?: string | null;
  companyCode?: string | null;
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

// comment below this
const LOCAL_LOGIN_EMAIL = "test1@gmail.com";
const LOCAL_LOGIN_PASSWORD = "Test@123";
const LOCAL_LOGIN_USER: RawLoginUser = {
  name: "Test",
  email: LOCAL_LOGIN_EMAIL,
  phone: "1234567890",
  groups: [
    {
      groupName: "Test Group",
      groupCode: "TESTGROUP",
      companies: [
        {
          legalName: "Tech Solutions Ltd",
          brandName: "TechSol",
          companyCode: "MVPOER44",
        },
      ],
    },
  ],
};

const getPacketString = (value: string | null | undefined) => (typeof value === "string" ? value.trim() : "");
const toUpperValue = (value: string) => value.toUpperCase();

const mapUserGroups = (groups?: RawLoginGroup[] | null): CurrentUserGroup[] =>
  Array.isArray(groups)
    ? groups.map((group) => ({
        groupName: getPacketString(group.groupName),
        groupCode: toUpperValue(getPacketString(group.groupCode)),
        companies: Array.isArray(group.companies)
          ? group.companies.map((company) => ({
              companyName: getPacketString(company.legalName),
              brandName: getPacketString(company.brandName),
              companyCode: toUpperValue(getPacketString(company.companyCode)),
            }))
          : [],
      }))
    : [];

const mapUser = (record?: RawLoginUser | null): CurrentUser => {
  const groups = mapUserGroups(record?.groups);
  const firstGroup = groups[0];
  const firstCompany = firstGroup?.companies[0];

  return {
    name: getPacketString(record?.name),
    email: getPacketString(record?.email),
    phone: getPacketString(record?.phone),
    company: getPacketString(record?.company) || firstCompany?.companyName || "",
    brand: getPacketString(record?.brand) || firstCompany?.brandName || "",
    companyCode:
      toUpperValue(getPacketString(record?.companyCode)) || firstCompany?.companyCode || "",
    groupName: getPacketString(record?.groupName) || firstGroup?.groupName || "",
    groupCode: toUpperValue(getPacketString(record?.groupCode)) || firstGroup?.groupCode || "",
    groups,
  };
};

export async function login(email: string, password: string, action = false) {
// comment below this ok
  if (email.trim().toLowerCase() === LOCAL_LOGIN_EMAIL && password === LOCAL_LOGIN_PASSWORD) {
    return {
      message: "Local login successful",
      user: mapUser(LOCAL_LOGIN_USER),
    };
  }

  const payload = await apiFetch<{ message: string; user: RawLoginUser }>(LOGIN_PATH, {
    method: "POST",
    body: JSON.stringify({ email, password, action: action ? 1 : 0 }),
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

  return {
    message: payload.message ?? "",
    user: mapUser(payload.user),
  };
}
