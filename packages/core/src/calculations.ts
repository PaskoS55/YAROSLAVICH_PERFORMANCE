import {
  Direction,
  Category,
  ChangeStatus,
  NormAnchors,
  TestMeta,
  CalculationContext,
  ScoreResult,
  DeltaResult,
  CategoryScoreResult,
  OverallScoreResult,
  PBResult,
  GoalGapResult,
  AsymmetryResult,
  QCResult,
  QCStatus
} from './domain';

/**
 * Нормализация значения теста в Score (0-100) на основе перцентильных точек
 */
export function normalizeScore(
  value: number,
  anchors: NormAnchors,
  direction: Direction
): ScoreResult {
  const minAnchor = Math.min(anchors.anchor10, anchors.anchor25, anchors.anchor50, anchors.anchor75, anchors.anchor90);
  const maxAnchor = Math.max(anchors.anchor10, anchors.anchor25, anchors.anchor50, anchors.anchor75, anchors.anchor90);

  if (value < minAnchor * 0.5 || value > maxAnchor * 2) {
    return {
      score: null,
      isValid: false,
      message: `Значение ${value} выходит за пределы разумного диапазона нормативов (${minAnchor * 0.5} - ${maxAnchor * 2})`
    };
  }

  let score: number;

  if (value <= anchors.anchor10) {
    score = 0;
  } else if (value >= anchors.anchor90) {
    score = 100;
  } else {
    if (value <= anchors.anchor25) {
      const ratio = (value - anchors.anchor10) / (anchors.anchor25 - anchors.anchor10);
      score = 0 + ratio * 25;
    } else if (value <= anchors.anchor50) {
      const ratio = (value - anchors.anchor25) / (anchors.anchor50 - anchors.anchor25);
      score = 25 + ratio * 25;
    } else if (value <= anchors.anchor75) {
      const ratio = (value - anchors.anchor50) / (anchors.anchor75 - anchors.anchor50);
      score = 50 + ratio * 25;
    } else {
      const ratio = (value - anchors.anchor75) / (anchors.anchor90 - anchors.anchor75);
      score = 75 + ratio * 25;
    }
  }

  if (direction === 'LOWER_IS_BETTER') {
    score = 100 - score;
  }

  return {
    score: Number(score.toFixed(2)),
    isValid: true
  };
}

/**
 * Расчет дельты между двумя значениями теста
 */
export function calculateDelta(
  currentValue: number,
  previousValue: number,
  direction: Direction,
  changeThreshold?: number
): DeltaResult {
  const rawDelta = currentValue - previousValue;
  const performanceDelta = direction === 'LOWER_IS_BETTER' ? -rawDelta : rawDelta;
  
  if (changeThreshold === undefined || changeThreshold === null) {
    return {
      delta: Number(rawDelta.toFixed(2)),
      performanceDelta: Number(performanceDelta.toFixed(2)),
      changeStatus: 'THRESHOLD_NOT_CONFIGURED'
    };
  }

  const absPerformanceDelta = Math.abs(performanceDelta);
  
  if (absPerformanceDelta < changeThreshold) {
    return {
      delta: Number(rawDelta.toFixed(2)),
      performanceDelta: Number(performanceDelta.toFixed(2)),
      changeStatus: 'NO_CHANGE'
    };
  }

  if (performanceDelta > 0) {
    return {
      delta: Number(rawDelta.toFixed(2)),
      performanceDelta: Number(performanceDelta.toFixed(2)),
      changeStatus: 'SIGNIFICANT_IMPROVEMENT'
    };
  } else {
    return {
      delta: Number(rawDelta.toFixed(2)),
      performanceDelta: Number(performanceDelta.toFixed(2)),
      changeStatus: 'SIGNIFICANT_DECREASE'
    };
  }
}

/**
 * Классификация изменения на основе дельты и порога
 */
export function classifyChange(
  performanceDelta: number,
  changeThreshold: number
): ChangeStatus {
  const absDelta = Math.abs(performanceDelta);
  
  if (absDelta < changeThreshold) {
    return 'NO_CHANGE';
  }
  
  return performanceDelta > 0 
    ? 'SIGNIFICANT_IMPROVEMENT' 
    : 'SIGNIFICANT_DECREASE';
}

/**
 * Расчет Score категории на основе выполненных тестов
 */
export function calculateCategoryScore(
  testResults: Array<{ testCode: string; score: number | null }>,
  category: Category,
  context: CalculationContext
): CategoryScoreResult {
  const categoryTests = Object.entries(context.tests)
    .filter(([_, testMeta]) => testMeta.category === category)
    .map(([code, _]) => code);
  
  const validResults = testResults.filter(result => 
    categoryTests.includes(result.testCode) && 
    result.score !== null
  );
  
  if (validResults.length === 0) {
    return {
      score: null,
      countValidTests: 0,
      totalTestsInCategory: categoryTests.length,
      message: `Нет валидных результатов для категории ${category}`
    };
  }
  
  const sumScores = validResults.reduce((sum, result) => sum + (result.score || 0), 0);
  const avgScore = sumScores / validResults.length;
  
  return {
    score: Number(avgScore.toFixed(2)),
    countValidTests: validResults.length,
    totalTestsInCategory: categoryTests.length,
    message: `Рассчитано на основе ${validResults.length}/${categoryTests.length} тестов`
  };
}

/**
 * Расчет Overall Performance Score (без BODY_COMPOSITION)
 */
export function calculateOverallScore(
  categoryScores: Record<Category, number | null>,
  weights: Record<Category, number>
): OverallScoreResult {
  const categoriesForOverall = Object.keys(weights).filter(
    cat => cat !== 'BODY_COMPOSITION'
  ) as Category[];
  
  let weightedSum = 0;
  let totalWeight = 0;
  const calculatedCategories: Record<Category, number | null> = {};
  
  for (const category of categoriesForOverall) {
    const score = categoryScores[category];
    const weight = weights[category];
    
    calculatedCategories[category] = score;
    
    if (score !== null) {
      weightedSum += score * weight;
      totalWeight += weight;
    }
  }
  
  if (totalWeight === 0) {
    return {
      score: null,
      categoryScores: calculatedCategories,
      message: "Нет валидных Score для категорий, участвующих в Overall Score"
    };
  }
  
  const overallScore = weightedSum / totalWeight;
  
  return {
    score: Number(overallScore.toFixed(2)),
    categoryScores: calculatedCategories,
    message: `Рассчитано на основе ${categoriesForOverall.filter(cat => categoryScores[cat] !== null).length}/${categoriesForOverall.length} категорий`
  };
}

/**
 * Расчет Personal Best (PB) для игрока по конкретному тесту
 */
export function calculatePB(
  playerId: string,
  testCode: string,
  currentValue: number,
  allPlayerResults: Array<{ testCode: string; value: number; date: Date }>,
  direction: Direction
): PBResult {
  const testResults = allPlayerResults.filter(r => r.testCode === testCode);
  
  if (testResults.length === 0) {
    return {
      currentValue,
      pbValue: currentValue,
      isNewPB: true,
      improvement: 0,
      relativeImprovement: 0
    };
  }
  
  let pbValue: number;
  
  if (direction === 'HIGHER_IS_BETTER') {
    pbValue = Math.max(...testResults.map(r => r.value));
  } else {
    pbValue = Math.min(...testResults.map(r => r.value));
  }
  
  const isNewPB = direction === 'HIGHER_IS_BETTER' 
    ? currentValue > pbValue 
    : currentValue < pbValue;
  
  const bestValue = isNewPB ? currentValue : pbValue;
  const previousBest = isNewPB ? pbValue : currentValue;
  
  let improvement: number | null = null;
  let relativeImprovement: number | null = null;
  
  if (previousBest !== 0) {
    improvement = bestValue - previousBest;
    relativeImprovement = (improvement / Math.abs(previousBest)) * 100;
  }
  
  return {
    currentValue,
    pbValue: bestValue,
    isNewPB,
    improvement: improvement !== null ? Number(improvement.toFixed(2)) : null,
    relativeImprovement: relativeImprovement !== null ? Number(relativeImprovement.toFixed(2)) : null
  };
}

/**
 * Расчет разницы до цели
 */
export function calculateGoalGap(
  currentValue: number,
  targetValue: number,
  direction: Direction
): GoalGapResult {
  let gap: number;
  
  if (direction === 'HIGHER_IS_BETTER') {
    gap = targetValue - currentValue;
  } else {
    gap = currentValue - targetValue;
  }
  
  const progress = direction === 'HIGHER_IS_BETTER' 
    ? Math.min(100, (currentValue / targetValue) * 100)
    : Math.min(100, ((targetValue - currentValue) / targetValue) * 100);
  
  return {
    currentValue,
    targetValue,
    gap: Number(gap.toFixed(2)),
    progressPercentage: Number(Math.max(0, progress).toFixed(2))
  };
}

/**
 * Расчет асимметрии между левой и правой стороной тела
 */
export function calculateAsymmetry(
  leftValue: number,
  rightValue: number
): AsymmetryResult {
  const absoluteDifference = Math.abs(leftValue - rightValue);
  const average = (leftValue + rightValue) / 2;
  const relativeDifference = average !== 0 ? (absoluteDifference / average) * 100 : 0;
  
  let sideFavored: 'LEFT' | 'RIGHT' | 'BALANCED';
  if (Math.abs(leftValue - rightValue) < 0.01) {
    sideFavored = 'BALANCED';
  } else if (leftValue > rightValue) {
    sideFavored = 'LEFT';
  } else {
    sideFavored = 'RIGHT';
  }
  
  return {
    left: Number(leftValue.toFixed(2)),
    right: Number(rightValue.toFixed(2)),
    absoluteDifference: Number(absoluteDifference.toFixed(2)),
    relativeDifference: Number(relativeDifference.toFixed(2)),
    sideFavored
  };
}

/**
 * Проверка значения на соответствие QC диапазону
 */
export function qcCheckValue(
  value: number,
  min: number,
  max: number
): QCResult {
  if (value < min || value > max) {
    return {
      value,
      min,
      max,
      status: 'FAILED',
      message: `Значение ${value} вне допустимого диапазона [${min}, ${max}]`
    };
  }
  
  return {
    value,
    min,
    max,
    status: 'PASSED'
  };
}

/**
 * Получение норматива для теста и позиции игрока
 */
export function getNormForTestAndPosition(
  testCode: string,
  position: string,
  norms: Record<string, Record<string, NormAnchors>>
): NormAnchors | null {
  const testNorms = norms[testCode];
  if (!testNorms) {
    return null;
  }
  
  if (testNorms[position]) {
    return testNorms[position];
  }
  
  if (testNorms['ALL'] || testNorms['GENERAL']) {
    return testNorms['ALL'] || testNorms['GENERAL'];
  }
  
  return null;
}
