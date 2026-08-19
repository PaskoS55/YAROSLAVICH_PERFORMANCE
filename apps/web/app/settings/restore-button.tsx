'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RestoreButton() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [backupText, setBackupText] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  function clearSelection() {
    setBackupText(null);
    setConfirmation('');
    setDialogOpen(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBackupText(await file.text());
      setConfirmation('');
      setMsg(null);
      setDialogOpen(true);
    } catch {
      clearSelection();
      setMsg({ kind: 'err', text: 'Не удалось прочитать файл резервной копии.' });
    }
  }

  async function restoreBackup() {
    if (confirmation !== 'ВОССТАНОВИТЬ' || backupText === null) return;
    setPending(true);
    setMsg(null);
    setDialogOpen(false);
    try {
      const res = await fetch('/api/restore', {
        method: 'POST',
        body: backupText,
        headers: {
          'Content-Type': 'application/json',
          'X-Restore-Confirm': 'RESTORE',
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
      clearSelection();
    }
  }

  function cancelRestore() {
    clearSelection();
    setMsg({ kind: 'err', text: 'Восстановление отменено.' });
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
      {dialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 id="restore-dialog-title" className="text-lg font-semibold text-gray-900">
              Подтверждение восстановления
            </h3>
            <p className="mt-3 text-sm text-gray-700">
              ВНИМАНИЕ: все текущие данные будут заменены данными из резервной копии.
              Для подтверждения введите <strong>ВОССТАНОВИТЬ</strong>.
            </p>
            <label className="mt-4 block text-sm font-medium text-gray-700" htmlFor="restore-confirmation">
              Подтверждение
            </label>
            <input
              id="restore-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoFocus
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelRestore}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={restoreBackup}
                disabled={confirmation !== 'ВОССТАНОВИТЬ' || backupText === null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Восстановить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
