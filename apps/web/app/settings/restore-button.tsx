'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RestoreButton() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();

    const answer = window.prompt(
      'ВНИМАНИЕ: все текущие данные будут ЗАМЕНЕНЫ данными из резервной копии.\n\nДля подтверждения введите ВОССТАНОВИТЬ:'
    );
    if (answer !== 'ВОССТАНОВИТЬ') {
      setMsg({ kind: 'err', text: 'Восстановление отменено.' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setPending(true);
    setMsg(null);
    try {
      const res = await fetch('/api/restore', {
        method: 'POST',
        body: text,
        headers: {
          'Content-Type': 'application/json',
          'X-Restore-Confirm': 'ВОССТАНОВИТЬ',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error ?? 'Ошибка восстановления.' });
      } else {
        setMsg({
          kind: 'ok',
          text: `Восстановлено: категорий — ${data.restored.testCategories}, тестов — ${data.restored.tests}, игроков — ${data.restored.players}, сессий — ${data.restored.testSessions}, результатов — ${data.restored.testResults}, связей Team↔Season — ${data.restored.teamSeasonLinks}.`,
        });
        router.refresh();
      }
    } catch {
      setMsg({ kind: 'err', text: 'Не удалось выполнить запрос восстановления.' });
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          onChange={onFile}
          disabled={pending}
          className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border file:border-gray-200 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 file:hover:bg-gray-50"
        />
        {pending && <span className="text-sm text-gray-500">Восстановление…</span>}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Восстановление заменяет все текущие данные файлом резервной копии. Используйте на
        пустой системе или когда уверены в замене.
      </p>
      {msg && (
        <p className={`mt-2 text-sm ${msg.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}