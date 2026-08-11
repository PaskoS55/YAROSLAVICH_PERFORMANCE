'use client';

import { useFormStatus } from 'react-dom';

export default function ResetButton() {
  const { pending } = useFormStatus();
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
      onClick={(e) => {
        if (!confirm('Вы уверены? Все демо-данные будут удалены!')) {
          e.preventDefault();
        }
      }}
    >
      {pending ? 'Сброс...' : 'Сбросить демо-данные'}
    </button>
  );
}