import { apiFetch } from "@/services/client";

type RawLoginUser = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  brand?: string | null;
  companyCode?: string | null;
  groupName?: string | null;
  groupCode?: string | null;
};

const LOGIN_PATH = "/api/v1/auth/login";
const LOGOUT_PATH = "/api/v1/auth/logout";
const ME_PATH = "/api/v1/auth/me";

const getPacketString = (value: string | null | undefined) => (typeof value === "string" ? value.trim() : "");
const toUpperValue = (value: string) => value.toUpperCase();

const mapUser = (record?: RawLoginUser | null) => ({
  name: getPacketString(record?.name),
  email: getPacketString(record?.email),
  phone: getPacketString(record?.phone),
  company: getPacketString(record?.company),
  brand: getPacketString(record?.brand),
  companyCode: toUpperValue(getPacketString(record?.companyCode)),
  groupName: getPacketString(record?.groupName),
  groupCode: toUpperValue(getPacketString(record?.groupCode)),
});

export async function login(email: string, password: string, action = false) {
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
