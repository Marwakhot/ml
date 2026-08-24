import { prepareTrainingData } from "../src/lib/experiments/prepareTrainingData";
import { computeMetrics } from "../src/lib/metrics";
import { MODEL_TRAINERS } from "../src/lib/models";
import type { DatasetColumn, RunConfig } from "../src/lib/supabase/types";

function makeSyntheticDataset(n: number) {
  const rows: string[][] = [];
  const colors = ["red", "blue", "green", "yellow"];
  for (let i = 0; i < n; i++) {
    const cls = i % 3; // 3-class problem, near MAX_TARGET_CLASSES-ish scale
    const base = cls * 4;
    const x1 = (Math.random() * 2 + base).toFixed(3);
    const x2 = (Math.random() * 2 + base).toFixed(3);
    const x3 = (Math.random() * 2 + base).toFixed(3);
    const x4 = (Math.random() * 2).toFixed(3);
    const color = colors[i % colors.length];
    const size = (Math.random() * 100).toFixed(1);
    rows.push([x1, x2, x3, x4, color, size, String(cls)]);
  }
  const columns: DatasetColumn[] = [
    { name: "x1", type: "numeric" },
    { name: "x2", type: "numeric" },
    { name: "x3", type: "numeric" },
    { name: "x4", type: "numeric" },
    { name: "color", type: "categorical", categories: colors },
    { name: "size", type: "numeric" },
    { name: "label", type: "categorical", categories: ["0", "1", "2"] },
  ];
  return { rows, columns };
}

async function main() {
  const N = 16000; // near MAX_ROWS (20000)
  const { rows, columns } = makeSyntheticDataset(N);
  const datasetId = "stress-test-dataset";
  const config: RunConfig = { axis: null };

  console.log(`Rows: ${N}, 3-class target, 6 raw feature columns (one categorical)`);
  for (const [modelType, trainer] of Object.entries(MODEL_TRAINERS)) {
    const prepStart = performance.now();
    const prepared = prepareTrainingData(datasetId, rows, columns, "label", config);
    const prepMs = performance.now() - prepStart;

    const t0 = performance.now();
    const model = trainer(prepared.XTrain, prepared.yTrain, prepared.numClasses, config);
    const trainMs = performance.now() - t0;

    const t1 = performance.now();
    const preds = model.predict(prepared.XTest);
    const inferMs = performance.now() - t1;

    const metrics = computeMetrics(prepared.yTest, preds, prepared.numClasses);
    const total = prepMs + trainMs + inferMs;
    console.log(
      `${modelType.padEnd(20)} acc=${metrics.accuracy.toFixed(3)} f1=${metrics.f1.toFixed(3)} ` +
        `prep=${prepMs.toFixed(0)}ms train=${trainMs.toFixed(0)}ms infer=${inferMs.toFixed(0)}ms TOTAL=${total.toFixed(0)}ms`
    );
    if (total > 55000) {
      console.warn(`  WARNING: ${modelType} total time ${total}ms is close to/over the 60s budget`);
    }
  }
}

main().catch((err) => {
  console.error("STRESS TEST FAILED:", err);
  process.exit(1);
});
