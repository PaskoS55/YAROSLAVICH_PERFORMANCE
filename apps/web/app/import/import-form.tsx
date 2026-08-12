'use client';

import { useState } from 'react';
import { importRows, type ImportRow } from './actions';

type Parsed = ImportRow & { line: number; valid: boolean; problem?: string };

export default function ImportForm() {
  const [rows, setRows] = useState<Parsed[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; errors: string[] } | null>(null);

  function parse(text: string): Parsed[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    const delim =
      (text.match(/;/g)?.length ?? 0) >= (text.match(/,/g)?.length ?? 0) ? ';' : ',';
    const parsed: Parsed[] = [];
    lines.forEach((line, idx) => {
      const cells = line.split(delim).map((c) => c.trim());
      if (cells.length < 4) {
        parsed.push({
          line: idx + 1,
          playerCode: cells[0] || '',
          date: cells[1] || '',
          testCode: cells[2] || '',
          value: 0,
          valid: false,
          problem: 'Недостаточно колонок: ожидается 4',
        });
        return;
      }
      const [playerCode, date, testCode, valueStr] = cells;
      const value = Number(valueStr.replace(',', '.'));
      // Пропускаем заголовок (первая строка, если значение не число)
      if (idx === 0 && Number.isNaN(value)) return;
      const problems: string[] = [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        problems.push('дата (нужен формат ГГГГ-ММ-ДД)');
      if (Number.isNaN(value)) problems.push('значение не число');
      parsed.push({
        line: idx + 1,
        playerCode,
        date,
        testCode,
        value: Number.isNaN(value) ? 0 : value,
        valid: problems.length === 0,
        problem: problems.join('; '),
      });
    });
    return parsed;
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      setRows(parse(String(reader.result ?? '')));
      setResult(null);
    };
    reader.readAsText(f, 'utf-8');
  }

  async function onImport() {
    const valid = rows.filter((r) => r.valid);
    if (valid.length === 0) return;
    setBusy(true);
    const res = await importRows(
      valid.map(({ playerCode, date, testCode, value }) => ({
        playerCode,
        date,
        testCode,
        value,
      }))
    );
    setResult(res);
    setBusy(false);
  }

  const validCount = rows.filter((r) => r.valid).length;

  const resultColor = result
    ? result.ok === 0
      ? 'bg-red-50 text-red-800 border-red-200'
      : result.errors.length > 0
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-green-50 text-green-800 border-green-200'
    : '';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="file" accept=".csv,.txt" onChange={onFile} className="text-sm" />
        <a
          href="/api/import-template"
          className="text-sm font-medium hover:underline"
          style={{ color: 'var(--red)' }}
        >
          Скачать шаблон CSV ↓
        </a>
      </div>
      {fileName && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          Файл: <b>{fileName}</b> · строк: {rows.length} · формат корректен:{' '}
          <b className={validCount ? 'text-green-700' : 'text-red-700'}>{validCount}</b>{' '}
          <span className="text-xs text-gray-400">(серверная проверка при импорте)</span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-1 pr-4">Строка</th>
                <th className="py-1 pr-4">Игрок</th>
                <th className="py-1 pr-4">Дата</th>
                <th className="py-1 pr-4">Тест</th>
                <th className="py-1 pr-4">Значение</th>
                <th className="py-1">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.line} className="border-b last:border-0">
                  <td className="py-1 pr-4 text-gray-400">{r.line}</td>
                  <td className="py-1 pr-4 font-mono">{r.playerCode}</td>
                  <td className="py-1 pr-4">{r.date}</td>
                  <td className="py-1 pr-4 font-mono">{r.testCode}</td>
                                    <td className="py-1 pr-4 font-mono">
                    {r.valid || r.value !== 0 ? r.value : '—'}
                  </td>
                  <td className="py-1">
                    {r.valid ? (
                      <span className="text-gray-600">Готово</span>
                    ) : (
                      <span className="text-xs text-red-600">{r.problem}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={onImport}
            disabled={busy || validCount === 0}
            className="btn-primary disabled:bg-gray-200 disabled:text-gray-400"
          >
            {busy ? 'Импорт…' : `Импортировать ${validCount} строк`}
          </button>
          {result && (
            <div className={`rounded-lg border p-4 ${resultColor}`}>
              <div className="font-semibold">
                Импортировано: {result.ok}. Ошибок: {result.errors.length}
              </div>
              {result.errors.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li className="text-gray-500">…и ещё {result.errors.length - 10}</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}