import type { OrgNode } from "@/contexts/AppContext";
import { createCompanyOnboarding, getAllCompanies, updateCompanyOnboardingAction, type OnboardingPayload } from "@/services/company.service";
import { getApiErrorMessage } from "@/services/client";
import { createNewOrgNode, getCompanyOrgStructure, updateOrgNodeAction } from "@/services/org.service";
import { getCompanyRoles } from "@/services/role.service";
import { createUserOnboarding, getCompanyUsers, updateUserStatus, type UserOnboardingPermission, type UserOnboardingPayload } from "@/services/user.service";

export type SeedSummary = {
  companiesCreated: number;
  companiesApproved: number;
  orgNodesCreated: number;
  orgNodesApproved: number;
  usersCreated: number;
  usersApproved: number;
  failedCompanies: number;
  failedOrgNodes: number;
  failedUsers: number;
  errors: string[];
};

export type SeedConfig = {
  approvedCompanyCount: number;
  pendingCompanyCount: number;
  usersPerCompany: number;
  pendingUsersPerCompany: number;
  signatoriesPerCompany: number;
  orgLevels: number;
  nodesPerLevel: number;
  pendingOrgNodesPerCompany: number;
};

export const DEFAULT_SEED_CONFIG: SeedConfig = {
  approvedCompanyCount: 10,
  pendingCompanyCount: 5,
  usersPerCompany: 10,
  pendingUsersPerCompany: 5,
  signatoriesPerCompany: 2,
  orgLevels: 1,
  nodesPerLevel: 10,
  pendingOrgNodesPerCompany: 5,
};

const defaultSummary = (): SeedSummary => ({
  companiesCreated: 0,
  companiesApproved: 0,
  orgNodesCreated: 0,
  orgNodesApproved: 0,
  usersCreated: 0,
  usersApproved: 0,
  failedCompanies: 0,
  failedOrgNodes: 0,
  failedUsers: 0,
  errors: [],
});

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const pad = (value: number) => String(value).padStart(2, "0");

const getTodayDate = () => new Date().toISOString().slice(0, 10);

const flattenOrg = (root: OrgNode | null): OrgNode[] => {
  if (!root) return [];
  const list: OrgNode[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    list.push(current);
    for (let index = current.children.length - 1; index >= 0; index -= 1) {
      stack.push(current.children[index]);
    }
  }
  return list;
};

const normalizePathSegment = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toUpperCase();

const findCompanyByBrand = async (brand: string) => {
  const groups = await getAllCompanies();
  for (const group of groups) {
    for (const company of group.subsidiaries) {
      if (company.brand?.trim().toUpperCase() === brand.trim().toUpperCase()) {
        return company;
      }
    }
  }
  return null;
};

const createCompanySeedPayload = (index: number, signatoriesPerCompany: number): OnboardingPayload => {
  const companyIndex = pad(index + 1);
  const companyLabel = `SEED COMPANY ${companyIndex}`;
  const groupLabel = `SEED GROUP ${Math.ceil((index + 1) / 5)}`;

  return {
    group: {
      name: groupLabel,
      groupCode: null,
      remarks: "Frontend-only seed run",
    },
    company: {
      name: companyLabel,
      brand: companyLabel,
      gst: `27SEED${companyIndex}A1Z${(index % 9) + 1}`,
      ieCode: `SEED${companyIndex}${(index % 9) + 1}`,
      registeredAt: getTodayDate(),
      address: `Seed Address Block ${companyIndex}, Mumbai, Maharashtra, India`,
    },
    signatories: Array.from({ length: signatoriesPerCompany }, (_, signatoryIndex) => {
      const signatoryLabel = signatoryIndex + 1;
      return {
        name: `Seed Signatory ${companyIndex}-${signatoryLabel}`,
        email: `seed.signatory.${companyIndex}.${signatoryLabel}@example.com`,
        phone: `900000${pad(index + 1)}${pad(signatoryLabel)}`,
        designation: signatoryLabel === 1 ? "Operations Manager" : "Finance Manager",
        employeeId: `SIG-${companyIndex}-${signatoryLabel}`,
      };
    }),
  };
};

const findCompanyByBrandWithStatus = async (brand: string, status: "Pending" | "Approved") => {
  const groups = await getAllCompanies();
  for (const group of groups) {
    for (const company of group.subsidiaries) {
      if (
        company.status === status &&
        company.brand?.trim().toUpperCase() === brand.trim().toUpperCase()
      ) {
        return company;
      }
    }
  }
  return null;
};

const pushError = (summary: SeedSummary, message: string, onProgress?: (message: string) => void) => {
  summary.errors.push(message);
  onProgress?.(message);
};

const createOrgNodeMatrix = async (
  companyCode: string,
  orgLevels: number,
  nodesPerLevel: number,
  pendingOrgNodesPerCompany: number,
  summary: SeedSummary,
  onProgress?: (message: string) => void,
) => {
  let tree = await getCompanyOrgStructure(companyCode);
  const rootNode = tree;
  if (!rootNode) return;

  let parentNodes: OrgNode[] = [rootNode];

  const totalPlannedNodes = orgLevels * nodesPerLevel;
  const safePendingCount = Math.max(0, Math.min(pendingOrgNodesPerCompany, totalPlannedNodes));
  const approvalsNeeded = Math.max(totalPlannedNodes - safePendingCount, 0);
  let createdNodeCounter = 0;
  let approvedNodeCounter = 0;
  for (let level = 1; level <= orgLevels; level += 1) {
    const nextParents: OrgNode[] = [];
    const currentNodes = flattenOrg(tree);
    const existingPathSet = new Set(currentNodes.map((node) => node.nodePath.toUpperCase()));

    for (let nodeIndex = 1; nodeIndex <= nodesPerLevel; nodeIndex += 1) {
      const parentNode = parentNodes[(nodeIndex - 1) % parentNodes.length];
      const nodeName = `L${level}_N${nodeIndex}`;
      const targetPath = `${parentNode.nodePath}.${normalizePathSegment(nodeName)}`.toUpperCase();
      if (existingPathSet.has(targetPath)) {
        continue;
      }

      try {
        const response = await createNewOrgNode({
          companyCode,
          newNodeName: nodeName,
          nodeType: level === 1 ? "DIVISION" : "DEPARTMENT",
          parentNode: {
            nodeName: parentNode.name,
            nodePath: parentNode.nodePath,
          },
        });
        summary.orgNodesCreated += 1;
        createdNodeCounter += 1;

        const requestId = (response as { requestId?: string }).requestId;
        const shouldApproveNode = approvedNodeCounter < approvalsNeeded;
        if (requestId && shouldApproveNode) {
          await updateOrgNodeAction(requestId, "approve", "Seed auto-approval");
          summary.orgNodesApproved += 1;
          approvedNodeCounter += 1;
        }
      } catch {
        summary.failedOrgNodes += 1;
      }
    }

    await wait(150);
    tree = await getCompanyOrgStructure(companyCode);
    const allNodes = flattenOrg(tree);
    const prefix = `${companyCode}.`;
    const expectedDepth = level + 1;
    const createdLevelNodes = allNodes.filter((node) => {
      const normalizedPath = node.nodePath.startsWith(prefix) ? node.nodePath : `${prefix}${node.nodePath}`;
      return normalizedPath.split(".").length === expectedDepth;
    });

    if (createdLevelNodes.length > 0) {
      nextParents.push(...createdLevelNodes);
    }
    parentNodes = nextParents.length > 0 ? nextParents : parentNodes;
    onProgress?.(`Org level ${level}/${orgLevels} completed for ${companyCode}`);
  }
};

const buildUserPermission = async (companyCode: string): Promise<UserOnboardingPermission> => {
  const [orgTree, roles] = await Promise.all([
    getCompanyOrgStructure(companyCode),
    getCompanyRoles(companyCode),
  ]);
  const rootNode = orgTree;
  if (!rootNode) {
    throw new Error("Org root not available");
  }

  const primaryRole = roles.find((role) => role.accessType === "PRIMARY") ?? roles[0];
  if (!primaryRole) {
    throw new Error("No role mapping available");
  }

  return {
    accessType: "PRIMARY",
    roleCategory:
      primaryRole.category === "OPERATIONAL"
        ? "OPERATIONAL"
        : primaryRole.category === "SYSTEM_ACCESS"
          ? "SYSTEM_ACCESS"
          : "TRANSACTIONAL",
    roleSubCategory: primaryRole.subCategory,
    roleName: primaryRole.roleName,
    nodeName: rootNode.name,
    nodePath: rootNode.nodePath,
  };
};

const createUsersForCompany = async (
  companyCode: string,
  companyIndex: number,
  targetUsersPerCompany: number,
  pendingUsersPerCompany: number,
  signatoriesPerCompany: number,
  summary: SeedSummary,
  onProgress?: (message: string) => void,
) => {
  const permission = await buildUserPermission(companyCode);
  const signatoryManagerEmail = `seed.signatory.${pad(companyIndex + 1)}.1@example.com`;
  const usersToCreate = Math.max(targetUsersPerCompany - signatoriesPerCompany, 0);
  const safePendingUsers = Math.max(0, Math.min(pendingUsersPerCompany, targetUsersPerCompany));
  const approvalsNeeded = Math.max(targetUsersPerCompany - safePendingUsers - signatoriesPerCompany, 0);
  const existingUsers = await getCompanyUsers(companyCode);
  const existingEmailSet = new Set(existingUsers.map((user) => user.email.trim().toLowerCase()));
  let approvedUserCounter = 0;

  for (let userIndex = 1; userIndex <= usersToCreate; userIndex += 1) {
    const userEmail = `seed.user.${pad(companyIndex + 1)}.${pad(userIndex)}@example.com`;
    if (existingEmailSet.has(userEmail.toLowerCase())) {
      continue;
    }

    const payload: UserOnboardingPayload = {
      basicDetails: {
        name: `Seed User ${pad(companyIndex + 1)}-${pad(userIndex)}`,
        email: userEmail,
        phone: `91${pad(companyIndex + 1)}${pad(userIndex)}123456`,
        designation: userIndex % 2 === 0 ? "Analyst" : "Executive",
        employeeId: `EMP-${pad(companyIndex + 1)}-${pad(userIndex)}`,
        reportingManager: signatoryManagerEmail,
      },
      permissions: [permission],
      workflowId: null,
    };

    try {
      await createUserOnboarding(payload);
      summary.usersCreated += 1;
      existingEmailSet.add(userEmail.toLowerCase());
    } catch {
      summary.failedUsers += 1;
      continue;
    }

    const shouldApproveUser = approvedUserCounter < approvalsNeeded;
    if (!shouldApproveUser) {
      onProgress?.(`Users ${userIndex}/${usersToCreate} completed for ${companyCode}`);
      continue;
    }

    await wait(100);
    try {
      const users = await getCompanyUsers(companyCode);
      const pendingRecord = users.find(
        (user) => user.status === "Pending" && user.email.trim().toLowerCase() === payload.basicDetails.email.toLowerCase(),
      );
      if (pendingRecord?.id) {
        await updateUserStatus(pendingRecord.id, "approve", "Seed auto-approval");
        summary.usersApproved += 1;
        approvedUserCounter += 1;
      }
    } catch {
      summary.failedUsers += 1;
    }

    onProgress?.(`Users ${userIndex}/${usersToCreate} completed for ${companyCode}`);
  }
};

export async function runFrontendSeed(
  config: SeedConfig = DEFAULT_SEED_CONFIG,
  onProgress?: (message: string) => void,
): Promise<SeedSummary> {
  const summary = defaultSummary();
  const totalCompanies = config.approvedCompanyCount + config.pendingCompanyCount;

  for (let companyIndex = 0; companyIndex < totalCompanies; companyIndex += 1) {
    const companyNumber = companyIndex + 1;
    const shouldApproveCompany = companyIndex < config.approvedCompanyCount;
    onProgress?.(`Starting company ${companyNumber}/${totalCompanies}`);

    const companyPayload = createCompanySeedPayload(companyIndex, config.signatoriesPerCompany);
    const seedBrand = companyPayload.company.brand ?? companyPayload.company.name;

    let existingApproved = null;
    let existingPending = null;
    try {
      existingApproved = await findCompanyByBrandWithStatus(seedBrand, "Approved");
      existingPending = await findCompanyByBrandWithStatus(seedBrand, "Pending");
    } catch (error) {
      summary.failedCompanies += 1;
      pushError(summary, `Failed to load groups while checking ${seedBrand}: ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
      continue;
    }

    if (existingApproved?.companyCode) {
      onProgress?.(`Company ${seedBrand} already approved, skipping creation`);
      try {
        await createOrgNodeMatrix(
          existingApproved.companyCode,
          config.orgLevels,
          config.nodesPerLevel,
          config.pendingOrgNodesPerCompany,
          summary,
          onProgress,
        );
      } catch (error) {
        summary.failedOrgNodes += 1;
        pushError(summary, `Org seeding failed for ${existingApproved.companyCode}: ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
      }
      try {
        await createUsersForCompany(
          existingApproved.companyCode,
          companyIndex,
          config.usersPerCompany,
          config.pendingUsersPerCompany,
          config.signatoriesPerCompany,
          summary,
          onProgress,
        );
      } catch (error) {
        summary.failedUsers += 1;
        pushError(summary, `User seeding failed for ${existingApproved.companyCode}: ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
      }
      continue;
    }

    if (existingPending?.id) {
      onProgress?.(`Company ${seedBrand} already pending, skipping create`);
      continue;
    }

    try {
      await createCompanyOnboarding(companyPayload);
      summary.companiesCreated += 1;
    } catch (error) {
      summary.failedCompanies += 1;
      pushError(summary, `Company create failed for ${seedBrand}: ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
      continue;
    }

    await wait(250);
    let pendingCompany = null;
    try {
      pendingCompany = await findCompanyByBrandWithStatus(seedBrand, "Pending");
    } catch (error) {
      summary.failedCompanies += 1;
      pushError(summary, `Failed to re-fetch pending company ${seedBrand}: ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
      continue;
    }
    const onboardingId = pendingCompany?.id?.trim() ?? "";
    if (!onboardingId) {
      summary.failedCompanies += 1;
      pushError(summary, `Pending onboarding id not found for ${seedBrand}`, onProgress);
      continue;
    }

    if (!shouldApproveCompany) {
      onProgress?.(`Company ${seedBrand} kept pending for testing`);
      continue;
    }

    try {
      await updateCompanyOnboardingAction(onboardingId, "approve", "Seed auto-approval");
      summary.companiesApproved += 1;
    } catch (error) {
      summary.failedCompanies += 1;
      pushError(summary, `Company approval failed for ${seedBrand}: ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
      continue;
    }

    await wait(300);
    let company = null;
    try {
      company = await findCompanyByBrand(seedBrand);
    } catch (error) {
      summary.failedCompanies += 1;
      pushError(summary, `Failed to fetch approved company ${seedBrand}: ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
      continue;
    }
    if (!company?.companyCode) {
      summary.failedCompanies += 1;
      pushError(summary, `Approved company code missing for ${seedBrand}`, onProgress);
      continue;
    }

    try {
      await createOrgNodeMatrix(
        company.companyCode,
        config.orgLevels,
        config.nodesPerLevel,
        config.pendingOrgNodesPerCompany,
        summary,
        onProgress,
      );
    } catch (error) {
      summary.failedOrgNodes += 1;
      pushError(summary, `Org seeding failed for ${company.companyCode}: ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
    }

    try {
      await createUsersForCompany(
        company.companyCode,
        companyIndex,
        config.usersPerCompany,
        config.pendingUsersPerCompany,
        config.signatoriesPerCompany,
        summary,
        onProgress,
      );
    } catch (error) {
      summary.failedUsers += 1;
      pushError(summary, `User seeding failed for ${company.companyCode}: ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
    }
  }

  return summary;
}
