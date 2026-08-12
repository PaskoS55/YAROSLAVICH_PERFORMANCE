'use client';

import React, { useRef, useState } from 'react';
import { saveTeamResults } from './actions';

type Player = { id: string; playerId: string; lastName: string; firstName: string };
type Test = {
  id: string;
  code: string;
  name: string;
  unit: string;
  qcMin: number | null;
  qcMax: number | null;
};

const phases: [string, string][] = [
  ['PRESEASON', 'Предсезонка'],
  ['CAMP', 'Сборы'],
  ['INSEASON', 'Сезон'],
  ['POSTSEASON', 'Постсезон'],
  ['RECOVERY', 'Восстановление'],
];

function plural(n: number, forms: [string, string, string]) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

const field = 'rounded-lg border px-3 py-2 text-sm';
const label = 'block text-xs font-medium text-gray-500';

export default function TeamForm({ players, tests }: { players: Player[]; tests: Test[] }) {
  const [testId, setTestId] = useState(tests[0]?.id ?? '');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [phase, setPhase] = useState<string>(() => {
    if (typeof window === 'undefined') return 'INSEASON';
    return localStorage.getItem('yp-last-phase') ?? 'INSEASON';
  });
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const test = tests.find((t) => t.id === testId);

  function fieldState(s: string): { state: 'empty' | 'ok' | 'bad'; value?: number } {
    const t = s.trim().replace(',', '.');
    if (!t) return { state: 'empty' };
    const n = Number(t);
    if (!Number.isFinite(n)) return { state: 'bad' };
    if (
      test &&
      ((test.qcMin !== null && n < test.qcMin) || (test.qcMax !== null && n > test.qcMax))
    ) {
      return { state: 'bad', value: n };
    }
    return { state: 'ok', value: n };
  }

  const states = players.map((p) => ({ p, st: fieldState(values[p.id] ?? '') }));
  const entered = states.filter((x) => x.st.state === 'ok').length;
  const invalid = states.filter((x) => x.st.state === 'bad').length;

  async function onSubmit() {
    setError(null);
    setMessage(null);
    if (invalid > 0) {
      setError(`Исправьте ${invalid} ${plural(invalid, ['значение', 'значения', 'значений'])} перед сохранением.`);
      return;
    }
    const entries = states
      .filter((x) => x.st.state === 'ok')
      .map((x) => ({ playerId: x.p.id, value: x.st.value as number }));
    if (entries.length === 0) {
      setError('Введите хотя бы один результат.');
      return;
    }
    setSaving(true);
    try {
      await saveTeamResults({ testId, date, phase, entries });
      localStorage.setItem('yp-last-phase', phase);
      const skipped = players.length - entries.length;
      setMessage(
        `✓ Сохранено: ${entries.length} из ${players.length} игроков${
          skipped > 0 ? ` · ${skipped} без результата` : ''
        }`
      );
      setValues({});
    } catch {
      setError('Не удалось сохранить. Проверьте данные и попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className={label}>
          Тест
          <select value={testId} onChange={(e) => setTestId(e.target.value)} className={`${field} mt-1 border-gray-200`}>
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Дата
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} mt-1 border-gray-200`} />
        </label>
        <label className={label}>
          Фаза
          <select value={phase} onChange={(e) => setPhase(e.target.value)} className={`${field} mt-1 border-gray-200`}>
            {phases.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="text-xs text-gray-500">
        Единица: <b>{test?.unit ?? '—'}</b> · допустимый диапазон ввода:{' '}
        <b>{test?.qcMin ?? '…'}–{test?.qcMax ?? '…'}</b>
      </div>

      <div>
        {states.map(({ p, st }, i) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-4 border-b border-gray-100 py-2 last:border-0"
          >
            <div>
              <div className="text-sm font-medium">
                {p.lastName} {p.firstName}
              </div>
              <div className="text-xs text-gray-400">{p.playerId}</div>
            </div>
            <div className="text-right">
              <input
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                value={values[p.id] ?? ''}
                inputMode="decimal"
                placeholder="—"
                onChange={(e) => {
                  setValues((v) => ({ ...v, [p.id]: e.target.value }));
                  setMessage(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const next = inputsRef.current.slice(i + 1).find(Boolean);
                    next?.focus();
                  }
                }}
                className={`w-28 text-right font-mono ${field} py-2.5 ${
                  st.state === 'bad' ? 'border-red-500' : 'border-gray-200'
                }`}
              />
              {st.state === 'bad' && (
                <div className="mt-1 text-[11px] text-red-600">
                  Проверьте значение · ожидается {test?.qcMin ?? '…'}–{test?.qcMax ?? '…'} {test?.unit}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          {message}
        </div>
      )}

      <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-between rounded-b-lg border-t border-gray-200 bg-white px-6 py-3">
        <span className="text-sm text-gray-500">
          Введено {entered} из {players.length}
        </span>
        <button className="btn-primary" onClick={onSubmit} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить результаты'}
        </button>
      </div>
    </div>
  );
}