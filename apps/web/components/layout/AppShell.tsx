'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { PRODUCT_IDENTITY } from '@pasko-performance/core/product';

export function AppShell({ children, organizationName }: { children: React.ReactNode; organizationName: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  if (pathname.startsWith('/login')) {
    return <div className="content-full">{children}</div>;
  }

  const today = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        organizationName={organizationName}
      />
      <div className={`main ${collapsed ? 'main-collapsed' : ''}`}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="hamburger"
              onClick={() => setMobileOpen(true)}
              aria-label="Открыть меню"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </button>
            <span className="topbar-brand">{PRODUCT_IDENTITY.canonical}</span>
          </div>
          <div className="topbar-right">
            <span className="topbar-date">{today}</span>
            <form action="/api/auth/logout">
              <button className="logout-btn" type="submit">
                Выйти
              </button>
            </form>
          </div>
        </header>
        <main className="content">{children}</main>
        <footer className="footer">
          <div className="footer-line">
            <span className="footer-dot" />
            {PRODUCT_IDENTITY.display}
            <span className="footer-dot" />
          </div>
          <div className="footer-author">
            Платформа для тестирования, мониторинга и управления физической подготовкой волейбольных команд
          </div>
        </footer>
      </div>
    </>
  );
}
