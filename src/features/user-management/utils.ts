import type { RoleRecord } from "@/services/role.service";
import type { UserOnboardingPayload, UserOnboardingPermission } from "@/services/user.service";
import type { AppUser, OrgNode } from "@/contexts/AppContext";
import type {
  UserOnboardingFormData,
  SystemAccessScope,
  UserOnboardingPermissions,
  ValidationErrors,
} from "@/features/user-management/types";
import { formatRoleTokenLabel } from "@/features/user-management/roleLabels";
import {
  formatDateLabel,
  formatDateWithSlashes,
  isoToSlashDate,
  isDateInFuture,
  parseSlashDate,
  slashToIsoDate,
} from "@/features/user-management/date.utils";
import {
  getOrgNodeBadgeTheme,
  getOrgNodePermissionChipTheme,
  getOrgNodeTheme,
} from "@/features/user-management/orgNodeTheme";
import { getInitials as getSharedInitials } from "@/lib/userIdentity.utils";

const PERMISSION_ACTIONS = ["manager", "user", "viewer"] as const;
const SYSTEM_ACCESS_SCOPE_ITEMS = new Set([
  "ORG_STR",
  "ORG_STRUCTURE",
  "USER_ACC",
  "USER_ACCESS",
  "USER_MANAGEMENT",
  "WORK_FLOW",
  "WORKFLOW",
  "WORKFLOW_CONFIG",
]);

const normalizeScopeKey = (value: string) => value.trim().toUpperCase();
export const buildUserOnboardingPayload = (formData: UserOnboardingFormData): UserOnboardingPayload => {
  const selectedNodeEntries =
    formData.nodeSelections.length > 0
      ? formData.nodeSelections
      : [
        {
          nodeId: "",
          nodeName: "",
          nodePath: "",
          immediateChildren: [],
          allChildren: [],
          permissions: {
            primary: createInitialPermissions([]),
            secondary: formData.permissions,
          },
          permissionScopes: {
            primary: {},
            secondary: {},
          },
        },
      ];
  const effectivePrimaryNodeId = formData.primaryNodeId || selectedNodeEntries[0]?.nodeId || "";

  const mappedPermissions: UserOnboardingPermission[] = selectedNodeEntries.flatMap((nodeEntry) =>
    (Object.entries(nodeEntry.permissions) as Array<[string, UserOnboardingPermissions]>).flatMap(([bucketKey, bucketPermissions]) => {
      // Only the effective primary node can contribute PRIMARY permissions.
      // This prevents stale PRIMARY entries on previously-primary nodes after drag/drop reorder.
      if (bucketKey === "primary" && nodeEntry.nodeId !== effectivePrimaryNodeId) return [];
      return (
        Object.entries(bucketPermissions).flatMap(([category, modules]) =>
          Object.entries(modules).flatMap(([subCategory, rights]) => {
            const selectedActions = PERMISSION_ACTIONS.filter((action) => rights[action]);
            const accessType = bucketKey === "primary" ? "PRIMARY" : "SECONDARY";
            if (selectedActions.length === 0) return [];
            const roleNameBase = formatRoleTokenLabel(subCategory);

            return selectedActions.flatMap((action) => {
              const scope =
                nodeEntry.permissionScopes?.[bucketKey as "primary" | "secondary"]?.[category]?.[subCategory]?.[action] ?? "NODE";
              return [
                {
                  roleCategory: category as UserOnboardingPermission["roleCategory"],
                  roleSubCategory: subCategory,
                  roleName: `${roleNameBase} ${action[0].toUpperCase()}${action.slice(1)}`,
                  nodeName: nodeEntry.nodeName,
                  nodePath: nodeEntry.nodePath.trim(),
                  accessCategory:
                    category.trim().toUpperCase() === "SYSTEM_ACCESS" && SYSTEM_ACCESS_SCOPE_ITEMS.has(normalizeScopeKey(subCategory))
                      ? scope
                      : null,
                  accessType,
                },
              ];
            });
          }),
        )
      );
    }),
  );

  const dedupedPermissions = Array.from(
    new Map(
      mappedPermissions.map((permission) => [
        [
          permission.roleCategory,
          permission.roleSubCategory,
          permission.roleName,
          permission.nodePath,
          permission.accessType,
          permission.accessCategory ?? "",
        ].join("|"),
        permission,
      ]),
    ).values(),
  );

  return {
    type: "initiate",
    basicDetails: {
      name: formData.basic.name.trim(),
      email: formData.basic.email.trim(),
      phone: formData.basic.phone.trim(),
      designation: formData.basic.designation.trim(),
      employeeId: formData.basic.employeeId.trim() ? formData.basic.employeeId.trim() : null,
      reportingManager: (formData.basic.reportingManagerEmail || formData.basic.reportingManager).trim(),
    },
    permissions: dedupedPermissions,
    levelsHash: formData.selectedWorkflowLevelsHash.trim() || null,
  };
};

const normalize = (value: string | null | undefined) => (value || "").trim();

export const buildUserUpdatePayload = (formData: UserOnboardingFormData, seedMember: AppUser): UserOnboardingPayload => {
  const targetUserEmail = normalize(seedMember.email);
  if (!targetUserEmail) {
    throw new Error("Target user email is required for update payload.");
  }

  const fullPayload = buildUserOnboardingPayload(formData);
  const seedBasic = seedMember.basicDetails;
  const nextBasic = fullPayload.basicDetails;

  const changedBasicDetails: UserOnboardingPayload["basicDetails"] = {};
  if (normalize(nextBasic.name) !== normalize(seedBasic?.name)) changedBasicDetails.name = nextBasic.name;
  if (normalize(nextBasic.email) !== normalize(seedBasic?.email)) changedBasicDetails.email = nextBasic.email;
  if (normalize(nextBasic.phone) !== normalize(seedBasic?.phone)) changedBasicDetails.phone = nextBasic.phone;
  if (normalize(nextBasic.designation) !== normalize(seedBasic?.designation)) changedBasicDetails.designation = nextBasic.designation;
  if (normalize(nextBasic.employeeId || "") !== normalize(seedBasic?.employeeId)) changedBasicDetails.employeeId = nextBasic.employeeId || null;
  if (
    normalize(nextBasic.reportingManager || "") !==
    normalize(seedBasic?.reportingManagerEmail || seedBasic?.reportingManager || "")
  ) {
    changedBasicDetails.reportingManager = nextBasic.reportingManager || null;
  }

  const toPermissionKey = (permission: {
    roleCategory?: string;
    roleSubCategory?: string;
    roleName?: string;
    nodePath?: string;
    accessType?: string;
    accessCategory?: string | null;
  }) =>
    [
      (permission.roleCategory || "").trim().toUpperCase(),
      (permission.roleSubCategory || "").trim(),
      (permission.roleName || "").trim(),
      (permission.nodePath || "").trim(),
      (permission.accessType || "").trim().toUpperCase(),
      (permission.accessCategory || "").trim().toUpperCase(),
    ].join("|");

  const existingPermissions = seedMember.accessDetails || [];
  const existingPermissionKeys = new Set(existingPermissions.map((permission) => toPermissionKey(permission)));
  const nextPermissionKeys = new Set(fullPayload.permissions.map((permission) => toPermissionKey(permission)));

  const removedPermissions = existingPermissions
    .filter((permission) => (permission.accessType || "").trim().toUpperCase() !== "PRIMARY")
    .filter((permission) => !nextPermissionKeys.has(toPermissionKey(permission)))
    .map((permission) => ({
      roleCategory: permission.roleCategory as UserOnboardingPermission["roleCategory"],
      roleSubCategory: permission.roleSubCategory,
      roleName: permission.roleName,
      nodeName: permission.nodeName,
      nodePath: permission.nodePath,
      accessCategory: permission.accessCategory ?? null,
      accessType: permission.accessType,
      remove: true as const,
    }));

  const addedPermissions = fullPayload.permissions
    .filter((permission) => !existingPermissionKeys.has(toPermissionKey(permission)))
    .map((permission) => ({
      roleCategory: permission.roleCategory,
      roleSubCategory: permission.roleSubCategory,
      roleName: permission.roleName,
      nodeName: permission.nodeName,
      nodePath: permission.nodePath,
      nodeType: permission.nodeType,
      accessCategory: permission.accessCategory ?? null,
      accessType: permission.accessType,
    }));

  const hasPermissionDelta =
    removedPermissions.length > 0 ||
    addedPermissions.length > 0 ||
    nextPermissionKeys.size !== existingPermissionKeys.size ||
    Array.from(nextPermissionKeys).some((key) => !existingPermissionKeys.has(key));

  const hasBasicDelta = Object.keys(changedBasicDetails).length > 0;

  const payload: UserOnboardingPayload = {
    type: "update",
    targetUserEmail,
    remarks: formData.remark.trim(),
    levelsHash: formData.selectedWorkflowLevelsHash.trim() || null,
  };

  if (hasBasicDelta) {
    payload.basicDetails = changedBasicDetails;
  }

  if (hasPermissionDelta) {
    payload.permissions = [...addedPermissions, ...removedPermissions];
  }

  return payload;
};

export const buildSignatoryOnboardingPayload = (
  formData: UserOnboardingFormData,
  companyNode: { nodeName: string; nodePath: string; nodeType?: string },
): UserOnboardingPayload => ({
  type: "initiate",
  basicDetails: {
    name: formData.basic.name.trim(),
    email: formData.basic.email.trim(),
    phone: formData.basic.phone.trim(),
    designation: formData.basic.designation.trim(),
    employeeId: formData.basic.employeeId.trim() ? formData.basic.employeeId.trim() : null,
    reportingManager: null,
  },
  permissions: [
    {
      accessType: "PRIMARY",
      roleName: "Corp Admin",
      roleCategory: "ALL",
      roleSubCategory: "ALL",
      nodeName: companyNode.nodeName.trim(),
      nodePath: companyNode.nodePath.trim(),
    },
  ],
  levelsHash: null,
});

/**
 * Build an empty UserOnboardingPermissions object from the live roles.
 * Structure: { [category]: { [subCategory]: { manager: false, user: false, viewer: false } } }
 */
export const createInitialPermissions = (roles: RoleRecord[]): UserOnboardingPermissions => {
  const permissions: UserOnboardingPermissions = {};

  for (const role of roles) {
    const cat = role.category;
    const sub = role.subCategory;
    if (!permissions[cat]) permissions[cat] = {};
    if (!permissions[cat][sub]) permissions[cat][sub] = { manager: false, user: false, viewer: false };
  }

  return permissions;
};

export const createInitialPermissionScopes = (roles: RoleRecord[]) => {
  const scopes: Record<string, Record<string, Partial<Record<"manager" | "user" | "viewer", SystemAccessScope>>>> = {};

  for (const role of roles) {
    const cat = role.category;
    const sub = role.subCategory;
    if (!scopes[cat]) scopes[cat] = {};
    if (scopes[cat][sub]) continue;
    scopes[cat][sub] = { manager: "NODE", user: "NODE", viewer: "NODE" };
  }

  return scopes;
};

export const getInitials = (name: string) => getSharedInitials(name);

const AVATAR_PALETTES = [
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-orange-100", text: "text-orange-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
];

export const getAvatarColor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
};

export const maskContactNumber = (phone?: string) => {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return "*".repeat(digits.length - 4) + digits.slice(-4);
};

export const createInitialUserOnboardingFormData = (): UserOnboardingFormData => ({
  basic: {
    name: "",
    email: "",
    phone: "",
    designation: "",
    employeeId: "",
    reportingManager: "",
    reportingManagerName: "",
    reportingManagerEmail: "",
  },
  isGlobalUserEligible: false,
  isGlobalSignatory: false,
  permissions: createInitialPermissions([]),
  nodeSelections: [],
  primaryNodeId: null,
  selectedWorkflow: "",
  selectedWorkflowLevelsHash: "",
  remark: "",
});

const toNodePathSegmentLabel = (segment: string) => segment.trim().replace(/_/g, " ");

const splitNodePathSegments = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const rawParts = trimmed.includes(">")
    ? trimmed.split(">")
    : trimmed.split(".");

  return rawParts
    .map((part) => toNodePathSegmentLabel(part))
    .filter((part) => Boolean(part) && part.toUpperCase() !== "ROOT");
};

export const formatCollapsedNodePath = (value: string, keepLast = 3) => {
  const segments = splitNodePathSegments(value);
  if (segments.length === 0) return "";

  const root = segments[0] ?? "";
  const tail = segments.slice(1);
  if (tail.length <= keepLast) {
    return [root, ...tail].filter(Boolean).join(" > ");
  }

  return [root, "...", ...tail.slice(-keepLast)].filter(Boolean).join(" > ");
};

export const validateUserOnboardingStep = (step: number, formData: UserOnboardingFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (step === 1) {
    const { name, email, phone, designation, employeeId, reportingManager } = formData.basic;

    if (!name.trim()) errors.name = "Required";
    if (!email.trim()) errors.email = "Required";
    if (!phone.trim()) errors.phone = "Required";
    else if (!/^\d{10}$/.test(phone)) errors.phone = "Enter a valid 10-digit phone number";
    if (!designation.trim()) errors.designation = "Required";
    if (!(formData.isGlobalUserEligible && formData.isGlobalSignatory) && !reportingManager.trim()) {
      errors.reportingManager = "Required";
    }
  }

  return errors;
};

export function findOrgNode(node: OrgNode | null, nodeId: string): OrgNode | null {
  if (!node) return null;
  if (node.id === nodeId) return node;

  for (const child of node.children) {
    const match = findOrgNode(child, nodeId);
    if (match) return match;
  }

  return null;
}

export {
  formatDateLabel,
  formatDateWithSlashes,
  isoToSlashDate,
  isDateInFuture,
  parseSlashDate,
  slashToIsoDate,
  getOrgNodeTheme,
  getOrgNodeBadgeTheme,
  getOrgNodePermissionChipTheme,
};
