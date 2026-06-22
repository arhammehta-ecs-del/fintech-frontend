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
  activeCount?: number;
  pendingCount?: number;
  inactiveCount?: number;
  pageInfo?: Partial<CompanyPageInfo>;
};

export type CompanyListDirection = "NEXT" | "PREV";

export type CompanyPaginatedRequest = {
  type?: "active" | "pending";
  limit: number;
  cursor: string | null;
  topCursor: string | null;
  page?: number | null;
  direction?: CompanyListDirection;
  query?: string | null;
  filter?: boolean;
  applied?: {
    incorporationDate: {
      dateRange: "7DAYS" | "15DAYS" | "1MONTH" | "CUSTOM";
      fromDate: string | null;
      toDate: string | null;
    } | null;
    gstcode: "yes" | "no" | null;
    isCode: "yes" | "no" | null;
    signatoryCount: number[] | null;
  } | null;
};

type CompanyPageInfo = {
  page: number;
  totalPages: number;
  nextCursor: string | null;
  prevCursor: string | null;
  topCursor: string | null;
  hasNext: boolean;
  hasPrev: boolean;
};

export type CompanyPaginatedResult = {
  groups: GroupCompany[];
  counts: {
    active: number;
    pending: number;
    inactive: number;
  };
  pageInfo: CompanyPageInfo;
};

const COMPANY_LIST_PATH = "/api/v1/admin/groups";
const COMPANY_CREATE_PATH = "/api/v1/admin/initiate";
const COMPANY_ACTION_PATH = "/api/v1/admin/action";
const COMPANY_HISTORY_PATH = "/api/v1/admin/fetch-history";
const DEFAULT_COMPANY_PAGE_LIMIT = 15;


const getPacketString = (value: string | null | undefined) => (typeof value === "string" ? value.trim() : "");
const toUpperValue = (value: string) => value.toUpperCase();
const toNullableString = (value: unknown) => {
  const parsed = typeof value === "string" ? value.trim() : "";
  return parsed ? parsed : null;
};

const normalizeCompanyStatus = (value: unknown): Company["status"] | null => {
  const normalized = getPacketString(typeof value === "string" ? value : "").toUpperCase();
  if (normalized === "APPROVED" || normalized === "ACTIVE") return "Approved";
  if (normalized === "PENDING") return "Pending";
  if (normalized === "INACTIVE" || normalized === "REJECTED" || normalized === "REJECT") return "Inactive";
  return null;
};

const resolveCompanyStatus = (
  company: RawCompanyListItem,
  bucketStatus?: Company["status"],
): Company["status"] => {
  const fromCompany = normalizeCompanyStatus(company.status);
  if (fromCompany) return fromCompany;
  if (bucketStatus) return bucketStatus;
  if (company.isActive === false) return "Inactive";
  return "Approved";
};

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
  bucketStatus?: Company["status"],
  inheritedSignatories?: Array<RawSignatory | null> | null,
): Company => {
  const legalName = getPacketString(company.name);
  // Some pending records can have an empty `brand`; render a placeholder in Company Name.
  const companyName = getPacketString(company.brand) || "-";
  const companyCode = toUpperValue(getPacketString(company.companyCode));
  const companyId = getPacketString(company.companyId) || getPacketString(company.id) || companyCode;
  const incorporationDate = getPacketString(company.registration) || getPacketString(company.registeredAt);
  const ieCode = getPacketString(company.ieCode) || getPacketString(company.iecode);

  if (!companyId || !companyCode || !legalName || !incorporationDate) {
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
    status: resolveCompanyStatus(company, bucketStatus),
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

const mapGroups = (groups: RawCompanyGroup[], bucketStatus?: Company["status"]): GroupCompany[] =>
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

const mapCompanyPageInfo = (pageInfo?: Partial<CompanyPageInfo>): CompanyPageInfo => ({
  page: Number(pageInfo?.page ?? 1) || 1,
  totalPages: Number(pageInfo?.totalPages ?? 0) || 0,
  nextCursor: toNullableString(pageInfo?.nextCursor),
  prevCursor: toNullableString(pageInfo?.prevCursor),
  topCursor: toNullableString(pageInfo?.topCursor),
  hasNext: Boolean(pageInfo?.hasNext),
  hasPrev: Boolean(pageInfo?.hasPrev),
});

const getGroupsFromResponse = (
  payload: CompanyListApiResponse,
  fallbackStatus?: Company["status"],
): GroupCompany[] => {
  if (payload.companies) {
    const { active, pending, inactive } = payload.companies;
    if (!Array.isArray(active) || !Array.isArray(pending) || !Array.isArray(inactive)) {
      throw new Error("Invalid admin/groups response: companies buckets must be arrays");
    }

    const activeGroups = mapGroups(active, "Approved");
    const pendingGroups = mapGroups(pending, "Pending");
    const inactiveGroups = mapGroups(inactive, "Inactive");
    return [...activeGroups, ...pendingGroups, ...inactiveGroups];
  }

  if (Array.isArray(payload.data)) {
    return mapGroups(payload.data, fallbackStatus);
  }

  throw new Error("Invalid admin/groups response: missing companies object");
};

const countCompaniesByStatus = (groups: GroupCompany[]) =>
  groups.reduce(
    (counts, group) => {
      group.subsidiaries.forEach((company) => {
        if (company.status === "Approved") counts.active += 1;
        else if (company.status === "Pending") counts.pending += 1;
        else if (company.status === "Inactive") counts.inactive += 1;
      });
      return counts;
    },
    { active: 0, pending: 0, inactive: 0 },
  );

export async function fetchCompaniesPaginated(request: CompanyPaginatedRequest): Promise<CompanyPaginatedResult> {
  const payload = await apiFetch<CompanyListApiResponse>(COMPANY_LIST_PATH, {
    body: JSON.stringify({
      filter: Boolean(request.filter),
      pagination: {
        statusType: request.type ?? "active",
        limit: request.limit,
        cursor: request.cursor ?? null,
        topCursor: request.topCursor ?? null,
        page: request.page ?? null,
        direction: request.direction ?? "NEXT",
        query: toNullableString(request.query),
      },
      applied: request.filter ? request.applied ?? null : null,
    }),
  });

  const fallbackStatus: Company["status"] | undefined =
    request.type === "pending" ? "Pending" : request.type === "active" ? "Approved" : undefined;
  const groups = getGroupsFromResponse(payload, fallbackStatus);
  const derivedCounts = countCompaniesByStatus(groups);

  return {
    groups,
    counts: {
      active: Number(payload.activeCount ?? derivedCounts.active) || derivedCounts.active,
      pending: Number(payload.pendingCount ?? derivedCounts.pending) || derivedCounts.pending,
      inactive: Number(payload.inactiveCount ?? derivedCounts.inactive) || derivedCounts.inactive,
    },
    pageInfo: mapCompanyPageInfo(payload.pageInfo),
  };
}

export async function getAllCompanies(): Promise<GroupCompany[]> {
  const allGroups: GroupCompany[] = [];
  let cursor: string | null = null;
  let topCursor: string | null = null;
  let hasNext = true;
  let safetyCounter = 0;

  while (hasNext && safetyCounter < 200) {
    safetyCounter += 1;
    const response = await fetchCompaniesPaginated({
      type: "active",
      limit: DEFAULT_COMPANY_PAGE_LIMIT,
      cursor,
      topCursor,
      page: null,
      direction: "NEXT",
      query: null,
    });

    allGroups.push(...response.groups);
    cursor = response.pageInfo.nextCursor;
    topCursor = response.pageInfo.topCursor || topCursor;
    hasNext = Boolean(response.pageInfo.hasNext && response.pageInfo.nextCursor);
  }

  return allGroups;
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
      body: formData,
    });
  }

  return apiFetch<OnboardingResponse>(COMPANY_CREATE_PATH, {
    body: JSON.stringify(finalPayload),
  });
}

export async function updateCompanyOnboardingAction(
  id: string,
  action: OnboardingAction,
  remark: string,
) {
  return apiFetch<OnboardingActionResponse>(COMPANY_ACTION_PATH, {
    body: JSON.stringify({
      id,
      action,
      remark,
    }),
  });
}

export async function fetchCompanyHistory(companyCode: string) {
  return apiFetch<CompanyHistoryResponse>(COMPANY_HISTORY_PATH, {
    body: JSON.stringify({ companyCode })
  });
}

const COMPANY_DETAILS_PATH = "/api/v1/admin/company-details";

export async function fetchCompanyDetails(companyCode: string) {
  return apiFetch<{
    message?: string;
    data?: {
      groupDetails?: { groupCode?: string; groupName?: string };
      companyDetails?: Array<{
        companyCode?: string;
        name?: string;
        gst?: string;
        brand?: string;
        ieCode?: string;
        registration?: string;
        address?: string;
        initiator?: {
          name?: string;
          email?: string;
        };
        initiatedDate?: string;
        signatories?: Array<{
          name?: string;
          email?: string;
          phone?: string;
          designation?: string;
          employeeId?: string;
        }>;
      }>;
    };
  }>(COMPANY_DETAILS_PATH, {
    body: JSON.stringify({ companyCode }),
  });
}
