import type { ModelHyperParams, TrainedModel } from "./types";

export interface BinaryScorer {
  /** Higher score = more confident the sample belongs to the positive class. */
  score(X: number[][]): number[];
}

export type BinaryTrainer = (
  X: number[][],
  yBinary: number[],
  params: ModelHyperParams
) => BinaryScorer;

/**
 * Generic one-vs-rest multiclass wrapper: trains one binary classifier per
 * class (that class vs everything else) and predicts the class whose
 * scorer is most confident. Used by the models this project implements from
 * scratch (linear SVM, gradient boosting), since they only have a natural
 * binary formulation.
 */
export function trainOneVsRest(
  X: number[][],
  y: number[],
  numClasses: number,
  params: ModelHyperParams,
  binaryTrainer: BinaryTrainer
): TrainedModel {
  const classifiers: BinaryScorer[] = [];
  for (let c = 0; c < numClasses; c++) {
    const yBinary = y.map((label) => (label === c ? 1 : 0));
    classifiers.push(binaryTrainer(X, yBinary, params));
  }

  return {
    predict(Xtest: number[][]): number[] {
      const scoresPerClass = classifiers.map((clf) => clf.score(Xtest));
      return Xtest.map((_, i) => {
        let best = 0;
        let bestScore = -Infinity;
        for (let c = 0; c < numClasses; c++) {
          if (scoresPerClass[c][i] > bestScore) {
            bestScore = scoresPerClass[c][i];
            best = c;
          }
        }
        return best;
      });
    },
  };
}
