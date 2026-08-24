import { mulberry32, seededGaussian, seededShuffleIndices } from "./prng";
import type { DatasetColumn } from "./supabase/types";

export interface FeatureGroup {
  originalName: string;
  /** Indices into the encoded column space this original column expanded
   * to (1 for numeric, one per category for one-hot categoricals). */
  indices: number[];
}

export interface EncodedDataset {
  X: number[][];
  y: number[];
  featureNames: string[];
  featureGroups: FeatureGroup[];
  targetClasses: string[];
}

const MISSING_CATEGORY = "__missing__";

/**
 * Turns raw string rows into a numeric feature matrix + label-encoded
 * target. Missing numeric values are mean-imputed; missing categoricals get
 * their own "__missing__" category. Categoricals are one-hot encoded.
 */
export function encodeDataset(
  rows: string[][],
  columns: DatasetColumn[],
  targetColumnName: string
): EncodedDataset {
  const targetIdx = columns.findIndex((c) => c.name === targetColumnName);
  if (targetIdx === -1) {
    throw new Error(`Target column "${targetColumnName}" not found`);
  }

  const targetValuesRaw = rows.map((r) => r[targetIdx]);
  const targetClasses = Array.from(new Set(targetValuesRaw)).sort();
  const y = targetValuesRaw.map((v) => targetClasses.indexOf(v));

  const featureNames: string[] = [];
  const featureGroups: FeatureGroup[] = [];
  const encodedColumns: number[][] = [];

  columns.forEach((col, colIdx) => {
    if (colIdx === targetIdx) return;
    const rawValues = rows.map((r) => r[colIdx]);

    if (col.type === "numeric") {
      const parsed = rawValues.map((v) => (v.trim() === "" ? null : Number(v)));
      const present = parsed.filter((v): v is number => v !== null);
      const mean =
        present.length > 0 ? present.reduce((a, b) => a + b, 0) / present.length : 0;
      const imputed = parsed.map((v) => (v === null ? mean : v));

      encodedColumns.push(imputed);
      featureNames.push(col.name);
      featureGroups.push({
        originalName: col.name,
        indices: [encodedColumns.length - 1],
      });
    } else {
      const normalized = rawValues.map((v) => (v.trim() === "" ? MISSING_CATEGORY : v));
      const categories = Array.from(new Set(normalized)).sort();
      const indices: number[] = [];
      for (const category of categories) {
        encodedColumns.push(normalized.map((v) => (v === category ? 1 : 0)));
        featureNames.push(`${col.name}=${category}`);
        indices.push(encodedColumns.length - 1);
      }
      featureGroups.push({ originalName: col.name, indices });
    }
  });

  const numRows = rows.length;
  const numCols = encodedColumns.length;
  const X: number[][] = Array.from({ length: numRows }, () => new Array(numCols));
  for (let j = 0; j < numCols; j++) {
    for (let i = 0; i < numRows; i++) {
      X[i][j] = encodedColumns[j][i];
    }
  }

  return { X, y, featureNames, featureGroups, targetClasses };
}

export interface Scaler {
  mean: number[];
  std: number[];
}

/** Fit z-score parameters on a matrix (call with the training split only,
 * to avoid leaking test-set statistics into the transform). */
export function fitScaler(X: number[][]): Scaler {
  const numCols = X[0]?.length ?? 0;
  const n = X.length;
  const mean = new Array(numCols).fill(0);
  const std = new Array(numCols).fill(0);

  for (let j = 0; j < numCols; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += X[i][j];
    mean[j] = n > 0 ? sum / n : 0;
  }
  for (let j = 0; j < numCols; j++) {
    let sq = 0;
    for (let i = 0; i < n; i++) sq += (X[i][j] - mean[j]) ** 2;
    std[j] = n > 0 ? Math.sqrt(sq / n) : 0;
    if (std[j] === 0) std[j] = 1;
  }
  return { mean, std };
}

export function applyScaler(X: number[][], scaler: Scaler): number[][] {
  return X.map((row) => row.map((v, j) => (v - scaler.mean[j]) / scaler.std[j]));
}

export interface TrainTestSplit {
  XTrain: number[][];
  yTrain: number[];
  XTest: number[][];
  yTest: number[];
}

/** Deterministic (seeded) shuffle + split. Every /api/train-one call for the
 * same dataset+seed reproduces the exact same partition, which is what
 * makes runs from different calls in a sweep comparable. */
export function splitTrainTest(
  X: number[][],
  y: number[],
  seed: number,
  testFraction = 0.2
): TrainTestSplit {
  const rng = mulberry32(seed);
  const order = seededShuffleIndices(X.length, rng);
  const testCount = Math.max(1, Math.round(X.length * testFraction));
  const testOrder = order.slice(0, testCount);
  const trainOrder = order.slice(testCount);

  return {
    XTrain: trainOrder.map((i) => X[i]),
    yTrain: trainOrder.map((i) => y[i]),
    XTest: testOrder.map((i) => X[i]),
    yTest: testOrder.map((i) => y[i]),
  };
}

/** Ranks original (pre-one-hot) feature columns by a simple importance
 * proxy: the strongest absolute Pearson correlation between any of the
 * column's encoded sub-columns and the (label-encoded) target. Good enough
 * to pick "the top-N most important features" for the ablation axis without
 * needing a trained model. */
export function rankFeatureImportance(
  X: number[][],
  y: number[],
  featureGroups: FeatureGroup[]
): string[] {
  const n = X.length;
  if (n === 0) return featureGroups.map((g) => g.originalName);

  const yMean = y.reduce((a, b) => a + b, 0) / n;
  const yStd = Math.sqrt(y.reduce((s, v) => s + (v - yMean) ** 2, 0) / n) || 1;

  function absCorrelation(colIdx: number): number {
    let colMean = 0;
    for (let i = 0; i < n; i++) colMean += X[i][colIdx];
    colMean /= n;
    let colVar = 0;
    for (let i = 0; i < n; i++) colVar += (X[i][colIdx] - colMean) ** 2;
    const colStd = Math.sqrt(colVar / n) || 1;

    let cov = 0;
    for (let i = 0; i < n; i++) cov += (X[i][colIdx] - colMean) * (y[i] - yMean);
    cov /= n;
    return Math.abs(cov / (colStd * yStd));
  }

  return featureGroups
    .map((g) => ({
      name: g.originalName,
      score: Math.max(...g.indices.map(absCorrelation)),
    }))
    .sort((a, b) => b.score - a.score)
    .map((g) => g.name);
}

export function dropFeatures(
  X: number[][],
  featureNames: string[],
  featureGroups: FeatureGroup[],
  namesToDrop: Set<string>
): { X: number[][]; featureNames: string[]; featureGroups: FeatureGroup[] } {
  const keepIndices: number[] = [];
  const newFeatureNames: string[] = [];
  const newGroups: FeatureGroup[] = [];

  for (const g of featureGroups) {
    if (namesToDrop.has(g.originalName)) continue;
    const newIndices: number[] = [];
    for (const idx of g.indices) {
      newIndices.push(keepIndices.length);
      keepIndices.push(idx);
      newFeatureNames.push(featureNames[idx]);
    }
    newGroups.push({ originalName: g.originalName, indices: newIndices });
  }

  return {
    X: X.map((row) => keepIndices.map((idx) => row[idx])),
    featureNames: newFeatureNames,
    featureGroups: newGroups,
  };
}

/** Training-data-quantity axis: nested prefix of the (already shuffled)
 * training split, so 20%/40%/... subsets are strictly nested — needed for a
 * coherent "more data helped" narrative in the Research view. */
export function subsampleTrainByPct(
  XTrain: number[][],
  yTrain: number[],
  pct: number
): { XTrain: number[][]; yTrain: number[] } {
  const count = Math.max(1, Math.round(XTrain.length * (pct / 100)));
  return { XTrain: XTrain.slice(0, count), yTrain: yTrain.slice(0, count) };
}

/** Label-noise axis: randomly reassigns a fraction of training labels to a
 * different class. Test labels are left untouched, so metrics still measure
 * generalization to clean ground truth. */
export function injectLabelNoise(
  yTrain: number[],
  noisePct: number,
  numClasses: number,
  seed: number
): number[] {
  const rng = mulberry32(seed);
  return yTrain.map((label) => {
    if (rng() >= noisePct / 100 || numClasses <= 1) return label;
    let newLabel = Math.floor(rng() * numClasses);
    let guard = 0;
    while (newLabel === label && guard < 5) {
      newLabel = Math.floor(rng() * numClasses);
      guard++;
    }
    return newLabel;
  });
}

/** Feature-noise axis: adds Gaussian noise to training features, scaled by
 * each column's own training-set standard deviation. */
export function injectFeatureNoise(
  XTrain: number[][],
  noiseStdFraction: number,
  seed: number
): number[][] {
  const rng = mulberry32(seed);
  const numCols = XTrain[0]?.length ?? 0;
  const n = XTrain.length;
  const colStd = new Array(numCols).fill(0);

  for (let j = 0; j < numCols; j++) {
    let mean = 0;
    for (let i = 0; i < n; i++) mean += XTrain[i][j];
    mean /= n;
    let variance = 0;
    for (let i = 0; i < n; i++) variance += (XTrain[i][j] - mean) ** 2;
    colStd[j] = Math.sqrt(variance / n) || 1;
  }

  return XTrain.map((row) =>
    row.map((v, j) => v + seededGaussian(rng) * colStd[j] * noiseStdFraction)
  );
}

/** Class-imbalance axis: keeps the majority class intact and downsamples
 * every other class to `minorityRatio` of the majority class's count. */
export function imbalanceClasses(
  XTrain: number[][],
  yTrain: number[],
  minorityRatio: number,
  seed: number
): { XTrain: number[][]; yTrain: number[] } {
  const rng = mulberry32(seed);
  const byClass = new Map<number, number[]>();
  yTrain.forEach((label, idx) => {
    const list = byClass.get(label) ?? [];
    list.push(idx);
    byClass.set(label, list);
  });

  let majorityClass = -1;
  let majorityCount = -1;
  for (const [label, idxs] of byClass) {
    if (idxs.length > majorityCount) {
      majorityCount = idxs.length;
      majorityClass = label;
    }
  }

  const keepIdx: number[] = [];
  for (const [label, idxs] of byClass) {
    if (label === majorityClass) {
      keepIdx.push(...idxs);
      continue;
    }
    const targetCount = Math.max(1, Math.round(majorityCount * minorityRatio));
    const shuffled = seededShuffleIndices(idxs.length, rng).map((i) => idxs[i]);
    keepIdx.push(...shuffled.slice(0, Math.min(targetCount, idxs.length)));
  }
  keepIdx.sort((a, b) => a - b);

  return {
    XTrain: keepIdx.map((i) => XTrain[i]),
    yTrain: keepIdx.map((i) => yTrain[i]),
  };
}
