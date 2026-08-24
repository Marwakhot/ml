/**
 * Standalone smoke test for the preprocessing -> model -> metrics pipeline,
 * bypassing Supabase/Blob (which need live credentials this environment
 * doesn't have). Exercises the same code the /api/train-one route calls.
 * Run with: npx tsx scripts/smoke-test-pipeline.ts
 */
import { prepareTrainingData } from "../src/lib/experiments/prepareTrainingData";
import { computeMetrics } from "../src/lib/metrics";
import { MODEL_TRAINERS } from "../src/lib/models";
import type { DatasetColumn, RunConfig } from "../src/lib/supabase/types";

function makeSyntheticDataset(n: number) {
  // Two blobs in 2D + one categorical + one noise column, binary target.
  const headers = ["x1", "x2", "color", "noise", "label"];
  const rows: string[][] = [];
  for (let i = 0; i < n; i++) {
    const cls = i % 2;
    const x1 = cls === 0 ? Math.random() * 2 : Math.random() * 2 + 5;
    const x2 = cls === 0 ? Math.random() * 2 : Math.random() * 2 + 5;
    const color = cls === 0 ? "red" : "blue";
    const noise = (Math.random() * 10).toFixed(2);
    rows.push([x1.toFixed(3), x2.toFixed(3), color, noise, String(cls)]);
  }
  const columns: DatasetColumn[] = [
    { name: "x1", type: "numeric" },
    { name: "x2", type: "numeric" },
    { name: "color", type: "categorical", categories: ["red", "blue"] },
    { name: "noise", type: "numeric" },
    { name: "label", type: "categorical", categories: ["0", "1"] },
  ];
  return { headers, rows, columns };
}

async function main() {
  const { rows, columns } = makeSyntheticDataset(300);
  const datasetId = "smoke-test-dataset";
  const baselineConfig: RunConfig = { axis: null };

  console.log("=== Baseline run per model ===");
  for (const [modelType, trainer] of Object.entries(MODEL_TRAINERS)) {
    const prepared = prepareTrainingData(datasetId, rows, columns, "label", baselineConfig);

    const t0 = performance.now();
    const model = trainer(prepared.XTrain, prepared.yTrain, prepared.numClasses, baselineConfig);
    const trainMs = performance.now() - t0;

    const t1 = performance.now();
    const preds = model.predict(prepared.XTest);
    const inferMs = performance.now() - t1;

    const metrics = computeMetrics(prepared.yTest, preds, prepared.numClasses);
    console.log(
      `${modelType.padEnd(20)} acc=${metrics.accuracy.toFixed(3)} f1=${metrics.f1.toFixed(3)} ` +
        `train=${trainMs.toFixed(0)}ms infer=${inferMs.toFixed(0)}ms`
    );

    if (metrics.accuracy < 0.8) {
      throw new Error(
        `${modelType} accuracy ${metrics.accuracy} is suspiciously low for a trivially separable synthetic dataset`
      );
    }
  }

  console.log("\n=== Determinism check (same dataset id => same split) ===");
  const runA = prepareTrainingData(datasetId, rows, columns, "label", baselineConfig);
  const runB = prepareTrainingData(datasetId, rows, columns, "label", baselineConfig);
  const sameSplit = JSON.stringify(runA.yTest) === JSON.stringify(runB.yTest);
  console.log("Same test split across calls:", sameSplit);
  if (!sameSplit) throw new Error("Split is not deterministic across calls!");

  console.log("\n=== Axis transform sanity ===");
  const pct20 = prepareTrainingData(datasetId, rows, columns, "label", {
    axis: "training_data_pct",
    trainDataPct: 20,
  });
  const pct100 = prepareTrainingData(datasetId, rows, columns, "label", {
    axis: "training_data_pct",
    trainDataPct: 100,
  });
  console.log(`trainDataPct=20 -> ${pct20.XTrain.length} rows, =100 -> ${pct100.XTrain.length} rows`);
  if (!(pct20.XTrain.length < pct100.XTrain.length)) {
    throw new Error("trainDataPct axis did not reduce training set size");
  }

  const ablated = prepareTrainingData(datasetId, rows, columns, "label", {
    axis: "feature_ablation",
    ablateTopNFeatures: 1,
  });
  console.log(
    `feature_ablation=1 -> ${ablated.featureNames.length} feature cols (baseline had ${pct100.featureNames.length})`
  );
  if (!(ablated.featureNames.length < pct100.featureNames.length)) {
    throw new Error("feature_ablation axis did not remove any columns");
  }

  console.log("\nAll smoke checks passed.");
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
