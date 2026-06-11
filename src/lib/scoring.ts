export type ScoreResult = 0 | 3 | 4 | 5;

export function calculatePoints(
  actualA: number,
  actualB: number,
  predictedA: number,
  predictedB: number
): ScoreResult {
  if (predictedA === actualA && predictedB === actualB) return 5;

  const actualMargin = actualA - actualB;
  const predictedMargin = predictedA - predictedB;
  const correctResult = Math.sign(actualMargin) === Math.sign(predictedMargin);

  if (correctResult && actualMargin === predictedMargin) return 4;
  if (correctResult) return 3;
  return 0;
}
