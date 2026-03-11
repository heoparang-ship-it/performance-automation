"use client";

import { formatKRW } from "@/lib/format";
import { Wallet, AlertTriangle, AlertCircle } from "lucide-react";

interface BizMoneyBadgeProps {
  bizmoney: number;
  budgetLock: number;
  loading?: boolean;
  error?: boolean;
}

export default function BizMoneyBadge({ bizmoney, budgetLock, loading, error }: BizMoneyBadgeProps) {
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 animate-pulse">
        <div className="h-5 bg-gray-700 rounded w-48" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 text-sm text-gray-400">
        비즈머니 정보를 불러올 수 없습니다
      </div>
    );
  }

  const available = bizmoney - budgetLock;
  const level =
    available >= 500_000 ? "safe" :
    available >= 100_000 ? "warning" :
    "danger";

  const colors = {
    safe: { bg: "bg-emerald-950/30", border: "border-emerald-700", text: "text-emerald-400", bar: "bg-emerald-500", icon: "text-emerald-400" },
    warning: { bg: "bg-amber-950/30", border: "border-amber-700", text: "text-amber-400", bar: "bg-amber-500", icon: "text-amber-400" },
    danger: { bg: "bg-red-950/30", border: "border-red-700", text: "text-red-400", bar: "bg-red-500", icon: "text-red-400" },
  }[level];

  // 게이지: bizmoney 중 available 비율
  const pct = bizmoney > 0 ? Math.round((available / bizmoney) * 100) : 0;

  return (
    <div className={`${colors.bg} rounded-lg border ${colors.border} px-4 py-3 flex items-center gap-4`}>
      <span className={`${colors.icon}`}>
        {level === "safe" ? <Wallet className="w-5 h-5" /> : level === "warning" ? <AlertTriangle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-400">비즈머니 잔액</span>
          <span className={`text-sm font-bold ${colors.text}`}>
            {formatKRW(available)}
          </span>
          {budgetLock > 0 && (
            <span className="text-[10px] text-gray-400">
              (예약 {formatKRW(budgetLock)})
            </span>
          )}
        </div>
        <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bar} rounded-full transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className={`text-xs font-medium ${colors.text}`}>{pct}%</span>
    </div>
  );
}
