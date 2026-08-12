'use client';

import React, { useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import { updateNorm, type NormState } from './actions';

export type NormData = {
  id: string;
  position: string;
  anchor10: number;
  anchor25: number;
  anchor50: number;
  anchor75: number;
  anchor90: number;
};

const fields = ['anchor10', 'anchor25', 'anchor50', 'anchor75', 'anchor90'] as const;

export default function NormRow({
  norm,
  positionLabel,
}: {
  norm: NormData;
  positionLabel: string;
}) {
  const [state, formAction] = useFormState<NormState, FormData>(updateNorm, null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);

  return (
    <form
      action={formAction}
      onChange={() => setDirty(true)}
      className="grid grid-cols-[1.2fr_repeat(5,5.5rem)_9rem] items-center gap-2 border-b border-gray-100 py-2 last:border-0"
    >
      <input type="hidden" name="id" value={norm.id} />
      <div className="text-sm">{positionLabel}</div>
      {fields.map((f) => (
        <input
          key={f}
          name={f}
          inputMode="decimal"
          defaultValue={String(norm[f]).replace('.', ',')}
          className="w-full rounded-lg border border-gray-200 px-2 py-2 font-mono text-sm"
        />
      ))}
      <div>
        <button className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Сохранить
        </button>
      </div>
      {dirty && !state?.error && (
        <div className="col-span-full text-xs text-amber-600">
          Есть изменения — нажмите «Сохранить»
        </div>
      )}
      {state?.error && (
        <div className="col-span-full rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {state.error}
        </div>
      )}
      {state?.ok && !dirty && (
        <div className="col-span-full text-xs text-green-700">Сохранено ✓</div>
      )}
    </form>
  );
}