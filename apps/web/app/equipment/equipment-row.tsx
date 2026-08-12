'use client';

import React, { useState } from 'react';
import { useFormState } from 'react-dom';
import { updateEquipment } from './actions';

type Item = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  warrantyExp: string | null;
  status: string;
};

const statuses: [string, string][] = [
  ['ACTIVE', 'В работе'],
  ['MAINTENANCE', 'На обслуживании'],
  ['BROKEN', 'Неисправно'],
  ['RETIRED', 'Списано'],
];

const field = 'w-full rounded-lg border border-gray-200 px-2 py-2 text-sm';

export default function EquipmentRow({
  item,
  warrantyLabel,
  warrantyColor,
  statusLabel,
  statusColor,
}: {
  item: Item;
  warrantyLabel: string;
  warrantyColor: string;
  statusLabel: string;
  statusColor: string;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useFormState(
    updateEquipment,
    null as null | { ok?: boolean; error?: string }
  );

  React.useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  if (!editing) {
    return (
      <tr>
        <td className="px-4 py-2">
          <div className="font-medium">{item.name}</div>
          <div className="text-xs font-mono text-gray-400">{item.code}</div>
        </td>
        <td className="px-4 py-2 text-gray-600">{item.brand ?? '—'}</td>
        <td className="px-4 py-2 text-gray-600">{item.model ?? '—'}</td>
        <td className={`px-4 py-2 text-sm ${warrantyColor}`}>{warrantyLabel}</td>
        <td className="px-4 py-2">
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
        </td>
        <td className="px-4 py-2 text-right">
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--red)' }}
          >
            Изменить
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={6} className="px-4 py-3">
        <form action={formAction} className="grid grid-cols-1 gap-2 md:grid-cols-6">
          <input type="hidden" name="id" value={item.id} />
          <input name="code" defaultValue={item.code} placeholder="Код" required className={field} />
          <input name="name" defaultValue={item.name} placeholder="Название" required className={field} />
          <input name="brand" defaultValue={item.brand ?? ''} placeholder="Производитель" className={field} />
          <input name="model" defaultValue={item.model ?? ''} placeholder="Модель" className={field} />
          <input name="warrantyExp" type="date" defaultValue={item.warrantyExp ?? ''} className={field} />
          <select name="status" defaultValue={item.status} className={field}>
            {statuses.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 md:col-span-6">
            <button className="btn-primary">Сохранить</button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Отмена
            </button>
            {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
            {state?.ok && <span className="text-xs text-green-700">Сохранено ✓</span>}
          </div>
        </form>
      </td>
    </tr>
  );
}