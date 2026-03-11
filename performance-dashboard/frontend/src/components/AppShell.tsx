"use client";

import StoreProvider from "./StoreProvider";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-60 overflow-auto">{children}</main>
      </div>
    </StoreProvider>
  );
}
