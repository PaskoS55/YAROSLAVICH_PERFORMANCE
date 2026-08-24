import Link from 'next/link';
import { getAppContext } from '../../../lib/app-context';
import { collectDiagnostics } from '../../../lib/diagnostics';

const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export default async function DiagnosticsPage() {
  const context = await getAppContext();
  const data = await collectDiagnostics();
  return <div className="space-y-5 p-6"><div><Link href="/settings" className="text-sm link-action">← Настройки</Link><h1 className="mt-2 text-3xl font-bold">Диагностика</h1><p className="text-sm text-gray-500">Локальная информация для проверки состояния установки. Данные никуда не отправляются.</p></div>
    <section className="grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">{[
      ['Версия', data.productVersion], ['ID установки', data.installationId ?? 'Недоступен'], ['Лицензия', data.license.state], ['План', data.license.plan ?? '—'], ['Runtime', data.appRuntime], ['База данных', data.databaseStatus], ['PostgreSQL', data.postgresMajor], ['Текущая migration', data.currentMigration ?? 'Нет'], ['Точек восстановления', String(data.snapshotCount)], ['Общий размер', size(data.snapshotStorageSize)], ['PASKO Reference', data.referenceProfileStatus], ['Организация', context.status === 'READY' ? context.organizationName : 'Контекст не выбран'], ['Команда', context.status === 'READY' ? context.teamName : '—'], ['Сезон', context.status === 'READY' ? context.seasonName : '—'],
    ].map(([label, value])=><div key={label} className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 break-all text-sm font-semibold">{value}</div></div>)}</section>
    <section className="rounded-xl border bg-white p-5"><h2 className="text-lg font-bold">Внутренние точки восстановления</h2><p className="mt-1 text-xs text-gray-500">Предназначены только для этой установки и могут содержать чувствительные локальные данные, включая хеши учётных записей.</p><div className="mt-3 space-y-2">{data.snapshots.length ? data.snapshots.map(item=><div key={item.snapshotId} className="grid gap-1 rounded-lg border p-3 text-sm sm:grid-cols-4"><span>{new Date(item.createdAt).toLocaleString('ru-RU')}</span><span>{item.reason === 'PRE_MIGRATION' ? 'Перед обновлением базы' : item.reason}</span><span>v{item.productVersion}</span><span>{size(item.sizeBytes)} · Проверена</span></div>) : <p className="text-sm text-gray-500">Точки восстановления пока не создавались.</p>}</div></section>
    <section className="rounded-xl border bg-white p-5"><h2 className="text-lg font-bold">Поддержка</h2><p className="mt-1 text-sm text-gray-600">ZIP содержит только техническую диагностику, redacted logs и manifests. Database dump и персональные данные игроков не включаются.</p><a href="/api/support-bundle" className="btn-primary mt-4 inline-block">Экспортировать диагностику</a></section>
  </div>;
}
