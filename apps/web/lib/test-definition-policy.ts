export type ReferenceIdentity = { unit: string; direction: string; categoryId: string | null };

export function changesReferencedMetricIdentity(current: ReferenceIdentity, next: ReferenceIdentity) {
  return current.unit !== next.unit || current.direction !== next.direction || current.categoryId !== next.categoryId;
}
