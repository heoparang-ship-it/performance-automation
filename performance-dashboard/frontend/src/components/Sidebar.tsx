"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "./StoreProvider";
import { BarChart3, TrendingUp, Zap, Settings, Users } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "대시보드", icon: BarChart3 },
  { href: "/ads", label: "광고 관리", icon: TrendingUp },
  { href: "/optimize", label: "자동 최적화", icon: Zap },
  { href: "/settings", label: "설정", icon: Settings },
];

const ADMIN_ITEMS = [
  { href: "/users", label: "담당자 관리", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { stores, selectedStoreId, setSelectedStoreId } = useStore();

  const allNavItems = [...NAV_ITEMS, ...ADMIN_ITEMS];

  return (
    <aside className="fixed left-0 top-0 w-60 h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col z-30">
      {/* 로고 */}
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-black text-sm">P</div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">퍼포먼스 자동화</h1>
            <p className="text-[10px] text-slate-400 -mt-0.5">Automation System</p>
          </div>
        </div>
      </div>

      {/* 광고주 선택기 */}
      <div className="px-4 py-3 border-b border-slate-700">
        <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wider">
          광고주
        </label>
        {stores.length === 0 ? (
          <Link
            href="/settings"
            className="block w-full text-center text-sm px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            광고주 연결
          </Link>
        ) : (
          <select
            className="w-full text-sm border border-slate-600 rounded-lg px-3 py-2 bg-slate-700 text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            value={selectedStoreId ?? ""}
            onChange={(e) => setSelectedStoreId(Number(e.target.value))}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {allNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all ${
                isActive
                  ? "bg-emerald-600 text-white font-medium shadow-lg shadow-emerald-500/20"
                  : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 하단 상태 */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          시스템 연동 중
        </div>
      </div>
    </aside>
  );
}
