'use client';

import React from 'react';
import { useFormStatus } from 'react-dom';

export default function ResetButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
      onClick={(e) => {
        const confirm = window.prompt(
          'ВНИМАНИЕ: будут удалены все игроки, сессии, результаты, цели и замеры.\nНормативы, справочник тестов и оборудование сохранятся.\n\nДля подтверждения введите слово СБРОСИТЬ:'
        );
        if (confirm !== 'СБРОСИТЬ') e.preventDefault();
      }}
    >
      {pending ? 'Сброс…' : 'Сбросить данные'}
    </button>
  );
}