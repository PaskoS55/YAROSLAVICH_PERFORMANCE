export const DEMO_TIMELINE_VERSION = 1;
export const DEMO_CHECKPOINT_OFFSETS = [-160, -135, -100, 0] as const;

export function demoTimeline(now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error('INVALID_DEMO_CLOCK');
  // Previous local calendar day at noon: never later than initialization,
  // including DST transitions. Persist the resulting instant, not a moving clock.
  const anchor = new Date(now);
  anchor.setDate(anchor.getDate() - 1);
  anchor.setHours(12, 0, 0, 0);
  const at = (days: number) => {
    const date = new Date(anchor);
    date.setDate(date.getDate() + days);
    return date;
  };
  return { anchor, checkpoints: DEMO_CHECKPOINT_OFFSETS.map(at),
    season: { name: `${at(-180).getFullYear()}/${at(120).getFullYear()} · Демо`, startDate: at(-180), endDate: at(120) },
    goalDeadlines: [at(14), at(60), at(7)] };
}

export function timelineMetadata(now: Date) {
  return { timelineVersion: DEMO_TIMELINE_VERSION, anchor: demoTimeline(now).anchor.toISOString(), initializedAt: now.toISOString() };
}
