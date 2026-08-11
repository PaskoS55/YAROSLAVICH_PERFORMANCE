import Link from 'next/link';
import { createPlayer } from './actions';

const positions: [string, string][] = [
  ['outside_hitter', 'Доигровщик'],
  ['opposite', 'Диагональный'],
  ['middle_blocker', 'Центральный блокирующий'],
  ['setter', 'Связующий'],
  ['libero', 'Либеро'],
];

const field = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm';
const label = 'block text-xs font-medium text-gray-500';

export default function NewPlayerPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="text-sm text-gray-500">
        <Link href="/players" className="link-action hover:underline">Игроки</Link> / новый
      </div>
      <h1 className="text-3xl font-bold">Добавить игрока</h1>

      <form
        action={createPlayer}
        className="grid max-w-3xl grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-6 md:grid-cols-2"
      >
        <label className={label}>
          Фамилия *
          <input name="lastName" required className={field} />
        </label>
        <label className={label}>
          Имя *
          <input name="firstName" required className={field} />
        </label>
        <label className={label}>
          Отчество
          <input name="middleName" className={field} />
        </label>
        <label className={label}>
          Код игрока
          <input name="playerId" placeholder="авто, если оставить пустым" className={field} />
        </label>
        <label className={label}>
          Амплуа
          <select name="position" className={field}>
            {positions.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Рост, см
          <input name="height" type="number" min="140" max="230" className={field} />
        </label>
        <label className={label}>
          Дата рождения
          <input name="birthDate" type="date" className={field} />
        </label>
        <div className="flex items-end gap-2">
          <button className="btn-primary">Сохранить игрока</button>
          <Link
            href="/players"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Отмена
          </Link>
        </div>
      </form>
    </div>
  );
}