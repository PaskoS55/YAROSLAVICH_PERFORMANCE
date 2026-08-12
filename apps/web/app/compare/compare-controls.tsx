'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

type Player = { id: string; lastName: string; firstName: string; playerId: string };

const field = 'mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm';
const label = 'block text-xs font-medium text-gray-500';

export default function CompareControls({
  players,
  aId,
  bId,
}: {
  players: Player[];
  aId: string;
  bId: string;
}) {
  const router = useRouter();
  const go = (a: string, b: string) => router.push(`/compare?a=${a}&b=${b}`);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className={label}>
        Игрок A
        <select value={aId} onChange={(e) => go(e.target.value, bId)} className={field}>
          {players.map((p) => (
            <option key={p.id} value={p.id} disabled={p.id === bId}>
              {p.lastName} {p.firstName} · {p.playerId}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Игрок B
        <select value={bId} onChange={(e) => go(aId, e.target.value)} className={field}>
          {players.map((p) => (
            <option key={p.id} value={p.id} disabled={p.id === aId}>
              {p.lastName} {p.firstName} · {p.playerId}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}