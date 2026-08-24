'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireAppContext } from '../../lib/app-context';

type Phase = 'PRESEASON' | 'CAMP' | 'INSEASON' | 'POSTSEASON' | 'RECOVERY';
const PHASES = new Set<string>(['PRESEASON', 'CAMP', 'INSEASON', 'POSTSEASON', 'RECOVERY']);

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim().replace(',', '.');
  return s === '' ? null : Number(s);
};

export async function createBodyComposition(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const playerId = String(formData.get('playerId') ?? '');
  const dateStr = String(formData.get('date') ?? '');
  const mass = num(formData.get('mass'));
  const fat = num(formData.get('fat'));
  const ffm = num(formData.get('ffm'));
  const phase = num(formData.get('phase'));
  const phaseStr = String(formData.get('sessionPhase') ?? 'INSEASON').toUpperCase();

  // Валидация
  if (!playerId || !dateStr) {
    console.error('Body composition: игрок и дата обязательны.');
    return;
  }
  if (mass === null || fat === null || ffm === null) {
    console.error('Body composition: масса, жир и БЖМ обязательны.');
    return;
  }
  if (!Number.isFinite(mass) || !Number.isFinite(fat) || !Number.isFinite(ffm)) {
    console.error('Body composition: все значения должны быть числами.');
    return;
  }
  if (mass <= 0 || mass > 300) {
    console.error('Body composition: масса должна быть от 0 до 300 кг.');
    return;
  }
  if (fat < 0 || fat > 60) {
    console.error('Body composition: процент жира должен быть от 0 до 60%.');
    return;
  }
  if (ffm <= 0 || ffm > 300) {
    console.error('Body composition: БЖМ должна быть от 0 до 300 кг.');
    return;
  }
  if (phase !== null && (!Number.isFinite(phase) || phase < 0 || phase > 15)) {
    console.error('Body composition: фазовый угол должен быть от 0 до 15°.');
    return;
  }
  if (!PHASES.has(phaseStr)) {
    console.error('Body composition: некорректная фаза сезона.');
    return;
  }

  const date = new Date(dateStr + 'T12:00:00.000Z');
  if (Number.isNaN(date.getTime())) {
    console.error('Body composition: некорректная дата.');
    return;
  }

  const player = await prisma.player.findFirst({
    where: { id: playerId, teamId: context.teamId, deletedAt: null },
  });
  if (!player) {
    console.error('Body composition: игрок не найден или удалён.');
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      let session = await tx.testSession.findFirst({
        where: {
          playerId,
          DateTime: date,
          phase: phaseStr as Phase,
          teamId: context.teamId,
          seasonId: context.seasonId,
        },
      });

      if (!session) {
        const sessionId = `S-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        session = await tx.testSession.create({
          data: {
            sessionId,
            DateTime: date,
            phase: phaseStr as Phase,
            playerId,
            teamId: context.teamId,
            seasonId: context.seasonId,
          },
        });
      } else if (session.deletedAt) {
        session = await tx.testSession.update({
          where: { id: session.id },
          data: { deletedAt: null, teamId: context.teamId, seasonId: context.seasonId },
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
  } catch (err) {
    console.error('Body composition: ошибка записи', err);
  }
}
