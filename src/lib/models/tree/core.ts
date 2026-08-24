import { seededShuffleIndices } from "@/lib/prng";

/**
 * A from-scratch CART implementation. ml-cart's split search generates a
 * candidate threshold at every point where the (sorted-by-feature) label
 * sequence changes, then re-scans the full node for each one — for a
 * feature with weak/no signal (exactly what the noise-injection experiment
 * axis produces on purpose, and what real uploaded data plausibly has too)
 * that's an O(rows) candidate list evaluated with an O(rows) scan each,
 * i.e. effectively O(rows^2) per node. Measured at ~76s for a single tree
 * on 16k rows — well past the serverless timeout budget this project is
 * built around, and random forest multiplies that by nEstimators.
 *
 * This version bounds candidate thresholds to a fixed count per node and
 * evaluates all of them in one linear pass using running class-count (or
 * sum/sum-of-squares) accumulators, giving O(rows log rows) per feature per
 * node regardless of how noisy the feature is.
 */

export interface TreeBuildOptions {
  maxDepth: number;
  minSamplesLeaf: number;
  maxCandidateThresholds: number;
  kind: "classifier" | "regressor";
  /** Required when kind === "classifier". */
  numClasses?: number;
  /** Random-forest-style per-node feature subsampling; requires rng. */
  maxFeaturesPerSplit?: number;
  rng?: () => number;
}

interface ClassifierLeaf {
  kind: "classifier";
  classCounts: number[];
}

interface RegressorLeaf {
  kind: "regressor";
  mean: number;
}

export interface TreeNode {
  isLeaf: boolean;
  leaf?: ClassifierLeaf | RegressorLeaf;
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

function giniImpurity(counts: number[], n: number): number {
  if (n === 0) return 0;
  let sumSq = 0;
  for (const c of counts) sumSq += (c / n) ** 2;
  return 1 - sumSq;
}

interface SplitResult {
  featureIndex: number;
  threshold: number;
  gain: number;
  leftIndices: number[];
  rightIndices: number[];
}

function candidatePositions(n: number, maxCandidates: number): number[] {
  const K = Math.min(maxCandidates, n - 1);
  const positions = new Set<number>();
  for (let k = 1; k <= K; k++) {
    const pos = Math.floor((k * n) / (K + 1));
    if (pos >= 1 && pos < n) positions.add(pos);
  }
  return Array.from(positions);
}

function findBestSplitForFeature(
  X: number[][],
  y: number[],
  indices: number[],
  featureIndex: number,
  options: TreeBuildOptions
): SplitResult | null {
  const sorted = [...indices].sort((a, b) => X[a][featureIndex] - X[b][featureIndex]);
  const n = sorted.length;
  if (n < 2) return null;

  const positions = new Set(candidatePositions(n, options.maxCandidateThresholds));
  if (positions.size === 0) return null;

  let bestGain = 0;
  let bestPos = -1;

  if (options.kind === "classifier") {
    const numClasses = options.numClasses!;
    const totalCounts = new Array(numClasses).fill(0);
    for (const idx of sorted) totalCounts[y[idx]]++;
    const parentImpurity = giniImpurity(totalCounts, n);

    const leftCounts = new Array(numClasses).fill(0);
    for (let i = 0; i < n; i++) {
      leftCounts[y[sorted[i]]]++;
      if (!positions.has(i + 1)) continue;
      if (X[sorted[i]][featureIndex] === X[sorted[i + 1]][featureIndex]) continue;

      const leftN = i + 1;
      const rightN = n - leftN;
      if (leftN < options.minSamplesLeaf || rightN < options.minSamplesLeaf) continue;

      const rightCounts = totalCounts.map((c, ci) => c - leftCounts[ci]);
      const weighted =
        (leftN / n) * giniImpurity(leftCounts, leftN) +
        (rightN / n) * giniImpurity(rightCounts, rightN);
      const gain = parentImpurity - weighted;
      if (gain > bestGain) {
        bestGain = gain;
        bestPos = i + 1;
      }
    }
  } else {
    let totalSum = 0;
    let totalSumSq = 0;
    for (const idx of sorted) {
      const v = y[idx];
      totalSum += v;
      totalSumSq += v * v;
    }
    const parentSSE = totalSumSq - (totalSum * totalSum) / n;

    let leftSum = 0;
    let leftSumSq = 0;
    for (let i = 0; i < n; i++) {
      const v = y[sorted[i]];
      leftSum += v;
      leftSumSq += v * v;
      if (!positions.has(i + 1)) continue;
      if (X[sorted[i]][featureIndex] === X[sorted[i + 1]][featureIndex]) continue;

      const leftN = i + 1;
      const rightN = n - leftN;
      if (leftN < options.minSamplesLeaf || rightN < options.minSamplesLeaf) continue;

      const rightSum = totalSum - leftSum;
      const rightSumSq = totalSumSq - leftSumSq;
      const leftSSE = leftSumSq - (leftSum * leftSum) / leftN;
      const rightSSE = rightSumSq - (rightSum * rightSum) / rightN;
      const gain = parentSSE - (leftSSE + rightSSE);
      if (gain > bestGain) {
        bestGain = gain;
        bestPos = i + 1;
      }
    }
  }

  if (bestPos === -1) return null;
  const threshold = (X[sorted[bestPos - 1]][featureIndex] + X[sorted[bestPos]][featureIndex]) / 2;
  return {
    featureIndex,
    threshold,
    gain: bestGain,
    leftIndices: sorted.slice(0, bestPos),
    rightIndices: sorted.slice(bestPos),
  };
}

function makeLeaf(y: number[], indices: number[], options: TreeBuildOptions): TreeNode {
  if (options.kind === "classifier") {
    const classCounts = new Array(options.numClasses!).fill(0);
    for (const idx of indices) classCounts[y[idx]]++;
    return { isLeaf: true, leaf: { kind: "classifier", classCounts } };
  }
  let sum = 0;
  for (const idx of indices) sum += y[idx];
  return { isLeaf: true, leaf: { kind: "regressor", mean: indices.length > 0 ? sum / indices.length : 0 } };
}

export function buildTree(
  X: number[][],
  y: number[],
  indices: number[],
  depth: number,
  options: TreeBuildOptions
): TreeNode {
  const n = indices.length;
  if (n < options.minSamplesLeaf * 2 || depth >= options.maxDepth) {
    return makeLeaf(y, indices, options);
  }

  const numFeatures = X[0]?.length ?? 0;
  let featureCandidates: number[];
  if (options.maxFeaturesPerSplit && options.maxFeaturesPerSplit < numFeatures && options.rng) {
    featureCandidates = seededShuffleIndices(numFeatures, options.rng).slice(
      0,
      options.maxFeaturesPerSplit
    );
  } else {
    featureCandidates = Array.from({ length: numFeatures }, (_, i) => i);
  }

  let best: SplitResult | null = null;
  for (const featureIndex of featureCandidates) {
    const split = findBestSplitForFeature(X, y, indices, featureIndex, options);
    if (split && (best === null || split.gain > best.gain)) {
      best = split;
    }
  }

  if (!best) {
    return makeLeaf(y, indices, options);
  }

  return {
    isLeaf: false,
    featureIndex: best.featureIndex,
    threshold: best.threshold,
    left: buildTree(X, y, best.leftIndices, depth + 1, options),
    right: buildTree(X, y, best.rightIndices, depth + 1, options),
  };
}

export function predictTreeClassifier(tree: TreeNode, row: number[]): number[] {
  let node = tree;
  while (!node.isLeaf) {
    node = row[node.featureIndex!] <= node.threshold! ? node.left! : node.right!;
  }
  return (node.leaf as ClassifierLeaf).classCounts;
}

export function predictTreeRegressor(tree: TreeNode, row: number[]): number {
  let node = tree;
  while (!node.isLeaf) {
    node = row[node.featureIndex!] <= node.threshold! ? node.left! : node.right!;
  }
  return (node.leaf as RegressorLeaf).mean;
}

export function argmaxCounts(counts: number[]): number {
  let best = 0;
  let bestCount = -1;
  for (let c = 0; c < counts.length; c++) {
    if (counts[c] > bestCount) {
      bestCount = counts[c];
      best = c;
    }
  }
  return best;
}
