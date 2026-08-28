'use client';

import { useActionState } from 'react';
import { assignReferenceProfile, cloneReferenceProfile, updateReferenceEntry, type ReferenceActionState } from './actions';

const initial: ReferenceActionState = null;
export function AssignProfileButton({ profileId, selected }: { profileId: string; selected: boolean }) {
  const [state, action, pending] = useActionState(assignReferenceProfile, initial);
  return <form action={action} className="max-w-sm space-y-2"><input type="hidden" name="profileId" value={profileId} /><label className="block text-xs"><input type="checkbox" name="compatibilityConfirmed" value="yes" required /> Подтверждаю соответствие команды полу, возрастной группе, уровню, единицам и протоколам этого референса. Не применяйте полоспецифичный профиль к смешанной команде.</label><button disabled={pending} className="btn-primary disabled:opacity-50">{pending ? 'Сохраняем…' : selected ? 'Подтвердить совместимость' : 'Подтвердить и использовать'}</button>{state?.error && <p className="text-xs text-red-600">{state.error}</p>}{state?.ok && <p className="text-xs text-green-700">Совместимость подтверждена для текущей команды и версии профиля.</p>}</form>;
}

export function CloneProfileForm({ profileId, suggestedName }: { profileId: string; suggestedName: string }) {
  const [state, action, pending] = useActionState(cloneReferenceProfile, initial);
  return <form action={action} className="flex flex-wrap items-end gap-2"><input type="hidden" name="profileId" value={profileId} /><label className="min-w-64 flex-1 text-sm">Название профиля клуба<input name="name" required defaultValue={suggestedName} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label><button disabled={pending} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold">{pending ? 'Создаём…' : 'Создать профиль клуба на основе этого'}</button>{state?.error && <p className="w-full text-xs text-red-600">{state.error}</p>}{state?.ok && <p className="w-full text-xs text-green-700">Профиль создан. Откройте его в списке выше.</p>}</form>;
}

type EditableEntry = { id: string; interpretationType: string; mean: number | null; sd: number | null; ciLow: number | null; ciHigh: number | null; referenceLow: number | null; referenceHigh: number | null; p10: number | null; p25: number | null; p50: number | null; p75: number | null; p90: number | null; notes: string | null; sourceText: string | null };
export function EntryEditor({ entry }: { entry: EditableEntry }) {
  const [state, action, pending] = useActionState(updateReferenceEntry, initial);
  const fields = ['mean','sd','ciLow','ciHigh','referenceLow','referenceHigh','p10','p25','p50','p75','p90'] as const;
  return <details className="mt-3 rounded-lg bg-gray-50 p-3"><summary className="cursor-pointer text-sm font-semibold">Редактировать профиль клуба</summary><form action={action} className="mt-3 space-y-3"><input type="hidden" name="entryId" value={entry.id} /><label className="block text-sm">Тип<select name="interpretationType" defaultValue={entry.interpretationType} className="ml-2 rounded border px-2 py-1">{['PUBLISHED_DISTRIBUTION','POOLED_ESTIMATE','EMPIRICAL_PERCENTILE','REFERENCE_RANGE','ORDINAL_SCALE','CONTEXT_ONLY','NO_REFERENCE'].map(v=><option key={v}>{v}</option>)}</select></label><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{fields.map(field=><label key={field} className="text-xs text-gray-600">{field}<input name={field} defaultValue={entry[field] ?? ''} inputMode="decimal" className="mt-1 w-full rounded border px-2 py-1 text-sm" /></label>)}</div><label className="block text-xs">Примечание<textarea name="notes" defaultValue={entry.notes ?? ''} className="mt-1 w-full rounded border p-2" /></label><label className="block text-xs">Пользовательский источник<textarea name="sourceText" defaultValue={entry.sourceText ?? ''} className="mt-1 w-full rounded border p-2" /></label><button disabled={pending} className="btn-primary">{pending ? 'Сохраняем…' : 'Сохранить'}</button>{state?.error && <p className="text-xs text-red-600">{state.error}</p>}{state?.ok && <p className="text-xs text-green-700">Сохранено.</p>}</form></details>;
}
