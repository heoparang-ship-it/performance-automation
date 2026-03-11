"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, Line, ComposedChart,
} from "recharts";
import {
  BarChart3, TrendingUp, AlertTriangle, Search, Lightbulb,
} from "lucide-react";
import {
  KpiSummary, ActionItem,
  useDashboardSummary, useDashboardTrend, useDashboardAlerts,
  useCampaignsWithDelta, useBizMoney, useQualityIndex,
  useAdCreatives, useAdExtensions,
} from "@/lib/api";
import { useStore } from "@/components/StoreProvider";
import Modal from "@/components/Modal";
import DeltaIndicator from "@/components/DeltaIndicator";
import DateRangePicker from "@/components/DateRangePicker";
import StatusBadge from "@/components/StatusBadge";
import BizMoneyBadge from "@/components/BizMoneyBadge";
import QualityIndexChart from "@/components/QualityIndexChart";
import AdCreativesSummaryView from "@/components/AdCreativesSummary";
import CollapsibleSection from "@/components/CollapsibleSection";
import { formatKRW, formatKRWShort, formatPct, formatNum } from "@/lib/format";

// Dynamic Import: 접을 수 있는 패널은 필요할 때만 로드
const KeywordToolPanel = dynamic(() => import("@/components/KeywordToolPanel"), {
  ssr: false,
  loading: () => <div className="text-xs text-gray-400 py-4 text-center">로딩 중...</div>,
});
const BidSimPanel = dynamic(() => import("@/components/BidSimPanel"), {
  ssr: false,
  loading: () => <div className="text-xs text-gray-400 py-4 text-center">로딩 중...</div>,
});

export default function AllInOnePage() {
  const { selectedStoreId, stores, hasLinkedStores, periodDays } = useStore();

  // SWR 훅으로 데이터 로드 (캐싱 + 중복 제거 자동)
  const { data: summary } = useDashboardSummary(selectedStoreId);
  const { data: trend } = useDashboardTrend(selectedStoreId, periodDays);
  const { data: alerts } = useDashboardAlerts(selectedStoreId);
  const { data: campaigns } = useCampaignsWithDelta(selectedStoreId, periodDays);
  const { data: bizmoney, isLoading: bizLoading, error: bizErr } = useBizMoney(selectedStoreId);
  const { data: qualityIndex, isLoading: qiLoading, error: qiErr } = useQualityIndex(selectedStoreId);
  const { data: adCreatives, isLoading: adsLoading, error: adsErr } = useAdCreatives(selectedStoreId);
  const { data: adExtensions, isLoading: extLoading } = useAdExtensions(selectedStoreId);

  const loading = !summary && !!selectedStoreId;
  const bizError = !!bizErr;
  const qiError = !!qiErr;
  const adsError = !!adsErr;

  const [showAlertModal, setShowAlertModal] = useState(false);

  const currentStoreName = useMemo(
    () => stores.find((s) => s.id === selectedStoreId)?.name ?? "전체 종합",
    [stores, selectedStoreId]
  );

  const alertsList = alerts ?? [];
  const campaignsList = campaigns ?? [];
  const trendList = trend ?? [];

  const sortedCampaigns = useMemo(
    () => [...campaignsList].sort((a, b) => b.cost - a.cost),
    [campaignsList]
  );
  const highAlerts = useMemo(
    () => alertsList.filter((a) => a.level === "HIGH"),
    [alertsList]
  );
  const mediumAlerts = useMemo(
    () => alertsList.filter((a) => a.level === "MEDIUM"),
    [alertsList]
  );

  if (!hasLinkedStores) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="text-5xl text-emerald-400"><BarChart3 className="w-12 h-12 mx-auto" /></div>
          <h2 className="text-xl font-bold text-gray-100">데이터가 없습니다</h2>
          <p className="text-sm text-gray-400">
            설정에서 광고주를 연결하면<br />실시간 성과 데이터를 확인할 수 있습니다.
          </p>
          <Link
            href="/settings"
            className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
          >
            광고주 연결하기
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">전체 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  const trendForChart = trendList.map((t) => ({
    ...t,
    date: t.date.slice(5),
    광고비: t.cost,
    매출: t.revenue,
    클릭수: t.clicks,
  }));

  const healthMetrics = summary ? getHealthMetrics(summary) : [];

  return (
    <div className="p-4 max-w-[1400px] overflow-y-auto h-[calc(100vh)]">
      {/* ─── 헤더 ─── */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-black text-gray-100 tracking-tight">
            {currentStoreName} — 전체 종합
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {summary?.date ? `${summary.date} 기준` : ""} · 모든 데이터를 한눈에
          </p>
        </div>
        <DateRangePicker />
      </div>

      {/* ─── 비즈머니 배너 ─── */}
      <div className="mb-3">
        <BizMoneyBadge
          bizmoney={bizmoney?.bizmoney ?? 0}
          budgetLock={bizmoney?.budget_lock ?? 0}
          loading={bizLoading}
          error={bizError}
        />
      </div>

      {/* ─── KPI 스트립 (6컬럼) ─── */}
      <div className="grid grid-cols-6 gap-2 mb-3">
        <CompactKpi title="광고비" value={formatKRW(summary?.cost ?? 0)} delta={summary?.deltas?.cost} inverseDelta />
        <CompactKpi title="매출액" value={formatKRW(summary?.revenue ?? 0)} delta={summary?.deltas?.revenue} />
        <CompactKpi title="ROAS" value={formatPct(summary?.roas ?? 0)} delta={summary?.deltas?.roas} />
        <CompactKpi title="전환수" value={formatNum(summary?.conversions ?? 0) + "건"} delta={summary?.deltas?.conversions} />
        <CompactKpi title="클릭수" value={formatNum(summary?.clicks ?? 0) + "회"} delta={summary?.deltas?.clicks} />
        <CompactKpi title="CTR" value={formatPct(summary?.ctr ?? 0)} delta={summary?.deltas?.ctr} />
      </div>

      {/* ─── 메인 그리드 ─── */}
      <div className="grid grid-cols-5 gap-3 mb-3">
        {/* 왼쪽 3/5 */}
        <div className="col-span-3 flex flex-col gap-3">
          {/* 추이 차트 */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-3 shadow-md shadow-black/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-200">{periodDays}일 추이</h3>
              <div className="flex gap-3 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full" />광고비</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-300 rounded-full" />매출</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full" />클릭수</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <ComposedChart data={trendForChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#6b7280" axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tickFormatter={(v) => formatKRWShort(v)} tick={{ fontSize: 9 }} stroke="#6b7280" axisLine={false} tickLine={false} width={45} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} stroke="#6b7280" axisLine={false} tickLine={false} width={30} hide />
                <Tooltip formatter={(v: number, name: string) => name === "클릭수" ? formatNum(v) : formatKRW(v)} contentStyle={{ borderRadius: 8, border: "1px solid #374151", fontSize: 11, padding: "6px 10px", backgroundColor: "#1f2937", color: "#e5e7eb" }} />
                <Area yAxisId="left" type="monotone" dataKey="광고비" fill="#10b98120" stroke="#10b981" strokeWidth={1.5} />
                <Area yAxisId="left" type="monotone" dataKey="매출" fill="#6ee7b720" stroke="#6ee7b7" strokeWidth={1.5} />
                <Line yAxisId="right" type="monotone" dataKey="클릭수" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 캠페인 성과 테이블 */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-3 shadow-md shadow-black/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-200">
                캠페인 성과
                <span className="ml-1.5 text-[10px] font-normal text-gray-400">{periodDays}일 기준</span>
              </h3>
            </div>
            <div className="overflow-auto max-h-[280px]">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-gray-900">
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="text-left py-1.5 px-2 font-medium">캠페인</th>
                    <th className="text-right py-1.5 px-2 font-medium">광고비</th>
                    <th className="text-right py-1.5 px-2 font-medium">클릭</th>
                    <th className="text-right py-1.5 px-2 font-medium">CTR</th>
                    <th className="text-right py-1.5 px-2 font-medium">전환</th>
                    <th className="text-right py-1.5 px-2 font-medium">ROAS</th>
                    <th className="text-right py-1.5 px-2 font-medium">변화</th>
                    <th className="text-center py-1.5 px-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCampaigns.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-4 text-gray-400">캠페인 데이터가 없습니다</td></tr>
                  ) : sortedCampaigns.map((c, i) => (
                    <tr key={i} className="border-b border-gray-800 hover:bg-gray-800">
                      <td className="py-1.5 px-2 font-medium text-gray-100 truncate max-w-[160px]">{c.campaign_name || "(미분류)"}</td>
                      <td className="py-1.5 px-2 text-right text-gray-300">{formatKRWShort(c.cost)}</td>
                      <td className="py-1.5 px-2 text-right text-gray-300">{formatNum(c.clicks)}</td>
                      <td className="py-1.5 px-2 text-right text-gray-300">{c.ctr.toFixed(1)}%</td>
                      <td className="py-1.5 px-2 text-right text-gray-300">{formatNum(c.conversions)}</td>
                      <td className={`py-1.5 px-2 text-right font-bold ${c.roas >= 200 ? "text-emerald-400" : c.roas > 0 ? "text-red-400" : "text-gray-400"}`}>
                        {c.roas > 0 ? c.roas.toFixed(0) + "%" : "-"}
                      </td>
                      <td className="py-1.5 px-2 text-right"><DeltaIndicator value={c.deltas?.roas} /></td>
                      <td className="py-1.5 px-2 text-center"><StatusBadge roas={c.roas} clicks={c.clicks} conversions={c.conversions} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 오른쪽 2/5 */}
        <div className="col-span-2 flex flex-col gap-3">
          {/* 계정 건강도 */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-3 shadow-md shadow-black/20">
            <h3 className="text-xs font-bold text-gray-200 mb-2">계정 건강도</h3>
            <div className="grid grid-cols-3 gap-2">
              {healthMetrics.map((m) => (
                <div key={m.label} className={`rounded-lg p-2 text-center ${m.bgColor}`}>
                  <p className="text-[10px] text-gray-400 mb-0.5">{m.label}</p>
                  <p className="text-sm font-bold text-gray-100">{m.value}</p>
                  <span className={`text-[10px] font-medium ${m.badgeColor}`}>{m.badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 품질지수 분포 */}
          <QualityIndexChart
            distribution={qualityIndex?.distribution ?? { high: 0, medium: 0, low: 0, total: 0 }}
            details={qualityIndex?.details ?? []}
            loading={qiLoading}
            error={qiError}
          />

          {/* 광고소재 현황 */}
          <AdCreativesSummaryView
            data={adCreatives ?? null}
            loading={adsLoading}
            error={adsError}
          />

          {/* 긴급 알림 */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-3 shadow-md shadow-black/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-200">알림 요약</h3>
              {alertsList.length > 0 && (
                <button onClick={() => setShowAlertModal(true)} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium">
                  전체 {alertsList.length}건
                </button>
              )}
            </div>
            {alertsList.length === 0 ? (
              <p className="text-xs text-gray-400">알림이 없습니다</p>
            ) : (
              <div className="space-y-1">
                {highAlerts.length > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-gray-300"><div className="w-2 h-2 rounded-full bg-red-400" /> HIGH</span>
                    <span className="font-medium text-red-400">{highAlerts.length}건</span>
                  </div>
                )}
                {mediumAlerts.length > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-gray-300"><div className="w-2 h-2 rounded-full bg-amber-400" /> MEDIUM</span>
                    <span className="font-medium text-amber-400">{mediumAlerts.length}건</span>
                  </div>
                )}
                {alertsList.filter(a => a.level === "LOW").length > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-gray-300"><div className="w-2 h-2 rounded-full bg-emerald-400" /> LOW</span>
                    <span className="font-medium text-emerald-400">{alertsList.filter(a => a.level === "LOW").length}건</span>
                  </div>
                )}
                {/* 상위 2개 HIGH 알림 미리보기 */}
                {highAlerts.slice(0, 2).map((a) => (
                  <div key={a.id} className="flex items-start gap-2 p-1.5 rounded bg-red-950/30 text-[10px] mt-1">
                    <span className="text-red-400 mt-0.5">{"\u25CF"}</span>
                    <div className="min-w-0">
                      <p className="text-gray-400 truncate">{a.campaign} &gt; {a.adgroup}</p>
                      <p className="text-emerald-400 font-medium">{a.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 확장소재 요약 (간략) */}
          {adExtensions && adExtensions.total > 0 && (
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-3 shadow-md shadow-black/20">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">확장소재 현황</p>
              <div className="space-y-1">
                {Object.entries(adExtensions.by_type).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300">{type}</span>
                    <span className="font-medium text-gray-200">{count}개</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">총 {adExtensions.total}개</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── 접이식 섹션 ─── */}
      <div className="space-y-2 mb-8">
        <CollapsibleSection title="키워드 도구 — 검색량/경쟁도 조회" icon={<Search className="w-4 h-4" />}>
          {selectedStoreId && <KeywordToolPanel storeId={selectedStoreId} />}
        </CollapsibleSection>

        <CollapsibleSection title="입찰 시뮬레이션" icon={<Lightbulb className="w-4 h-4" />}>
          {selectedStoreId && <BidSimPanel storeId={selectedStoreId} />}
        </CollapsibleSection>
      </div>

      {/* 모달 */}
      <Modal isOpen={showAlertModal} onClose={() => setShowAlertModal(false)} title="전체 액션 추천" size="lg">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {alertsList.map((a) => (
            <AlertRow key={a.id} alert={a} />
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ── 컴팩트 KPI ──
function CompactKpi({ title, value, delta, inverseDelta }: { title: string; value: string; delta?: number | null; inverseDelta?: boolean }) {
  const getDeltaColor = () => {
    if (delta == null) return "";
    const isPositive = inverseDelta ? delta < 0 : delta > 0;
    const isNegative = inverseDelta ? delta > 0 : delta < 0;
    if (isPositive) return "text-emerald-400";
    if (isNegative) return "text-red-400";
    return "text-gray-400";
  };
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 px-3 py-2.5 shadow-md shadow-black/20 hover:shadow-lg hover:shadow-black/30 transition-shadow">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{title}</p>
      <p className="text-base font-black text-gray-100 mt-0.5 tracking-tight">{value}</p>
      {delta != null && (
        <span className={`text-[10px] font-medium ${getDeltaColor()}`}>
          {delta > 0 ? "\u25B2" : delta < 0 ? "\u25BC" : "\u2500"} {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

// ── 계정 건강도 ──
interface HealthMetric { label: string; value: string; badge: string; bgColor: string; badgeColor: string; }

function getHealthMetrics(summary: KpiSummary): HealthMetric[] {
  const roas = summary.roas;
  const ctr = summary.ctr;
  const convRate = summary.clicks > 0 ? (summary.conversions / summary.clicks) * 100 : 0;

  const roasH = roas >= 300 ? { badge: "우수", bgColor: "bg-emerald-950/30", badgeColor: "text-emerald-400" }
    : roas >= 200 ? { badge: "양호", bgColor: "bg-emerald-950/20", badgeColor: "text-emerald-400" }
    : roas >= 100 ? { badge: "보통", bgColor: "bg-amber-950/20", badgeColor: "text-amber-400" }
    : { badge: "위험", bgColor: "bg-red-950/20", badgeColor: "text-red-400" };

  const ctrH = ctr >= 4 ? { badge: "우수", bgColor: "bg-emerald-950/30", badgeColor: "text-emerald-400" }
    : ctr >= 2 ? { badge: "양호", bgColor: "bg-emerald-950/20", badgeColor: "text-emerald-400" }
    : ctr >= 1 ? { badge: "보통", bgColor: "bg-amber-950/20", badgeColor: "text-amber-400" }
    : { badge: "위험", bgColor: "bg-red-950/20", badgeColor: "text-red-400" };

  const convH = convRate >= 3 ? { badge: "우수", bgColor: "bg-emerald-950/30", badgeColor: "text-emerald-400" }
    : convRate >= 1 ? { badge: "양호", bgColor: "bg-emerald-950/20", badgeColor: "text-emerald-400" }
    : convRate >= 0.5 ? { badge: "보통", bgColor: "bg-amber-950/20", badgeColor: "text-amber-400" }
    : { badge: "위험", bgColor: "bg-red-950/20", badgeColor: "text-red-400" };

  return [
    { label: "ROAS", value: formatPct(roas), ...roasH },
    { label: "CTR", value: formatPct(ctr), ...ctrH },
    { label: "전환율", value: convRate.toFixed(1) + "%", ...convH },
  ];
}

// ── 알림 행 ──
function AlertRow({ alert }: { alert: ActionItem }) {
  const levelConfig = {
    HIGH: { bg: "bg-red-950/30", badge: "bg-red-900/50 text-red-300", dot: "bg-red-400" },
    MEDIUM: { bg: "bg-amber-950/30", badge: "bg-amber-900/50 text-amber-300", dot: "bg-amber-400" },
    LOW: { bg: "bg-emerald-950/30", badge: "bg-emerald-900/50 text-emerald-300", dot: "bg-emerald-400" },
  }[alert.level] || { bg: "bg-gray-800", badge: "bg-gray-700 text-gray-300", dot: "bg-gray-400" };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${levelConfig.bg}`}>
      <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${levelConfig.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${levelConfig.badge}`}>{alert.level}</span>
          <span className="text-xs text-gray-400 truncate">{alert.campaign} &gt; {alert.adgroup}</span>
        </div>
        <p className="text-xs text-gray-300">{alert.reason}</p>
        <p className="text-xs text-emerald-400 font-medium mt-0.5">{alert.action}</p>
      </div>
    </div>
  );
}
