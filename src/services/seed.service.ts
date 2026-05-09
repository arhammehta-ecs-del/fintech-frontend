import type { Company, OrgNode } from "@/contexts/AppContext";
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
  orgLevels: 7,
  nodesPerLevel: 5,
  pendingOrgNodesPerCompany: 5,
};

const FIRST_NAMES = [
  "Arjun", "Priya", "Rohan", "Sneha", "Vikram", "Ananya", "Karan",
  "Divya", "Rahul", "Meera", "Aditya", "Pooja", "Nikhil", "Shreya",
  "Amit", "Kavya", "Siddharth", "Neha", "Varun", "Ishaan",
] as const;

const LAST_NAMES = [
  "Sharma", "Patel", "Singh", "Kumar", "Mehta", "Joshi", "Gupta",
  "Verma", "Nair", "Iyer", "Reddy", "Shah", "Malhotra", "Kapoor",
  "Chopra", "Bose", "Das", "Rao", "Pillai", "Mishra",
] as const;

const DESIGNATIONS = [
  "Analyst", "Executive", "Manager", "Associate",
  "Consultant", "Officer", "Coordinator", "Specialist",
] as const;

const SEED_NODE_NAMES = [
  "Mumbai HQ",
  "Pune West Division",
  "Delhi North Team",
  "Chennai Plant 01",
  "Finance Department",
  "Operations Team Alpha",
  "Bengaluru Tech Division",
  "Hyderabad Logistics Plant",
  "Sales Department East",
  "Manufacturing Unit 7",
  "Warehouse Team Red",
  "Corporate Division A",
  "Procurement Department",
  "Plant Delta",
  "Support Team India",
  "Zone North 01",
  "Zone South 02",
  "Retail Division Prime",
  "Accounts Department Core",
  "QA Team Falcon",
  "Assembly Plant Titan",
  "HR Department Central",
  "Branch Division Neo",
  "Engineering Team Apex",
  "Packaging Plant Nova",
  "Customer Success Department",
  "Export Division Elite",
  "Field Team Velocity",
  "Production Plant Zenith",
  "Compliance Department 9",
  "Regional Division West",
  "Strategy Team Orbit",
  "Textile Plant Alpha",
  "Legal Department One",
  "Distribution Division Max",
  "Maintenance Team Echo",
  "Chemical Plant Sigma",
  "Marketing Department Pulse",
  "Territory Division Northstar",
  "Analytics Team Vertex",
  "Factory Plant Orion",
  "Audit Department Secure",
  "Service Division Rapid",
  "Installation Team Prime",
  "Energy Plant Core",
  "Talent Department Hub",
  "Supply Chain Division Axis",
  "Infrastructure Team Nova",
  "Pharma Plant Greenline",
  "Admin Department Infinity",
  "Global Division Horizon",
  "Design Team Pixel",
  "Food Processing Plant FreshFlow",
  "Innovation Department Spark",
  "Logistics Division Swift",
  "Site Team DeltaX",
  "Steel Plant IronEdge",
  "Payroll Department Alpha",
  "International Division Crest",
  "Operations Team Quantum",
  "Cement Plant RockSolid",
  "Procurement Department Vertex",
  "Urban Division MetroLink",
  "Inspection Team Sentinel",
  "Solar Plant SunGrid",
  "Digital Department Hyper",
  "Regional Division EastBay",
  "Security Team Guardian",
  "Plastic Plant PolyCore",
  "Employee Relations Department",
  "Mobility Division TransitX",
  "Deployment Team Nexus",
  "Water Treatment Plant AquaFlow",
  "Research Department Genesis",
  "Consumer Division Omni",
  "Technical Team ByteForce",
  "Electronics Plant VoltEdge",
  "Internal Audit Department",
  "Enterprise Division Fusion",
  "Service Team Rocket",
  "Refinery Plant PetroMax",
  "Risk Department Shield",
  "Central Division AlphaOne",
  "Integration Team Matrix",
  "Packaging Plant Boxify",
  "Branding Department Elevate",
  "Strategic Division FalconX",
  "Backend Team Velocity",
  "Agro Plant GreenHarvest",
  "Recruitment Department Orbit",
  "City Division UrbanGrid",
  "Mobile Team CoreSync",
  "Dairy Plant Milko",
  "Operations Department Prime",
  "Export Division Skyline",
  "Cloud Team InfraNet",
  "Textile Plant Fabricon",
  "Business Department Unity",
  "National Division Eagle",
  "Support Team Connect",
  "Power Plant EnerGen",
  "Vendor Management Department",
  "Industrial Division Forge",
  "Platform Team NodeBase",
  "Paint Plant ColorMix",
  "IT Department Matrix",
  "Global Division Infinity",
  "Automation Team RoboCore",
  "Mining Plant TerraMine",
  "Revenue Department PulseX",
  "Regional Division SouthLine",
  "Monitoring Team TrackPro",
  "Beverage Plant FreshSip",
  "Admin Division CentralHub",
  "Territory Division PeakPoint",
  "AI Team NeuralOps",
  "Automotive Plant DriveX",
  "Customer Care Department",
  "West Coast Division",
  "Team Alpha 01",
  "Team Bravo 02",
  "Team Charlie 03",
  "Plant Omega",
  "Plant Falcon",
  "Plant Horizon",
  "Department Zenith",
  "Department CoreOps",
  "Division Quantum",
  "Division Atlas",
  "Location Mumbai Central",
  "Location Navi Mumbai Hub",
  "Location Pune Tech Park",
  "Location Ahmedabad Zone",
  "Location Jaipur Sector 5",
  "Location Kolkata East Hub",
  "Location Surat Industrial Area",
  "Location Noida Tower 3",
  "Location Bengaluru Campus",
  "Location Hyderabad Block B",
] as const;

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

const addSummary = (target: SeedSummary, delta: SeedSummary) => {
  target.companiesCreated += delta.companiesCreated;
  target.companiesApproved += delta.companiesApproved;
  target.orgNodesCreated += delta.orgNodesCreated;
  target.orgNodesApproved += delta.orgNodesApproved;
  target.usersCreated += delta.usersCreated;
  target.usersApproved += delta.usersApproved;
  target.failedCompanies += delta.failedCompanies;
  target.failedOrgNodes += delta.failedOrgNodes;
  target.failedUsers += delta.failedUsers;
  target.errors.push(...delta.errors);
};

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

const isActiveNode = (node: OrgNode) => (node.status ?? "Active") !== "Pending";
const isApprovedNodeStatus = (status: OrgNode["status"] | string | undefined) => {
  const normalized = String(status ?? "").trim().toUpperCase();
  return normalized === "ACTIVE" || normalized === "APPROVED";
};

const getCompanyOrgStructureWithRetry = async (
  companyCode: string,
  maxAttempts: number,
  delayMs: number,
) => {
  let lastTree: OrgNode | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastTree = await getCompanyOrgStructure(companyCode);
    if (lastTree) return lastTree;
    if (attempt < maxAttempts) {
      await wait(delayMs);
    }
  }
  return lastTree;
};

const readRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const extractOrgRequestId = (response: unknown) => {
  const root = readRecord(response);
  const rootId = readString(root.requestId) || readString(root.id);
  if (rootId) return rootId;
  const data = readRecord(root.data);
  return readString(data.requestId) || readString(data.id);
};

const normalizePathSegment = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toUpperCase();

const inferNodeTypeFromName = (name: string): "DIVISION" | "TEAM" | "PLANT" | "DEPARTMENT" | "LOCATION" => {
  const n = name.trim().toUpperCase();
  if (n.includes("LOCATION")) return "LOCATION";
  if (n.includes("PLANT")) return "PLANT";
  if (n.includes("TEAM")) return "TEAM";
  if (n.includes("DEPARTMENT")) return "DEPARTMENT";
  return "DIVISION";
};

const normalizeDomainSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const randomItem = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)] as T;

const randomDigits = (length: number) =>
  Array.from({ length }, () => String(Math.floor(Math.random() * 10))).join("");

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

const getPreferredReportingManagerEmail = (
  companyUsers: Awaited<ReturnType<typeof getCompanyUsers>>,
  companyIndex: number,
) => {
  const seededSignatoryEmail = `seed.signatory.${pad(companyIndex + 1)}.1@example.com`.toLowerCase();
  const activeUsers = companyUsers.filter((user) => user.status !== "Pending" && user.status !== "Inactive");
  const seededSignatory = activeUsers.find((user) => user.email.trim().toLowerCase() === seededSignatoryEmail);
  if (seededSignatory?.email) return seededSignatory.email.trim().toLowerCase();

  const globalAccessUser = activeUsers.find((user) => {
    const details = user.basicDetails;
    const managerName = details?.reportingManagerName?.trim().toUpperCase();
    const managerEmail = details?.reportingManagerEmail?.trim().toUpperCase();
    return managerName === "N/A" && managerEmail === "N/A";
  });
  if (globalAccessUser?.email) return globalAccessUser.email.trim().toLowerCase();

  return activeUsers[0]?.email?.trim().toLowerCase() ?? "";
};

const generateRandomUser = (
  companyCode: string,
  companyBrand: string,
  existingEmailSet: Set<string>,
): { name: string; email: string; phone: string; designation: string; employeeId: string } => {
  const firstName = randomItem(FIRST_NAMES);
  const lastName = randomItem(LAST_NAMES);
  const name = `${firstName} ${lastName}`;

  const rawDomain = normalizeDomainSegment(companyBrand) || normalizeDomainSegment(companyCode) || "seed-company";
  const companyDomain = `${rawDomain}.com`;

  const baseLocalPart = `${firstName}.${lastName}`.toLowerCase();
  let localPart = baseLocalPart;
  let email = `${localPart}@${companyDomain}`;
  let suffix = 2;
  while (existingEmailSet.has(email)) {
    localPart = `${baseLocalPart}${suffix}`;
    email = `${localPart}@${companyDomain}`;
    suffix += 1;
  }

  const phone = `9${randomDigits(9)}`;
  const designation = randomItem(DESIGNATIONS);
  const employeeId = `EMP-${normalizePathSegment(companyCode).slice(0, 8)}-${randomDigits(3)}`;

  return {
    name,
    email,
    phone,
    designation,
    employeeId,
  };
};

const createOrgNodeMatrix = async (
  companyCode: string,
  orgLevels: number,
  nodesPerLevel: number,
  pendingOrgNodesPerCompany: number,
  summary: SeedSummary,
  onProgress?: (message: string) => void,
) => {
  void orgLevels;
  void nodesPerLevel;
  void pendingOrgNodesPerCompany;

  const childrenPerParent = 2;
  let tree = await getCompanyOrgStructure(companyCode);
  const rootNode = tree;
  if (!rootNode) return;

  const allCurrentNodes = flattenOrg(tree).filter(isActiveNode);
  const maxDepth = allCurrentNodes.reduce((acc, node) => Math.max(acc, node.nodePath.split(".").length), 0);
  const deepestLevelParents = allCurrentNodes.filter(
    (node) => node.nodePath.split(".").length === maxDepth,
  );

  if (deepestLevelParents.length === 0) {
    throw new Error(`Root node is not active for ${companyCode}`);
  }
  onProgress?.(
    `Using deepest level depth=${maxDepth} with ${deepestLevelParents.length} parent nodes for next-level seeding`,
  );

  const existingPaths = new Set(flattenOrg(tree).map((node) => node.nodePath.toUpperCase()));
  let createdCount = 0;
  let approvedCount = 0;

  for (const parentNode of deepestLevelParents) {
    for (let childIndex = 1; childIndex <= childrenPerParent; childIndex += 1) {
      const seedNameIndex = (createdCount + childIndex - 1) % SEED_NODE_NAMES.length;
      const mappedName = SEED_NODE_NAMES[seedNameIndex];
      const baseNodeName = mappedName;
      let nodeName = baseNodeName;
      let suffix = 2;
      let targetPath = `${parentNode.nodePath}.${normalizePathSegment(nodeName)}`.toUpperCase();
      while (existingPaths.has(targetPath)) {
        nodeName = `${baseNodeName}_${suffix}`;
        targetPath = `${parentNode.nodePath}.${normalizePathSegment(nodeName)}`.toUpperCase();
        suffix += 1;
      }

      try {
        const response = await createNewOrgNode({
          companyCode,
          newNodeName: nodeName,
          nodeType: inferNodeTypeFromName(nodeName),
          parentNode: {
            nodeName: parentNode.name,
            nodePath: parentNode.nodePath,
          },
        });
        createdCount += 1;
        summary.orgNodesCreated += 1;
        existingPaths.add(targetPath);
        onProgress?.(`Created org node ${createdCount} under ${parentNode.name}`);

        const requestId = extractOrgRequestId(response);
        if (requestId) {
          try {
            await wait(200);
            await updateOrgNodeAction(requestId, "approve", "Seed auto-approval");
            approvedCount += 1;
            summary.orgNodesApproved += 1;
            onProgress?.(`Approved org node ${approvedCount}/${createdCount} for ${companyCode}`);
          } catch (error) {
            summary.failedOrgNodes += 1;
            pushError(
              summary,
              `Org node approve failed for ${companyCode} (${nodeName}): ${getApiErrorMessage(error, "Unknown error")}`,
              onProgress,
            );
          }
        }
      } catch (error) {
        summary.failedOrgNodes += 1;
        pushError(
          summary,
          `Org node create failed for ${companyCode} (${nodeName}): ${getApiErrorMessage(error, "Unknown error")}`,
          onProgress,
        );
      }
    }
  }
};

const normalizeRoleCategory = (category: string): UserOnboardingPermission["roleCategory"] => {
  if (category === "SYSTEM_ACCESS") return "SYSTEM_ACCESS";
  if (category === "OPERATIONAL") return "OPERATIONAL";
  return "TRANSACTIONAL";
};

const buildUserPermissionsFactory = async (companyCode: string) => {
  const [orgTree, roles] = await Promise.all([
    getCompanyOrgStructure(companyCode),
    getCompanyRoles(companyCode),
  ]);

  if (!orgTree) {
    throw new Error("Org root not available");
  }

  const allNodes = flattenOrg(orgTree).filter(isActiveNode);
  if (allNodes.length === 0) {
    throw new Error("No active org nodes available");
  }

  const systemRoles = roles.filter((role) => role.category === "SYSTEM_ACCESS");
  const nonSystemRoles = roles.filter((role) => role.category !== "SYSTEM_ACCESS");
  const preferredRoles = systemRoles.length > 0 ? systemRoles : roles;
  if (preferredRoles.length === 0) {
    throw new Error("No role mapping available");
  }

  const accessCategories: Array<"NODE" | "IMMEDIATE_CHILD" | "ALL_CHILD"> = ["NODE", "IMMEDIATE_CHILD", "ALL_CHILD"];

  return (userSeedIndex: number): UserOnboardingPermission[] => {
    const primaryRole = preferredRoles[userSeedIndex % preferredRoles.length];
    const primaryNode = allNodes[userSeedIndex % allNodes.length];
    const primaryAccessCategory = accessCategories[userSeedIndex % accessCategories.length];

    const primary: UserOnboardingPermission = {
      accessType: "PRIMARY",
      roleCategory: normalizeRoleCategory(primaryRole.category),
      roleSubCategory: primaryRole.subCategory,
      roleName: primaryRole.roleName,
      nodeName: primaryNode.name,
      nodePath: primaryNode.nodePath,
      accessCategory: primaryAccessCategory,
    };

    const secondaryPool = [...preferredRoles, ...nonSystemRoles].filter(
      (role) => role.roleCode !== primaryRole.roleCode || role.roleName !== primaryRole.roleName,
    );
    const secondaryCount = userSeedIndex % 2 === 0 ? 2 : 1;
    const secondary: UserOnboardingPermission[] = Array.from({ length: secondaryCount }, (_, offset) => {
      const role = secondaryPool[(userSeedIndex + offset) % secondaryPool.length] ?? primaryRole;
      const node = allNodes[(userSeedIndex + offset + 1) % allNodes.length] ?? primaryNode;
      const accessCategory = accessCategories[(userSeedIndex + offset + 1) % accessCategories.length];
      return {
        accessType: "SECONDARY",
        roleCategory: normalizeRoleCategory(role.category),
        roleSubCategory: role.subCategory,
        roleName: role.roleName,
        nodeName: node.name,
        nodePath: node.nodePath,
        accessCategory,
      };
    });

    return [primary, ...secondary];
  };
};

const createUsersForCompany = async (
  companyCode: string,
  companyIndex: number,
  companyBrand: string,
  targetUsersPerCompany: number,
  pendingUsersPerCompany: number,
  signatoriesPerCompany: number,
  summary: SeedSummary,
  onProgress?: (message: string) => void,
) => {
  const permissionFactory = await buildUserPermissionsFactory(companyCode);
  const usersToCreate = Math.max(targetUsersPerCompany - signatoriesPerCompany, 0);
  const safePendingUsers = Math.max(0, Math.min(pendingUsersPerCompany, targetUsersPerCompany));
  const approvalsNeeded = Math.max(targetUsersPerCompany - safePendingUsers - signatoriesPerCompany, 0);

  let existingUsers = await getCompanyUsers(companyCode);
  const reportingManagerEmail = getPreferredReportingManagerEmail(existingUsers, companyIndex);
  if (!reportingManagerEmail) {
    throw new Error(`No active reporting manager found in ${companyCode}. Approve company signatories first.`);
  }

  const existingEmailSet = new Set(existingUsers.map((user) => user.email.trim().toLowerCase()));
  const newlyCreatedEmails: string[] = [];

  for (let index = 1; index <= usersToCreate; index += 1) {
    const randomUser = generateRandomUser(companyCode, companyBrand, existingEmailSet);
    existingEmailSet.add(randomUser.email.toLowerCase());

    const payload: UserOnboardingPayload = {
      basicDetails: {
        name: randomUser.name,
        email: randomUser.email,
        phone: randomUser.phone,
        designation: randomUser.designation,
        employeeId: randomUser.employeeId,
        reportingManager: reportingManagerEmail,
      },
      permissions: permissionFactory(index - 1),
      workflowId: null,
    };

    try {
      await createUserOnboarding(payload);
      summary.usersCreated += 1;
      newlyCreatedEmails.push(randomUser.email.toLowerCase());
    } catch (error) {
      summary.failedUsers += 1;
      pushError(
        summary,
        `User create failed for ${companyCode} (${randomUser.email}): ${getApiErrorMessage(error, "Unknown error")}`,
        onProgress,
      );
      continue;
    }

    onProgress?.(`Users ${index}/${usersToCreate} initiated for ${companyCode}`);
  }

  await wait(150);
  existingUsers = await getCompanyUsers(companyCode);
  const pendingCreatedUsers = existingUsers.filter(
    (user) => user.status === "Pending" && newlyCreatedEmails.includes(user.email.trim().toLowerCase()),
  );

  for (const pendingUser of pendingCreatedUsers.slice(0, approvalsNeeded)) {
    await wait(100);
    try {
      await updateUserStatus(pendingUser.id, "approve", "Seed auto-approval");
      summary.usersApproved += 1;
    } catch (error) {
      summary.failedUsers += 1;
      pushError(
        summary,
        `User approval failed for ${companyCode} (${pendingUser.email}): ${getApiErrorMessage(error, "Unknown error")}`,
        onProgress,
      );
    }
  }

  onProgress?.(`Users completed for ${companyCode}`);
};

const getCompanyRefFromSeedIndex = async (companyIndex: number) => {
  const seedPayload = createCompanySeedPayload(companyIndex, DEFAULT_SEED_CONFIG.signatoriesPerCompany);
  const seedBrand = seedPayload.company.brand ?? seedPayload.company.name;
  return findCompanyByBrandWithStatus(seedBrand, "Approved");
};

export async function seedCompanies(
  config: SeedConfig,
  onProgress?: (msg: string) => void,
): Promise<SeedSummary> {
  const summary = defaultSummary();
  const totalCompanies = config.approvedCompanyCount + config.pendingCompanyCount;

  for (let companyIndex = 0; companyIndex < totalCompanies; companyIndex += 1) {
    const companyNumber = companyIndex + 1;
    const shouldApproveCompany = companyIndex < config.approvedCompanyCount;
    onProgress?.(`Starting company ${companyNumber}/${totalCompanies}`);

    const companyPayload = createCompanySeedPayload(companyIndex, config.signatoriesPerCompany);
    const seedBrand = companyPayload.company.brand ?? companyPayload.company.name;

    let existingApproved: Company | null = null;
    let existingPending: Company | null = null;
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
    let pendingCompany: Company | null = null;
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
    }
  }

  return summary;
}

export async function seedOrgForCompany(
  companyCode: string,
  companyIndex: number | null,
  config: SeedConfig,
  onProgress?: (msg: string) => void,
): Promise<SeedSummary> {
  const summary = defaultSummary();
  void companyIndex;
  onProgress?.(`Seeding org for ${companyCode} in current session...`);
  await createOrgNodeMatrix(
    companyCode,
    config.orgLevels,
    config.nodesPerLevel,
    config.pendingOrgNodesPerCompany,
    summary,
    onProgress,
  );
  return summary;
}

export async function seedUsersForCompany(
  companyCode: string,
  companyIndex: number | null,
  companyBrand: string,
  config: SeedConfig,
  onProgress?: (msg: string) => void,
): Promise<SeedSummary> {
  const summary = defaultSummary();
  const resolvedCompanyIndex = companyIndex ?? 0;
  onProgress?.(`Seeding users for ${companyCode} in current session...`);
  await createUsersForCompany(
    companyCode,
    resolvedCompanyIndex,
    companyBrand,
    config.usersPerCompany,
    config.pendingUsersPerCompany,
    config.signatoriesPerCompany,
    summary,
    onProgress,
  );
  return summary;
}

export async function seedAllForCompany(
  companyCode: string,
  companyIndex: number | null,
  companyBrand: string,
  config: SeedConfig,
  onProgress?: (msg: string) => void,
): Promise<SeedSummary> {
  const summary = defaultSummary();
  const resolvedCompanyIndex = companyIndex ?? 0;
  onProgress?.(`Seeding org + users for ${companyCode} in current session...`);
  await createOrgNodeMatrix(
    companyCode,
    config.orgLevels,
    config.nodesPerLevel,
    config.pendingOrgNodesPerCompany,
    summary,
    onProgress,
  );
  await createUsersForCompany(
    companyCode,
    resolvedCompanyIndex,
    companyBrand,
    config.usersPerCompany,
    config.pendingUsersPerCompany,
    config.signatoriesPerCompany,
    summary,
    onProgress,
  );
  return summary;
}

export async function approveAllPendingUsersForCompany(
  companyCode: string,
  onProgress?: (msg: string) => void,
): Promise<SeedSummary> {
  const summary = defaultSummary();
  const users = await getCompanyUsers(companyCode);
  const pendingUsers = users.filter((user) => user.status === "Pending");

  if (pendingUsers.length === 0) {
    onProgress?.(`No pending users found for ${companyCode}`);
    return summary;
  }

  for (const [index, user] of pendingUsers.entries()) {
    try {
      await updateUserStatus(user.id ?? "", "approve", "Bulk pending approval from dashboard");
      summary.usersApproved += 1;
      onProgress?.(`Approved pending user ${index + 1}/${pendingUsers.length} for ${companyCode}`);
    } catch (error) {
      summary.failedUsers += 1;
      pushError(
        summary,
        `Pending user approval failed for ${companyCode} (${user.email}): ${getApiErrorMessage(error, "Unknown error")}`,
        onProgress,
      );
    }
  }

  return summary;
}

export async function approveAllPendingOrgNodesForCompany(
  companyCode: string,
  onProgress?: (msg: string) => void,
): Promise<SeedSummary> {
  const summary = defaultSummary();
  const orgTree = await getCompanyOrgStructure(companyCode);
  const pendingNodes = flattenOrg(orgTree).filter((node) => node.status === "Pending");

  if (pendingNodes.length === 0) {
    onProgress?.(`No pending org nodes found for ${companyCode}`);
    return summary;
  }

  for (const [index, node] of pendingNodes.entries()) {
    if (!node.id?.trim()) {
      summary.failedOrgNodes += 1;
      pushError(summary, `Pending org node missing request id for ${companyCode} (${node.name})`, onProgress);
      continue;
    }

    try {
      await updateOrgNodeAction(node.id, "approve", "Bulk pending approval from dashboard");
      summary.orgNodesApproved += 1;
      onProgress?.(`Approved pending org node ${index + 1}/${pendingNodes.length} for ${companyCode}`);
    } catch (error) {
      summary.failedOrgNodes += 1;
      pushError(
        summary,
        `Pending org node approval failed for ${companyCode} (${node.name}): ${getApiErrorMessage(error, "Unknown error")}`,
        onProgress,
      );
    }
  }

  return summary;
}

export async function approveAllPendingForCompany(
  companyCode: string,
  onProgress?: (msg: string) => void,
): Promise<SeedSummary> {
  const summary = defaultSummary();
  onProgress?.(`Approving all pending users for ${companyCode}...`);
  const userSummary = await approveAllPendingUsersForCompany(companyCode, onProgress);
  addSummary(summary, userSummary);

  onProgress?.(`Approving all pending org nodes for ${companyCode}...`);
  const orgSummary = await approveAllPendingOrgNodesForCompany(companyCode, onProgress);
  addSummary(summary, orgSummary);

  onProgress?.(`Approve all completed for ${companyCode}`);
  return summary;
}

export async function runFrontendSeed(
  config: SeedConfig = DEFAULT_SEED_CONFIG,
  onProgress?: (message: string) => void,
): Promise<SeedSummary> {
  const summary = defaultSummary();
  const companySummary = await seedCompanies(config, onProgress);
  addSummary(summary, companySummary);

  for (let companyIndex = 0; companyIndex < config.approvedCompanyCount; companyIndex += 1) {
    const companyRef = await getCompanyRefFromSeedIndex(companyIndex);
    if (!companyRef?.companyCode) {
      summary.failedCompanies += 1;
      pushError(summary, `Approved company not found for seed index ${companyIndex + 1}`, onProgress);
      continue;
    }

    try {
      const perCompany = await seedAllForCompany(
        companyRef.companyCode,
        companyIndex,
        companyRef.brand || companyRef.companyName,
        config,
        onProgress,
      );
      addSummary(summary, perCompany);
    } catch (error) {
      summary.failedUsers += 1;
      summary.failedOrgNodes += 1;
      pushError(
        summary,
        `Seed failed for ${companyRef.companyCode}: ${getApiErrorMessage(error, "Unknown error")}`,
        onProgress,
      );
    }
  }

  return summary;
}
