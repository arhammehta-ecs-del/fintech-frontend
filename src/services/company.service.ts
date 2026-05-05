import type { Company, GroupCompany } from "@/contexts/AppContext";
import { apiFetch } from "@/services/client";
const USE_MOCK_DATA = String(import.meta.env.VITE_USE_ORG_MOCK).toLowerCase() === "true";

export type OnboardingPayload = {
  group: {
    name: string;
    groupCode: string | null;
    remarks?: string;
  };
  company: {
    companyCode: string | null;
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
      } | null>
    | null;
  requesterName?: string | null;
  requesterEmail?: string | null;
  requestInitiatedAt?: string | null;
  initiatedByName?: string | null;
  initiatedByEmail?: string | null;
  initiatedAt?: string | null;
  createdAt?: string | null;
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
const COMPANY_CREATE_PATH = "/api/v1/company-settings/initiate";
const COMPANY_ACTION_PATH = "/api/v1/company-settings/action";

const MOCK_GROUPS: GroupCompany[] = [
  {
    id: "grp-test",
    groupName: "TEST Group",
    code: "TST",
    createdDate: "2026-04-01",
    remarks: "Mock group for UI testing",
    subsidiaries: [
      {
        id: "cmp-test",
        brand: "TEST Tech",
        companyCode: "TEST28042026",
        companyName: "TEST Tech",
        legalName: "TEST Tech Solutions Pvt Ltd",
        incorporationDate: "2024-04-28",
        address: "Mumbai, Maharashtra, India",
        gstin: "27ABCDE1234F1Z5",
        ieCode: "1234567890",
        status: "Approved",
        signatories: [
          {
            fullName: "Sakshi Nair",
            designation: "Director",
            email: "sakshi.nair@testtech.com",
            phone: "9876543210",
          },
        ],
      },
      {
        id: "cmp-test-logistics",
        brand: "TEST Logistics",
        companyCode: "TLOG2026",
        companyName: "TEST Logistics",
        legalName: "TEST Logistics Private Limited",
        incorporationDate: "2023-11-12",
        address: "Pune, Maharashtra, India",
        gstin: "27AACCT9021M1ZA",
        ieCode: "9988776655",
        status: "Pending",
        signatories: [
          {
            fullName: "Amit Verma",
            designation: "COO",
            email: "amit.verma@testlogistics.com",
            phone: "9820012345",
          },
        ],
        requesterName: "Sneha Kulkarni",
        requesterEmail: "sneha.kulkarni@testtech.com",
        requestInitiatedAt: "2026-04-29T10:45:00.000Z",
      },
      {
        id: "cmp-test-energy",
        brand: "TEST Energy",
        companyCode: "TENG2025",
        companyName: "TEST Energy",
        legalName: "TEST Energy Systems LLP",
        incorporationDate: "2022-08-01",
        address: "Ahmedabad, Gujarat, India",
        gstin: "24AACCE7781N1ZX",
        ieCode: "5566778899",
        status: "Inactive",
        signatories: [
          {
            fullName: "Riya Shah",
            designation: "Partner",
            email: "riya.shah@testenergy.com",
            phone: "9898989898",
          },
        ],
      },
    ],
  },
  {
    id: "grp-global",
    groupName: "Global Industrial Group",
    code: "GIG",
    createdDate: "2025-01-20",
    remarks: "Diversified industrial businesses",
    subsidiaries: [
      {
        id: "cmp-global-metals",
        brand: "Global Metals",
        companyCode: "GMET2024",
        companyName: "Global Metals",
        legalName: "Global Metals India Pvt Ltd",
        incorporationDate: "2021-07-19",
        address: "Chennai, Tamil Nadu, India",
        gstin: "33AABCG4567L1ZS",
        ieCode: "2233445566",
        status: "Approved",
        signatories: [
          {
            fullName: "Harish Iyer",
            designation: "Managing Director",
            email: "harish.iyer@globalmetals.com",
            phone: "9000090000",
          },
        ],
      },
      {
        id: "cmp-global-chem",
        brand: "Global Chemicals",
        companyCode: "GCHEM2026",
        companyName: "Global Chemicals",
        legalName: "Global Specialty Chemicals Ltd",
        incorporationDate: "2020-03-08",
        address: "Vadodara, Gujarat, India",
        gstin: "24AAFCG1122K1ZQ",
        ieCode: "6677889900",
        status: "Pending",
        signatories: [
          {
            fullName: "Nidhi Rao",
            designation: "Compliance Head",
            email: "nidhi.rao@globalchem.com",
            phone: "9011122233",
          },
        ],
        requesterName: "Karan Mehta",
        requesterEmail: "karan.mehta@globalchem.com",
        requestInitiatedAt: "2026-04-30T08:15:00.000Z",
      },
    ],
  },
];

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
  const legalName = getPacketString(company.name) || "Untitled Company";
  const companyName = getPacketString(company.brand) || legalName;
  const companyCode = toUpperValue(getPacketString(company.companyCode));
  const mappedSignatories =
    company.signatories
      ?.filter((signatory): signatory is NonNullable<typeof signatory> => Boolean(signatory))
      .map((signatory) => ({
        fullName: getPacketString(signatory.fullName) || getPacketString(signatory.name),
        designation: getPacketString(signatory.designation),
        email: getPacketString(signatory.email),
        phone: getPacketString(signatory.phone),
      }))
      .filter((signatory) => Boolean(signatory.fullName || signatory.email || signatory.phone || signatory.designation)) ??
    [];
  const signatories = mappedSignatories;

  return {
    id: getPacketString(company.id) || companyCode || companyName.toLowerCase().replace(/\s+/g, "-"),
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
    requesterName: getPacketString(company.requesterName) || getPacketString(company.initiatedByName),
    requesterEmail: getPacketString(company.requesterEmail) || getPacketString(company.initiatedByEmail),
    requestInitiatedAt:
      getPacketString(company.requestInitiatedAt) ||
      getPacketString(company.initiatedAt) ||
      getPacketString(company.createdAt),
  };
};

const getGroupName = (group: RawCompanyGroup) =>
  getPacketString(group.groupName) || getPacketString(group.groupDetails?.groupName);
const getGroupCode = (group: RawCompanyGroup) =>
  toUpperValue(getPacketString(group.groupCode) || getPacketString(group.groupDetails?.groupCode));
const getGroupCompanies = (group: RawCompanyGroup) =>
  group.companies ?? group.comapnyDetails ?? group.companyDetails ?? [];

const mapGroups = (groups: RawCompanyGroup[], bucketStatus?: Company["status"] | null): GroupCompany[] =>
  groups.map((group, index) => {
    const rawGroupName = getGroupName(group);
    const groupCode = getGroupCode(group);
    const isIndependentGroup = !rawGroupName && !groupCode || rawGroupName.trim().toLowerCase() === "ungrouped";
    const groupName = isIndependentGroup ? "Independent" : rawGroupName;
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
  if (USE_MOCK_DATA) {
    return MOCK_GROUPS;
  }

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
  if (USE_MOCK_DATA) {
    return {
      message: "Company onboarding initiated successfully (mock)",
      code: 200,
      data: {
        companyId: `mock-company-${Date.now()}`,
        groupId: "mock-group",
        status: "Pending",
      },
    };
  }

  const finalPayload = {
    ...payload,
    group: {
      ...payload.group,
      groupCode: payload.group.groupCode?.trim() ? payload.group.groupCode.trim().toUpperCase() : null,
    },
    company: {
      ...payload.company,
      companyCode: payload.company.companyCode?.trim() ? payload.company.companyCode.trim().toUpperCase() : null,
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
  if (USE_MOCK_DATA) {
    return {
      message: `Company ${id} ${action} (mock)`,
      code: 200,
      success: true,
      data: { remark },
    };
  }

  return apiFetch<OnboardingActionResponse>(COMPANY_ACTION_PATH, {
    method: "POST",
    body: JSON.stringify({
      id,
      action,
      remark,
    }),
  });
}
