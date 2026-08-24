import { AXES, getAxis, type AxisId } from "@/lib/experiments/axes";
import { MODEL_LABELS, type ModelType } from "@/lib/models/types";
import type { RunRow } from "@/lib/supabase/types";

export interface BestModelInsight {
  winner: RunRow;
  bestModelLabel: string;
  bestMetricScore: number;
  largestSwingAxis: string;
  largestSwingDrop: number;
  suggestion: string;
  keyTakeaways: string[];
}

export interface AxisResearchInsight {
  trendDescription: string;
  diminishingReturnsNote: string | null;
  bestConfigForAxis: string;
  robustnessSummary: string;
}

export type MetricKey = "f1" | "accuracy" | "precision" | "recall";

export const METRIC_LABELS: Record<MetricKey, string> = {
  f1: "F1 Score",
  accuracy: "Accuracy",
  precision: "Precision",
  recall: "Recall",
};

/**
 * Analyzes all completed runs and generates high-level plain-language insights
 * and actionable next steps for the Best Model view.
 */
export function generateBestModelInsights(
  runs: RunRow[],
  targetMetric: MetricKey = "f1"
): BestModelInsight | null {
  if (!runs || runs.length === 0) return null;

  // 1. Find the top performing run
  const sortedRuns = [...runs].sort((a, b) => b[targetMetric] - a[targetMetric]);
  const winner = sortedRuns[0];
  const bestModelLabel =
    MODEL_LABELS[winner.model_type as ModelType] || winner.model_type;
  const bestMetricScore = winner[targetMetric];

  // 2. Measure metric swing across each axis (Max value - Min value for that axis)
  const axisDrops: Record<string, { maxDrop: number; axisName: string; worstVal: string }> = {};

  for (const axis of AXES) {
    const axisRuns = runs.filter((r) => r.config.axis === axis.id);
    if (axisRuns.length < 2) continue;

    // Group by model to measure sensitivity per model
    const baselineScores: Record<string, number> = {};
    runs
      .filter((r) => r.config.axis === null)
      .forEach((r) => {
        baselineScores[r.model_type] = r[targetMetric];
      });

    let maxDrop = 0;
    let worstValDesc = "";

    for (const r of axisRuns) {
      const base = baselineScores[r.model_type] ?? 1.0;
      const drop = base - r[targetMetric];
      if (drop > maxDrop) {
        maxDrop = drop;
        worstValDesc =
          typeof r.config.axisValue === "number"
            ? axis.describeValue(r.config.axisValue)
            : String(r.config.axisValue ?? "");
      }
    }

    if (maxDrop > 0) {
      axisDrops[axis.id] = {
        maxDrop,
        axisName: axis.label,
        worstVal: worstValDesc,
      };
    }
  }

  // Find axis with biggest swing
  let largestSwingAxisId = "training_data_pct";
  let largestSwingDrop = 0;
  let largestSwingName = "Training data quantity";

  for (const [axisId, data] of Object.entries(axisDrops)) {
    if (data.maxDrop > largestSwingDrop) {
      largestSwingDrop = data.maxDrop;
      largestSwingAxisId = axisId;
      largestSwingName = data.axisName;
    }
  }

  // 3. Generate tailored recommendations
  let suggestion = "";
  const keyTakeaways: string[] = [];

  switch (largestSwingAxisId as AxisId) {
    case "class_imbalance":
      suggestion = `Class imbalance caused the steepest drop in ${METRIC_LABELS[targetMetric]} (up to ${(
        largestSwingDrop * 100
      ).toFixed(1)}% drop). We recommend applying SMOTE, class-weight rebalancing, or threshold tuning.`;
      keyTakeaways.push(
        "Performance degrades sharply when minority class ratio drops below 20%."
      );
      break;
    case "noise_label":
      suggestion = `Label noise had the largest negative impact on performance. Consider reviewing noisy annotations, using cleanlab/confident learning, or applying robust loss functions.`;
      keyTakeaways.push(
        "Model accuracy is sensitive to corrupted training targets."
      );
      break;
    case "noise_feature":
      suggestion = `Gaussian feature noise significantly degraded metrics. Standardizing input features, applying PCA, or adding L2 regularization will help shield against noisy sensor/tabular inputs.`;
      break;
    case "feature_ablation":
      suggestion = `Removing top features caused a sharp metric drop (up to ${(
        largestSwingDrop * 100
      ).toFixed(1)}%). Your top-ranked features carry critical predictive signal.`;
      keyTakeaways.push("Feature selection must retain the top informative predictors.");
      break;
    case "training_data_pct":
      suggestion = `Training data quantity showed a strong positive slope — scaling from 20% to 100% data led to marked improvements. Collecting more samples is highly likely to boost performance further.`;
      keyTakeaways.push(
        "Learning curves have not fully plateaued; additional data collection is advised."
      );
      break;
    case "model_complexity":
      suggestion = `Tree depth / model complexity had a substantial effect. Shallow trees underfit while very deep trees showed signs of overfitting.`;
      break;
    default:
      suggestion = `Model choice and dataset preprocessing provided solid baseline performance across sweeps.`;
  }

  // Add winner specific takeaway
  keyTakeaways.unshift(
    `Top Performer: ${bestModelLabel} achieved ${(bestMetricScore * 100).toFixed(
      1
    )}% ${METRIC_LABELS[targetMetric]} in ${winner.training_time_ms}ms.`
  );

  return {
    winner,
    bestModelLabel,
    bestMetricScore,
    largestSwingAxis: largestSwingName,
    largestSwingDrop,
    suggestion,
    keyTakeaways,
  };
}

/**
 * Analyzes runs for a single axis sweep and produces a concise summary
 * including diminishing returns analysis and trend descriptions.
 */
export function generateAxisResearchInsight(
  runs: RunRow[],
  axisId: AxisId,
  targetMetric: MetricKey = "f1"
): AxisResearchInsight {
  const axisDef = getAxis(axisId);
  const axisRuns = runs.filter((r) => r.config.axis === axisId);

  if (axisRuns.length === 0 || !axisDef) {
    return {
      trendDescription: "No experimental runs recorded for this axis yet.",
      diminishingReturnsNote: null,
      bestConfigForAxis: "N/A",
      robustnessSummary: "Pending sweep completion.",
    };
  }

  // Average metric across all models for each axis value
  const valueMetrics: { value: number; avgMetric: number; count: number }[] = [];

  for (const val of axisDef.values) {
    const valRuns = axisRuns.filter((r) => r.config.axisValue === val);
    if (valRuns.length > 0) {
      const avg =
        valRuns.reduce((sum, r) => sum + r[targetMetric], 0) / valRuns.length;
      valueMetrics.push({ value: val, avgMetric: avg, count: valRuns.length });
    }
  }

  if (valueMetrics.length < 2) {
    return {
      trendDescription: `Insufficient data points to compute trend for ${axisDef.label}.`,
      diminishingReturnsNote: null,
      bestConfigForAxis: "N/A",
      robustnessSummary: "More data required.",
    };
  }

  // Calculate segment deltas for diminishing returns
  let trendDescription = "";
  let diminishingReturnsNote: string | null = null;

  if (axisId === "training_data_pct") {
    // Look at low-mid delta vs high delta
    const lowVal = valueMetrics.find((v) => v.value === 20) || valueMetrics[0];
    const midVal = valueMetrics.find((v) => v.value === 40) || valueMetrics[1];
    const highVal = valueMetrics.find((v) => v.value === 80) || valueMetrics[valueMetrics.length - 2];
    const maxVal = valueMetrics.find((v) => v.value === 100) || valueMetrics[valueMetrics.length - 1];

    const lowMidGain = ((midVal.avgMetric - lowVal.avgMetric) * 100).toFixed(1);
    const highMaxGain = ((maxVal.avgMetric - highVal.avgMetric) * 100).toFixed(1);

    trendDescription = `${axisDef.describeValue(lowVal.value)} → ${axisDef.describeValue(
      midVal.value
    )} data raised ${METRIC_LABELS[targetMetric]} by ${lowMidGain}%, while ${axisDef.describeValue(
      highVal.value
    )} → ${axisDef.describeValue(maxVal.value)} raised it by ${highMaxGain}%.`;

    if (parseFloat(highMaxGain) < 2.5 && parseFloat(lowMidGain) > 4) {
      diminishingReturnsNote = `Diminishing returns observed beyond ${axisDef.describeValue(
        highVal.value
      )} of dataset size.`;
    }
  } else if (axisId === "noise_label" || axisId === "noise_feature") {
    const cleanVal = valueMetrics[0];
    const noisyVal = valueMetrics[valueMetrics.length - 1];
    const drop = ((cleanVal.avgMetric - noisyVal.avgMetric) * 100).toFixed(1);

    trendDescription = `Injecting maximum noise (${axisDef.describeValue(
      noisyVal.value
    )}) caused an average ${METRIC_LABELS[targetMetric]} decrease of ${drop}%.`;

    // Check which model was most robust
    const byModelDrop = getMostRobustModel(runs, axisId, targetMetric);
    if (byModelDrop) {
      diminishingReturnsNote = `${byModelDrop.mostRobust} demonstrated highest noise tolerance, losing only ${(
        byModelDrop.minDrop * 100
      ).toFixed(1)}% ${METRIC_LABELS[targetMetric]}.`;
    }
  } else if (axisId === "feature_ablation") {
    const noneRemoved = valueMetrics[0];
    const maxRemoved = valueMetrics[valueMetrics.length - 1];
    const impact = ((noneRemoved.avgMetric - maxRemoved.avgMetric) * 100).toFixed(1);

    trendDescription = `Ablating top ${axisDef.describeValue(
      maxRemoved.value
    )} decreased mean ${METRIC_LABELS[targetMetric]} by ${impact}%.`;
  } else if (axisId === "class_imbalance") {
    const balanced = valueMetrics[0];
    const severe = valueMetrics[valueMetrics.length - 1];
    const drop = ((balanced.avgMetric - severe.avgMetric) * 100).toFixed(1);

    trendDescription = `Severe imbalance (${axisDef.describeValue(
      severe.value
    )}) reduced mean ${METRIC_LABELS[targetMetric]} by ${drop}%.`;
  } else if (axisId === "model_complexity") {
    // Find best depth
    let best = valueMetrics[0];
    for (const v of valueMetrics) {
      if (v.avgMetric > best.avgMetric) best = v;
    }
    trendDescription = `Model performance peaked at ${axisDef.describeValue(
      best.value
    )} with ${(best.avgMetric * 100).toFixed(1)}% ${METRIC_LABELS[targetMetric]}.`;
  }

  // Find best overall run on this axis
  const bestAxisRun = [...axisRuns].sort(
    (a, b) => b[targetMetric] - a[targetMetric]
  )[0];
  const bestConfig = `${MODEL_LABELS[bestAxisRun.model_type as ModelType] || bestAxisRun.model_type} (${
    bestAxisRun.config.axisValue !== undefined
      ? axisDef.describeValue(bestAxisRun.config.axisValue as number)
      : ""
  })`;

  return {
    trendDescription,
    diminishingReturnsNote,
    bestConfigForAxis: bestConfig,
    robustnessSummary: `Highest score on this axis: ${(
      bestAxisRun[targetMetric] * 100
    ).toFixed(1)}% ${METRIC_LABELS[targetMetric]}.`,
  };
}

function getMostRobustModel(
  runs: RunRow[],
  axisId: AxisId,
  metric: MetricKey
): { mostRobust: string; minDrop: number } | null {
  const baselines: Record<string, number> = {};
  runs
    .filter((r) => r.config.axis === null)
    .forEach((r) => (baselines[r.model_type] = r[metric]));

  const maxNoiseRuns = runs.filter(
    (r) => r.config.axis === axisId && r.config.axisValue === 30 // or max
  );

  let bestModel = "";
  let minDrop = Infinity;

  for (const r of maxNoiseRuns) {
    const base = baselines[r.model_type];
    if (base !== undefined) {
      const drop = base - r[metric];
      if (drop < minDrop) {
        minDrop = drop;
        bestModel = MODEL_LABELS[r.model_type as ModelType] || r.model_type;
      }
    }
  }

  return bestModel ? { mostRobust: bestModel, minDrop } : null;
}
