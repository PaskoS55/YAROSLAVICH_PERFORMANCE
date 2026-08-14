'use client';

import React, { useState } from 'react';
import { useFormState } from 'react-dom';
import { createNorms, type NormState } from './actions';

const POSITIONS: [string, string][] = [
  ['outside_hitter', 'Доигровщик'],
  ['opposite', 'Диагональный'],
  ['middle_blocker', 'Центральный'],
  ['setter', 'Связующий'],
  ['libero', 'Либеро'],
];

const input = 'w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-mono';

export default function NormCreateForm({ testCode }: { testCode: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createNorms, null as NormState);

  if (!open) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-800">Нормативы не настроены</p>
        <p className="mt-1 text-xs text-amber-700">
          Пока этот тест участвует только в абсолютных сравнениях. Настройте процентили — и он
          появится в «Динамике» и «Сравнении».
        </p>
        <button className="btn-primary mt-3" onClick={() => setOpen(true)}>
          + Добавить нормативы
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="testCode" value={testCode} />
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[1.2fr_repeat(5,5.5rem)] gap-2 border-b border-gray-200 pb-1 text-xs text-gray-500">
            <div>Позиция</div>
            <div>p10</div>
            <div>p25</div>
            <div>p50</div>
            <div>p75</div>
            <div>p90</div>
          </div>
          {POSITIONS.map(([code, label]) => (
            <div
              key={code}
              className="grid grid-cols-[1.2fr_repeat(5,5.5rem)] items-center gap-2 border-b border-gray-100 py-2"
            >
              <div className="text-sm text-gray-700">{label}</div>
              {[10, 25, 50, 75, 90].map((p) => (
                <input
                  key={p}
                  name={`a${p}_${code}`}
                  inputMode="decimal"
                  placeholder="—"
                  className={input}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary">Сохранить нормативы</button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Отмена
        </button>
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}