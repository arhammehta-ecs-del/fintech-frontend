export type ApiMonitoringCompany = {
  name: string;
  code: string;
};

export type ApiMonitoringUser = {
  name: string;
  email: string;
};

export type ApiMonitoringHeaders = Record<string, string>;

export type ApiMonitoringPayload = Record<string, unknown> | null;

export type ApiMonitoringStep = {
  id: string;
  trackId: string;
  spanType?: string;
  method: string;
  path: string;
  responseSize?: string;
  status: number | null;
  latency?: number | null;
  clientIp?: string;
  timeString: string;
  accessToken?: string;
  refreshToken?: string;
  cookies?: string;
  reqHeaders: ApiMonitoringHeaders;
  reqBody: ApiMonitoringPayload;
  resHeaders: ApiMonitoringHeaders;
  resBody: Record<string, unknown>;
};

export type ApiMonitoringLog = ApiMonitoringStep & {
  company: ApiMonitoringCompany;
  user: ApiMonitoringUser;
  timeStr: string;
  dateStr: string;
  spanCount: number;
  totalSpanCount: number;
  subApis: ApiMonitoringStep[];
};

export type ApiMonitoringDetailsData = {
  mainRequest: ApiMonitoringStep;
  childSpans: ApiMonitoringStep[];
};
