import { apiFetch } from "@/services/client";

type RawRoleRecord = {
  role_code?: string | null;
  category?: string | null;
  permission_level?: string | null;
  is_active?: boolean | null;
};

type RolesApiResponse = {
  success?: boolean;
  data?: RawRoleRecord[];
};

export type RoleRecord = {
  roleCode: string;
  category: string;
  permissionLevel: string;
  isActive: boolean;
};

const ROLES_PATH = "/api/v1/company-settings/roles";

const getPacketString = (value: string | null | undefined) => (typeof value === "string" ? value.trim() : "");

export async function getCompanyRoles(companyCode: string): Promise<RoleRecord[]> {
  const payload = await apiFetch<RolesApiResponse>(ROLES_PATH, {
    method: "POST",
    body: JSON.stringify({
      companyCode: companyCode.trim().toUpperCase(),
    }),
  });

  const roles = Array.isArray(payload.data) ? payload.data : [];

  return roles
    .map((role) => ({
      roleCode: getPacketString(role.role_code).toUpperCase(),
      category: getPacketString(role.category).toUpperCase(),
      permissionLevel: getPacketString(role.permission_level).toUpperCase(),
      isActive: Boolean(role.is_active),
    }))
    .filter((role) => role.roleCode && role.category && role.permissionLevel && role.isActive);
}
