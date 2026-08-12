'use client';

import React, { useState } from 'react';
import { syncGoals } from './actions';

export default function GoalsHeader({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Цели</h1>
        <div className="flex flex-wrap items-center gap-2">
          <form action={syncGoals}>
            <button className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Проверить достижения
            </button>
          </form>
          <button className="btn-primary" onClick={() => setOpen((o) => !o)}>
            {open ? 'Закрыть' : '+ Новая цель'}
          </button>
        </div>
      </div>
      {open && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">{children}</div>
      )}
    </div>
  );
}