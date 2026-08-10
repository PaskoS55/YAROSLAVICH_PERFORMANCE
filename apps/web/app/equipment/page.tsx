import { prisma } from '../../lib/prisma';
import { createEquipment } from './actions';

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

export default async function EquipmentPage() {
  const items = await prisma.equipment.findMany({
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  });

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Оборудование</h1>

      <form
        action={createEquipment}
        className="grid grid-cols-1 gap-3 rounded-lg bg-white p-4 shadow md:grid-cols-5"
      >
        <input name="code" placeholder="Код (EQ01)" required className="rounded border-2 border-gray-300 px-2 py-1 text-sm" />
        <input name="name" placeholder="Название" required className="rounded border-2 border-gray-300 px-2 py-1 text-sm" />
        <input name="brand" placeholder="Производитель" className="rounded border-2 border-gray-300 px-2 py-1 text-sm" />
        <input name="model" placeholder="Модель" className="rounded border-2 border-gray-300 px-2 py-1 text-sm" />
        <button className="rounded bg-blue-600 px-4 py-1 text-sm text-white hover:bg-blue-700">
          Добавить
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Оборудование ещё не добавлено.</p>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Код</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Название</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Производитель</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Модель</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Гарантия до</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono">{e.code}</td>
                  <td className="px-4 py-2">{e.name}</td>
                  <td className="px-4 py-2 text-gray-500">{e.brand ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{e.model ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{fmtDate(e.warrantyExp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}