"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Shield, Pencil, Trash2 } from "lucide-react";
import { api, AuthUser, UserCreate } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

const ROLE_LABELS: Record<string, string> = {
  master: "마스터",
  admin: "관리자",
  staff: "담당자",
};

const ROLE_COLORS: Record<string, string> = {
  master: "bg-purple-950/40 text-purple-400 border-purple-700",
  admin: "bg-emerald-950/40 text-emerald-400 border-emerald-700",
  staff: "bg-gray-800 text-gray-200 border-gray-700",
};

export default function UsersPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState<UserCreate>({
    email: "",
    password: "",
    name: "",
    role: "staff",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // 편집 모달
  const [editUser, setEditUser] = useState<AuthUser | null>(null);
  const [editRole, setEditRole] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      return;
    }
    loadUsers();
  }, [isAdmin, router]);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.createUser(formData);
      setShowCreate(false);
      setFormData({ email: "", password: "", name: "", role: "staff" });
      loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId: number) => {
    try {
      await api.updateUser(userId, { role: editRole });
      setEditUser(null);
      loadUsers();
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" 사용자를 삭제하시겠습니까?`)) return;
    try {
      await api.deleteUser(id);
      loadUsers();
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            담당자 관리
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            담당자 계정을 생성하고 권한을 관리합니다
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1.5"
        >
          <UserPlus className="w-4 h-4" />
          담당자 추가
        </button>
      </div>

      {/* 사용자 목록 */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 border-b border-gray-700">
              <th className="text-left px-5 py-3 font-medium text-gray-400">이름</th>
              <th className="text-left px-5 py-3 font-medium text-gray-400">이메일</th>
              <th className="text-left px-5 py-3 font-medium text-gray-400">역할</th>
              <th className="text-left px-5 py-3 font-medium text-gray-400">생성일</th>
              <th className="text-right px-5 py-3 font-medium text-gray-400">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-gray-100">
                  {u.name}
                </td>
                <td className="px-5 py-3.5 text-gray-300">{u.email}</td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${
                      ROLE_COLORS[u.role] || ROLE_COLORS.staff
                    }`}
                  >
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-400">
                  {new Date(u.created_at).toLocaleDateString("ko-KR")}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {u.role !== "master" && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditUser(u);
                          setEditRole(u.role);
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        역할 변경
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.name)}
                        className="text-xs text-red-400 hover:text-red-300 font-medium flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        삭제
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            등록된 사용자가 없습니다
          </div>
        )}
      </div>

      {/* 생성 모달 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-700">
            <h2 className="text-lg font-bold text-gray-100 mb-4">
              담당자 추가
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  이름
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="홍길동"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  이메일
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  비밀번호
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="비밀번호"
                  required
                  minLength={4}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  역할
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as "admin" | "staff",
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  <option value="staff">담당자</option>
                  <option value="admin">관리자</option>
                </select>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-950/30 rounded-lg p-2 border border-red-800">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setError("");
                  }}
                  className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "생성 중..." : "생성"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 역할 변경 모달 */}
      {editUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-gray-700">
            <h2 className="text-lg font-bold text-gray-100 mb-1">
              역할 변경
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              {editUser.name} ({editUser.email})
            </p>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none mb-4"
            >
              <option value="staff">담당자</option>
              <option value="admin">관리자</option>
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => setEditUser(null)}
                className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-200 hover:bg-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleRoleChange(editUser.id)}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                변경
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
