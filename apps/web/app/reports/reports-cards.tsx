'use client';

import React, { useState } from 'react';

type Player = { id: string; lastName: string; firstName: string; playerId: string };
type Session = { id: string; sessionId: string; date: string; playerLabel: string };

const field = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm';
const label = 'block text-xs font-medium text-gray-500';

export default function ReportsCards({
  players,
  sessions,
}: {
  players: Player[];
  sessions: Session[];
}) {
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '');
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? '');

  const download = (url: string) => {
    window.location.href = url;
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-bold">Командная сводка</h2>
        <p className="mt-1 text-sm text-gray-600">
          Матрица «все игроки × все тесты» с последними результатами.
        </p>
        <button
          className="btn-primary mt-4"
          onClick={() => download('/api/export?type=team')}
        >
          Скачать CSV
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-bold">По игроку</h2>
        <p className="mt-1 text-sm text-gray-600">
          История результатов выбранного игрока.
        </p>
        <label className={`${label} mt-3`}>
          Игрок
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className={field}
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.lastName} {p.firstName} · {p.playerId}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn-primary mt-4"
          onClick={() => download(`/api/export?type=player&id=${playerId}`)}
        >
          Скачать CSV
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-bold">По сессии</h2>
        <p className="mt-1 text-sm text-gray-600">
          Все результаты выбранной сессии тестирования.
        </p>
        <label className={`${label} mt-3`}>
          Сессия
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className={field}
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.playerLabel} · {s.date}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn-primary mt-4"
          onClick={() => download(`/api/export?type=session&id=${sessionId}`)}
        >
          Скачать CSV
        </button>
      </div>
    </div>
  );
}