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
  roleName: string;
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
    body: JSON.stringify({
      companyCode: companyCode.trim().toUpperCase(),
    }),
  });

  if (!Array.isArray(payload.data)) {
    throw new Error("Invalid roles response: data must be an array");
  }

  return payload.data.map((role) => {
    const roleName = getPacketString(role.roleName);
    const category = getPacketString(role.category).toUpperCase();
    const subCategory = getPacketString(role.subCategory).toUpperCase();
    const permissionLevel = getPacketString(role.permissionLevel).toUpperCase();
    if (!roleName || !category || !subCategory || !permissionLevel) {
      throw new Error("Invalid roles response: roleName, category, subCategory and permissionLevel are required");
    }

    const accessTypeRaw = getPacketString(role.accessType).toUpperCase();
    const accessType =
      accessTypeRaw === "PRIMARY"
        ? "PRIMARY"
        : accessTypeRaw === "SECONDARY"
          ? "SECONDARY"
          : undefined;

    return {
      roleName,
      roleCode: `${subCategory}_${permissionLevel}`,
      category,
      subCategory,
      permissionLevel,
      isActive: true,
      accessType,
    };
  });
}
