export const POSITIONS = new Set([
  'outside_hitter',
  'opposite',
  'middle_blocker',
  'setter',
  'libero',
]);

export const STATUSES = new Set(['ACTIVE', 'INJURED', 'LIMITED', 'INACTIVE']);

export type PlayerValidation =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

const str = (v: FormDataEntryValue | null) => String(v ?? '').trim();

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T12:00:00.000Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseRange(s: string, min: number, max: number, label: string): number | null | { error: string } {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < min || n > max) {
    return { error: `${label} должен быть от ${min} до ${max}.` };
  }
  return Math.round(n);
}

export function validatePlayerFields(formData: FormData): PlayerValidation {
  const lastName = str(formData.get('lastName'));
  const firstName = str(formData.get('firstName'));
  if (!lastName || !firstName) return { ok: false, error: 'Фамилия и имя обязательны.' };

  const middleName = str(formData.get('middleName')) || null;
  const playerIdInput = str(formData.get('playerId'));

  const position = str(formData.get('position')) || 'outside_hitter';
  if (!POSITIONS.has(position)) return { ok: false, error: 'Некорректное амплуа.' };

  const statusRaw = str(formData.get('status'));
  const status = statusRaw || 'ACTIVE';
  if (!STATUSES.has(status)) return { ok: false, error: 'Некорректный статус.' };

  const height = parseRange(str(formData.get('height')), 100, 250, 'Рост');
  if (typeof height === 'object' && 'error' in height) return { ok: false, error: height.error };

  const number = parseRange(str(formData.get('number')), 1, 99, 'Номер');
  if (typeof number === 'object' && 'error' in number) return { ok: false, error: number.error };

  const birthDateStr = str(formData.get('birthDate'));
  const birthDate = birthDateStr ? parseDate(birthDateStr) : null;
  if (birthDateStr && !birthDate) return { ok: false, error: 'Некорректная дата рождения.' };

  const joinedDateStr = str(formData.get('joinedDate'));
  const joinedDate = joinedDateStr ? parseDate(joinedDateStr) : null;
  if (joinedDateStr && !joinedDate) return { ok: false, error: 'Некорректная дата прихода.' };

  const comment = str(formData.get('comment')) || null;

  return {
    ok: true,
    data: {
      lastName,
      firstName,
      middleName,
      playerIdInput,
      position,
      status,
      height,
      number,
      birthDate,
      joinedDate,
      comment,
    },
  };
}