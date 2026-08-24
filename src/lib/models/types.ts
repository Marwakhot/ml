export type ModelType =
  | "logistic_regression"
  | "decision_tree"
  | "random_forest"
  | "gradient_boosting"
  | "knn"
  | "linear_svm";

export interface TrainedModel {
  predict(X: number[][]): number[];
}

export interface ModelHyperParams {
  maxDepth?: number;
  nEstimators?: number;
  k?: number;
  [key: string]: unknown;
}

export type ModelTrainer = (
  XTrain: number[][],
  yTrain: number[],
  numClasses: number,
  params: ModelHyperParams
) => TrainedModel;

export const MODEL_TYPES: ModelType[] = [
  "logistic_regression",
  "decision_tree",
  "random_forest",
  "gradient_boosting",
  "knn",
  "linear_svm",
];

export const MODEL_LABELS: Record<ModelType, string> = {
  logistic_regression: "Logistic Regression",
  decision_tree: "Decision Tree",
  random_forest: "Random Forest",
  gradient_boosting: "Gradient Boosting",
  knn: "k-Nearest Neighbors",
  linear_svm: "Linear SVM",
};
