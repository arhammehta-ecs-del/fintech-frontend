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
    gst: string | null;
    brand: string | null;
    ieCode: string | null;
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
type CompanyHistoryResponse = {
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
  signatories?: Array<{
    name?: string | null;
    designation?: string | null;
    email?: string | null;
    phone?: string | null;
    employeeId?: string | null;
  } | null> | null;
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
  name?: string | null;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  employeeId?: string | null;
};

type RawCompanyGroup = {
  groupName?: string | null;
  groupCode?: string | null;
  groupDetails?: {
    groupName?: string | null;
    groupCode?: string | null;
  } | null;
  comapnyDetails?: RawCompanyListItem[] | null;
  companyDetails?: RawCompanyListItem[] | null;
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

const mapSignatories = (signatories: Array<RawSignatory | null> | null | undefined) =>
  (signatories ?? [])
    .filter((signatory): signatory is RawSignatory => Boolean(signatory))
    .map((signatory) => ({
      fullName: getPacketString(signatory.name),
      designation: getPacketString(signatory.designation),
      email: getPacketString(signatory.email),
      phone: getPacketString(signatory.phone),
      employeeId: getPacketString(signatory.employeeId),
    }));

const mapCompany = (
  company: RawCompanyListItem,
  bucketStatus: Company["status"],
  inheritedSignatories?: Array<RawSignatory | null> | null,
): Company => {
  const legalName = getPacketString(company.name);
  const companyName = getPacketString(company.brand);
  const companyCode = toUpperValue(getPacketString(company.companyCode));
  const companyId = getPacketString(company.companyId) || getPacketString(company.id) || companyCode;
  const incorporationDate = getPacketString(company.registration) || getPacketString(company.registeredAt);
  const ieCode = getPacketString(company.ieCode) || getPacketString(company.iecode);

  if (!companyId || !companyCode || !legalName || !companyName || !incorporationDate) {
    throw new Error("Invalid admin/groups response: company record missing required fields");
  }

  const companyLevelSignatories = mapSignatories(company.signatories);
  const signatories = companyLevelSignatories.length > 0
    ? companyLevelSignatories
    : mapSignatories(inheritedSignatories);

  return {
    id: companyId,
    brand: companyName,
    companyCode,
    companyName,
    legalName,
    incorporationDate,
    address: getPacketString(company.address),
    gstin: getPacketString(company.gst),
    ieCode,
    status: bucketStatus,
    signatories,
    requesterName: getPacketString(company.initiatorName),
    requesterEmail: getPacketString(company.initiatorEmail),
    requestInitiatedAt: getPacketString(company.initiatedDate),
  };
};

const getGroupName = (group: RawCompanyGroup) =>
  getPacketString(group.groupDetails?.groupName) || getPacketString(group.groupName);
const getGroupCode = (group: RawCompanyGroup) =>
  toUpperValue(getPacketString(group.groupDetails?.groupCode) || getPacketString(group.groupCode));
const getGroupCompanies = (group: RawCompanyGroup) => {
  const companies = Array.isArray(group.companyDetails)
    ? group.companyDetails
    : Array.isArray(group.comapnyDetails)
      ? group.comapnyDetails
      : null;

  if (!companies) {
    throw new Error("Invalid admin/groups response: companyDetails/comapnyDetails must be an array");
  }
  return companies;
};

const mapGroups = (groups: RawCompanyGroup[], bucketStatus: Company["status"]): GroupCompany[] =>
  groups.map((group, index) => {
    const rawGroupName = getGroupName(group).toUpperCase() === "INDEPENDENT" ? "Independent" : getGroupName(group);
    const groupCode = getGroupCode(group);
    if (!rawGroupName || !groupCode) {
      throw new Error("Invalid admin/groups response: groupDetails missing groupName/groupCode");
    }
    const groupName = rawGroupName;
    const groupId = `${groupCode}-${index + 1}`;
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

  if (!payload.companies) {
    throw new Error("Invalid admin/groups response: missing companies object");
  }
  const { active, pending, inactive } = payload.companies;
  if (!Array.isArray(active) || !Array.isArray(pending) || !Array.isArray(inactive)) {
    throw new Error("Invalid admin/groups response: companies buckets must be arrays");
  }

  const activeGroups = mapGroups(active, "Approved");
  const pendingGroups = mapGroups(pending, "Pending");
  const inactiveGroups = mapGroups(inactive, "Inactive");
  return [...activeGroups, ...pendingGroups, ...inactiveGroups];
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
  return apiFetch<CompanyHistoryResponse>(COMPANY_HISTORY_PATH, {
    method: "POST",
    body: JSON.stringify({ companyCode })
  });
}
