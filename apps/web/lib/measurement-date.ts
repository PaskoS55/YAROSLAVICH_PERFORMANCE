// Date-only forms represent a completed calendar-day measurement, not noon UTC.
// Local midnight is stable, displays on the entered day, and is never later
// than submission time for today's date. Future dates remain future records.
export function measurementDay(input: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) throw new Error('Некорректная дата.');
  const [year, month, day] = input.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  if (year < 1900 || year > 2200 || start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) {
    throw new Error('Некорректная дата.');
  }
  const end = new Date(year, month - 1, day + 1);
  return { start, end };
}
