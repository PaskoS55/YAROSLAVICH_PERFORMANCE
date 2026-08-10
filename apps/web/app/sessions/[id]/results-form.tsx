'use client';

import { useState } from 'react';
import { saveResults } from './actions';

type TestItem = {
  id: string;
  name: string;
  unit: string;
  qcMin: number | null;
  qcMax: number | null;
};

export default function ResultsForm({
  tests,
  existing,
  sessionId,
  playerId,
}: {
  tests: TestItem[];
  existing: Record<string, number>;
  sessionId: string;
  playerId: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const t of tests) {
      init[t.id] = existing[t.id] !== undefined ? String(existing[t.id]) : '';
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function qcState(t: TestItem, raw: string): 'ok' | 'warn' | 'empty' {
    if (raw.trim() === '') return 'empty';
    const v = Number(raw.replace(',', '.'));
    if (Number.isNaN(v)) return 'warn';
    if (t.qcMin !== null && v < t.qcMin) return 'warn';
    if (t.qcMax !== null && v > t.qcMax) return 'warn';
    return 'ok';
  }

  const borderFor = {
    ok: 'border-green-500',
    warn: 'border-red-500',
    empty: 'border-gray-300',
  };

  async function onSubmit() {
    setSaving(true);
    setMessage('');
    const entries: { testId: string; value: number }[] = [];
    for (const t of tests) {
      const raw = values[t.id] ?? '';
      if (raw.trim() === '') continue;
      const v = Number(raw.replace(',', '.'));
      if (!Number.isNaN(v)) entries.push({ testId: t.id, value: v });
    }
    try {
      await saveResults(sessionId, playerId, entries);
      setMessage('✓ Результаты сохранены');
    } catch {
      setMessage('Не удалось сохранить результаты. Проверьте значения и попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="py-2 pr-4">Тест</th>
            <th className="py-2 pr-4">Результат</th>
            <th className="py-2 pr-4">Ед.</th>
            <th className="py-2">QC-диапазон</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((t) => {
            const raw = values[t.id] ?? '';
            const st = qcState(t, raw);
            return (
              <tr key={t.id} className="border-b last:border-0">
                <td className="py-2 pr-4">{t.name}</td>
                <td className="py-2 pr-4">
                  <input
                    type="text"
                    value={raw}
                    onChange={(e) => setValues({ ...values, [t.id]: e.target.value })}
                    className={`w-28 rounded border-2 px-2 py-1 font-mono ${borderFor[st]}`}
                    placeholder="—"
                  />
                </td>
                <td className="py-2 pr-4 text-gray-500">{t.unit}</td>
                <td className="py-2 text-gray-400">
                  {t.qcMin !== null || t.qcMax !== null
                    ? `${t.qcMin ?? '…'} – ${t.qcMax ?? '…'}`
                    : '—'}
                  {st === 'warn' && (
                    <span className="ml-2 font-semibold text-red-600">вне диапазона!</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={onSubmit}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : 'Сохранить результаты'}
        </button>
        {message && <span className="text-sm text-green-700">{message}</span>}
      </div>
    </div>
  );
}