'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

type Phase = 'PRESEASON' | 'CAMP' | 'INSEASON' | 'POSTSEASON' | 'RECOVERY';
const PHASES = new Set<string>(['PRESEASON', 'CAMP', 'INSEASON', 'POSTSEASON', 'RECOVERY']);

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim().replace(',', '.');
  return s === '' ? null : Number(s);
};

export async function createBodyComposition(formData: FormData) {
  const playerId = String(formData.get('playerId') ?? '');
  const dateStr = String(formData.get('date') ?? '');
  const mass = num(formData.get('mass'));
  const fat = num(formData.get('fat'));
  const ffm = num(formData.get('ffm'));
  const phase = num(formData.get('phase'));
  const phaseStr = String(formData.get('sessionPhase') ?? 'INSEASON').toUpperCase();

  // Валидация
  if (!playerId || !dateStr) return { error: 'Игрок и дата обязательны.' };
  if (mass === null || fat === null || ffm === null)
    return { error: 'Масса, жир и БЖМ обязательны.' };
  if (!Number.isFinite(mass) || !Number.isFinite(fat) || !Number.isFinite(ffm))
    return { error: 'Все значения должны быть числами.' };
  if (mass <= 0 || mass > 300) return { error: 'Масса должна быть от 0 до 300 кг.' };
  if (fat < 0 || fat > 60) return { error: 'Процент жира должен быть от 0 до 60%.' };
  if (ffm <= 0 || ffm > 300) return { error: 'БЖМ должна быть от 0 до 300 кг.' };
  if (phase !== null && (!Number.isFinite(phase) || phase < 0 || phase > 15))
    return { error: 'Фазовый угол должен быть от 0 до 15°.' };
  if (!PHASES.has(phaseStr)) return { error: 'Некорректная фаза сезона.' };

  const date = new Date(dateStr + 'T12:00:00.000Z');
  if (Number.isNaN(date.getTime())) return { error: 'Некорректная дата.' };

  const player = await prisma.player.findFirst({
    where: { id: playerId, deletedAt: null },
  });
  if (!player) return { error: 'Игрок не найден или удалён.' };

  const season = await prisma.season.findFirst();
  if (!season) return { error: 'Не настроен сезон — создайте его в настройках.' };

  // Атомарная запись: сессия + body composition
  await prisma.$transaction(async (tx) => {
    let session = await tx.testSession.findFirst({
      where: {
        playerId,
        DateTime: date,
        phase: phaseStr as Phase,
        deletedAt: null,
      },
    });

    if (!session) {
      let n = (await tx.testSession.count()) + 1;
      let sessionId = `S${String(n).padStart(3, '0')}`;
      while (await tx.testSession.findUnique({ where: { sessionId } })) {
        n += 1;
        sessionId = `S${String(n).padStart(3, '0')}`;
      }
      session = await tx.testSession.create({
        data: {
          sessionId,
          DateTime: date,
          phase: phaseStr as Phase,
          playerId,
          teamId: player.teamId,
          seasonId: season.id,
        },
      });
    }

    await tx.bodyComposition.create({
      data: {
        playerId,
        testSessionId: session.id,
        mass_kg: mass,
        fat_pct: fat,
        ffm_kg: ffm,
        phase_angle: phase,
      },
    });
  });

  revalidatePath('/body');
  revalidatePath('/players', 'layout');
  revalidatePath('/analytics', 'layout');
  return { ok: true };
}