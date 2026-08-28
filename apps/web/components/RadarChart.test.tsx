import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RadarChart, { wrapRadarLabel } from './RadarChart';

const categories = ['Мощность', 'Скорость', 'Ловкость', 'Волейбол'].map((name, i) => ({ id: String(i), name }));
const render = (values: (number | null)[]) => renderToStaticMarkup(<RadarChart categories={categories} values={values} teamValues={[]} playerLabel="Игрок" />);
const player = (markup: string) => markup.match(/<g data-series="player"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? '';
describe('Radar missing values and labels', () => {
  it('does not emit a vertex or a closed polygon for a missing value', () => {
    const markup = render([60, null, 40, 50]);
    expect(player(markup)).not.toContain('<polygon');
    expect(player(markup).match(/<circle/g)).toHaveLength(3);
    expect(player(markup)).not.toContain('data-category-id="1"');
    expect(markup).toContain('Скорость Нет результата');
  });
  it('keeps real zero and full polygons, without coercing undefined/NaN to zero', () => {
    expect(player(render([0, 20, 60, 100]))).toContain('<polygon');
    expect(player(render([0, 20, 60, 100])).match(/<circle/g)).toHaveLength(4);
    expect(player(render([NaN]))).not.toContain('<circle');
    expect(player(render([null, null, null, null]))).not.toMatch(/<circle|<line|<polygon/);
  });
  it('wraps long Cyrillic labels including unbroken names into bounded tspans', () => {
    for (const label of ['Мобильность и стабильность', 'Выносливость и стабильность', 'А'.repeat(60)]) {
      expect(wrapRadarLabel(label).every(line => line.length <= 18)).toBe(true);
      expect(wrapRadarLabel(label).join('').replace(/\s/g, '')).toBe(label.replace(/\s/g, ''));
      const svg = renderToStaticMarkup(<RadarChart categories={[{ id: 'long', name: label }]} values={[50]} teamValues={[]} playerLabel="Игрок" />);
      expect(svg.match(/<tspan/g)!.length).toBeGreaterThan(1);
    }
  });
});
