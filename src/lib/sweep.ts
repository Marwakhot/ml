import { AXES, type AxisId } from "./experiments/axes";
import { MODEL_TYPES, type ModelType } from "./models/types";
import type { RunConfig } from "./supabase/types";

export interface SweepJob {
  id: string;
  modelType: ModelType;
  config: RunConfig;
  description: string;
  axisId: AxisId | null;
  axisValue: number | string | null;
}

const TREE_MODELS: Set<ModelType> = new Set([
  "decision_tree",
  "random_forest",
  "gradient_boosting",
]);

export function isTreeModel(modelType: ModelType): boolean {
  return TREE_MODELS.has(modelType);
}

export interface GenerateSweepJobsOptions {
  models?: ModelType[];
  axes?: AxisId[];
  includeBaseline?: boolean;
}

/**
 * Generates an ordered list of training jobs for client-side sweep orchestration.
 * Each job corresponds to exactly one `POST /api/train-one` invocation.
 */
export function generateSweepJobs(
  options: GenerateSweepJobsOptions = {}
): SweepJob[] {
  const models = options.models ?? MODEL_TYPES;
  const targetAxes = options.axes
    ? AXES.filter((a) => options.axes?.includes(a.id))
    : AXES;
  const includeBaseline = options.includeBaseline ?? true;

  const jobs: SweepJob[] = [];

  // 1. Baselines first for selected models
  if (includeBaseline) {
    for (const modelType of models) {
      jobs.push({
        id: `${modelType}-baseline`,
        modelType,
        config: {
          axis: null,
          axisValue: "baseline",
        },
        description: `Baseline (100% clean data)`,
        axisId: null,
        axisValue: "baseline",
      });
    }
  }

  // 2. Axis sweeps
  for (const axis of targetAxes) {
    for (const modelType of models) {
      if (axis.treeOnly && !isTreeModel(modelType)) {
        continue;
      }

      for (const val of axis.values) {
        // Skip baseline duplicates if value is 0 noise or 100% data and already tested
        const configPart = axis.toConfig(val);
        jobs.push({
          id: `${modelType}-${axis.id}-${val}`,
          modelType,
          config: {
            axis: axis.id,
            axisValue: val,
            ...configPart,
          },
          description: `${axis.label}: ${axis.describeValue(val)}`,
          axisId: axis.id,
          axisValue: val,
        });
      }
    }
  }

  return jobs;
}
