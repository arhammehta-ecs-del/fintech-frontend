import type { Company, GroupCompany } from "@/contexts/AppContext";
import { apiFetch } from "@/services/client";

export type OnboardingPayload = {
  group: {
    name: string;
    groupCode: string | null;
    remarks?: string;
  };
  company: {
    name: string;
    gst: string;
    brand: string;
    ieCode: string;
    registeredAt: string;
    address: string;
  };
  signatories: Array<{
    name: string;
    email: string;
    phone: string;
    designation: string;
    employeeId: string;
  }>;
};

type OnboardingResponse = {
  message: string;
  code?: number;
  data?: {
    companyId?: string;
    groupId?: string;
    status?: string;
  };
};

type OnboardingAction = "approve" | "reject";

type OnboardingActionResponse = {
  message?: string;
  code?: number;
  success?: boolean;
  data?: unknown;
};

type RawCompanyListItem = {
  id?: string | null;
  companyId?: string | null;
  companyCode?: string | null;
  name?: string | null;
  gst?: string | null;
  brand?: string | null;
  ieCode?: string | null;
  iecode?: string | null;
  registeredAt?: string | null;
  registration?: string | null;
  address?: string | null;
  status?: string | null;
  isActive?: boolean | null;
  signatories?:
  | Array<{
    fullName?: string | null;
    name?: string | null;
    designation?: string | null;
    email?: string | null;
    phone?: string | null;
    employeeId?: string | null;
  } | null>
  | null;
  requesterName?: string | null;
  requesterEmail?: string | null;
  requestInitiatedAt?: string | null;
  initiatorName?: string | null;
  initiatorEmail?: string | null;
  initiatedDate?: string | null;
  initiatedByName?: string | null;
  initiatedByEmail?: string | null;
  initiatedAt?: string | null;
  createdAt?: string | null;
};

type RawSignatory = {
  fullName?: string | null;
  name?: string | null;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  employeeId?: string | null;
};

type RawCompanyGroup = {
  groupName?: string | null;
  groupCode?: string | null;
  companies?: RawCompanyListItem[] | null;
  groupDetails?: {
    groupName?: string | null;
    groupCode?: string | null;
  } | null;
  companyDetails?: RawCompanyListItem[] | null;
  comapnyDetails?: RawCompanyListItem[] | null;
  conapnyDetails?: RawCompanyListItem[] | null;
  signatories?: Array<RawSignatory | null> | null;
};

type CompanyListApiResponse = {
  message?: string;
  code?: number;
  data?: RawCompanyGroup[];
  companies?: {
    active?: RawCompanyGroup[] | null;
    pending?: RawCompanyGroup[] | null;
    inactive?: RawCompanyGroup[] | null;
  } | null;
};

const COMPANY_LIST_PATH = "/api/v1/admin/groups";
const COMPANY_CREATE_PATH = "/api/v1/admin/initiate";
const COMPANY_ACTION_PATH = "/api/v1/admin/action";
const COMPANY_HISTORY_PATH = "/api/v1/admin/fetch-history";


const getPacketString = (value: string | null | undefined) => (typeof value === "string" ? value.trim() : "");
const toUpperValue = (value: string) => value.toUpperCase();

const normalizeCompanyStatus = (
  company: RawCompanyListItem,
  bucketStatus?: Company["status"] | null,
): Company["status"] => {
  if (bucketStatus) return bucketStatus;
  const packetStatus = getPacketString(company.status).toLowerCase();
  if (packetStatus === "pending") return "Pending";
  if (packetStatus === "inactive") return "Inactive";
  if (packetStatus === "approved" || packetStatus === "active") return "Approved";
  if (company.isActive === false) return "Inactive";
  return "Approved";
};

const mapSignatories = (signatories: Array<RawSignatory | null> | null | undefined) =>
  signatories
    ?.filter((signatory): signatory is RawSignatory => Boolean(signatory))
    .map((signatory) => ({
      fullName: getPacketString(signatory.fullName) || getPacketString(signatory.name),
      designation: getPacketString(signatory.designation),
      email: getPacketString(signatory.email),
      phone: getPacketString(signatory.phone),
      employeeId: getPacketString(signatory.employeeId),
    }))
    .filter((signatory) => Boolean(signatory.fullName || signatory.email || signatory.phone || signatory.designation || signatory.employeeId)) ?? [];

const mapCompany = (
  company: RawCompanyListItem,
  bucketStatus?: Company["status"] | null,
  inheritedSignatories?: Array<RawSignatory | null> | null,
): Company => {
  const legalName = getPacketString(company.name) || "Untitled Company";
  const companyName = getPacketString(company.brand) || legalName;
  const companyCode = toUpperValue(getPacketString(company.companyCode));
  const companyLevelSignatories = mapSignatories(company.signatories);
  const signatories = companyLevelSignatories.length > 0
    ? companyLevelSignatories
    : mapSignatories(inheritedSignatories);

  return {
    id:
      getPacketString(company.companyId) ||
      getPacketString(company.id) ||
      companyCode ||
      companyName.toLowerCase().replace(/\s+/g, "-"),
    brand: companyName,
    companyCode,
    companyName,
    legalName,
    incorporationDate: getPacketString(company.registeredAt) || getPacketString(company.registration),
    address: getPacketString(company.address),
    gstin: getPacketString(company.gst),
    ieCode: getPacketString(company.ieCode) || getPacketString(company.iecode),
    status: normalizeCompanyStatus(company, bucketStatus),
    signatories,
    requesterName:
      getPacketString(company.requesterName) ||
      getPacketString(company.initiatorName) ||
      getPacketString(company.initiatedByName),
    requesterEmail:
      getPacketString(company.requesterEmail) ||
      getPacketString(company.initiatorEmail) ||
      getPacketString(company.initiatedByEmail),
    requestInitiatedAt:
      getPacketString(company.requestInitiatedAt) ||
      getPacketString(company.initiatedDate) ||
      getPacketString(company.initiatedAt) ||
      getPacketString(company.createdAt),
  };
};

const getGroupName = (group: RawCompanyGroup) =>
  getPacketString(group.groupName) || getPacketString(group.groupDetails?.groupName);
const getGroupCode = (group: RawCompanyGroup) =>
  toUpperValue(getPacketString(group.groupCode) || getPacketString(group.groupDetails?.groupCode));
const getGroupCompanies = (group: RawCompanyGroup) =>
  group.companies ?? group.companyDetails ?? group.comapnyDetails ?? group.conapnyDetails ?? [];

const mapGroups = (groups: RawCompanyGroup[], bucketStatus?: Company["status"] | null): GroupCompany[] =>
  groups.map((group, index) => {
    const rawGroupName = getGroupName(group);
    const groupCode = getGroupCode(group);
    const isIndependentGroup = !rawGroupName && !groupCode || rawGroupName.trim().toLowerCase() === "ungrouped";
    const groupName = isIndependentGroup ? "Independent" : rawGroupName;
    const groupId = isIndependentGroup ? `ungrouped-${bucketStatus ?? "default"}-${index + 1}` : groupCode || rawGroupName;
    const subsidiaries = getGroupCompanies(group).map((company) => mapCompany(company, bucketStatus, group.signatories));

    return {
      id: groupId,
      groupName,
      code: groupCode,
      createdDate: "",
      remarks: "",
      subsidiaries,
    };
  });

export async function getAllCompanies(): Promise<GroupCompany[]> {
  const payload = await apiFetch<CompanyListApiResponse>(COMPANY_LIST_PATH, {
    method: "POST",
    body: JSON.stringify({}),
  });

  if (payload.companies) {
    const activeGroups = mapGroups(payload.companies.active ?? [], "Approved");
    const pendingGroups = mapGroups(payload.companies.pending ?? [], "Pending");
    const inactiveGroups = mapGroups(payload.companies.inactive ?? [], "Inactive");
    return [...activeGroups, ...pendingGroups, ...inactiveGroups];
  }

  return mapGroups(payload.data ?? []);
}

export async function createCompanyOnboarding(payload: OnboardingPayload, file?: File | null) {
  const finalPayload = {
    ...payload,
    group: {
      ...payload.group,
      groupCode: payload.group.groupCode?.trim() ? payload.group.groupCode.trim().toUpperCase() : null,
    },
  };

  if (file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("payload", JSON.stringify(finalPayload));

    return apiFetch<OnboardingResponse>(COMPANY_CREATE_PATH, {
      method: "POST",
      body: formData,
    });
  }

  return apiFetch<OnboardingResponse>(COMPANY_CREATE_PATH, {
    method: "POST",
    body: JSON.stringify(finalPayload),
  });
}

export async function updateCompanyOnboardingAction(
  id: string,
  action: OnboardingAction,
  remark: string,
) {
  return apiFetch<OnboardingActionResponse>(COMPANY_ACTION_PATH, {
    method: "POST",
    body: JSON.stringify({
      id,
      action,
      remark,
    }),
  });
}

export async function fetchCompanyHistory(companyCode: string) {
  return apiFetch<any>(COMPANY_HISTORY_PATH, {
    method: "POST",
    body: JSON.stringify({ companyCode })
  });
}
