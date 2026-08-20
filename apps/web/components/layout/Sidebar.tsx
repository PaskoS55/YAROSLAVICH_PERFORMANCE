'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRODUCT_IDENTITY } from '@pasko-performance/core/product';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string | null;
  divider?: boolean;
  items: NavItem[];
}

const ic = (paths: React.ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);

const sections: NavSection[] = [
  {
    title: null,
    items: [
      { href: '/', label: 'Обзор команды', icon: ic(<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>) },
    ],
  },
  {
    title: 'Команда',
    items: [
      { href: '/players', label: 'Игроки', icon: ic(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>) },
      { href: '/body', label: 'Состав тела', icon: ic(<><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20" /><path d="M2 12h20" /></>) },
      { href: '/goals', label: 'Цели', icon: ic(<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>) },
    ],
  },
  {
    title: 'Тестирование',
    items: [
      { href: '/testing/team', label: 'Провести тестирование', icon: ic(<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>) },
      { href: '/sessions', label: 'Сессии', icon: ic(<><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></>) },
    ],
  },
  {
    title: 'Аналитика',
    items: [
      { href: '/analytics', label: 'Динамика', icon: ic(<><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>) },
      { href: '/compare', label: 'Сравнение', icon: ic(<><line x1="18" x2="18" y1="20" y2="10" /><line x1="12" x2="12" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="14" /></>) },
    ],
  },
  {
    title: null,
    items: [
      { href: '/reports', label: 'Отчёты', icon: ic(<><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /></>) },
    ],
  },
  {
    title: 'Система',
    divider: true,
    items: [
      { href: '/import', label: 'Импорт', icon: ic(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></>) },
      { href: '/qc', label: 'Контроль данных', icon: ic(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>) },
      { href: '/tests', label: 'Тесты', icon: ic(<><path d="M9 2h6v4H9z" /><path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></>) },
      { href: '/norms', label: 'Нормативы', icon: ic(<><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" /></>) },
      { href: '/protocols', label: 'Протоколы', icon: ic(<><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></>) },
      { href: '/equipment', label: 'Оборудование', icon: ic(<><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M12 8v8" /><path d="M8 12h8" /></>) },
      { href: '/settings', label: 'Настройки', icon: ic(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>) },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  organizationName: string;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose, organizationName }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const renderNav = (onNavigate?: () => void) => (
    <nav className="nav">
      {sections.map((s, si) => (
        <div key={si}>
          {s.divider && <div className="nav-divider" />}
          {s.title && <div className="nav-section">{s.title}</div>}
          {s.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white font-extrabold text-red-700" aria-label="PASKO product placeholder">P</div>
          {!collapsed && (
            <div className="brand-text">
              <div className="brand-name">{organizationName}</div>
              <div className="brand-sub">{PRODUCT_IDENTITY.short}</div>
            </div>
          )}
          <button className="toggle-btn" onClick={onToggle} aria-label="Свернуть меню">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
            </svg>
          </button>
        </div>
        {renderNav()}
        <div className="side-footer">v1.0 · {PRODUCT_IDENTITY.vertical}</div>
      </aside>

      <div className={`mobile-overlay ${mobileOpen ? '' : 'hidden'}`} onClick={onMobileClose} />
      <div className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white font-extrabold text-red-700" aria-label="PASKO product placeholder">P</div>
          <div className="brand-text">
            <div className="brand-name">{organizationName}</div>
            <div className="brand-sub">{PRODUCT_IDENTITY.short}</div>
          </div>
        </div>
        {renderNav(onMobileClose)}
      </div>
    </>
  );
}
