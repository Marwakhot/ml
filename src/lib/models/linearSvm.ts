import type { ModelHyperParams, ModelTrainer } from "./types";
import type { BinaryScorer } from "./ovr";
import { trainOneVsRest } from "./ovr";

// Batch sub-gradient descent on L2-regularized hinge loss. Features are
// standardized upstream, so a fixed learning rate converges reliably
// without needing a per-sample Pegasos-style 1/t schedule.
const LAMBDA = 1e-4;
const LEARNING_RATE = 0.05;
const EPOCHS = 200;

function trainBinaryLinearSvm(
  X: number[][],
  yBinary: number[],
  // Linear SVM has no tunable hyperparams in this project's config surface;
  // kept for signature parity with BinaryTrainer.
  params: ModelHyperParams
): BinaryScorer {
  void params;
  const n = X.length;
  const d = X[0]?.length ?? 0;
  const y = yBinary.map((v) => (v === 1 ? 1 : -1));
  const w = new Array(d).fill(0);
  let b = 0;

  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    const dw = new Array(d).fill(0);
    let db = 0;

    for (let i = 0; i < n; i++) {
      let margin = b;
      for (let j = 0; j < d; j++) margin += w[j] * X[i][j];
      if (y[i] * margin < 1) {
        for (let j = 0; j < d; j++) dw[j] -= y[i] * X[i][j];
        db -= y[i];
      }
    }

    for (let j = 0; j < d; j++) {
      w[j] -= LEARNING_RATE * (LAMBDA * w[j] + dw[j] / n);
    }
    b -= LEARNING_RATE * (db / n);
  }

  return {
    score(Xtest: number[][]): number[] {
      return Xtest.map((row) => {
        let s = b;
        for (let j = 0; j < d; j++) s += w[j] * row[j];
        return s;
      });
    },
  };
}

export const trainLinearSvm: ModelTrainer = (XTrain, yTrain, numClasses, params) => {
  return trainOneVsRest(XTrain, yTrain, numClasses, params, trainBinaryLinearSvm);
};
