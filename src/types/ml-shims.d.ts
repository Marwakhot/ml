/**
 * ml-knn and ml-logistic-regression ship no type declarations. These are
 * hand-written from each package's actual source (not just its README) —
 * only the surface this project calls.
 */

declare module "ml-knn" {
  export default class KNN {
    constructor(
      dataset: number[][],
      labels: number[],
      options?: { k?: number }
    );
    predict(dataset: number[][]): number[];
  }
}

declare module "ml-logistic-regression" {
  import { Matrix } from "ml-matrix";

  export default class LogisticRegression {
    constructor(options?: { numSteps?: number; learningRate?: number });
    train(X: Matrix, Y: Matrix): void;
    predict(Xtest: Matrix): number[];
  }
}
