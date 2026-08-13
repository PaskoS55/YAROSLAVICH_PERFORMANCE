'use client';

import React from 'react';

export default function ResolveFlagButton() {
  return (
    <button
      type="submit"
      className="text-xs font-medium hover:underline"
      style={{ color: 'var(--red)' }}
      onClick={(e) => {
        const answer = window.prompt(
          'Отметить QC-флаг решённым? Значение результата не изменится.\n\nПричина:\n1 — Проверено: значение верное\n2 — Исправлено в исходных данных\n3 — Другое\n\nВведите цифру или свой текст:',
          '1'
        );
        if (answer === null) {
          e.preventDefault();
          return;
        }
        const map: Record<string, string> = {
          '1': 'manual:verified',
          '2': 'manual:fixed',
          '3': 'manual:other',
        };
        const form = (e.currentTarget as HTMLButtonElement).closest('form');
        const input = form?.querySelector('input[name="reason"]') as HTMLInputElement | null;
        if (input) input.value = map[answer.trim()] ?? `manual:${answer.trim() || 'other'}`;
      }}
    >
      Отметить решённым
    </button>
  );
}