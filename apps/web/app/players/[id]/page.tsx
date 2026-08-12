import { prisma } from '../../../lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PrintButton from './print-button';

const positionLabels: Record<string, string> = {
  outside_hitter: 'Доигровщик',
  opposite: 'Диагональный',
  middle_blocker: 'Центральный блокирующий',
  setter: 'Связующий',
  libero: 'Либеро',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Активен',
  INJURED: 'Травмирован',
  LIMITED: 'Ограничение',
  INACTIVE: 'Неактивен',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INJURED: 'bg-red-100 text-red-800',
  LIMITED: 'bg-yellow-100 text-yellow-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
};

const phaseLabels: Record<string, string> = {
  PRESEASON: 'Предсезонка',
  CAMP: 'Сборы',
  INSEASON: 'Сезон',
  POSTSEASON: 'Постсезон',
  RECOVERY: 'Восстановление',
};

const sessionStatusLabels: Record<string, string> = {
  FULL: 'Полное',
  PARTIAL: 'Частичное',
  INCOMPLETE: 'Не завершено',
  RESTRICTED: 'Ограничение',
};

const categoryLabels: Record<string, string> = {
  STRENGTH: 'Сила',
  POWER: 'Мощность',
  SPEED: 'Скорость',
  AGILITY: 'Ловкость',
  VOLLEYBALL: 'Волейбол',
  MOBILITY_STABILITY: 'Мобильность',
};

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

function computePercentile(
  value: number,
  norm: { anchor10: number; anchor25: number; anchor50: number; anchor75: number; anchor90: number } | null
): number | null {
  if (!norm) return null;
  let pts = [
    { p: 10, v: norm.anchor10 },
    { p: 25, v: norm.anchor25 },
    { p: 50, v: norm.anchor50 },
    { p: 75, v: norm.anchor75 },
    { p: 90, v: norm.anchor90 },
  ];
  // Нормативы LOWER_IS_BETTER хранятся в обратном порядке — разворачиваем
  if (pts[0].v > pts[4].v) pts = pts.slice().reverse();
  if (value <= pts[0].v) return pts[0].p;
  if (value >= pts[4].v) return pts[4].p;
  for (let i = 0; i < 4; i++) {
    if (value >= pts[i].v && value <= pts[i + 1].v) {
      const ratio = (value - pts[i].v) / (pts[i + 1].v - pts[i].v);
      return Math.round(pts[i].p + ratio * (pts[i + 1].p - pts[i].p));
    }
  }
  return 50;
}

function radarPolygon(values: number[], cx: number, cy: number, r: number): string {
  return values
    .map((v, i) => {
      const angle = (Math.PI / 180) * (60 * i - 90);
      const rr = (r * v) / 100;
      return `${(cx + rr * Math.cos(angle)).toFixed(1)},${(cy + rr * Math.sin(angle)).toFixed(1)}`;
    })
    .join(' ');
}

export default async function PlayerCardPage({ params }: { params: { id: string } }) {
  const player = await prisma.player.findUnique({
    where: { id: params.id },
    include: {
      team: true,
      testSessions: {
        where: { deletedAt: null },
        orderBy: { DateTime: 'desc' },
        include: { testResults: { include: { test: true } } },
      },
      goals: { include: { test: true } },
    },
  });

  if (!player || player.deletedAt) notFound();

  const allNorms = await prisma.norm.findMany({ where: { deletedAt: null } });
  const normByKey = new Map(allNorms.map((n) => [`${n.position}|${n.testCode}`, n]));

  const allPlayers = await prisma.player.findMany({
    where: { deletedAt: null, status: { in: ['ACTIVE', 'LIMITED'] } },
    include: {
      testSessions: {
        where: { deletedAt: null },
        include: { testResults: { include: { test: true } } },
      },
    },
  });

  const lastSession = player.testSessions[0];

  const latest = new Map<string, { value: number; code: string; category: string; direction: string }>();
  for (const s of player.testSessions) {
    for (const r of s.testResults) {
      if (!latest.has(r.testId)) {
        latest.set(r.testId, { value: r.value, code: r.test.code, category: r.test.category, direction: r.test.direction });
      }
    }
  }
  const latestByCode = new Map<string, number>();
  for (const { value, code } of latest.values()) latestByCode.set(code, value);

  const catAcc = new Map<string, { sum: number; count: number }>();
  for (const { value, code, category } of latest.values()) {
    if (!categoryLabels[category]) continue;
    const pct = computePercentile(value, normByKey.get(`${player.position}|${code}`) ?? null);
    if (pct === null) continue;
    const acc = catAcc.get(category) ?? { sum: 0, count: 0 };
    acc.sum += pct;
    acc.count += 1;
    catAcc.set(category, acc);
  }

  const teamAcc = new Map<string, { sum: number; count: number }>();
  for (const tp of allPlayers) {
    const tLatest = new Map<string, { value: number; code: string; category: string }>();
    const sorted = [...tp.testSessions].sort(
      (a, b) => new Date(b.DateTime).getTime() - new Date(a.DateTime).getTime()
    );
    for (const s of sorted) {
      for (const r of s.testResults) {
        if (!tLatest.has(r.testId)) {
          tLatest.set(r.testId, { value: r.value, code: r.test.code, category: r.test.category });
        }
      }
    }
    for (const { value, code, category } of tLatest.values()) {
      if (!categoryLabels[category]) continue;
      const pct = computePercentile(value, normByKey.get(`${tp.position}|${code}`) ?? null);
      if (pct === null) continue;
      const acc = teamAcc.get(category) ?? { sum: 0, count: 0 };
      acc.sum += pct;
      acc.count += 1;
      teamAcc.set(category, acc);
    }
  }

  const cats = Object.keys(categoryLabels)
    .filter((c) => catAcc.has(c))
    .map((c) => ({
      key: c,
      label: categoryLabels[c],
      pct: Math.round(catAcc.get(c)!.sum / catAcc.get(c)!.count),
    }));

  const radarOrder = Object.keys(categoryLabels).map((c) =>
    catAcc.has(c) ? Math.round(catAcc.get(c)!.sum / catAcc.get(c)!.count) : 0
  );
  const teamOrder = Object.keys(categoryLabels).map((c) =>
    teamAcc.has(c) ? Math.round(teamAcc.get(c)!.sum / teamAcc.get(c)!.count) : 0
  );

  const strengths = [...cats].sort((a, b) => b.pct - a.pct).slice(0, 3);
  const zones = [...cats].sort((a, b) => a.pct - b.pct).slice(0, 3);

  const pbMap = new Map<string, { name: string; unit: string; value: number; date: Date }>();
  for (const s of [...player.testSessions].reverse()) {
    for (const r of s.testResults) {
      if (r.test.direction === 'CONTEXTUAL') continue;
      const cur = pbMap.get(r.testId);
      const better =
        !cur || (r.test.direction === 'HIGHER_IS_BETTER' ? r.value > cur.value : r.value < cur.value);
      if (better) {
        pbMap.set(r.testId, { name: r.test.name, unit: r.test.unit, value: r.value, date: s.DateTime });
      }
    }
  }
  const pbList = [...pbMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const alerts: string[] = [];
  const mobOhs = latestByCode.get('MOB_OHS');
  const mobSl = latestByCode.get('MOB_SL');
  if (mobOhs !== undefined && mobOhs <= 4) {
    alerts.push(`Низкий балл мобильности в приседе с палкой (${mobOhs}/10) — консультация специалиста.`);
  }
  if (mobSl !== undefined && mobSl <= 4) {
    alerts.push(`Низкий балл выпада в линию (${mobSl}/10) — консультация специалиста.`);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div>
          <Link href="/players" className="text-blue-600 hover:underline">Игроки</Link> / {player.playerId}
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <Link
            href={`/players/${player.id}/edit`}
            className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
          >
            Редактировать
          </Link>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
          <h2 className="font-bold text-red-900">⚠ Требует внимания</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">
            {alerts.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-6 rounded-lg bg-white p-6 shadow">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-3xl font-bold text-gray-500">
          {player.lastName[0]}
          {player.firstName[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {player.lastName} {player.firstName} {player.middleName || ''}
            </h1>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColors[player.status]}`}>
              {statusLabels[player.status]}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-600 md:grid-cols-4">
            <div>Амплуа: <b>{positionLabels[player.position] || player.position}</b></div>
            <div>Рост: <b>{player.height ? `${player.height} см` : '—'}</b></div>
            <div>Дата рождения: <b>{fmtDate(player.birthDate)}</b></div>
            <div>Команда: <b>{player.team.name}</b></div>
          </div>
        </div>
        <div className="text-right text-sm text-gray-500">
          <div>Последнее тестирование</div>
          <div className="text-lg font-semibold text-gray-900">
            {lastSession ? fmtDate(lastSession.DateTime) : '—'}
          </div>
        </div>
      </div>

      {cats.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-2 text-xl font-bold">Профиль игрока</h2>
            <svg viewBox="0 0 260 240" className="w-full">
              {[25, 50, 75, 100].map((lvl) => (
                <polygon
                  key={lvl}
                  points={radarPolygon([lvl, lvl, lvl, lvl, lvl, lvl], 130, 120, 90)}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              ))}
              <polygon
                points={radarPolygon(teamOrder, 130, 120, 90)}
                fill="rgba(107, 114, 128, 0.12)"
                stroke="#9ca3af"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              {cats.map((c) => {
                const order = Object.keys(categoryLabels).indexOf(c.key);
                const angle = (Math.PI / 180) * (60 * order - 90);
                const lx = 130 + 108 * Math.cos(angle);
                const ly = 120 + 108 * Math.sin(angle);
                return (
                  <text key={c.key} x={lx} y={ly} fontSize="9" textAnchor="middle" fill="#6b7280">
                    {c.label} {c.pct}
                  </text>
                );
              })}
              <polygon
                points={radarPolygon(radarOrder, 130, 120, 90)}
                fill="rgba(200, 16, 46, 0.18)"
                stroke="#c8102e"
                strokeWidth="2"
              />
            </svg>
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--red)' }} />
                Игрок
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
                Средний по команде (последние тесты)
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Средний процентиль (0–100) относительно нормативов амплуа «{positionLabels[player.position]}».
            </p>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-3 text-xl font-bold">Сильные стороны</h2>
              <ul className="space-y-2">
                {strengths.map((s) => (
                  <li key={s.key} className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
                    <span className="text-sm font-medium text-green-800">↑ {s.label}</span>
                    <span className="font-mono text-sm font-bold text-green-700">p{s.pct}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-3 text-xl font-bold">Зоны роста</h2>
              <ul className="space-y-2">
                {zones.map((s) => (
                  <li key={s.key} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
                    <span className="text-sm font-medium text-amber-800">↓ {s.label}</span>
                    <span className="font-mono text-sm font-bold text-amber-700">p{s.pct}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-gray-500">
                Категории с самым низким процентилем — фокус ближайшего микроцикла.
              </p>
            </div>
          </div>
        </div>
      )}

      {pbList.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">Персональные рекорды</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {pbList.map((pb) => (
              <div key={pb.name} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <div className="text-xs text-gray-500">{pb.name}</div>
                <div className="font-mono text-lg font-bold text-amber-800">
                  🏆 {pb.value} {pb.unit}
                </div>
                <div className="text-xs text-gray-500">{fmtDate(pb.date)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-bold">
          История тестирований ({player.testSessions.length})
        </h2>
        {player.testSessions.length === 0 && <p className="text-gray-500">Тестирований пока нет.</p>}
        <div className="space-y-6">
          {player.testSessions.map((s) => (
            <div key={s.id} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-semibold">
                  {fmtDate(s.DateTime)} — {phaseLabels[s.phase] || s.phase}
                </div>
                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs">
                  {sessionStatusLabels[s.status] || s.status}
                </span>
              </div>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-1 pr-4">Тест</th>
                    <th className="py-1 pr-4">Результат</th>
                    <th className="py-1">QC</th>
                  </tr>
                </thead>
                <tbody>
                  {s.testResults.map((r) => {
                    const pb = pbMap.get(r.testId);
                    const isPB = pb && pb.value === r.value;
                    return (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-1 pr-4">{r.test.name}</td>
                        <td className="py-1 pr-4 font-mono">
                          {r.value} {r.test.unit} {isPB && '🏆'}
                        </td>
                        <td className="py-1">
                          {r.qcStatus === 'PASSED' ? '✓' : r.qcStatus === 'FAILED' ? '✗' : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-bold">Цели ({player.goals.length})</h2>
        {player.goals.length === 0 && <p className="text-gray-500">Целей пока нет.</p>}
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-1 pr-4">Тест</th>
              <th className="py-1 pr-4">Цель</th>
              <th className="py-1 pr-4">Срок</th>
              <th className="py-1">Статус</th>
            </tr>
          </thead>
          <tbody>
            {player.goals.map((g) => (
              <tr key={g.id} className="border-b last:border-0">
                <td className="py-1 pr-4">{g.test.name}</td>
                <td className="py-1 pr-4 font-mono">
                  {g.targetValue} {g.test.unit}
                </td>
                <td className="py-1 pr-4">{fmtDate(g.targetDate)}</td>
                <td className="py-1">{g.achieved ? '✅ Достигнута' : '⏳ В работе'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}