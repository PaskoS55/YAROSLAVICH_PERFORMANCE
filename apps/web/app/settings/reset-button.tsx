'use client';

import React, { useRef, useState } from 'react';
import { resetDemoData } from './actions';

export default function ResetButton() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  function close() { setOpen(false); setConfirmation(''); trigger.current?.focus(); }
  return (
    <div>
    <button
      ref={trigger}
      type="button"
      disabled={pending}
      className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
      onClick={() => { setMessage(''); setOpen(true); }}
    >
      {pending ? 'Сброс…' : 'Сбросить данные'}
    </button>
    {message && <p role="status" className="mt-2 text-sm">{message}</p>}
    {open && <div role="dialog" aria-modal="true" aria-labelledby="reset-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onKeyDown={event => { if (event.key === 'Escape' && !pending) close(); }}>
      <form className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onSubmit={async event => {
        event.preventDefault();
        if (pending || confirmation !== 'СБРОСИТЬ') return;
        setPending(true);
        const form = new FormData(event.currentTarget);
        try { await resetDemoData(form); close(); setMessage('Данные сброшены. Справочники сохранены.'); }
        catch { setMessage('Не удалось сбросить данные. Операция отменена.'); close(); }
        finally { setPending(false); }
      }}>
        <h3 id="reset-title" className="text-lg font-semibold">Подтверждение сброса</h3>
        <p className="mt-3 text-sm">Будут удалены игроки, сессии, результаты, цели и замеры всех клубов этой установки. Справочники и локальный администратор сохранятся. Сначала создайте резервную копию.</p>
        <label htmlFor="reset-confirmation" className="mt-4 block text-sm">Введите СБРОСИТЬ</label>
        <input autoFocus id="reset-confirmation" name="confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={pending} className="mt-1 w-full rounded border p-2" />
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={close} disabled={pending} className="btn-secondary">Отмена</button>
          <button type="submit" disabled={pending || confirmation !== 'СБРОСИТЬ'} className="btn-primary disabled:opacity-50">{pending ? 'Сброс…' : 'Сбросить'}</button>
        </div>
      </form>
    </div>}
    </div>
  );
}
