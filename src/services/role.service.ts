import { apiFetch } from "@/services/client";

type RawRoleRecord = {
  roleName?: string | null;
  category?: string | null;
  subCategory?: string | null;
  permissionLevel?: string | null;
  accessType?: string | null;
};

type RolesApiResponse = {
  success?: boolean;
  data?: RawRoleRecord[];
};

export type RoleRecord = {
  roleCode: string;
  category: string;
  subCategory: string;
  permissionLevel: string;
  isActive: boolean;
  accessType?: "PRIMARY" | "SECONDARY";
};

const ROLES_PATH = "/api/v1/company-settings/role/fetch-all";

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
      roleCode: `${getPacketString(role.subCategory).toUpperCase()}_${getPacketString(role.permissionLevel).toUpperCase()}`,
      category: getPacketString(role.category).toUpperCase(),
      subCategory: getPacketString(role.subCategory).toUpperCase(),
      permissionLevel: getPacketString(role.permissionLevel).toUpperCase(),
      isActive: true,
      accessType:
        getPacketString(role.accessType).toUpperCase() === "PRIMARY"
          ? "PRIMARY"
          : getPacketString(role.accessType).toUpperCase() === "SECONDARY"
            ? "SECONDARY"
            : undefined,
    }))
    .filter((role) => role.roleCode && role.category && role.permissionLevel && role.isActive);
}
