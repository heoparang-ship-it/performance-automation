"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/components/StoreProvider";
import OptimizationConfirmModal from "@/components/OptimizationConfirmModal";
import {
  api,
  OptimizationAction,
  OptimizationJob,
  OptimizationPreviewSummary,
  OptimizationExecuteSummary,
  OptimizationJobListItem,
} from "@/lib/api";

type Tab = "preview" | "history";

const ACTION_TYPE_LABELS: Record<string, string> = {
  keyword_pause: "키워드 중지",
  bid_down: "입찰 하향",
  bid_up: "입찰 상향",
  add_negative_keyword: "제외키워드",
};

const ACTION_TYPE_COLORS: Record<string, string> = {
  keyword_pause: "bg-red-100 text-red-700",
  bid_down: "bg-orange-100 text-orange-700",
  bid_up: "bg-emerald-100 text-emerald-700",
  add_negative_keyword: "bg-purple-100 text-purple-700",
};

const LEVEL_COLORS: Record<string, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-blue-500",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  excluded: "제외",
  success: "성공",
  failed: "실패",
  preview: "미리보기",
  executing: "실행 중",
  completed: "완료",
  partial: "부분 완료",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-gray-500",
  approved: "text-blue-600",
  excluded: "text-gray-400",
  success: "text-emerald-600",
  failed: "text-red-600",
  preview: "text-blue-500",
  executing: "text-amber-500",
  completed: "text-emerald-600",
  partial: "text-orange-500",
};

function formatValue(val: Record<string, unknown> | null): string {
  if (!val) return "-";
  if (val.bid_amount != null) return `${Number(val.bid_amount).toLocaleString()}원`;
  if (val.status != null) return val.status === "PAUSED" ? "일시중지" : "활성";
  return JSON.stringify(val);
}

export default function OptimizePage() {
  const { selectedStoreId } = useStore();

  // 탭
  const [tab, setTab] = useState<Tab>("preview");

  // 분석
  const [periodDays, setPeriodDays] = useState(14);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 미리보기 결과
  const [job, setJob] = useState<OptimizationJob | null>(null);
  const [actions, setActions] = useState<OptimizationAction[]>([]);
  const [summary, setSummary] = useState<OptimizationPreviewSummary | null>(null);

  // 제외 선택
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());

  // 실행
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<OptimizationExecuteSummary | null>(null);

  // 히스토리
  const [history, setHistory] = useState<OptimizationJobListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const [expandedActions, setExpandedActions] = useState<OptimizationAction[]>([]);

  // 히스토리 로드
  useEffect(() => {
    if (tab === "history" && selectedStoreId) {
      loadHistory();
    }
  }, [tab, selectedStoreId]);

  async function loadHistory() {
    if (!selectedStoreId) return;
    setHistoryLoading(true);
    try {
      const jobs = await api.getOptimizationJobs(selectedStoreId);
      setHistory(jobs);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!selectedStoreId) return;
    setAnalyzing(true);
    setError(null);
    setJob(null);
    setActions([]);
    setSummary(null);
    setExcludedIds(new Set());
    setExecuteResult(null);

    try {
      const res = await api.previewOptimization(selectedStoreId, periodDays);
      setJob(res.job);
      setActions(res.actions);
      setSummary(res.summary);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleExclude(id: number) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllExclude() {
    if (excludedIds.size === actions.length) {
      setExcludedIds(new Set());
    } else {
      setExcludedIds(new Set(actions.map((a) => a.id)));
    }
  }

  async function handleExecute() {
    if (!job) return;
    setExecuting(true);
    try {
      const res = await api.executeOptimization(job.id, Array.from(excludedIds));
      setExecuteResult(res.summary);
      setActions(res.results);
      setJob(res.job);
      setConfirmOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "실행 중 오류가 발생했습니다.");
      setConfirmOpen(false);
    } finally {
      setExecuting(false);
    }
  }

  async function toggleExpandJob(jobId: number) {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      setExpandedActions([]);
      return;
    }
    setExpandedJobId(jobId);
    try {
      const detail = await api.getOptimizationJobDetail(jobId);
      setExpandedActions(detail.actions);
    } catch {
      setExpandedActions([]);
    }
  }

  if (!selectedStoreId) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">좌측에서 광고주를 선택해주세요.</p>
      </div>
    );
  }

  const activeCount = actions.length - excludedIds.size;
  const isExecuted = job && ["completed", "partial", "failed"].includes(job.status);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">자동 최적화</h1>
          <p className="text-sm text-gray-500 mt-1">
            성과 분석 후 입찰가 조정, 키워드 일시중지를 자동 실행합니다
          </p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("preview")}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            tab === "preview"
              ? "bg-white text-gray-900 font-medium shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          분석 & 실행
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            tab === "history"
              ? "bg-white text-gray-900 font-medium shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          히스토리
        </button>
      </div>

      {tab === "preview" && (
        <>
          {/* 분석 컨트롤 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className="block text-xs text-gray-500 mb-1">분석 기간</label>
                <select
                  value={periodDays}
                  onChange={(e) => setPeriodDays(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  disabled={analyzing}
                >
                  <option value={7}>최근 7일</option>
                  <option value={14}>최근 14일</option>
                  <option value={30}>최근 30일</option>
                </select>
              </div>
              <div className="pt-4">
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {analyzing ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      분석 중...
                    </span>
                  ) : (
                    "분석 실행"
                  )}
                </button>
              </div>
            </div>
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* 실행 결과 배너 */}
          {executeResult && (
            <div className={`rounded-xl border p-4 ${
              executeResult.failed === 0
                ? "bg-emerald-50 border-emerald-200"
                : "bg-amber-50 border-amber-200"
            }`}>
              <p className={`text-sm font-medium ${
                executeResult.failed === 0 ? "text-emerald-800" : "text-amber-800"
              }`}>
                실행 완료: 성공 {executeResult.success}건
                {executeResult.failed > 0 && `, 실패 ${executeResult.failed}건`}
                {executeResult.excluded > 0 && `, 제외 ${executeResult.excluded}건`}
              </p>
            </div>
          )}

          {/* 요약 카드 */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard
                label="총 액션"
                value={`${summary.total_actions}건`}
                color="text-gray-900"
              />
              <SummaryCard
                label="입찰 하향"
                value={`${(summary.by_type["bid_down"] || 0) + (summary.by_type["keyword_pause"] || 0)}건`}
                color="text-orange-600"
              />
              <SummaryCard
                label="입찰 상향"
                value={`${summary.by_type["bid_up"] || 0}건`}
                color="text-emerald-600"
              />
              <SummaryCard
                label="예상 절감"
                value={`${summary.estimated_cost_savings.toLocaleString()}원`}
                color="text-blue-600"
              />
            </div>
          )}

          {/* 액션 테이블 */}
          {actions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {!isExecuted && (
                        <th className="px-3 py-3 text-left w-10">
                          <input
                            type="checkbox"
                            checked={excludedIds.size === 0}
                            onChange={toggleAllExclude}
                            className="rounded border-gray-300"
                            title="전체 선택/해제"
                          />
                        </th>
                      )}
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">우선</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">대상</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">액션</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">변경</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">성과</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">사유</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {actions.map((action) => {
                      const isExcluded = excludedIds.has(action.id);
                      return (
                        <tr
                          key={action.id}
                          className={`hover:bg-gray-50 ${isExcluded ? "opacity-40" : ""}`}
                        >
                          {!isExecuted && (
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={!isExcluded}
                                onChange={() => toggleExclude(action.id)}
                                className="rounded border-gray-300"
                              />
                            </td>
                          )}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${LEVEL_COLORS[action.level] || "bg-gray-400"}`}
                              />
                              <span className="text-xs text-gray-500">P{action.priority}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="max-w-[200px]">
                              {action.campaign_name && (
                                <div className="text-[10px] text-gray-400 truncate">
                                  {action.campaign_name}
                                </div>
                              )}
                              {action.adgroup_name && (
                                <div className="text-[10px] text-gray-400 truncate">
                                  {action.adgroup_name}
                                </div>
                              )}
                              {action.keyword_text && (
                                <div className="text-xs font-medium text-gray-700 truncate">
                                  {action.keyword_text}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                ACTION_TYPE_COLORS[action.action_type] || "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {ACTION_TYPE_LABELS[action.action_type] || action.action_type}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            <span className="text-gray-500">{formatValue(action.before_value)}</span>
                            <span className="mx-1 text-gray-300">&rarr;</span>
                            <span className="font-medium text-gray-800">{formatValue(action.after_value)}</span>
                            {action.change_pct != null && (
                              <span className={`ml-1 text-[10px] ${action.change_pct < 0 ? "text-red-500" : "text-emerald-500"}`}>
                                ({action.change_pct > 0 ? "+" : ""}{action.change_pct}%)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {action.context ? (
                              <div className="text-[10px] text-gray-500 space-y-0.5">
                                <div>클릭 {action.context.clicks} | 전환 {action.context.conversions}</div>
                                <div>
                                  광고비 {action.context.cost.toLocaleString()}원
                                  {action.context.roas > 0 && ` | ROAS ${action.context.roas.toFixed(0)}%`}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-xs text-gray-600 max-w-[180px] truncate" title={action.reason}>
                              {action.reason}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`text-xs font-medium ${STATUS_COLORS[action.status] || "text-gray-500"}`}>
                              {STATUS_LABELS[action.status] || action.status}
                            </span>
                            {action.error_message && (
                              <div className="text-[10px] text-red-500 mt-0.5 truncate max-w-[120px]" title={action.error_message}>
                                {action.error_message}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 하단 실행 바 */}
              {!isExecuted && actions.length > 0 && (
                <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    {activeCount}건 실행 예정
                    {excludedIds.size > 0 && (
                      <span className="text-gray-400"> ({excludedIds.size}건 제외)</span>
                    )}
                  </div>
                  <button
                    onClick={() => setConfirmOpen(true)}
                    disabled={activeCount === 0}
                    className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    승인 후 실행
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 분석 전 안내 */}
          {!analyzing && actions.length === 0 && !error && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="text-lg font-semibold text-gray-700">분석을 시작하세요</h3>
              <p className="text-sm text-gray-500 mt-1">
                기간을 선택하고 &quot;분석 실행&quot; 버튼을 눌러 최적화 제안을 확인합니다
              </p>
            </div>
          )}
        </>
      )}

      {tab === "history" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {historyLoading ? (
            <div className="p-8 text-center text-gray-500">불러오는 중...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-gray-500">실행 히스토리가 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {history.map((hJob) => (
                <div key={hJob.id}>
                  <button
                    onClick={() => toggleExpandJob(hJob.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-medium ${STATUS_COLORS[hJob.status] || "text-gray-500"}`}>
                        {STATUS_LABELS[hJob.status] || hJob.status}
                      </span>
                      <span className="text-sm text-gray-700">
                        {hJob.analysis_period_start} ~ {hJob.analysis_period_end}
                      </span>
                      <span className="text-xs text-gray-400">
                        총 {hJob.total_actions}건
                        {hJob.executed_actions > 0 && ` | 성공 ${hJob.executed_actions}건`}
                        {hJob.failed_actions > 0 && ` | 실패 ${hJob.failed_actions}건`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {new Date(hJob.created_at).toLocaleString("ko-KR")}
                      </span>
                      <span className="text-gray-400">{expandedJobId === hJob.id ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  {expandedJobId === hJob.id && (
                    <div className="px-5 pb-4">
                      {expandedActions.length === 0 ? (
                        <p className="text-sm text-gray-400">로딩 중...</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="px-2 py-2 text-left text-gray-500">대상</th>
                                <th className="px-2 py-2 text-left text-gray-500">액션</th>
                                <th className="px-2 py-2 text-left text-gray-500">변경</th>
                                <th className="px-2 py-2 text-left text-gray-500">상태</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {expandedActions.map((a) => (
                                <tr key={a.id}>
                                  <td className="px-2 py-2 text-gray-700">
                                    {a.keyword_text || a.adgroup_name || a.campaign_name || "-"}
                                  </td>
                                  <td className="px-2 py-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ACTION_TYPE_COLORS[a.action_type] || "bg-gray-100 text-gray-600"}`}>
                                      {ACTION_TYPE_LABELS[a.action_type] || a.action_type}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 text-gray-500">
                                    {formatValue(a.before_value)} → {formatValue(a.after_value)}
                                  </td>
                                  <td className="px-2 py-2">
                                    <span className={`font-medium ${STATUS_COLORS[a.status] || "text-gray-500"}`}>
                                      {STATUS_LABELS[a.status] || a.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 확인 모달 */}
      {summary && (
        <OptimizationConfirmModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleExecute}
          actions={actions}
          excludedIds={excludedIds}
          summary={summary}
          loading={executing}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
