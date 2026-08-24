import {
  applyScaler,
  dropFeatures,
  encodeDataset,
  fitScaler,
  imbalanceClasses,
  injectFeatureNoise,
  injectLabelNoise,
  rankFeatureImportance,
  splitTrainTest,
  subsampleTrainByPct,
} from "@/lib/preprocessing";
import { hashStringToSeed } from "@/lib/prng";
import type { DatasetColumn, RunConfig } from "@/lib/supabase/types";

export interface PreparedData {
  XTrain: number[][];
  yTrain: number[];
  XTest: number[][];
  yTest: number[];
  numClasses: number;
  featureNames: string[];
}

/**
 * Turns raw CSV rows + a run config into a train/test-ready, standardized
 * matrix pair. The dataset id seeds the train/test split and every
 * stochastic transform, so repeated calls for the same dataset (as happens
 * across a sweep, each call a separate serverless invocation with no shared
 * state) land on the same partition and are directly comparable.
 */
export function prepareTrainingData(
  datasetId: string,
  rows: string[][],
  columns: DatasetColumn[],
  targetColumn: string,
  config: RunConfig
): PreparedData {
  const encoded = encodeDataset(rows, columns, targetColumn);
  let X = encoded.X;
  let featureNames = encoded.featureNames;
  const { y, targetClasses } = encoded;

  if (config.ablateTopNFeatures && config.ablateTopNFeatures > 0) {
    const ranked = rankFeatureImportance(X, y, encoded.featureGroups);
    const n = Math.min(config.ablateTopNFeatures, Math.max(ranked.length - 1, 0));
    const toDrop = new Set(ranked.slice(0, n));
    const dropped = dropFeatures(X, featureNames, encoded.featureGroups, toDrop);
    X = dropped.X;
    featureNames = dropped.featureNames;
  }

  const seed = hashStringToSeed(datasetId);
  const split = splitTrainTest(X, y, seed);
  let XTrain = split.XTrain;
  let yTrain = split.yTrain;
  let XTest = split.XTest;
  const yTest = split.yTest;

  if (config.trainDataPct !== undefined && config.trainDataPct < 100) {
    ({ XTrain, yTrain } = subsampleTrainByPct(XTrain, yTrain, config.trainDataPct));
  }
  if (config.labelNoisePct) {
    yTrain = injectLabelNoise(yTrain, config.labelNoisePct, targetClasses.length, seed + 1);
  }
  if (config.featureNoiseStd) {
    XTrain = injectFeatureNoise(XTrain, config.featureNoiseStd, seed + 2);
  }
  if (config.imbalanceRatio !== undefined && config.imbalanceRatio < 1) {
    ({ XTrain, yTrain } = imbalanceClasses(XTrain, yTrain, config.imbalanceRatio, seed + 3));
  }

  const scaler = fitScaler(XTrain);
  XTrain = applyScaler(XTrain, scaler);
  XTest = applyScaler(XTest, scaler);

  return { XTrain, yTrain, XTest, yTest, numClasses: targetClasses.length, featureNames };
}
