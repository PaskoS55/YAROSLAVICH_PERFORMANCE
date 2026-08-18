'use client';

import React, { useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createTest, updateTest } from './actions';

export type Cat = { id: string; name: string };
export type TestInit = {
  id?: string;
  code: string;
  name: string;
  unit: string;
  direction: string;
  categoryId: string | null;
  qcMin: number | null;
  qcMax: number | null;
  qcDescription: string | null;
  changeThreshold: number | null;
  cv: number | null;
  alertBelow: number | null;
  alertAbove: number | null;
  equipment: string | null;
  source: string | null;
  comment: string | null;
  protocol: { how: string; result: string; rules: string[] };
};

const field = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm';
const label = 'block text-xs font-medium text-gray-500';
const section = 'rounded-lg border border-gray-200 bg-white p-6';
const h2 = 'mb-4 text-lg font-bold';

function FieldHelp({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex cursor-help">
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-gray-300 text-[9px] font-semibold text-gray-500 group-hover:border-red-400 group-hover:text-red-600">
        ?
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-200" />
      </span>
    </span>
  );
}

export function ArchiveButton() {
  return (
    <button
      type="submit"
      className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
      onClick={(e) => {
        const ok = window.prompt(
          'Архивировать тест? Он исчезнет из нового тестирования и целей, но все исторические данные и аналитика сохранятся.\n\nДля подтверждения введите АРХИВ:'
        );
        if (ok !== 'АРХИВ') e.preventDefault();
      }}
    >
      Архивировать
    </button>
  );
}

export default function TestEditor({
  test,
  categories,
  hasResults,
  resultsCount,
}: {
  test: TestInit | null;
  categories: Cat[];
  hasResults: boolean;
  resultsCount: number;
}) {
  const router = useRouter();
  const [state, formAction] = useFormState(test?.id ? updateTest : createTest, null);
  const [rules, setRules] = useState<string[]>(
    test?.protocol.rules.length ? test.protocol.rules : ['']
  );
  const [catId, setCatId] = useState(test?.categoryId ?? '');

  useEffect(() => {
    if (state?.ok) router.push('/tests');
  }, [state, router]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (test?.id && hasResults) {
      const f = e.currentTarget;
      const unit = (f.elements.namedItem('unit') as HTMLInputElement).value.trim();
      const direction = (f.elements.namedItem('direction') as HTMLSelectElement).value;
      if (unit !== test.unit || direction !== test.direction) {
        const ok = window.confirm(
          `Для этого теста уже существует ${resultsCount} результатов. Изменение единицы или направления повлияет на интерпретацию исторических данных. Продолжить?`
        );
        if (!ok) {
          e.preventDefault();
          return;
        }
        (f.elements.namedItem('confirmed') as HTMLInputElement).value = '1';
      }
    }
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-5">
      {test?.id && <input type="hidden" name="id" value={test.id} />}
      <input type="hidden" name="confirmed" defaultValue="" />

      <div className={section}>
        <h2 className={h2}>Основное</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={label}>
            Название *
            <input name="name" required defaultValue={test?.name ?? ''} className={field} />
          </label>
          <label className={label}>
            Код *{' '}
            {test?.id && (
              <span className="text-gray-400">(не изменяется после создания)</span>
            )}
            <input
              name="code"
              required
              readOnly={!!test?.id}
              defaultValue={test?.code ?? ''}
              placeholder="PLY_RSI"
              className={`${field} ${test?.id ? 'bg-gray-50 text-gray-500' : ''} font-mono`}
            />
          </label>
          <label className={label}>
            Категория *
            <select
              name="categoryId"
              value={catId}
              onChange={(e) => setCatId(e.target.value)}
              className={field}
            >
              <option value="">— выберите —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__new__">+ Новая категория…</option>
            </select>
          </label>
          {catId === '__new__' && (
            <label className={label}>
              Название новой категории
              <input name="newCategory" className={field} placeholder="Плиометрика" />
            </label>
          )}
          <label className={label}>
            Единица измерения *
            <input
              name="unit"
              required
              list="units-list"
              defaultValue={test?.unit ?? ''}
              placeholder="см"
              className={field}
            />
            <datalist id="units-list">
              {['см', 'м', 'с', 'мс', 'кг', '%', 'Вт', 'Вт/кг', 'м/с', 'баллы', 'км/ч'].map(
                (u) => (
                  <option key={u} value={u} />
                )
              )}
            </datalist>
          </label>
        </div>
      </div>

      <div className={section}>
        <h2 className={h2}>Интерпретация результата</h2>
        <label className={label}>
          Направление
          <select
            name="direction"
            defaultValue={test?.direction ?? 'HIGHER_IS_BETTER'}
            className={field}
          >
            <option value="HIGHER_IS_BETTER">↑ Больше — лучше</option>
            <option value="LOWER_IS_BETTER">↓ Меньше — лучше</option>
            <option value="CONTEXTUAL">· Контекстное</option>
          </select>
        </label>
        <p className="mt-2 text-xs text-gray-500">
          Направление управляет сравнением, динамикой, PB и нормативами во всей системе.
        </p>
      </div>

      <div className={section}>
        <h2 className={h2}>Контроль качества</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={label}>
            <span className="flex items-center gap-1.5">
              QC минимум
              <FieldHelp text="Нижняя граница физиологически возможного значения. Замеры ниже помечаются как ошибка измерения и попадают в «Контроль данных»." />
            </span>
            <input name="qcMin" inputMode="decimal" defaultValue={test?.qcMin ?? ''} className={field} />
          </label>
          <label className={label}>
            <span className="flex items-center gap-1.5">
              QC максимум
              <FieldHelp text="Верхняя граница физиологически возможного значения. Замеры выше помечаются как ошибка измерения (например, 200 см в CMJ у волейболиста)." />
            </span>
            <input name="qcMax" inputMode="decimal" defaultValue={test?.qcMax ?? ''} className={field} />
          </label>
          <label className={`${label} md:col-span-2`}>
            <span className="flex items-center gap-1.5">
              Описание QC
              <FieldHelp text="Почему выбраны именно такие границы. Памятка тренеру и методическая документация для коллег." />
            </span>
            <input name="qcDescription" defaultValue={test?.qcDescription ?? ''} className={field} placeholder="Диапазон 10–90 см. Ниже — ошибка платформы, выше — датчик." />
          </label>
          <label className={label}>
            <span className="flex items-center gap-1.5">
              MDC
              <FieldHelp text="Минимально значимое изменение (Minimum Detectable Change). Выше этого порога изменение считается реальным прогрессом или регрессом, а не шумом измерения." />
            </span>
            <input name="changeThreshold" inputMode="decimal" defaultValue={test?.changeThreshold ?? ''} className={field} />
          </label>
          <label className={label}>
            <span className="flex items-center gap-1.5">
              CV
              <FieldHelp text="Коэффициент вариации, %. Характеризует воспроизводимость теста: <3% — отлично, 3–5% — хорошо, >10% — ненадёжно." />
            </span>
            <input name="cv" inputMode="decimal" defaultValue={test?.cv ?? ''} className={field} />
          </label>
          <label className={label}>
            <span className="flex items-center gap-1.5">
              Порог «ниже»
              <FieldHelp text="Если последний результат игрока ≤ порога, на его карточке появится предупреждение «Требует внимания» (например, MOB_OHS ≤ 4)." />
            </span>
            <input name="alertBelow" inputMode="decimal" defaultValue={test?.alertBelow ?? ''} className={field} />
          </label>
          <label className={label}>
            <span className="flex items-center gap-1.5">
              Порог «выше»
              <FieldHelp text="Если последний результат игрока ≥ порога, на его карточке появится предупреждение «Требует внимания»." />
            </span>
            <input name="alertAbove" inputMode="decimal" defaultValue={test?.alertAbove ?? ''} className={field} />
          </label>
        </div>
      </div>

      <div className={section}>
        <h2 className={h2}>Протокол</h2>
        <div className="space-y-4">
          <label className={label}>
            Как выполнять
            <textarea name="how" rows={4} defaultValue={test?.protocol.how ?? ''} className={field} />
          </label>
          <label className={label}>
            Как определяется результат
            <input name="result" defaultValue={test?.protocol.result ?? ''} className={field} />
          </label>
          <div>
            <span className={label}>Критерии зачёта</span>
            <div className="mt-1 space-y-2">
              {rules.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    name="rules"
                    value={r}
                    onChange={(e) =>
                      setRules((rs) => rs.map((x, j) => (j === i ? e.target.value : x)))
                    }
                    placeholder={`Правило ${i + 1}`}
                    className={field}
                  />
                  <button
                    type="button"
                    onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))}
                    className="shrink-0 rounded-lg border border-gray-200 px-3 text-sm text-gray-500 hover:bg-gray-50"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRules((rs) => [...rs, ''])}
              className="mt-2 text-sm font-medium hover:underline"
              style={{ color: 'var(--red)' }}
            >
              + Добавить правило
            </button>
          </div>
        </div>
      </div>

      <div className={section}>
        <h2 className={h2}>Дополнительно</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={label}>
            Оборудование
            <input name="equipment" defaultValue={test?.equipment ?? ''} className={field} />
          </label>
          <label className={label}>
            Источник / автор протокола
            <input name="source" defaultValue={test?.source ?? ''} className={field} />
          </label>
          <label className={`${label} md:col-span-2`}>
            Комментарий
            <textarea name="comment" rows={2} defaultValue={test?.comment ?? ''} className={field} />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary">Сохранить тест</button>
        <a
          href="/tests"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Отмена
        </a>
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}