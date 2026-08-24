'use client';
import { useActionState, useState } from 'react';
import { resetDemoWorkspace } from './actions';

export function DemoResetForm() {
  const [confirmation, setConfirmation] = useState('');
  const [state, action, pending] = useActionState(resetDemoWorkspace, {});
  return <form action={action} className="space-y-3">
    <p className="text-sm text-gray-600">Демонстрационные изменения будут удалены, и исходные демо-данные версии 1.0 будут восстановлены. Данные клуба не затрагиваются.</p>
    <label className="block text-sm font-medium">Введите <b>СБРОСИТЬ ДЕМО</b></label>
    <input name="confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2" autoComplete="off" />
    {state.error && <p role="alert" className="text-sm font-medium text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm font-medium text-green-700">{state.success}</p>}
    <button className="btn-primary" disabled={pending || confirmation !== 'СБРОСИТЬ ДЕМО'}>{pending ? 'Восстановление…' : 'Сбросить демо-данные'}</button>
  </form>;
}
