"use client";

import { Fragment } from "react";
import Modal from "./Modal";
import { OptimizationAction, OptimizationPreviewSummary } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  actions: OptimizationAction[];
  excludedIds: Set<number>;
  summary: OptimizationPreviewSummary;
  loading: boolean;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  keyword_pause: "키워드 일시중지",
  bid_down: "입찰가 하향",
  bid_up: "입찰가 상향",
  add_negative_keyword: "제외키워드 등록",
};

export default function OptimizationConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  actions,
  excludedIds,
  summary,
  loading,
}: Props) {
  const activeActions = actions.filter((a) => !excludedIds.has(a.id));
  const activeByType: Record<string, number> = {};
  for (const a of activeActions) {
    activeByType[a.action_type] = (activeByType[a.action_type] || 0) + 1;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="최적화 실행 확인" size="md">
      <div className="space-y-4">
        <div className="bg-amber-950/20 border border-amber-700 rounded-lg p-4">
          <p className="text-sm text-amber-300 font-medium">
            아래 변경사항이 네이버 검색광고에 즉시 반영됩니다.
          </p>
          <p className="text-xs text-amber-400 mt-1">
            실행 후에는 네이버 광고 관리 시스템에서 직접 되돌려야 합니다.
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-bold text-gray-200">실행 요약</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-400">총 액션</div>
            <div className="font-medium">{activeActions.length}건</div>
            {Object.entries(activeByType).map(([type, count]) => (
              <Fragment key={type}>
                <div className="text-gray-400">
                  {ACTION_TYPE_LABELS[type] || type}
                </div>
                <div className="font-medium">{count}건</div>
              </Fragment>
            ))}
            {excludedIds.size > 0 && (
              <>
                <div className="text-gray-400">제외됨</div>
                <div className="text-gray-400">{excludedIds.size}건</div>
              </>
            )}
          </div>
          {summary.estimated_cost_savings > 0 && (
            <div className="pt-2 border-t border-gray-700 mt-2">
              <span className="text-xs text-gray-400">예상 절감 광고비: </span>
              <span className="text-sm font-bold text-emerald-400">
                {summary.estimated_cost_savings.toLocaleString()}원
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors text-gray-300"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? "실행 중..." : `${activeActions.length}건 실행`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
