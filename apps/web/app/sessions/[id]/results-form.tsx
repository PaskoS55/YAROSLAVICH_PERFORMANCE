'use client';

import React, { useRef, useState, useTransition } from 'react';
import { saveResults } from './actions';

type TestRow = {
  id: string;
  name: string;
  unit: string;
  qcMin: number | null;
  qcMax: number | null;
  archived: boolean;
};

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

export default function ResultsForm({
  sessionId,
  tests,
  existing,
}: {
  sessionId: string;
  tests: TestRow[];
  existing: Record<string, number>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const t of tests)
      init[t.id] = existing[t.id] !== undefined ? String(existing[t.id]) : '';
    return init;
  });
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string[] | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  const parse = (s: string) => Number(s.trim().replace(',', '.'));

  function collect() {
    let bad = 0;
    const entries: { testId: string; value: number }[] = [];
    const out: string[] = [];
    for (const t of tests) {
      const raw = (values[t.id] ?? '').trim();
      if (raw === '') continue;
      const v = parse(raw);
      if (!Number.isFinite(v)) {
        bad++;
        continue;
      }
      entries.push({ testId: t.id, value: v });
      if ((t.qcMin !== null && v < t.qcMin) || (t.qcMax !== null && v > t.qcMax)) {
        out.push(`${t.name}: ${v} ${t.unit} при диапазоне ${t.qcMin ?? '…'}–${t.qcMax ?? '…'}`);
      }
    }
    return { entries, bad, out };
  }

  function doSave(entries: { testId: string; value: number }[]) {
    setOk(false);
    setError(null);
    startTransition(async () => {
      try {
        await saveResults(sessionId, entries);
        setWarn(null);
        setOk(true);
      } catch (e) {
        setWarn(null);
        setError(e instanceof Error ? e.message : 'Не удалось сохранить результаты.');
      }
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOk(false);
    setError(null);
    const { entries, bad, out } = collect();
    if (bad > 0) {
      setError(`Исправьте ${bad} ${plural(bad, 'значение', 'значения', 'значений')}: введено не число.`);
      return;
    }
    if (entries.length === 0) {
      setError('Нет ни одного заполненного значения.');
      return;
    }
    if (out.length > 0) {
      setWarn(out);
      return;
    }
    doSave(entries);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-2">
        {tests.map((t, i) => {
          const raw = (values[t.id] ?? '').trim();
          const v = parse(raw);
          const invalid = raw !== '' && !Number.isFinite(v);
          const out =
            raw !== '' &&
            Number.isFinite(v) &&
            ((t.qcMin !== null && v < t.qcMin) || (t.qcMax !== null && v > t.qcMax));
          return (
            <div key={t.id} className="flex flex-wrap items-center gap-3">
              <div className="w-56 text-sm text-gray-700">
                {t.name}{' '}
                {t.archived && (
                  <span className="ml-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
                    Архивирован
                  </span>
                )}
                <div className="text-xs text-gray-400">
                  {t.unit}
                  {t.qcMin !== null || t.qcMax !== null
                    ? ` · QC ${t.qcMin ?? '…'}–${t.qcMax ?? '…'}`
                    : ''}
                </div>
              </div>
              <input
                ref={(el) => {
                  refs.current[t.id] = el;
                }}
                value={values[t.id]}
                onChange={(e) => setValues((s) => ({ ...s, [t.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const next = tests[i + 1];
                    if (next) refs.current[next.id]?.focus();
                  }
                }}
                inputMode="decimal"
                placeholder="—"
                className={`w-32 rounded-lg border px-3 py-2 text-sm font-mono ${
                  invalid
                    ? 'border-red-400 bg-red-50'
                    : out
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-gray-200'
                }`}
              />
              {invalid && <span className="text-xs text-red-600">введите число</span>}
              {!invalid && out && (
                <span className="text-xs text-amber-700">вне QC-диапазона</span>
              )}
            </div>
          );
        })}
      </div>

      {warn && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Значения вне QC-диапазона:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {warn.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={pending}
              onClick={() => {
                const { entries, bad } = collect();
                if (bad === 0 && entries.length > 0) doSave(entries);
              }}
            >
              Подтвердить и сохранить
            </button>
            <button
              type="button"
              onClick={() => setWarn(null)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!warn && (
          <button className="btn-primary" disabled={pending}>
            {pending ? 'Сохранение…' : 'Сохранить результаты'}
          </button>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
        {ok && !error && (
          <span className="text-sm text-green-700">✓ Результаты сохранены</span>
        )}
      </div>
    </form>
  );
}