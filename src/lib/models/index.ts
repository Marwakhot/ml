import { trainDecisionTree } from "./decisionTree";
import { trainGradientBoosting } from "./gradientBoosting";
import { trainKnn } from "./knn";
import { trainLinearSvm } from "./linearSvm";
import { trainLogisticRegression } from "./logisticRegression";
import { trainRandomForest } from "./randomForest";
import type { ModelTrainer, ModelType } from "./types";

export * from "./types";

export const MODEL_TRAINERS: Record<ModelType, ModelTrainer> = {
  logistic_regression: trainLogisticRegression,
  decision_tree: trainDecisionTree,
  random_forest: trainRandomForest,
  gradient_boosting: trainGradientBoosting,
  knn: trainKnn,
  linear_svm: trainLinearSvm,
};

export function getModelTrainer(modelType: string): ModelTrainer {
  const trainer = MODEL_TRAINERS[modelType as ModelType];
  if (!trainer) {
    throw new Error(`Unknown model_type "${modelType}"`);
  }
  return trainer;
}
