'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createBodyComposition(formData: FormData) {
  const playerId = String(formData.get('playerId') ?? '');
  const dateStr = String(formData.get('date') ?? '');
  const mass = Number(String(formData.get('mass') ?? '').replace(',', '.'));
  const fat = Number(String(formData.get('fat') ?? '').replace(',', '.'));
  const ffm = Number(String(formData.get('ffm') ?? '').replace(',', '.'));
  const phaseStr = String(formData.get('phase') ?? '').replace(',', '.');

  if (!playerId || !dateStr || Number.isNaN(mass) || Number.isNaN(fat) || Number.isNaN(ffm)) {
    return;
  }

  const date = new Date(dateStr + 'T12:00:00.000Z');

  let session = await prisma.testSession.findFirst({
    where: { playerId, DateTime: date, deletedAt: null },
  });
  if (!session) {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return;
    let n = (await prisma.testSession.count()) + 1;
    let sessionId = `S${String(n).padStart(3, '0')}`;
    while (await prisma.testSession.findUnique({ where: { sessionId } })) {
      n += 1;
      sessionId = `S${String(n).padStart(3, '0')}`;
    }
    const season = await prisma.season.findFirst();
    session = await prisma.testSession.create({
      data: {
        sessionId,
        DateTime: date,
        phase: 'INSEASON',
        playerId,
        teamId: player.teamId,
        seasonId: season!.id,
      },
    });
  }

  await prisma.bodyComposition.create({
    data: {
      playerId,
      testSessionId: session.id,
      mass_kg: mass,
      fat_pct: fat,
      ffm_kg: ffm,
      phase_angle: phaseStr && !Number.isNaN(Number(phaseStr)) ? Number(phaseStr) : null,
    },
  });

  revalidatePath('/body');
  revalidatePath('/players', 'layout');
}