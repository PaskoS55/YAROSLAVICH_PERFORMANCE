'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

const titles: [string, string][] = [
  ['/players', 'Игроки'],
  ['/sessions', 'Тестирования'],
  ['/testing', 'Командный ввод'],
  ['/analytics', 'Динамика и профиль'],
  ['/compare', 'Сравнение'],
  ['/team', 'Команда'],
  ['/body', 'Состав тела'],
  ['/goals', 'Цели'],
  ['/norms', 'Нормативы'],
  ['/protocols', 'Протоколы'],
  ['/import', 'Импорт данных'],
  ['/reports', 'Отчёты'],
  ['/qc', 'Контроль данных'],
  ['/equipment', 'Оборудование'],
  ['/settings', 'Настройки'],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  if (pathname.startsWith('/login')) {
    return <div className="content-full">{children}</div>;
  }

  const title = titles.find(([p]) => pathname.startsWith(p))?.[1] ?? 'Главная';
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
            <h1 className="topbar-title">{title}</h1>
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
      </div>
    </>
  );
}