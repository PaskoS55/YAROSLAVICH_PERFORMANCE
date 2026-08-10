'use client';

import { useState } from 'react';
import { saveTeamResults } from './actions';

type PlayerItem = {
  id: string;
  playerId: string;
  lastName: string;
  firstName: string;
};

type TestItem = {
  id: string;
  code: string;
  name: string;
  unit: string;
  qcMin: number | null;
  qcMax: number | null;
};

const phaseOptions = [
  { value: 'PRESEASON', label: 'Предсезонка' },
  { value: 'CAMP', label: 'Сборы' },
  { value: 'INSEASON', label: 'Сезон' },
  { value: 'POSTSEASON', label: 'Постсезон' },
  { value: 'RECOVERY', label: 'Восстановление' },
];

export default function TeamForm({
  players,
  tests,
}: {
  players: PlayerItem[];
  tests: TestItem[];
}) {
  const [testId, setTestId] = useState(tests[0]?.id ?? '');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [phase, setPhase] = useState('CAMP');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const test = tests.find((t) => t.id === testId);

  function qcBad(raw: string): boolean {
    if (!test || raw.trim() === '') return false;
    const v = Number(raw.replace(',', '.'));
    if (Number.isNaN(v)) return true;
    if (test.qcMin !== null && v < test.qcMin) return true;
    if (test.qcMax !== null && v > test.qcMax) return true;
    return false;
  }

  async function onSubmit() {
    setSaving(true);
    setMessage('');
    const entries: { playerId: string; value: number }[] = [];
    for (const p of players) {
      const raw = values[p.id] ?? '';
      if (raw.trim() === '') continue;
      const v = Number(raw.replace(',', '.'));
      if (!Number.isNaN(v)) entries.push({ playerId: p.id, value: v });
    }
    if (entries.length === 0) {
      setMessage('Введите хотя бы одно значение.');
      setSaving(false);
      return;
    }
    try {
      const summary = await saveTeamResults({ testId, date, phase, entries });
      setMessage(
        '✓ Сохранено результатов: ' +
          summary.length +
          '. ' +
          summary
            .map((s) => s.sessionId + (s.created ? ' (новая)' : ''))
            .join(', ')
      );
    } catch {
      setMessage('Не удалось сохранить. Проверьте данные и попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Тест</label>
          <select
            value={testId}
            onChange={(e) => setTestId(e.target.value)}
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          >
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {test && (
            <div className="mt-1 text-xs text-gray-500">
              Ед.: {test.unit} · QC: {test.qcMin ?? '…'} – {test.qcMax ?? '…'}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Фаза</label>
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            className="w-full rounded border-2 border-gray-300 px-2 py-1"
          >
            {phaseOptions.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="py-2 pr-4">Игрок</th>
            <th className="py-2 pr-4">ID</th>
            <th className="py-2">Результат ({test?.unit ?? ''})</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const raw = values[p.id] ?? '';
            const bad = qcBad(raw);
            return (
              <tr key={p.id} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  {p.lastName} {p.firstName}
                </td>
                <td className="py-2 pr-4 font-mono text-gray-500">{p.playerId}</td>
                <td className="py-2">
                  <input
                    type="text"
                    value={raw}
                    onChange={(e) => setValues({ ...values, [p.id]: e.target.value })}
                    className={`w-28 rounded border-2 px-2 py-1 font-mono ${
                      raw.trim() === ''
                        ? 'border-gray-300'
                        : bad
                          ? 'border-red-500'
                          : 'border-green-500'
                    }`}
                    placeholder="—"
                  />
                  {bad && (
                    <span className="ml-2 text-xs font-semibold text-red-600">
                      вне диапазона!
                    </span>
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
          {saving ? 'Сохранение…' : 'Сохранить результаты команды'}
        </button>
        {message && <span className="text-sm text-green-700">{message}</span>}
      </div>
    </div>
  );
}