import { buildTree, predictTreeRegressor, type TreeNode } from "./tree/core";
import type { BinaryScorer } from "./ovr";
import { trainOneVsRest } from "./ovr";
import type { ModelHyperParams, ModelTrainer } from "./types";

// Lightweight gradient boosting: shallow regression-tree stumps fit on the
// residual of binary log-loss, boosted one-vs-rest for multiclass. This is
// a from-scratch simplified GBM (not sklearn's), scoped down to what's
// cheap enough for a single serverless call — a handful of shallow trees
// rather than sklearn's deeper, larger ensembles.
const MAX_CANDIDATE_THRESHOLDS = 32;
const LEARNING_RATE = 0.15;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function trainBinaryGradientBoosting(
  X: number[][],
  yBinary: number[],
  params: ModelHyperParams
): BinaryScorer {
  const nEstimators = (params.nEstimators as number | undefined) ?? 30;
  const maxDepth = (params.maxDepth as number | undefined) ?? 3;
  const n = X.length;
  const indices = X.map((_, i) => i);

  const F = new Array(n).fill(0);
  const trees: TreeNode[] = [];

  for (let m = 0; m < nEstimators; m++) {
    const residuals = new Array(n);
    for (let i = 0; i < n; i++) {
      residuals[i] = yBinary[i] - sigmoid(F[i]);
    }

    const tree = buildTree(X, residuals, indices, 0, {
      maxDepth,
      minSamplesLeaf: 5,
      maxCandidateThresholds: MAX_CANDIDATE_THRESHOLDS,
      kind: "regressor",
    });

    for (let i = 0; i < n; i++) F[i] += LEARNING_RATE * predictTreeRegressor(tree, X[i]);
    trees.push(tree);
  }

  return {
    score(Xtest: number[][]): number[] {
      return Xtest.map((row) => {
        let s = 0;
        for (const tree of trees) s += LEARNING_RATE * predictTreeRegressor(tree, row);
        return s;
      });
    },
  };
}

export const trainGradientBoosting: ModelTrainer = (XTrain, yTrain, numClasses, params) => {
  return trainOneVsRest(XTrain, yTrain, numClasses, params, trainBinaryGradientBoosting);
};
