'use client';

import React, { useState } from 'react';
import { useFormState } from 'react-dom';
import { createEquipment } from './actions';

const field = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm';
const label = 'block text-xs font-medium text-gray-500';
const statuses: [string, string][] = [
  ['ACTIVE', 'В работе'],
  ['MAINTENANCE', 'На обслуживании'],
  ['BROKEN', 'Неисправно'],
  ['RETIRED', 'Списано'],
];

export default function NewEquipmentSection() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(
    createEquipment,
    null as null | { ok?: boolean; error?: string }
  );

  React.useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Оборудование</h1>
        <button className="btn-primary" onClick={() => setOpen((o) => !o)}>
          {open ? 'Закрыть' : '+ Добавить'}
        </button>
      </div>
      {open && (
        <form
          action={formAction}
          className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-6 md:grid-cols-3"
        >
          <label className={label}>
            Код *
            <input name="code" required className={field} placeholder="EQ01" />
          </label>
          <label className={label}>
            Название *
            <input name="name" required className={field} />
          </label>
          <label className={label}>
            Производитель
            <input name="brand" className={field} />
          </label>
          <label className={label}>
            Модель
            <input name="model" className={field} />
          </label>
          <label className={label}>
            Гарантия до
            <input name="warrantyExp" type="date" className={field} />
          </label>
          <label className={label}>
            Статус
            <select name="status" defaultValue="ACTIVE" className={field}>
              {statuses.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2 md:col-span-3">
            <button className="btn-primary">Добавить оборудование</button>
            {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
            {state?.ok && <span className="text-sm text-green-700">Добавлено ✓</span>}
          </div>
        </form>
      )}
    </div>
  );
}