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

  /* Mock payload commented out
  const mockPayload: RolesApiResponse = {
    success: true,
    data: [
      { roleName: "Purchase Order Viewer", category: "TRANSACTIONAL", subCategory: "PURCHASE_ORDER", permissionLevel: "VIEWER" },
      { roleName: "Purchase Order User", category: "TRANSACTIONAL", subCategory: "PURCHASE_ORDER", permissionLevel: "USER" },
      { roleName: "Purchase Order Manager", category: "TRANSACTIONAL", subCategory: "PURCHASE_ORDER", permissionLevel: "MANAGER" },
      { roleName: "Accounts Viewer", category: "TRANSACTIONAL", subCategory: "ACCOUNTS", permissionLevel: "VIEWER" },
      { roleName: "Accounts User", category: "TRANSACTIONAL", subCategory: "ACCOUNTS", permissionLevel: "USER" },
      { roleName: "Accounts Manager", category: "TRANSACTIONAL", subCategory: "ACCOUNTS", permissionLevel: "MANAGER" },
      { roleName: "Invoice Viewer", category: "TRANSACTIONAL", subCategory: "INVOICE", permissionLevel: "VIEWER" },
      { roleName: "Invoice User", category: "TRANSACTIONAL", subCategory: "INVOICE", permissionLevel: "USER" },
      { roleName: "Invoice Manager", category: "TRANSACTIONAL", subCategory: "INVOICE", permissionLevel: "MANAGER" },
      { roleName: "Master Viewer", category: "OPERATIONAL", subCategory: "MASTER", permissionLevel: "VIEWER" },
      { roleName: "Master User", category: "OPERATIONAL", subCategory: "MASTER", permissionLevel: "USER" },
      { roleName: "Master Manager", category: "OPERATIONAL", subCategory: "MASTER", permissionLevel: "MANAGER" },
      { roleName: "Org Structure Viewer", category: "SYSTEM_ACCESS", subCategory: "ORG_STRUCTURE", permissionLevel: "VIEWER" },
      { roleName: "Org Structure User", category: "SYSTEM_ACCESS", subCategory: "ORG_STRUCTURE", permissionLevel: "USER" },
      { roleName: "Org Structure Manager", category: "SYSTEM_ACCESS", subCategory: "ORG_STRUCTURE", permissionLevel: "MANAGER" },
      { roleName: "User Management Viewer", category: "SYSTEM_ACCESS", subCategory: "USER_MANAGEMENT", permissionLevel: "VIEWER" },
      { roleName: "User Management User", category: "SYSTEM_ACCESS", subCategory: "USER_MANAGEMENT", permissionLevel: "USER" },
      { roleName: "User Management Manager", category: "SYSTEM_ACCESS", subCategory: "USER_MANAGEMENT", permissionLevel: "MANAGER" },
      { roleName: "Track Workflow Viewer", category: "SYSTEM_ACCESS", subCategory: "TRACK_WORKFLOW", permissionLevel: "VIEWER" },
      { roleName: "Track Workflow User", category: "SYSTEM_ACCESS", subCategory: "TRACK_WORKFLOW", permissionLevel: "USER" },
      { roleName: "Track Workflow Manager", category: "SYSTEM_ACCESS", subCategory: "TRACK_WORKFLOW", permissionLevel: "MANAGER" }
    ]
  };
  */

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
