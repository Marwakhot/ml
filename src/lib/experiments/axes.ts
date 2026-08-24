import type { RunConfig } from "@/lib/supabase/types";

export type AxisId =
  | "training_data_pct"
  | "noise_label"
  | "noise_feature"
  | "feature_ablation"
  | "class_imbalance"
  | "model_complexity";

export interface AxisDefinition {
  id: AxisId;
  label: string;
  /** Only meaningful for tree-based models (decision_tree, random_forest,
   * gradient_boosting) since it sweeps max tree depth. */
  treeOnly?: boolean;
  values: number[];
  toConfig: (value: number) => Partial<RunConfig>;
  describeValue: (value: number) => string;
}

export const AXES: AxisDefinition[] = [
  {
    id: "training_data_pct",
    label: "Training data quantity",
    values: [10, 20, 40, 60, 80, 100],
    toConfig: (value) => ({ trainDataPct: value }),
    describeValue: (v) => `${v}%`,
  },
  {
    id: "noise_label",
    label: "Label noise",
    values: [0, 5, 10, 20, 30],
    toConfig: (value) => ({ labelNoisePct: value }),
    describeValue: (v) => `${v}%`,
  },
  {
    id: "noise_feature",
    label: "Feature noise",
    values: [0, 0.1, 0.25, 0.5, 1],
    toConfig: (value) => ({ featureNoiseStd: value }),
    describeValue: (v) => `${v}σ`,
  },
  {
    id: "feature_ablation",
    label: "Feature ablation",
    values: [0, 1, 2, 3],
    toConfig: (value) => ({ ablateTopNFeatures: value }),
    describeValue: (v) => (v === 0 ? "none removed" : `top ${v} removed`),
  },
  {
    id: "class_imbalance",
    label: "Class imbalance",
    values: [1, 0.5, 0.25, 0.1, 0.05],
    toConfig: (value) => ({ imbalanceRatio: value }),
    describeValue: (v) => `${Math.round(v * 100)}% minority`,
  },
  {
    id: "model_complexity",
    label: "Model complexity (max depth)",
    treeOnly: true,
    values: [2, 3, 5, 8, 12],
    toConfig: (value) => ({ maxDepth: value }),
    describeValue: (v) => `depth ${v}`,
  },
];

export function getAxis(id: string): AxisDefinition | undefined {
  return AXES.find((a) => a.id === id);
}
