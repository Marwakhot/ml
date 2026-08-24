import { mulberry32 } from "@/lib/prng";
import { argmaxCounts, buildTree, predictTreeClassifier, type TreeNode } from "./tree/core";
import type { ModelTrainer } from "./types";

const MAX_CANDIDATE_THRESHOLDS = 32;

export const trainRandomForest: ModelTrainer = (XTrain, yTrain, numClasses, params) => {
  const nEstimators = (params.nEstimators as number | undefined) ?? 25;
  const maxDepth = (params.maxDepth as number | undefined) ?? 12;
  const numFeatures = XTrain[0]?.length ?? 0;
  const maxFeaturesPerSplit = Math.max(1, Math.round(Math.sqrt(numFeatures)));
  const n = XTrain.length;

  const rng = mulberry32(42);
  const trees: TreeNode[] = [];

  for (let t = 0; t < nEstimators; t++) {
    const bootstrapIndices: number[] = new Array(n);
    for (let i = 0; i < n; i++) bootstrapIndices[i] = Math.floor(rng() * n);

    trees.push(
      buildTree(XTrain, yTrain, bootstrapIndices, 0, {
        maxDepth,
        minSamplesLeaf: 3,
        maxCandidateThresholds: MAX_CANDIDATE_THRESHOLDS,
        kind: "classifier",
        numClasses,
        maxFeaturesPerSplit,
        rng,
      })
    );
  }

  return {
    predict(X: number[][]): number[] {
      return X.map((row) => {
        const votes = new Array(numClasses).fill(0);
        for (const tree of trees) {
          votes[argmaxCounts(predictTreeClassifier(tree, row))]++;
        }
        return argmaxCounts(votes);
      });
    },
  };
};
