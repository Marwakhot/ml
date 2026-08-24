import { argmaxCounts, buildTree, predictTreeClassifier } from "./tree/core";
import type { ModelTrainer } from "./types";

const MAX_CANDIDATE_THRESHOLDS = 32;

export const trainDecisionTree: ModelTrainer = (XTrain, yTrain, numClasses, params) => {
  const maxDepth = (params.maxDepth as number | undefined) ?? 10;
  const indices = XTrain.map((_, i) => i);
  const tree = buildTree(XTrain, yTrain, indices, 0, {
    maxDepth,
    minSamplesLeaf: 3,
    maxCandidateThresholds: MAX_CANDIDATE_THRESHOLDS,
    kind: "classifier",
    numClasses,
  });

  return {
    predict(X: number[][]): number[] {
      return X.map((row) => argmaxCounts(predictTreeClassifier(tree, row)));
    },
  };
};
