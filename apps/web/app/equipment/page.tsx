import { prisma } from '../../lib/prisma';
import NewEquipmentSection from './new-equipment-section';
import EquipmentRow from './equipment-row';

const statusLabels: Record<string, string> = {
  ACTIVE: 'В работе',
  MAINTENANCE: 'На обслуживании',
  BROKEN: 'Неисправно',
  RETIRED: 'Списано',
};
const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800',
  BROKEN: 'bg-red-100 text-red-800',
  RETIRED: 'bg-gray-200 text-gray-600',
};

function warrantyInfo(d: Date | null | undefined) {
  if (!d) return { label: '—', color: 'text-gray-400' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(d);
  exp.setHours(0, 0, 0, 0);
  const days = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
  const label = exp.toLocaleDateString('ru-RU');
  if (days < 0) return { label: `${label} · истекла`, color: 'text-red-700' };
  if (days <= 30) return { label: `${label} · ещё ${days} дн.`, color: 'text-amber-700' };
  return { label, color: 'text-gray-600' };
}

export default async function EquipmentPage() {
  const items = await prisma.equipment.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-5 p-6">
      <NewEquipmentSection />

      {items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Оборудования ещё нет — добавьте первую запись через «+ Добавить».
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Название</th>
                <th className="px-4 py-2 text-left">Производитель</th>
                <th className="px-4 py-2 text-left">Модель</th>
                <th className="px-4 py-2 text-left">Гарантия</th>
                <th className="px-4 py-2 text-left">Статус</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((e) => {
                const w = warrantyInfo(e.warrantyExp);
                return (
                  <EquipmentRow
                    key={e.id}
                    item={{
                      id: e.id,
                      code: e.code,
                      name: e.name,
                      brand: e.brand,
                      model: e.model,
                      warrantyExp: e.warrantyExp ? e.warrantyExp.toISOString().slice(0, 10) : null,
                      status: e.status ?? 'ACTIVE',
                    }}
                    warrantyLabel={w.label}
                    warrantyColor={w.color}
                    statusLabel={statusLabels[e.status ?? 'ACTIVE']}
                    statusColor={statusColors[e.status ?? 'ACTIVE']}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}