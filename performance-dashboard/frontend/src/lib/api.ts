import useSWR from "swr";

const BASE = "/api/v1";

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    const err = await res.json().catch(() => ({ detail: "인증 오류" }));
    throw new Error(err.detail || "인증 오류");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "요청 실패");
  }
  return res.json();
}

export const api = {
  // 인증
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  getMe: () => request<AuthUser>("/auth/me"),
  getUsers: () => request<AuthUser[]>("/auth/users"),
  createUser: (data: UserCreate) =>
    request<AuthUser>("/auth/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateUser: (userId: number, data: UserUpdate) =>
    request<AuthUser>(`/auth/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteUser: (userId: number) =>
    request<void>(`/auth/users/${userId}`, { method: "DELETE" }),

  // 스토어
  getStores: (linkedOnly?: boolean) => {
    const params = new URLSearchParams();
    if (linkedOnly) params.set("linked_only", "true");
    const qs = params.toString();
    return request<Store[]>(`/stores${qs ? `?${qs}` : ""}`);
  },
  createStore: (data: { name: string; description?: string; customer_id?: string }) =>
    request<Store>("/stores", { method: "POST", body: JSON.stringify(data) }),
  linkCustomerStore: (data: { name: string; customer_id: string }) =>
    request<Store>("/stores/link-customer", { method: "POST", body: JSON.stringify(data) }),
  deleteStore: (id: number) =>
    request<void>(`/stores/${id}`, { method: "DELETE" }),

  // 대시보드
  getDashboardSummary: (storeId: number, date?: string) => {
    const params = new URLSearchParams({ store_id: String(storeId) });
    if (date) params.set("date", date);
    return request<KpiSummary>(`/dashboard/summary?${params}`);
  },
  getDashboardTrend: (storeId: number, days = 7) => {
    const params = new URLSearchParams({
      store_id: String(storeId),
      days: String(days),
    });
    return request<TrendPoint[]>(`/dashboard/trend?${params}`);
  },
  getDashboardAlerts: (storeId: number, date?: string) => {
    const params = new URLSearchParams({ store_id: String(storeId) });
    if (date) params.set("date", date);
    return request<ActionItem[]>(`/dashboard/alerts?${params}`);
  },
  getStoreComparison: (days = 7) =>
    request<StoreComparison[]>(`/dashboard/store-comparison?days=${days}`),

  // 광고 성과 (storeId 필수)
  getCampaigns: (storeId: number, start?: string, end?: string) => {
    const params = new URLSearchParams({ store_id: String(storeId) });
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    return request<CampaignPerf[]>(`/performance/campaigns?${params}`);
  },
  getCampaignsWithDelta: (storeId: number, period = 7) => {
    const params = new URLSearchParams({
      store_id: String(storeId),
      period: String(period),
    });
    return request<CampaignPerfWithDelta[]>(
      `/performance/campaigns/with-delta?${params}`
    );
  },
  getAdgroups: (storeId: number, campaign?: string) => {
    const params = new URLSearchParams({ store_id: String(storeId) });
    if (campaign) params.set("campaign", campaign);
    return request<AdgroupPerf[]>(`/performance/adgroups?${params}`);
  },
  getAdgroupsWithDelta: (storeId: number, campaign?: string, period = 7) => {
    const params = new URLSearchParams({
      store_id: String(storeId),
      period: String(period),
    });
    if (campaign) params.set("campaign", campaign);
    return request<AdgroupPerfWithDelta[]>(
      `/performance/adgroups/with-delta?${params}`
    );
  },
  getKeywords: (storeId: number, adgroup?: string) => {
    const params = new URLSearchParams({ store_id: String(storeId) });
    if (adgroup) params.set("adgroup", adgroup);
    return request<KeywordPerf[]>(`/performance/keywords?${params}`);
  },
  getKeywordsWithDelta: (storeId: number, campaign?: string, adgroup?: string, period = 7) => {
    const params = new URLSearchParams({
      store_id: String(storeId),
      period: String(period),
    });
    if (campaign) params.set("campaign", campaign);
    if (adgroup) params.set("adgroup", adgroup);
    return request<KeywordPerfWithDelta[]>(
      `/performance/keywords/with-delta?${params}`
    );
  },

  // 광고그룹 소재 조회
  getAdgroupAds: (storeId: number, adgroupId: string) =>
    request<AdCreativeForList[]>(
      `/performance/adgroup-ads?store_id=${storeId}&adgroup_id=${encodeURIComponent(adgroupId)}`
    ),

  // 설정
  getThresholds: () => request<ThresholdSettings>("/settings/thresholds"),
  updateThresholds: (data: ThresholdSettings) =>
    request<ThresholdSettings>("/settings/thresholds", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // 네이버 API
  getNaverCredentials: () => request<NaverCredentialsOut>("/naver/credentials"),
  saveNaverCredentials: (data: NaverCredentials) =>
    request<{ success: boolean; message: string }>("/naver/credentials", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteNaverCredentials: () =>
    request<{ success: boolean }>("/naver/credentials", { method: "DELETE" }),
  testNaverConnection: () =>
    request<NaverConnectionTest>("/naver/test-connection", { method: "POST" }),
  getNaverCustomers: () => request<NaverCustomer[]>("/naver/customers"),
  getNaverAccountOverview: (customerId: string) =>
    request<NaverAccountOverview>(`/naver/accounts/${customerId}/overview`),
  // syncNaverData 제거됨 — 실시간 API 사용

  // 전체 종합
  getBizMoney: (storeId: number) =>
    request<BizMoneyBalance>(`/all-in-one/bizmoney?store_id=${storeId}`),
  getQualityIndex: (storeId: number) =>
    request<QualityIndexSummary>(`/all-in-one/quality-index?store_id=${storeId}`),
  getAdCreatives: (storeId: number) =>
    request<AdCreativesSummary>(`/all-in-one/ad-creatives?store_id=${storeId}`),
  getAdExtensions: (storeId: number) =>
    request<AdExtensionsSummary>(`/all-in-one/ad-extensions?store_id=${storeId}`),
  getKeywordTool: (storeId: number, keywords: string[]) =>
    request<KeywordToolResult[]>(`/all-in-one/keyword-tool?store_id=${storeId}`, {
      method: "POST",
      body: JSON.stringify({ keywords }),
    }),
  getBidSimulation: (storeId: number, req: BidSimRequest) =>
    request<Record<string, unknown>>(`/all-in-one/bid-simulation?store_id=${storeId}`, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  // 자동 최적화
  previewOptimization: (storeId: number, periodDays = 14) =>
    request<OptimizationPreviewResponse>("/optimization/preview", {
      method: "POST",
      body: JSON.stringify({ store_id: storeId, period_days: periodDays }),
    }),
  executeOptimization: (jobId: number, excludedActionIds: number[] = []) =>
    request<OptimizationExecuteResponse>("/optimization/execute", {
      method: "POST",
      body: JSON.stringify({ job_id: jobId, excluded_action_ids: excludedActionIds }),
    }),
  getOptimizationJobs: (storeId: number, limit = 20) =>
    request<OptimizationJobListItem[]>(
      `/optimization/jobs?store_id=${storeId}&limit=${limit}`
    ),
  getOptimizationJobDetail: (jobId: number) =>
    request<OptimizationPreviewResponse>(`/optimization/jobs/${jobId}`),
  updateOptimizationAction: (actionId: number, status: "approved" | "excluded") =>
    request<{ success: boolean }>(`/optimization/actions/${actionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // AI 채팅
  getAiApiKeyStatus: () => request<AiApiKeyStatus>("/ai/api-key-status"),
  saveAiApiKey: (apiKey: string) =>
    request<{ success: boolean; message: string }>("/ai/api-key", {
      method: "POST",
      body: JSON.stringify({ api_key: apiKey }),
    }),
  deleteAiApiKey: () =>
    request<{ success: boolean }>("/ai/api-key", { method: "DELETE" }),
  chatWithAi: (messages: ChatMessage[], context?: string) =>
    request<{ reply: string }>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ messages, context }),
    }),

  // 파일 업로드
  uploadFile: async (file: File, storeId: number, targetDate?: string): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const params = new URLSearchParams({ store_id: String(storeId) });
    if (targetDate) params.set("target_date", targetDate);

    const res = await fetch(`${BASE}/upload/csv?${params}`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "업로드 실패");
    }
    return res.json();
  },

  // 모든 스토어 조회 (linked 여부 무관)
  getAllStores: () => request<Store[]>("/stores"),

  // 네이버 API 데이터 동기화
  syncNaverData: (customerId: string, periodDays = 14) =>
    request<NaverSyncResult>(`/naver/sync/${customerId}`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
};

// ── 타입 정의 ──

export interface Store {
  id: number;
  name: string;
  description: string | null;
  customer_id: string | null;
  created_at: string;
}

export interface KpiSummary {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
  ctr: number;
  roas: number;
  cpa: number;
  avg_cpc: number;
  aov: number;
  deltas: {
    revenue: number | null;
    cost: number | null;
    roas: number | null;
    conversions: number | null;
    clicks: number | null;
    ctr: number | null;
  } | null;
}

export interface TrendPoint {
  date: string;
  cost: number;
  revenue: number;
  conversions: number;
  clicks: number;
  impressions: number;
  roas: number;
}

export interface ActionItem {
  id: number;
  store_id: number;
  date: string;
  priority: number;
  level: string;
  campaign: string | null;
  adgroup: string | null;
  keyword: string | null;
  reason: string;
  action: string;
  status: string;
  created_at: string;
}

export interface PerformanceDeltas {
  cost: number | null;
  clicks: number | null;
  ctr: number | null;
  roas: number | null;
  conversions: number | null;
  revenue: number | null;
}

export interface CampaignPerf {
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
  ctr: number;
  roas: number;
  cpa: number;
  avg_cpc: number;
}

export interface AIRecommendation {
  level: string;
  reason: string;
  action: string;
}

export interface CampaignPerfWithDelta extends CampaignPerf {
  deltas: PerformanceDeltas | null;
  recommendation: AIRecommendation | null;
}

export interface AdgroupPerf extends CampaignPerf {
  adgroup_name: string;
  adgroup_id: string;
}

export interface AdgroupPerfWithDelta extends AdgroupPerf {
  deltas: PerformanceDeltas | null;
  recommendation: AIRecommendation | null;
}

export interface AdCreativeForList {
  ad_id: string;
  type: string;
  status: string;
  inspect_status: string;
  headline: string;
  description: string;
  pc_channel_id: string;
  mobile_channel_id: string;
  product_title: string;
  price: string;
  image_url: string;
  mall_name: string;
  review_count: string;
  purchase_count: string;
  category: string;
}

export interface KeywordPerf extends AdgroupPerf {
  keyword: string;
}

export interface KeywordPerfWithDelta extends KeywordPerf {
  deltas: PerformanceDeltas | null;
}

export interface StoreComparison {
  store_id: number;
  store_name: string;
  cost: number;
  revenue: number;
  conversions: number;
  roas: number;
}

export interface ThresholdSettings {
  min_clicks_for_pause: number;
  low_ctr_threshold: number;
  low_roas_threshold: number;
  high_roas_threshold: number;
  high_cpc_threshold: number;
}

// 네이버 API 타입
export interface NaverCredentials {
  api_key: string;
  secret_key: string;
  customer_id: string;
}

export interface NaverCredentialsOut {
  api_key_masked: string;
  customer_id: string;
  is_configured: boolean;
}

export interface NaverConnectionTest {
  success: boolean;
  client_count: number;
  campaigns_count?: number;
  error: string | null;
}

export interface NaverCustomer {
  customer_id: string;
  name: string;
  login_id: string;
}

export interface NaverCampaignInfo {
  campaign_id: string;
  name: string;
  campaign_type: string;
  status: string;
  budget: number;
}

export interface NaverAdgroupInfo {
  adgroup_id: string;
  campaign_id: string;
  name: string;
  status: string;
  bid_amount: number;
}

export interface NaverAccountOverview {
  customer_id: string;
  customer_name: string;
  campaigns: NaverCampaignInfo[];
  adgroups: NaverAdgroupInfo[];
  keywords_count: number;
}

// 전체 종합 타입
export interface BizMoneyBalance {
  bizmoney: number;
  budget_lock: number;
  refund: number;
}

export interface QualityIndexDistribution {
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface QualityIndexDetail {
  keyword_id: string;
  keyword: string;
  quality_index: number;
  adgroup_id: string;
  adgroup_name: string;
  campaign_name: string;
}

export interface QualityIndexSummary {
  distribution: QualityIndexDistribution;
  details: QualityIndexDetail[];
}

export interface AdCreativeItem {
  ad_id: string;
  adgroup_name: string;
  campaign_name: string;
  type: string;
  status: string;
  inspect_status: string;
  headline: string;
  description: string;
}

export interface AdCreativesSummary {
  total: number;
  status_counts: Record<string, number>;
  recent_ads: AdCreativeItem[];
}

export interface AdExtensionsSummary {
  total: number;
  by_type: Record<string, number>;
}

export interface KeywordToolResult {
  keyword: string;
  monthly_pc_qc_cnt: number;
  monthly_mobile_qc_cnt: number;
  comp_idx: string;
  pl_avg_depth: number;
}

export interface BidSimRequest {
  keyword_id: string;
  bid: number;
  device?: string;
}

// 자동 최적화 타입
export interface OptimizationActionContext {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  roas: number;
  ctr: number;
  cpc: number;
}

export interface OptimizationAction {
  id: number;
  job_id: number;
  rule_id: string;
  priority: number;
  level: string;
  reason: string;
  action_description: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adgroup_id: string | null;
  adgroup_name: string | null;
  keyword_id: string | null;
  keyword_text: string | null;
  action_type: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  change_pct: number | null;
  status: string;
  error_message: string | null;
  executed_at: string | null;
  created_at: string;
  context: OptimizationActionContext | null;
}

export interface OptimizationJob {
  id: number;
  store_id: number;
  customer_id: string;
  status: string;
  total_actions: number;
  executed_actions: number;
  failed_actions: number;
  analysis_period_start: string;
  analysis_period_end: string;
  created_by: number;
  created_at: string;
  executed_at: string | null;
  completed_at: string | null;
}

export interface OptimizationJobListItem extends OptimizationJob {}

export interface OptimizationPreviewSummary {
  total_actions: number;
  by_type: Record<string, number>;
  by_level: Record<string, number>;
  estimated_cost_savings: number;
}

export interface OptimizationExecuteSummary {
  total: number;
  success: number;
  failed: number;
  excluded: number;
}

export interface OptimizationPreviewResponse {
  job: OptimizationJob;
  actions: OptimizationAction[];
  summary: OptimizationPreviewSummary;
}

export interface OptimizationExecuteResponse {
  job: OptimizationJob;
  results: OptimizationAction[];
  summary: OptimizationExecuteSummary;
}

// AI 채팅 타입
export interface AiApiKeyStatus {
  is_configured: boolean;
  masked_key: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// 인증 타입
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "master" | "admin" | "staff";
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface UserCreate {
  email: string;
  password: string;
  name: string;
  role: "admin" | "staff";
}

export interface UserUpdate {
  name?: string;
  role?: string;
  password?: string;
}

export interface UploadResult {
  upload_id: number;
  filename: string;
  rows_processed: number;
  rows_inserted: number;
  rows_updated: number;
  columns_detected: string[];
  summary: {
    total_cost: number;
    total_revenue: number;
    total_conversions: number;
    roas: number;
  };
  actions_generated: number;
}

export interface NaverSyncResult {
  success: boolean;
  campaigns_count: number;
  adgroups_count: number;
  keywords_count: number;
  stats_rows_saved: number;
}

// ── SWR 훅 ──
const SWR_OPTIONS = {
  revalidateOnFocus: false,
  dedupingInterval: 60000,
  errorRetryCount: 2,
};

export function useDashboardSummary(storeId: number | null, date?: string) {
  return useSWR(
    storeId ? ["dashboard-summary", storeId, date] : null,
    () => api.getDashboardSummary(storeId!, date),
    SWR_OPTIONS
  );
}

export function useDashboardTrend(storeId: number | null, days: number) {
  return useSWR(
    storeId ? ["dashboard-trend", storeId, days] : null,
    () => api.getDashboardTrend(storeId!, days),
    SWR_OPTIONS
  );
}

export function useDashboardAlerts(storeId: number | null, date?: string) {
  return useSWR(
    storeId ? ["dashboard-alerts", storeId, date] : null,
    () => api.getDashboardAlerts(storeId!, date),
    SWR_OPTIONS
  );
}

export function useDailySummaries(storeId: number | null) {
  return useSWR(
    storeId ? ["daily-summaries", storeId] : null,
    async () => {
      const today = new Date();
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split("T")[0]);
      }
      return Promise.all(dates.map((date) => api.getDashboardSummary(storeId!, date)));
    },
    { ...SWR_OPTIONS, dedupingInterval: 120000 }
  );
}

export function useCampaignsWithDelta(storeId: number | null, period: number) {
  return useSWR(
    storeId ? ["campaigns-delta", storeId, period] : null,
    () => api.getCampaignsWithDelta(storeId!, period),
    SWR_OPTIONS
  );
}

export function useAdgroups(storeId: number | null) {
  return useSWR(
    storeId ? ["adgroups", storeId] : null,
    () => api.getAdgroups(storeId!),
    SWR_OPTIONS
  );
}

export function useAdgroupsWithDelta(storeId: number | null, campaign?: string, period = 7) {
  return useSWR(
    storeId ? ["adgroups-delta", storeId, campaign, period] : null,
    () => api.getAdgroupsWithDelta(storeId!, campaign, period),
    SWR_OPTIONS
  );
}

export function useBizMoney(storeId: number | null) {
  return useSWR(
    storeId ? ["bizmoney", storeId] : null,
    () => api.getBizMoney(storeId!),
    SWR_OPTIONS
  );
}

export function useQualityIndex(storeId: number | null) {
  return useSWR(
    storeId ? ["quality-index", storeId] : null,
    () => api.getQualityIndex(storeId!),
    SWR_OPTIONS
  );
}

export function useAdCreatives(storeId: number | null) {
  return useSWR(
    storeId ? ["ad-creatives", storeId] : null,
    () => api.getAdCreatives(storeId!),
    SWR_OPTIONS
  );
}

export function useAdExtensions(storeId: number | null) {
  return useSWR(
    storeId ? ["ad-extensions", storeId] : null,
    () => api.getAdExtensions(storeId!),
    SWR_OPTIONS
  );
}

export function useStoreComparison(days: number) {
  return useSWR(
    ["store-comparison", days],
    () => api.getStoreComparison(days),
    SWR_OPTIONS
  );
}
