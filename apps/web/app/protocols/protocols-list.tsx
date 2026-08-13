'use client';

import React, { useState } from 'react';

type Test = {
  id: string;
  code: string;
  name: string;
  categoryName: string;
  direction: string;
  unit: string;
  qcMin: number | null;
  qcMax: number | null;
  changeThreshold: number | null;
  protocolData: string | null;
};

const directionLabels: Record<string, string> = {
  HIGHER_IS_BETTER: '↑ выше — лучше',
  LOWER_IS_BETTER: '↓ ниже — лучше',
  CONTEXTUAL: '· контекстное',
};

type Protocol = { how: string; result: string; rules?: string[] };

function parseProtocol(json: string | null): Protocol | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json);
    return {
      how: p.how ?? '',
      result: p.result ?? '',
      rules: Array.isArray(p.rules) ? p.rules : [],
    };
  } catch {
    return null;
  }
}

export default function ProtocolsList({ tests }: { tests: Test[] }) {
  const [cat, setCat] = useState('ALL');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const categories = Array.from(new Set(tests.map((t) => t.categoryName)));
  const filtered = tests.filter((t) => cat === 'ALL' || t.categoryName === cat);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCat('ALL')}
          className={`rounded-full border px-3 py-1 text-sm ${
            cat === 'ALL'
              ? 'chip-active'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          Все · {tests.length}
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full border px-3 py-1 text-sm ${
              cat === c
                ? 'chip-active'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {c} · {tests.filter((t) => t.categoryName === c).length}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((t) => {
          const p = parseProtocol(t.protocolData);
          const isOpen = !!open[t.id];
          return (
            <div key={t.id} className="rounded-lg border border-gray-200 bg-white p-5">
              <button
                onClick={() => setOpen((o) => ({ ...o, [t.id]: !isOpen }))}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div>
                  <div className="font-bold">{t.name}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {t.categoryName} · {directionLabels[t.direction]} · QC{' '}
                    {t.qcMin ?? '…'}–{t.qcMax ?? '…'} {t.unit}
                  </div>
                </div>
                <span className="text-gray-400">{isOpen ? '▾' : '▸'}</span>
              </button>

              {isOpen && (
                <div className="mt-4 space-y-3 border-t border-gray-100 pt-4 text-sm">
                  {p ? (
                    <>
                      {p.how && (
                        <div>
                          <div className="mb-1 text-xs font-semibold text-gray-500">
                            Как выполнять
                          </div>
                          <p className="leading-relaxed text-gray-700">{p.how}</p>
                        </div>
                      )}
                      {p.rules && p.rules.length > 0 && (
                        <div>
                          <div className="mb-1 text-xs font-semibold text-gray-500">
                            Критерии оценки и зачёта
                          </div>
                          <ul className="list-disc space-y-1 pl-5 leading-relaxed text-gray-700">
                            {p.rules.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {p.result && (
                        <div>
                          <div className="mb-1 text-xs font-semibold text-gray-500">
                            Результат
                          </div>
                          <p className="leading-relaxed text-gray-700">{p.result}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">Протокол пока не заполнен.</p>
                  )}
                  {t.changeThreshold !== null && (
                    <div className="text-xs text-gray-500">
                      Порог значимости изменения (MDC): <b>{t.changeThreshold}</b>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}