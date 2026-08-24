"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { PRODUCT_IDENTITY } from "@pasko-performance/core/product";
import type { ReadyAppContext } from "../../lib/app-context-core";

export function AppShell({
  children,
  context,
  demo,
  demoAvailable,
  trial,
}: {
  children: React.ReactNode;
  context: ReadyAppContext | null;
  demo: boolean;
  demoAvailable: boolean;
  trial: { expiresAt: string; daysRemaining: number } | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/setup") ||
    pathname.startsWith("/recover")
  ) {
    return <div className="content-full">{children}</div>;
  }

  const today = new Date().toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        organizationName={
          context?.organizationShortName ??
          context?.organizationName ??
          "Организация"
        }
      />
      <div className={`main ${collapsed ? "main-collapsed" : ""}`}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="hamburger"
              onClick={() => setMobileOpen(true)}
              aria-label="Открыть меню"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </button>
            <span className="topbar-brand">{PRODUCT_IDENTITY.canonical}</span>
          </div>
          <div className="topbar-right">
            {demo && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-900">ДЕМОНСТРАЦИОННЫЕ ДАННЫЕ</span>}
            {!demo && trial && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">TRIAL · до {trial.expiresAt} · {trial.daysRemaining} дн.</span>}
            {context && (
              <a href="/context" className="context-chip">
                <b>{context.teamName}</b>
                <span>{context.seasonName}</span>
              </a>
            )}
            <span className="topbar-date">{today}</span>
            <form action="/api/auth/logout">
              <button className="logout-btn" type="submit">
                Выйти
              </button>
            </form>
          </div>
        </header>
        <main className="content">{children}</main>
        <div className="mx-6 mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
          {demo ? <><b>PASKO Demo Volleyball</b><span className="mx-2 text-gray-300">·</span><span className="text-gray-500">Это вымышленная команда.</span><a href="/club-workspace" className="ml-4 font-semibold text-blue-700">Вернуться к клубу →</a></> : demoAvailable ? <a href="/api/demo-enter" className="font-semibold text-blue-700">Демо PASKO Performance →</a> : <span className="text-gray-500">Не удалось подготовить демонстрационные данные. Перезапустите приложение, чтобы повторить.</span>}
        </div>
        <footer className="footer">
          <div className="footer-line">
            <span className="footer-dot" />
            {PRODUCT_IDENTITY.display}
            <span className="footer-dot" />
          </div>
          <div className="footer-author">
            {PRODUCT_IDENTITY.creator.creditRu}
          </div>
        </footer>
      </div>
    </>
  );
}
