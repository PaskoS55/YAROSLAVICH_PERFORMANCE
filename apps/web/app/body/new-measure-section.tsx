'use client';

import React, { useState } from 'react';

export default function NewMeasureSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Состав тела</h1>
        <button className="btn-primary" onClick={() => setOpen((o) => !o)}>
          {open ? 'Скрыть форму' : '+ Новый замер'}
        </button>
      </div>
      {open && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">{children}</div>
      )}
    </div>
  );
}