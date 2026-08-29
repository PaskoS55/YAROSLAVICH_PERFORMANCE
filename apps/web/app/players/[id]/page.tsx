import { prisma } from '../../../lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PrintButton from './print-button';
import PlayerProfilePanel from '../../../components/PlayerProfilePanel';
import { buildProfileModel } from '../../../lib/profile-model';
import { latestMeasurements, personalBests } from '../../../lib/measurements';
import { hasProfileConfirmation } from '../../../lib/profile-confirmation';
import { requireAppContext } from '../../../lib/app-context';
import { loadTeamReferenceProfile, referenceEntryMap, resolveReferenceEntry } from '../../../lib/references';

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
  LIMITED: 'Ограничен',
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
  PARTIAL: 'Частично',
  INCOMPLETE: 'Не завершено',
  RESTRICTED: 'Ограничение',
};

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export default async function PlayerCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAppContext();
  const now = new Date();
  const player = await prisma.player.findFirst({
    where: { id, teamId: context.teamId, deletedAt: null },
    include: {
      team: true,
      testSessions: {
        where: { teamId: context.teamId, seasonId: context.seasonId, deletedAt: null, DateTime: { lte: now } },
        orderBy: { DateTime: 'desc' },
        include: {
          testResults: { where: { deletedAt: null, qcStatus: 'PASSED' }, include: { test: true } },
        },
      },
      goals: { where: { deletedAt: null }, include: { test: true } },
    },
  });

  if (!player) notFound();

  const referenceProfile = await loadTeamReferenceProfile(context.teamId);
  const referenceByKey = referenceEntryMap(referenceProfile?.entries ?? []);
  const referenceConfirmed = !!referenceProfile?.explicitlySelected && await hasProfileConfirmation(context.teamId, referenceProfile);
  const referenceLabel = (code: string, unit: string) => {
    const entry = resolveReferenceEntry(referenceByKey, code, player.position);
    if (!entry) return 'Нет референса';
    if (entry.interpretationType === 'NO_REFERENCE') return 'Системный референс пока не утверждён';
    if (entry.interpretationType === 'CONTEXT_ONLY') return entry.notes ?? 'Контекстная интерпретация';
    if (entry.interpretationType === 'POOLED_ESTIMATE') return `${entry.mean} ${unit}; 95% CI pooled mean ${entry.ciLow}–${entry.ciHigh}`;
    if (entry.interpretationType === 'PUBLISHED_DISTRIBUTION') return `${entry.mean}${entry.sd != null ? ` ± ${entry.sd}` : ''} ${unit}${entry.position === null ? ' · все позиции' : ''}`;
    if (entry.interpretationType === 'EMPIRICAL_PERCENTILE') return 'Эмпирические перцентили доступны';
    return 'Референс доступен';
  };

  const radarCategories = await prisma.testCategory.findMany({
    where: { active: true, includeInRadar: true },
    include: { tests: { where: { deletedAt: null }, orderBy: { code: 'asc' } } },
    orderBy: [{ radarOrder: 'asc' }, { sortOrder: 'asc' }],
  });

  const allPlayers = await prisma.player.findMany({
    where: { teamId: context.teamId, deletedAt: null, status: { in: ['ACTIVE', 'LIMITED'] } },
    include: {
      testSessions: {
        where: { teamId: context.teamId, seasonId: context.seasonId, deletedAt: null, DateTime: { lte: now } },
        include: {
          testResults: { where: { deletedAt: null, qcStatus: 'PASSED' }, include: { test: true } },
        },
      },
    },
  });

  const lastSession = player.testSessions[0];

  const latest = latestMeasurements(player.testSessions, now);

  const alerts: string[] = [];
  for (const { value, name, unit, alertBelow, alertAbove } of Array.from(latest.values())) {
    if (alertBelow !== null && value <= alertBelow) {
      alerts.push(
        `Низкий результат по тесту «${name}» (${value} ${unit} при пороге ${alertBelow}) — консультация специалиста.`
      );
    }
    if (alertAbove !== null && value >= alertAbove) {
      alerts.push(
        `Высокий результат по тесту «${name}» (${value} ${unit} при пороге ${alertAbove}) — консультация специалиста.`
      );
    }
  }


  const profileModel = buildProfileModel(radarCategories, referenceProfile?.entries ?? [], referenceProfile, player, referenceConfirmed, now, allPlayers);
  const { cats, strengths, zones } = profileModel;
  const pbMap = personalBests(player.testSessions, now);

  const pbList = [...pbMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PlayerProfilePanel model={profileModel} referenceConfirmed={referenceConfirmed} referenceProfile={referenceProfile} />

        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-3 text-xl font-bold">Сильные стороны</h2>
            {strengths.length === 0 ? (
              <p className="text-sm text-gray-500">{cats.length ? 'Нет категорий с баллом ≥ 60.' : 'Нет совместимых данных по категориям профиля.'}</p>
            ) : (
              <ul className="space-y-2">
                {strengths.map((s) => (
                  <li key={s.key} className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
                    <span className="text-sm font-medium text-green-800">↑ {s.label}</span>
                    <span className="font-mono text-sm font-bold text-green-700">{Math.round(s.score)} баллов</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-3 text-xl font-bold">Зоны роста</h2>
            {zones.length === 0 ? (
              <p className="text-sm text-gray-500">{cats.length ? 'Нет категорий с баллом ≤ 40.' : 'Нет совместимых данных по категориям профиля.'}</p>
            ) : (
              <ul className="space-y-2">
                {zones.map((s) => (
                  <li key={s.key} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
                    <span className="text-sm font-medium text-amber-800">↓ {s.label}</span>
                    <span className="font-mono text-sm font-bold text-amber-700">{Math.round(s.score)} баллов</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Выраженные зоны роста показываются только при балле ≤ 40, сильные стороны — при балле ≥ 60.
            </p>
          </div>
        </div>
      </div>

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
                    <th className="py-1 pr-4">Референс</th>
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
                        <td className="max-w-72 py-1 pr-4 text-xs text-gray-500">{referenceLabel(r.test.code, r.test.unit)}</td>
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
