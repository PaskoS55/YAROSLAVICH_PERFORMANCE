// Domain types for PASKO PERFORMANCE PLATFORM

export type Direction = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | 'CONTEXTUAL';

export type Category = 
  | 'STRENGTH' 
  | 'POWER' 
  | 'SPEED' 
  | 'AGILITY' 
  | 'VOLLEYBALL' 
  | 'MOBILITY_STABILITY' 
  | 'BODY_COMPOSITION';

export type ChangeStatus = 
  | 'SIGNIFICANT_IMPROVEMENT' 
  | 'SIGNIFICANT_DECREASE' 
  | 'MINOR_CHANGE' 
  | 'NO_CHANGE'
  | 'THRESHOLD_NOT_CONFIGURED';

export type QCStatus = 'PASSED' | 'FAILED' | 'NOT_CHECKED';

export type SessionPhase = 'PRESEASON' | 'CAMP' | 'INSEASON' | 'POSTSEASON' | 'RECOVERY';

export type PlayerStatus = 'ACTIVE' | 'INJURED' | 'LIMITED' | 'INACTIVE';

export type SessionStatus = 'FULL' | 'PARTIAL' | 'INCOMPLETE' | 'RESTRICTED';

export type SessionSource = 'MANUAL' | 'MEDASS' | 'TENSOR_PLATFORM' | 'PHOTO_CELLS' | 'CSV' | 'API' | 'OTHER';

export interface NormAnchors {
  anchor10: number;   // 10th percentile
  anchor25: number;   // 25th percentile
  anchor50: number;   // 50th percentile (median)
  anchor75: number;   // 75th percentile
  anchor90: number;   // 90th percentile
}

export interface TestMeta {
  code: string;
  direction: Direction;
  category: Category;
  unit: string;
  changeThreshold?: number; // minimum meaningful change (MDC)
  cv?: number;             // coefficient of variation
}

export interface PlayerTestResult {
  playerId: string;
  testName: string;
  testCode: string;
  value: number;
  date: Date;
}

export interface CalculationContext {
  norms: Record<string, Record<string, NormAnchors>>; // { testCode: { position: anchors } }
  categoryWeights: Record<Category, number>;
  tests: Record<string, TestMeta>;
}

export interface ScoreResult {
  score: number | null;
  isValid: boolean;
  message?: string;
}

export interface DeltaResult {
  delta: number | null;
  performanceDelta: number | null; // inverted for lower-is-better tests
  changeStatus: ChangeStatus;
}

export interface CategoryScoreResult {
  score: number | null;
  countValidTests: number;
  totalTestsInCategory: number;
  message?: string;
}

export interface OverallScoreResult {
  score: number | null;
  categoryScores: Record<Category, number | null>;
  message?: string;
}

export interface PBResult {
  currentValue: number;
  pbValue: number | null;
  isNewPB: boolean;
  improvement: number | null;
  relativeImprovement: number | null;
}

export interface GoalGapResult {
  currentValue: number;
  targetValue: number;
  gap: number;
  progressPercentage: number;
}

export interface AsymmetryResult {
  left: number;
  right: number;
  absoluteDifference: number;
  relativeDifference: number;
  sideFavored: 'LEFT' | 'RIGHT' | 'BALANCED';
}

export interface QCResult {
  value: number;
  min: number;
  max: number;
  status: QCStatus;
  message?: string;
}
