import Image from 'next/image';
import { redirect } from 'next/navigation';
import { PRODUCT_ASSETS, PRODUCT_IDENTITY } from '@pasko-performance/core/product';
import { LICENSING_ENFORCEMENT, getRuntimeLicenseState, readLicenseMetadata } from '../../lib/license-policy';
import { LicenseActivation } from './license-activation';

export default async function LicensePage({ searchParams }: { searchParams: Promise<{ replace?: string }> }) {
  if (!LICENSING_ENFORCEMENT) redirect('/setup');
  const state = getRuntimeLicenseState();
  const replacing = (await searchParams).replace === '1';
  if (state === 'VALID' && !replacing) redirect('/setup');
  const metadata = readLicenseMetadata();
  const messages: Record<string,string> = { UNLICENSED: 'Для продолжения требуется лицензия.', EXPIRED: 'Срок действия лицензии истёк.', INVALID: 'Подпись или формат лицензии не прошли проверку.', WRONG_INSTALLATION: 'Лицензия не подходит для этой установки.', NOT_YET_VALID: 'Срок действия лицензии ещё не начался.', CLOCK_ROLLBACK_SUSPECTED: 'Обнаружено существенное изменение системного времени.' };
  return <main className="setup-shell"><div className="setup-card"><Image src={PRODUCT_ASSETS.logoLight} alt={PRODUCT_IDENTITY.display} width={300} height={100} className="mx-auto h-auto w-[240px]" priority/><div className="mt-6 space-y-5"><div className="setup-step-badge">Лицензия</div><h1 className="text-3xl font-extrabold">{replacing ? 'Замена лицензии' : 'Активация PASKO Performance'}</h1><p>{state === 'VALID' ? 'Лицензия активна.' : messages[state]}</p><div className="rounded-xl bg-gray-50 p-4"><div className="text-xs text-gray-500">ID установки</div><div className="mt-1 break-all font-mono font-semibold">{process.env.PASKO_INSTALLATION_ID || 'Доступен в Desktop-приложении'}</div></div><p className="text-sm text-gray-600">Передайте ID установки поставщику лицензии и выберите полученный файл <code>.pasko-license</code>.</p>{metadata && <p className="text-sm">Текущая лицензия: {metadata.licenseId}</p>}<LicenseActivation requirePassword={replacing}/><div className="flex gap-4 text-sm"><a href="/api/backup" className="underline">Экспорт данных</a><a href="/settings/diagnostics" className="underline">Диагностика</a></div></div><p className="mt-7 border-t border-gray-100 pt-4 text-center text-xs text-gray-400">{PRODUCT_IDENTITY.creator.creditRu}</p></div></main>;
}
