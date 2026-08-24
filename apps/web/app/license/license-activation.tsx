'use client';
import { useState } from 'react';

declare global { interface Window { paskoLicense?: { chooseAndActivate(password?: string): Promise<{ state: string; message: string }> } } }
export function LicenseActivation({ requirePassword = false }: { requirePassword?: boolean }) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState('');
  async function activate() {
    if (!window.paskoLicense) { setMessage('Активация доступна в Desktop-приложении.'); return; }
    setPending(true); setMessage('Проверка лицензии…');
    const result = await window.paskoLicense.chooseAndActivate(password);
    setMessage(result.message); setPending(false);
  }
  return <div className="space-y-4">{requirePassword && <label className="block text-sm font-semibold">Текущий пароль администратора<input type="password" autoComplete="current-password" className="mt-2 w-full rounded-lg border border-gray-300 p-3" value={password} onChange={(event) => setPassword(event.target.value)}/></label>}<button type="button" className="btn-primary" disabled={pending || (requirePassword && !password)} onClick={activate}>Выбрать файл лицензии</button>{message && <p role="status" className="text-sm font-semibold text-gray-700">{message}</p>}</div>;
}
