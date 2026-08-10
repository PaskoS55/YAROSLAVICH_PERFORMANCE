'use client';

import { useState } from 'react';
import { importRows, type ImportRow } from './actions';

type Parsed = ImportRow & { line: number; valid: boolean; problem?: string };

export default function ImportForm() {
  const [rows, setRows] = useState<Parsed[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  function parse(text: string): Parsed[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    const delim =
      (text.match(/;/g)?.length ?? 0) >= (text.match(/,/g)?.length ?? 0) ? ';' : ',';
    const parsed: Parsed[] = [];
    lines.forEach((line, idx) => {
      const cells = line.split(delim).map((c) => c.trim());
      if (cells.length < 4) return;
      const [playerCode, date, testCode, valueStr] = cells;
      const value = Number(valueStr.replace(',', '.'));
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
      setResult('');
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
    setResult(
      `Импортировано: ${res.ok}. Ошибок: ${res.errors.length}` +
        (res.errors.length ? ' — ' + res.errors.slice(0, 5).join(' | ') : '')
    );
    setBusy(false);
  }

  const validCount = rows.filter((r) => r.valid).length;

  return (
    <div>
      <input type="file" accept=".csv,.txt" onChange={onFile} className="mb-4 text-sm" />
      {fileName && (
        <div className="mb-4 text-sm text-gray-600">
          Файл: <b>{fileName}</b> · строк: {rows.length} · готово к импорту:{' '}
          <b className={validCount ? 'text-green-700' : 'text-red-700'}>{validCount}</b>
        </div>
      )}

      {rows.length > 0 && (
        <table className="mb-4 min-w-full text-sm">
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
                <td className="py-1 pr-4 font-mono">{r.value}</td>
                <td className="py-1">
                  {r.valid ? (
                    <span className="text-green-700">✓</span>
                  ) : (
                    <span className="text-xs text-red-600">{r.problem}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rows.length > 0 && (
        <div className="flex items-center gap-4">
          <button
            onClick={onImport}
            disabled={busy || validCount === 0}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Импорт…' : `Импортировать ${validCount} строк`}
          </button>
          {result && <span className="text-sm text-green-700">{result}</span>}
        </div>
      )}
    </div>
  );
}