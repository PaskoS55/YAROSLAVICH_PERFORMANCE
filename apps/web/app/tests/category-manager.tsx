'use client';

import React, { useState } from 'react';
import { useFormState } from 'react-dom';
import { updateCategories, type CategoryState } from './category-actions';

export type CatRow = {
  id: string;
  code: string;
  name: string;
  includeInRadar: boolean;
  radarOrder: number | null;
};

export default function CategoryManager({ categories }: { categories: CatRow[] }) {
  const [included, setIncluded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, c.includeInRadar]))
  );
  const [order, setOrder] = useState<string[]>(() =>
    categories
      .filter((c) => c.includeInRadar)
      .sort((a, b) => (a.radarOrder ?? 999) - (b.radarOrder ?? 999))
      .map((c) => c.id)
  );
  const [state, formAction] = useFormState(updateCategories, null as CategoryState);

  const toggle = (id: string) => {
    const wasIncluded = !!included[id];
    setIncluded((inc) => ({ ...inc, [id]: !wasIncluded }));
    setOrder((o) => (wasIncluded ? o.filter((x) => x !== id) : [...o, id]));
  };

  const move = (id: string, dir: -1 | 1) => {
    setOrder((o) => {
      const i = o.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const includedCount = order.length;
  const plural =
    includedCount % 10 === 1 && includedCount % 100 !== 11
      ? 'категория'
      : includedCount % 10 >= 2 &&
          includedCount % 10 <= 4 &&
          (includedCount % 100 < 10 || includedCount % 100 >= 20)
        ? 'категории'
        : 'категорий';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-1 text-lg font-bold">Категории</h2>
      <p className="mb-3 text-sm text-gray-500">
        Отметьте, какие категории входят в профиль спортсмена на радаре. Порядок осей меняется
        кнопками ↑ и ↓. Новые категории по умолчанию не попадают на радар — включайте их
        осознанно.
      </p>
      <div className="mb-3 text-sm text-gray-600">
        В профиль включено: <b>{includedCount}</b> {plural}
      </div>
      {includedCount > 0 && includedCount < 3 && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Для радара нужно минимум 3 категории.
        </div>
      )}
      <form action={formAction} className="space-y-2">
        {categories.map((c) => {
          const inc = !!included[c.id];
          const pos = order.indexOf(c.id);
          return (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 px-3 py-2"
            >
              <input type="hidden" name="catId" value={c.id} />
              <input type="hidden" name={`inc_${c.id}`} value={inc ? '1' : '0'} />
              {inc && <input type="hidden" name={`pos_${c.id}`} value={pos + 1} />}
              <label className="flex flex-1 items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={inc}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4"
                />
                {c.name}
                <span className="font-mono text-xs text-gray-400">{c.code}</span>
              </label>
              {inc && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="w-14 text-center">ось {pos + 1}</span>
                  <button
                    type="button"
                    onClick={() => move(c.id, -1)}
                    disabled={pos === 0}
                    className="rounded border border-gray-200 px-2 py-1 hover:bg-gray-50 disabled:opacity-40"
                    aria-label="Выше"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(c.id, 1)}
                    disabled={pos === order.length - 1}
                    className="rounded border border-gray-200 px-2 py-1 hover:bg-gray-50 disabled:opacity-40"
                    aria-label="Ниже"
                  >
                    ↓
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button className="btn-primary">Сохранить категории</button>
          {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
          {state?.ok && <span className="text-sm text-green-700">Сохранено ✓</span>}
        </div>
      </form>
    </div>
  );
}