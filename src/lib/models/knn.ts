import KNN from "ml-knn";
import type { ModelTrainer } from "./types";

export const trainKnn: ModelTrainer = (XTrain, yTrain, _numClasses, params) => {
  const defaultK = Math.max(1, Math.min(15, Math.round(Math.sqrt(XTrain.length))));
  const k = (params.k as number | undefined) ?? defaultK;
  const model = new KNN(XTrain, yTrain, { k });

  return {
    predict(X: number[][]): number[] {
      return model.predict(X);
    },
  };
};
