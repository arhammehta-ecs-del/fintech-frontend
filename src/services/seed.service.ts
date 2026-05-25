import type { Company, OrgNode } from "@/contexts/AppContext";
import { createCompanyOnboarding, getAllCompanies, updateCompanyOnboardingAction, type OnboardingPayload } from "@/services/company.service";
import { getApiErrorMessage } from "@/services/client";
import { createNewOrgNode, getCompanyOrgStructure, updateOrgNodeAction } from "@/services/org.service";
import { getCompanyRoles } from "@/services/role.service";
import { createUserOnboarding, getCompanyUsers, updateUserStatus, type UserOnboardingPermission, type UserOnboardingPayload } from "@/services/user.service";
import { createWorkflow, fetchWorkflows, updateWorkflowAction } from "@/services/workflow.service";
import { mapWorkflowRecord } from "@/features/workflow-management/utils/workflowRecord.utils";

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

export type FrontendBulkConfig = {
  totalOrgNodes: number;
  totalUsers: number;
  totalWorkflows: number;
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

export const DEFAULT_FRONTEND_BULK_CONFIG: FrontendBulkConfig = {
  totalOrgNodes: 100,
  totalUsers: 10_000,
  totalWorkflows: 100,
};

const SEED_COMPANY_NAMES = [
  "Nexora",
  "Zyntex",
  "Veltro",
  "Quorbit",
  "Flarix",
  "Drovex",
  "Pylonix",
  "Cravos",
  "Trellix",
  "Snappix",
  "Glowbit",
  "Vortiq",
  "Blynco",
  "Zephira",
  "Clustr",
  "Prixon",
  "Nuvelo",
  "Driftix",
  "Sparkra",
  "Omniq",
  "Hexova",
  "Lumiq",
  "Traxon",
  "Bytora",
  "Fluxio",
  "Cyphex",
  "Wavora",
  "Gridly",
  "Plexio",
  "Zircon",
  "Kryptex",
  "Novaris",
  "Synkro",
  "Pixlora",
  "Datalyx",
  "Cloudra",
  "Veloxa",
  "Quantix",
  "Boltify",
  "Neoflux",
  "Strixo",
  "Morphiq",
  "Zentrax",
  "Pulsar",
  "Orbify",
  "Tachyon",
  "Glitchex",
  "Nucliq",
  "Axiomix",
  "Vyntra",
  "Solvix",
  "Promptly",
  "Codexa",
  "Infyra",
  "Logiqo",
  "Dataplex",
  "Appriva",
  "Softriq",
  "Devlora",
  "Techvio",
  "Scalrix",
  "Linkova",
  "Apexio",
  "Cryptova",
  "Nethryx",
  "Stackify",
  "Binarix",
  "Cortexa",
  "Pivotix",
  "Flowbit",
  "Pingora",
  "Meshify",
  "Hubrix",
  "Loopix",
  "Taskova",
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

const randomDigits = (length: number) =>
  Array.from({ length }, () => String(Math.floor(Math.random() * 10))).join("");

const indexToLetters = (index: number) => {
  let value = index;
  let token = "";
  do {
    token = String.fromCharCode(65 + (value % 26)) + token;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return token;
};

const getSeedCompanyBaseName = (index: number) => {
  const base = SEED_COMPANY_NAMES[index % SEED_COMPANY_NAMES.length];
  const cycle = Math.floor(index / SEED_COMPANY_NAMES.length);
  return cycle === 0 ? base : `${base}${cycle + 1}`;
};

const getCompanyEmailDomain = (companyName: string, companyCode: string) => {
  const rawDomain = normalizeDomainSegment(companyName) || normalizeDomainSegment(companyCode) || "seed-company";
  return `${rawDomain}.com`;
};

const getBulkCompanyEmailDomain = (companyName: string, companyCode: string) => {
  const compactName = companyName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const compactCode = companyCode.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${compactName || compactCode || "company"}.com`;
};

const shouldSeedIndependentCompany = (index: number) => (index + 1) % 4 === 0;

const createCompanySeedPayload = (
  index: number,
  signatoriesPerCompany: number,
  isIndependent = false,
): OnboardingPayload => {
  const companyIndex = pad(index + 1);
  const companyLabel = getSeedCompanyBaseName(index);
  const companyCode = `${normalizePathSegment(companyLabel)}${companyIndex}`;
  const companyDomain = getCompanyEmailDomain(companyLabel, companyCode);
  const groupLabel = isIndependent
    ? "Independent Group"
    : `Seed Group ${indexToLetters(Math.floor(index / 5))}`;
  const signatoryNameByIndex = ["Primary Signatory", "Secondary Signatory", "Additional Signatory"] as const;

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
        name: signatoryNameByIndex[signatoryIndex] ?? `Signatory ${indexToLetters(signatoryIndex)}`,
        email: `s${signatoryLabel}@${companyDomain}`,
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
  companyCode: string,
  companyBrand: string,
) => {
  const seededSignatoryEmail = `s1@${getCompanyEmailDomain(companyBrand, companyCode)}`.toLowerCase();
  const activeUsers = companyUsers.filter((user) => user.status !== "Pending" && user.status !== "Inactive");
  const seededSignatory = activeUsers.find((user) => user.email.trim().toLowerCase() === seededSignatoryEmail);
  if (seededSignatory?.email) return seededSignatory.email.trim().toLowerCase();

  const globalAccessUser = activeUsers.find((user) => {
    const details = user.basicDetails;
    const managerName = details?.reportingManagerName?.trim().toUpperCase() ?? "";
    const managerEmail = details?.reportingManagerEmail?.trim().toUpperCase() ?? "";
    return (!managerName && !managerEmail) || (managerName === "N/A" && managerEmail === "N/A");
  });
  if (globalAccessUser?.email) return globalAccessUser.email.trim().toLowerCase();

  return activeUsers[0]?.email?.trim().toLowerCase() ?? "";
};

const generateSeedUser = (
  companyCode: string,
  companyBrand: string,
  userNumber: number,
): { name: string; email: string; phone: string; designation: string; employeeId: string } => {
  const companyDomain = getCompanyEmailDomain(companyBrand, companyCode);
  const email = `u${userNumber}@${companyDomain}`;
  return {
    name: `User ${userNumber}`,
    email,
    phone: `9${randomDigits(9)}`,
    designation: "Executive",
    employeeId: `EMP-${normalizePathSegment(companyCode).slice(0, 8)}-${pad(userNumber)}`,
  };
};

const flattenActiveNodes = (root: OrgNode | null) => flattenOrg(root).filter(isActiveNode);

const generateBulkUser = (
  companyCode: string,
  companyBrand: string,
  userNumber: number,
): { name: string; email: string; phone: string; designation: string; employeeId: string } => {
  const email = `u${userNumber}@${getBulkCompanyEmailDomain(companyBrand, companyCode)}`;
  return {
    name: `User ${userNumber}`,
    email,
    phone: `8${String(userNumber).padStart(9, "0").slice(-9)}`,
    designation: "Executive",
    employeeId: `EMP-${normalizePathSegment(companyCode).slice(0, 10)}-${String(userNumber).padStart(5, "0")}`,
  };
};

const chunked = async <T>(items: T[], size: number, worker: (item: T, index: number) => Promise<void>) => {
  for (let offset = 0; offset < items.length; offset += size) {
    const slice = items.slice(offset, offset + size);
    await Promise.all(slice.map((item, index) => worker(item, offset + index)));
  }
};

const buildBulkPermissionFactory = async (companyCode: string) => {
  const [orgTree, roles] = await Promise.all([getCompanyOrgStructure(companyCode), getCompanyRoles(companyCode)]);
  if (!orgTree) throw new Error("Org root not available");
  const nodes = flattenActiveNodes(orgTree);
  if (!nodes.length) throw new Error("No active org nodes available");
  const validRoles = roles.filter(
    (role) =>
      role.roleName.trim().toUpperCase() !== "CORP ADMIN" &&
      role.category.trim().toUpperCase() !== "ALL",
  );
  if (!validRoles.length) throw new Error("No valid roles available for bulk user onboarding");

  const accessCategories: Array<"NODE" | "IMMEDIATE_CHILD" | "ALL_CHILD"> = [
    "NODE",
    "IMMEDIATE_CHILD",
    "ALL_CHILD",
  ];
  const roleCount = validRoles.length;
  const nodeCount = nodes.length;
  const categoryCount = accessCategories.length;
  const combinationSpace =
    nodeCount * roleCount * categoryCount * nodeCount * roleCount * categoryCount * roleCount * categoryCount;

  return (userIndex: number): UserOnboardingPermission[] => {
    let x = userIndex % combinationSpace;
    const take = (base: number) => {
      const value = x % base;
      x = Math.floor(x / base);
      return value;
    };

    const pNode = take(nodeCount);
    const pRole = take(roleCount);
    const pCat = take(categoryCount);
    const sNodeA = take(nodeCount);
    const sRoleA = take(roleCount);
    const sCatA = take(categoryCount);
    const sRoleB = take(roleCount);
    const sCatB = take(categoryCount);

    const primaryNode = nodes[pNode];
    const secondaryNode = nodes[sNodeA];
    const primaryRole = validRoles[pRole];
    const secondaryRoleA = validRoles[sRoleA];
    const secondaryRoleB = validRoles[sRoleB];

    return [
      {
        accessType: "PRIMARY",
        roleCategory: normalizeRoleCategory(primaryRole.category),
        roleSubCategory: primaryRole.subCategory,
        roleName: primaryRole.roleName,
        nodeName: primaryNode.name,
        nodePath: primaryNode.nodePath,
        accessCategory: accessCategories[pCat],
      },
      {
        accessType: "SECONDARY",
        roleCategory: normalizeRoleCategory(secondaryRoleA.category),
        roleSubCategory: secondaryRoleA.subCategory,
        roleName: secondaryRoleA.roleName,
        nodeName: secondaryNode.name,
        nodePath: secondaryNode.nodePath,
        accessCategory: accessCategories[sCatA],
      },
      {
        accessType: "SECONDARY",
        roleCategory: normalizeRoleCategory(secondaryRoleB.category),
        roleSubCategory: secondaryRoleB.subCategory,
        roleName: secondaryRoleB.roleName,
        nodeName: primaryNode.name,
        nodePath: primaryNode.nodePath,
        accessCategory: accessCategories[sCatB],
      },
    ];
  };
};

const approvePendingOrgNodesWithRetries = async (
  companyCode: string,
  summary: SeedSummary,
  onProgress?: (message: string) => void,
  maxRounds = 6,
) => {
  for (let round = 1; round <= maxRounds; round += 1) {
    const tree = await getCompanyOrgStructure(companyCode);
    const pending = flattenOrg(tree).filter((node) => node.status === "Pending" && node.id?.trim());
    if (!pending.length) return;
    onProgress?.(`Approving pending org nodes round ${round}/${maxRounds} (${pending.length} pending)`);
    for (const node of pending) {
      try {
        await updateOrgNodeAction(node.id, "approve", "Bulk org auto-approval");
        summary.orgNodesApproved += 1;
        await wait(120);
      } catch (error) {
        summary.failedOrgNodes += 1;
        pushError(summary, `Org pending approval failed (${node.name}): ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
      }
    }
    await wait(500);
  }
};

const seedBinaryOrgTree = async (
  companyCode: string,
  totalOrgNodes: number,
  summary: SeedSummary,
  onProgress?: (message: string) => void,
) => {
  let tree = await getCompanyOrgStructureWithRetry(companyCode, 5, 200);
  if (!tree) throw new Error(`Org root unavailable for ${companyCode}`);
  let activeNodes = flattenActiveNodes(tree);
  if (activeNodes.length >= totalOrgNodes) {
    onProgress?.(`Org already has ${activeNodes.length} active nodes; skipping org bulk creation.`);
    return;
  }

  const root = activeNodes[0];
  const queue: OrgNode[] = [root];
  let serial = activeNodes.length + 1;

  while (activeNodes.length < totalOrgNodes && queue.length > 0) {
    const parent = queue.shift()!;
    const remaining = totalOrgNodes - activeNodes.length;
    const childrenToCreate = Math.min(2, remaining);

    for (let i = 0; i < childrenToCreate; i += 1) {
      const nodeName = `BULK_NODE_${String(serial).padStart(3, "0")}`;
      serial += 1;
      try {
        await createNewOrgNode({
          companyCode,
          newNodeName: nodeName,
          nodeType: "TEAM",
          parentNode: {
            nodeName: parent.name,
            nodePath: parent.nodePath,
          },
        });
        summary.orgNodesCreated += 1;
        await wait(120);
      } catch (error) {
        summary.failedOrgNodes += 1;
        pushError(summary, `Bulk org create failed (${nodeName}): ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
      }
    }

    await approvePendingOrgNodesWithRetries(companyCode, summary, onProgress);

    tree = await getCompanyOrgStructureWithRetry(companyCode, 5, 250);
    if (!tree) break;
    activeNodes = flattenActiveNodes(tree);
    const byPath = new Map(activeNodes.map((node) => [node.nodePath, node] as const));
    const refreshedParent = byPath.get(parent.nodePath);
    if (refreshedParent) {
      refreshedParent.children.forEach((child) => queue.push(child));
    }
    onProgress?.(`Org bulk progress: ${activeNodes.length}/${totalOrgNodes} active nodes`);
  }
};

const seedBulkWorkflowsForCompany = async (
  companyCode: string,
  totalWorkflows: number,
  summary: SeedSummary,
  onProgress?: (message: string) => void,
) => {
  const orgTree = await getCompanyOrgStructure(companyCode);
  const nodes = flattenActiveNodes(orgTree);
  if (!nodes.length) throw new Error("No active nodes found for workflow bulk seed");

  const roles = await getCompanyRoles(companyCode);
  const validRoleModules = roles
    .filter((role) => role.roleName.trim().toUpperCase() !== "CORP ADMIN" && role.category.trim().toUpperCase() !== "ALL")
    .map((role) => ({ module: role.category.trim().toUpperCase(), subModule: role.subCategory.trim().toUpperCase() }))
    .filter((pair) => Boolean(pair.module) && Boolean(pair.subModule));
  const modulePairs = Array.from(
    new Map(validRoleModules.map((pair) => [`${pair.module}|${pair.subModule}`, pair])).values(),
  );
  if (!modulePairs.length) throw new Error("No valid module/submodule pairs available for workflow bulk seed");

  const levelOptions = ["REPORTING_MANAGER", "NODE_APPROVER", "HIERARCHY_APPROVER"] as const;

  for (let i = 0; i < totalWorkflows; i += 1) {
    const node = nodes[i % nodes.length];
    const pair = modulePairs[i % modulePairs.length];
    const alias = `BULKWF-${String(i + 1).padStart(3, "0")}`;
    const checkerCount = (i % 4) + 1;
    const levels: Record<string, Record<string, string>> = {};
    for (let l = 1; l <= checkerCount; l += 1) {
      levels[`l${l}`] = {
        approver1: levelOptions[(i + l) % levelOptions.length],
      };
    }

    try {
      await createWorkflow({
        companyCode,
        name: `Bulk Workflow ${i + 1}`,
        alias,
        module: pair.module,
        subModule: pair.subModule,
        nodePath: node.nodePath,
        levels,
        levelsHash: null,
      });
      onProgress?.(`Workflow bulk initiated ${i + 1}/${totalWorkflows}`);
      await wait(100);
    } catch (error) {
      summary.failedUsers += 1;
      pushError(summary, `Bulk workflow create failed (${alias}): ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
    }
  }
};

export async function seedBulkUsersForCompany(
  companyCode: string,
  companyBrand: string,
  totalUsers: number,
  onProgress?: (msg: string) => void,
): Promise<SeedSummary> {
  const summary = defaultSummary();
  const existingUsers = await getCompanyUsers(companyCode);
  const managerEmail = getPreferredReportingManagerEmail(existingUsers, companyCode, companyBrand);
  if (!managerEmail) throw new Error(`No active reporting manager found in ${companyCode}`);

  const permissionFactory = await buildBulkPermissionFactory(companyCode);
  const domain = getBulkCompanyEmailDomain(companyBrand, companyCode).toLowerCase();
  const existingEmails = new Set(existingUsers.map((user) => user.email.trim().toLowerCase()));

  const users = Array.from({ length: totalUsers }, (_, idx) => idx + 1);
  await chunked(users, 3, async (userNo) => {
    const seededUser = generateBulkUser(companyCode, companyBrand, userNo);
    const lowerEmail = seededUser.email.toLowerCase();
    if (existingEmails.has(lowerEmail)) return;

    const payload: UserOnboardingPayload = {
      basicDetails: {
        name: seededUser.name,
        email: seededUser.email,
        phone: seededUser.phone,
        designation: seededUser.designation,
        employeeId: seededUser.employeeId,
        reportingManager: managerEmail,
      },
      permissions: permissionFactory(userNo - 1),
      levelsHash: null,
    };

    try {
      await createUserOnboarding(payload);
      summary.usersCreated += 1;
      existingEmails.add(lowerEmail);
      await wait(60);
    } catch (error) {
      summary.failedUsers += 1;
      pushError(summary, `Bulk user create failed (${seededUser.email}): ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
    }
  });

  onProgress?.(`Bulk users initiated for domain ${domain}: ${summary.usersCreated}/${totalUsers}`);
  return summary;
}

export async function seedBulkAllForCompany(
  companyCode: string,
  companyBrand: string,
  config: FrontendBulkConfig,
  onProgress?: (msg: string) => void,
): Promise<SeedSummary> {
  const summary = defaultSummary();
  onProgress?.(`Bulk add start: org=${config.totalOrgNodes}, users=${config.totalUsers}, workflows=${config.totalWorkflows}`);
  await seedBinaryOrgTree(companyCode, config.totalOrgNodes, summary, onProgress);
  await seedBulkWorkflowsForCompany(companyCode, config.totalWorkflows, summary, onProgress);
  const userSummary = await seedBulkUsersForCompany(companyCode, companyBrand, config.totalUsers, onProgress);
  addSummary(summary, userSummary);
  onProgress?.("Bulk add completed.");
  return summary;
}

export async function approveBulkForCompany(
  companyCode: string,
  onProgress?: (msg: string) => void,
): Promise<SeedSummary> {
  const summary = defaultSummary();
  const orgSummary = await approveAllPendingOrgNodesForCompany(companyCode, onProgress);
  addSummary(summary, orgSummary);
  const userSummary = await approveAllPendingUsersForCompany(companyCode, onProgress);
  addSummary(summary, userSummary);

  try {
    const workflowResponse = await fetchWorkflows();
    const pending = Array.isArray((workflowResponse as any)?.data?.pending)
      ? (workflowResponse as any).data.pending.map((entry: unknown) => mapWorkflowRecord(entry, "Pending"))
      : [];
    const bulkPending = pending.filter((w) => w.alias?.trim().toUpperCase().startsWith("BULKWF-"));
    for (const [index, workflow] of bulkPending.entries()) {
      const hash = (workflow.levelsHash || workflow.workflowId || workflow.id || "").trim();
      if (!hash) continue;
      try {
        await updateWorkflowAction(hash, "approve", "Bulk workflow approval from dashboard");
        summary.orgNodesApproved += 1;
        onProgress?.(`Approved bulk workflow ${index + 1}/${bulkPending.length}`);
      } catch (error) {
        summary.failedOrgNodes += 1;
        pushError(summary, `Bulk workflow approval failed (${workflow.alias}): ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
      }
    }
  } catch (error) {
    pushError(summary, `Failed to fetch workflows for bulk approval: ${getApiErrorMessage(error, "Unknown error")}`, onProgress);
  }

  onProgress?.("Bulk approval completed.");
  return summary;
}

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
  const tree = await getCompanyOrgStructure(companyCode);
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

  for (const parentNode of deepestLevelParents) {
    for (let childIndex = 1; childIndex <= childrenPerParent; childIndex += 1) {
      const seedNameIndex = (createdCount + childIndex - 1) % SEED_NODE_NAMES.length;
      const mappedName = SEED_NODE_NAMES[seedNameIndex];
      const baseNodeName = mappedName;
      let nodeName: string = baseNodeName;
      let suffix = 2;
      let targetPath = `${parentNode.nodePath}.${normalizePathSegment(nodeName)}`.toUpperCase();
      while (existingPaths.has(targetPath)) {
        nodeName = `${baseNodeName}_${suffix}`;
        targetPath = `${parentNode.nodePath}.${normalizePathSegment(nodeName)}`.toUpperCase();
        suffix += 1;
      }

      try {
        await createNewOrgNode({
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
  const reportingManagerEmail = getPreferredReportingManagerEmail(existingUsers, companyCode, companyBrand);
  if (!reportingManagerEmail) {
    throw new Error(`No active reporting manager found in ${companyCode}. Approve company signatories first.`);
  }

  const companyDomain = getCompanyEmailDomain(companyBrand, companyCode).toLowerCase();
  const userEmailPattern = new RegExp(`^u(\\d+)@${companyDomain.replace(/\./g, "\\.")}$`);
  const highestExistingUserIndex = existingUsers.reduce((max, user) => {
    const email = user.email.trim().toLowerCase();
    const match = email.match(userEmailPattern);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);
  const newlyCreatedEmails: string[] = [];

  for (let index = 1; index <= usersToCreate; index += 1) {
    const userNumber = highestExistingUserIndex + index;
    const seededUser = generateSeedUser(companyCode, companyBrand, userNumber);

    const payload: UserOnboardingPayload = {
      basicDetails: {
        name: seededUser.name,
        email: seededUser.email,
        phone: seededUser.phone,
        designation: seededUser.designation,
        employeeId: seededUser.employeeId,
        reportingManager: reportingManagerEmail,
      },
      permissions: permissionFactory(index - 1),
      levelsHash: null,
    };

    try {
      await createUserOnboarding(payload);
      summary.usersCreated += 1;
      newlyCreatedEmails.push(seededUser.email.toLowerCase());
    } catch (error) {
      summary.failedUsers += 1;
      pushError(
        summary,
        `User create failed for ${companyCode} (${seededUser.email}): ${getApiErrorMessage(error, "Unknown error")}`,
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

    const companyPayload = createCompanySeedPayload(
      companyIndex,
      config.signatoriesPerCompany,
      shouldSeedIndependentCompany(companyIndex),
    );
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
  void companyIndex;
  onProgress?.(`Seeding users for ${companyCode} in current session...`);
  await createUsersForCompany(
    companyCode,
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
  void companyIndex;
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
