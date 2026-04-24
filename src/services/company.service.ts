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

type OnboardingAction = "approve" | "reject";

type OnboardingActionResponse = {
  message?: string;
  code?: number;
  success?: boolean;
  data?: unknown;
};

type RawCompanyListItem = {
  id?: string | null;
  companyCode?: string | null;
  name?: string | null;
  gst?: string | null;
  brand?: string | null;
  ieCode?: string | null;
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
  groupDetails?: {
    groupName?: string | null;
    groupCode?: string | null;
  } | null;
  companyDetails?: RawCompanyListItem[] | null;
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

const COMPANY_LIST_PATH = "/api/v1/company/groups";
const COMPANY_CREATE_PATH = "/api/v1/onboarding/company/initiate";
const COMPANY_ACTION_PATH = "/api/v1/onboarding/company/action";
const MOCK_COMPANY_LIST_RESPONSE: CompanyListApiResponse = {
  message: "Companies fetched successfully!",
  companies: {
    active: [
      {
        groupDetails: {
          groupCode: "TESTGROUP03042026",
          groupName: "TEST GROUP",
        },
        companyDetails: [
          {
            id: "7d6716aa-db50-495f-915f-f91c7ea5e5c2",
            companyCode: "TECHSOLUTIONS04042026",
            name: "Tech Solutions Ltd",
            gst: "GST001",
            brand: "TechSol",
            ieCode: "",
            registration: "",
            address: "",
          },
        ],
      },
    ],
    pending: [
      {
        groupDetails: {
          groupCode: "TESTGROUP03042026",
          groupName: "TEST GROUP",
        },
        companyDetails: [
          {
            id: "9c4a21b7-2e6a-47a8-9652-0d2b4de67d11",
            companyCode: "FINANCEPRO03042026",
            name: "Finance Pro Inc",
            gst: "GST002",
            brand: "FinPro",
            ieCode: "",
            registration: "",
            address: "",
          },
        ],
      },
    ],
    inactive: [
      {
        groupDetails: {
          groupCode: "",
          groupName: "",
        },
        companyDetails: [
          {
            id: "2c8f671e-5c1d-4679-b6cb-c8b5d44e901a",
            companyCode: "RETAILMAX03042026",
            name: "Retail Max",
            gst: "GST003",
            brand: "RM",
            ieCode: "",
            registration: "",
            address: "",
          },
        ],
      },
    ],
  },
};

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
  const companyCode = toUpperValue(getPacketString(company.companyCode));

  return {
    id: getPacketString(company.id) || companyCode || companyName.toLowerCase().replace(/\s+/g, "-"),
    brand: getPacketString(company.brand) || companyName,
    companyCode,
    companyName,
    legalName: companyName,
    incorporationDate: getPacketString(company.registeredAt) || getPacketString(company.registration),
    address: getPacketString(company.address),
    gstin: getPacketString(company.gst),
    ieCode: getPacketString(company.ieCode),
    status: normalizeCompanyStatus(company, bucketStatus),
    signatories: [],
  };
};

const getGroupName = (group: RawCompanyGroup) =>
  getPacketString(group.groupName) || getPacketString(group.groupDetails?.groupName);
const getGroupCode = (group: RawCompanyGroup) =>
  toUpperValue(getPacketString(group.groupCode) || getPacketString(group.groupDetails?.groupCode));
const getGroupCompanies = (group: RawCompanyGroup) => group.companies ?? group.companyDetails ?? [];

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
  // Comment this mock payload to go back to the normal backend flow.
  const payload = MOCK_COMPANY_LIST_RESPONSE;
  /*
  const payload = await apiFetch<CompanyListApiResponse>(COMPANY_LIST_PATH, {
    method: "POST",
    body: JSON.stringify({
      type: "A",
    }),
  });
  */

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

export async function updateCompanyOnboardingAction(
  id: string,
  action: OnboardingAction,
  remark = "this will we build today",
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
