export type NormAnchors = {
  anchor10: number;
  anchor25: number;
  anchor50: number;
  anchor75: number;
  anchor90: number;
};

// Процентиль унифицирован: выше = всегда лучше.
// HIGHER_IS_BETTER: меньшее значение -> меньший процентиль;
// LOWER_IS_BETTER: меньшее значение -> больший процентиль.
export function computePercentile(
  value: number,
  norm: NormAnchors | null,
  direction: string
): number | null {
  if (!norm) return null;
  const anchors = [
    { v: norm.anchor10 },
    { v: norm.anchor25 },
    { v: norm.anchor50 },
    { v: norm.anchor75 },
    { v: norm.anchor90 },
  ].sort((a, b) => a.v - b.v);
  const seq = direction === 'LOWER_IS_BETTER' ? [90, 75, 50, 25, 10] : [10, 25, 50, 75, 90];
  const pts = anchors.map((a, i) => ({ v: a.v, p: seq[i] }));
  if (value <= pts[0].v) return pts[0].p;
  if (value >= pts[4].v) return pts[4].p;
  for (let i = 0; i < 4; i++) {
    if (value >= pts[i].v && value <= pts[i + 1].v) {
      const ratio = (value - pts[i].v) / (pts[i + 1].v - pts[i].v);
      return Math.round(pts[i].p + ratio * (pts[i + 1].p - pts[i].p));
    }
  }
  return 50;
}

export function fmtVal(v: number) {
  return (Math.round(v * 100) / 100).toString().replace('.', ',');
}