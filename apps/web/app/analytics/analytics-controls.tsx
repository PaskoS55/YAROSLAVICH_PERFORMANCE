'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

type Player = { id: string; lastName: string; firstName: string; playerId: string };
type Test = { id: string; name: string };

const field = 'mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm';
const label = 'block text-xs font-medium text-gray-500';

export default function AnalyticsControls({
  players,
  tests,
  playerId,
  testId,
}: {
  players: Player[];
  tests: Test[];
  playerId: string;
  testId: string;
}) {
  const router = useRouter();
  const go = (pid: string, tid: string) =>
    router.push(`/analytics?playerId=${pid}&testId=${tid}`);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className={label}>
        Игрок
        <select
          value={playerId}
          onChange={(e) => go(e.target.value, testId)}
          className={field}
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.lastName} {p.firstName} · {p.playerId}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Тест
        <select
          value={testId}
          onChange={(e) => go(playerId, e.target.value)}
          className={field}
        >
          {tests.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}