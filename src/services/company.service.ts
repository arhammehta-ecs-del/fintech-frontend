import type { Company, GroupCompany } from "@/contexts/AppContext";
import { apiFetch } from "@/services/client";

export type OnboardingPayload = {
  group: {
    name: string;
    groupCode: string;
    remarks?: string;
  };
  company: {
    companyCode: string;
    name: string;
    gst: string;
    brand: string;
    ieCode: string;
    incorporationDate: string;
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

type RawCompanyListItem = {
  companyCode?: string | null;
  companycode?: string | null;
  name?: string | null;
  gst?: string | null;
  brand?: string | null;
  iecode?: string | null;
  registeredAt?: string | null;
  registration?: string | null;
  address?: string | null;
  status?: string | null;
  isActive?: boolean | null;
};

type RawCompanyGroup = {
  groupName?: string | null;
  groupCode?: string | null;
  companies?: RawCompanyListItem[] | null;
  groupdetails?: {
    groupname?: string | null;
    groupcode?: string | null;
  } | null;
  comapnydetails?: RawCompanyListItem[] | null;
  companydetails?: RawCompanyListItem[] | null;
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

const COMPANY_LIST_PATH = "/api/v1/companies/all";
const COMPANY_CREATE_PATH = "/api/v1/admin/companies";

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

const mapCompany = (company: RawCompanyListItem, bucketStatus?: Company["status"] | null): Company => {
  const companyName = getPacketString(company.name) || "Untitled Company";
  const companyCode = toUpperValue(getPacketString(company.companyCode) || getPacketString(company.companycode));

  return {
    id: companyCode || companyName.toLowerCase().replace(/\s+/g, "-"),
    brand: getPacketString(company.brand) || companyName,
    companyCode,
    companyName,
    legalName: companyName,
    incorporationDate: getPacketString(company.registeredAt) || getPacketString(company.registration),
    address: getPacketString(company.address),
    gstin: getPacketString(company.gst),
    ieCode: getPacketString(company.iecode),
    status: normalizeCompanyStatus(company, bucketStatus),
    signatories: [],
  };
};

const getGroupName = (group: RawCompanyGroup) => getPacketString(group.groupName) || getPacketString(group.groupdetails?.groupname);
const getGroupCode = (group: RawCompanyGroup) => toUpperValue(getPacketString(group.groupCode) || getPacketString(group.groupdetails?.groupcode));
const getGroupCompanies = (group: RawCompanyGroup) =>
  group.companies ?? group.comapnydetails ?? group.companydetails ?? [];

const mapGroups = (groups: RawCompanyGroup[], bucketStatus?: Company["status"] | null): GroupCompany[] =>
  groups.map((group, index) => {
    const rawGroupName = getGroupName(group);
    const groupCode = getGroupCode(group);
    const isIndependentGroup = !rawGroupName && !groupCode;
    const groupName = isIndependentGroup ? "ungrouped" : rawGroupName;
    const groupId = isIndependentGroup ? `ungrouped-${bucketStatus ?? "default"}-${index + 1}` : groupCode || rawGroupName;
    const subsidiaries = getGroupCompanies(group).map((company) => mapCompany(company, bucketStatus));

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
    body: JSON.stringify({
      type: "A",
    }),
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
  if (file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("payload", JSON.stringify(payload));

    return apiFetch<OnboardingResponse>(COMPANY_CREATE_PATH, {
      method: "POST",
      body: formData,
    });
  }

  return apiFetch<OnboardingResponse>(COMPANY_CREATE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
