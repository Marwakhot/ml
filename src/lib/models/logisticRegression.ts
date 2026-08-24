import { Matrix } from "ml-matrix";
import LogisticRegression from "ml-logistic-regression";
import type { ModelTrainer } from "./types";

/**
 * ml-logistic-regression defaults to 50,000 gradient steps per one-vs-all
 * classifier, which would blow well past a serverless function's time
 * budget. These caps keep total training time roughly bounded regardless of
 * how many classes the target has.
 */
const NUM_STEPS = 300;
const LEARNING_RATE = 0.3;

export const trainLogisticRegression: ModelTrainer = (XTrain, yTrain) => {
  const model = new LogisticRegression({
    numSteps: NUM_STEPS,
    learningRate: LEARNING_RATE,
  });
  model.train(new Matrix(XTrain), Matrix.columnVector(yTrain));

  return {
    predict(X: number[][]): number[] {
      return model.predict(new Matrix(X));
    },
  };
};
