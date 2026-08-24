export interface ClassificationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
}

/**
 * Macro-averaged precision/recall/F1 (unweighted mean across classes that
 * actually appear in yTrue), plus overall accuracy. Macro averaging is used
 * so a model that ignores a minority class gets penalized even if
 * accuracy looks fine — relevant for the class-imbalance experiment axis.
 */
export function computeMetrics(
  yTrue: number[],
  yPred: number[],
  numClasses: number
): ClassificationMetrics {
  const tp = new Array(numClasses).fill(0);
  const fp = new Array(numClasses).fill(0);
  const fn = new Array(numClasses).fill(0);
  let correct = 0;

  for (let i = 0; i < yTrue.length; i++) {
    const t = yTrue[i];
    const p = yPred[i];
    if (t === p) {
      correct++;
      tp[t]++;
    } else {
      fp[p]++;
      fn[t]++;
    }
  }

  let precisionSum = 0;
  let recallSum = 0;
  let f1Sum = 0;
  let presentClasses = 0;

  for (let c = 0; c < numClasses; c++) {
    const support = tp[c] + fn[c];
    if (support === 0) continue;
    presentClasses++;

    const precision = tp[c] + fp[c] === 0 ? 0 : tp[c] / (tp[c] + fp[c]);
    const recall = tp[c] / support;
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    precisionSum += precision;
    recallSum += recall;
    f1Sum += f1;
  }

  const denom = Math.max(presentClasses, 1);
  return {
    accuracy: yTrue.length === 0 ? 0 : correct / yTrue.length,
    precision: precisionSum / denom,
    recall: recallSum / denom,
    f1: f1Sum / denom,
  };
}
