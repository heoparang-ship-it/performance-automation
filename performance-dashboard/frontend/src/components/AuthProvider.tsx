"use client";

import { createContext, useContext, useMemo } from "react";
import { AuthUser } from "@/lib/api";

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const DUMMY_USER: AuthUser = {
  id: 1,
  email: "",
  name: "관리자",
  role: "master",
  created_at: "",
};

const Ctx = createContext<AuthCtx>({
  user: DUMMY_USER,
  loading: false,
  login: async () => {},
  logout: () => {},
  isAdmin: true,
});

export const useAuth = () => useContext(Ctx);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => ({
    user: DUMMY_USER,
    loading: false,
    login: async () => {},
    logout: () => {},
    isAdmin: true,
  }), []);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
