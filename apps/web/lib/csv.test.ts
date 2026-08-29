import { describe, expect, it } from 'vitest';
import { csvCell, csvRow, csvAttachment } from './csv';

describe('report CSV cell safety', () => {
  it('preserves Cyrillic, delimiters, quotes and multiline text as one cell', () => {
    expect(csvRow(['Игрок; «А»', 'Имя "Б"\nстрока', 319.5])).toBe('"Игрок; «А»";"Имя ""Б""\nстрока";319,5');
  });
  it('neutralizes spreadsheet formulas without changing real numeric cells', () => {
    for (const value of ['=1+1', '+1', '-1', '@SUM(1)', '  =1', '\t=1']) expect(csvCell(value)).toBe(`"'${value}"`);
    expect(csvCell(-1.5)).toBe('-1,5');
    expect(csvCell('')).toBe('""');
  });
});

describe('CSV attachment filenames', () => {
  it('preserves Unicode through an ASCII RFC5987 header', () => {
    const filename = 'player_ИГРОК-1.csv';
    const response = new Response('', { headers: { 'Content-Disposition': csvAttachment(filename) } });
    const header = response.headers.get('Content-Disposition')!;
    expect(header).toContain('filename="player______-1.csv"');
    expect(decodeURIComponent(header.split("UTF-8''")[1])).toBe(filename);
  });
  it('cannot inject headers or path separators', () => {
    const header = csvAttachment('player_"\r\n/\\;ф.csv');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).toMatch(/^attachment; filename="[A-Za-z0-9._-]+"; filename\*=UTF-8''/);
    expect(() => new Headers({ 'Content-Disposition': header })).not.toThrow();
  });
});
