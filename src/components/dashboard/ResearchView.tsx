"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { AXES, getAxis, type AxisId } from "@/lib/experiments/axes";
import { MODEL_LABELS, MODEL_TYPES, type ModelType } from "@/lib/models/types";
import type { RunRow } from "@/lib/supabase/types";
import {
  generateAxisResearchInsight,
  METRIC_LABELS,
  type MetricKey,
} from "./InsightEngine";

interface ResearchViewProps {
  runs: RunRow[];
}

const MODEL_COLORS: Record<ModelType, string> = {
  logistic_regression: "#3b82f6", // blue
  decision_tree: "#10b981", // emerald
  random_forest: "#8b5cf6", // purple
  gradient_boosting: "#f59e0b", // amber
  knn: "#ec4899", // pink
  linear_svm: "#06b6d4", // cyan
};

export function ResearchView({ runs }: ResearchViewProps) {
  const [selectedAxisId, setSelectedAxisId] = useState<AxisId>("training_data_pct");
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("f1");

  const axisDef = useMemo(() => getAxis(selectedAxisId), [selectedAxisId]);

  const insights = useMemo(
    () => generateAxisResearchInsight(runs, selectedAxisId, selectedMetric),
    [runs, selectedAxisId, selectedMetric]
  );

  // Format data for Recharts: array of { label, axisValue, [modelType]: metricValue }
  const chartData = useMemo(() => {
    if (!axisDef) return [];

    const axisRuns = runs.filter((r) => r.config.axis === selectedAxisId);

    return axisDef.values.map((val) => {
      const entry: Record<string, number | string> = {
        axisValue: val,
        label: axisDef.describeValue(val),
      };

      for (const modelType of MODEL_TYPES) {
        const run = axisRuns.find(
          (r) => r.model_type === modelType && r.config.axisValue === val
        );
        if (run) {
          entry[modelType] = Number((run[selectedMetric] * 100).toFixed(1));
        }
      }

      return entry;
    });
  }, [runs, selectedAxisId, selectedMetric, axisDef]);

  if (runs.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-12 text-center shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          No experimental sweep data yet
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Launch the benchmark sweep to plot empirical tradeoffs and learning curves.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Axis & Metric Selectors */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white/70 p-5 shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="axis-select"
            className="text-xs font-semibold tracking-wide text-zinc-500 uppercase"
          >
            Experimental Dimension
          </label>
          <select
            id="axis-select"
            value={selectedAxisId}
            onChange={(e) => setSelectedAxisId(e.target.value as AxisId)}
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-900 shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {AXES.map((axis) => (
              <option key={axis.id} value={axis.id}>
                {axis.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Evaluation Metric
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["f1", "accuracy", "precision", "recall"] as MetricKey[]).map(
              (metric) => (
                <button
                  key={metric}
                  type="button"
                  onClick={() => setSelectedMetric(metric)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    selectedMetric === metric
                      ? "bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-950"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {METRIC_LABELS[metric]}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* 2. Auto-generated Empirical Insight Card */}
      <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-5 shadow-xs backdrop-blur-md dark:border-blue-400/20 dark:from-blue-400/10">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
            📊 Empirical Tradeoff Finding
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {axisDef?.label}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-800 dark:text-zinc-200">
          {insights.trendDescription}
        </p>
        {insights.diminishingReturnsNote && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300 font-medium">
            💡 {insights.diminishingReturnsNote}
          </p>
        )}
      </div>

      {/* 3. Recharts Line Chart */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-6 shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60">
        <div className="mb-6 flex flex-col gap-1">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {axisDef?.label} vs. {METRIC_LABELS[selectedMetric]} (%)
          </h3>
          <p className="text-xs text-zinc-500">
            Comparing all classical architectures across varying experimental conditions.
          </p>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-zinc-200 dark:stroke-zinc-800"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                className="text-zinc-600 dark:text-zinc-400"
                dy={10}
              />
              <YAxis
                unit="%"
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                className="text-zinc-600 dark:text-zinc-400"
              />
              <Tooltip
                formatter={(val: unknown) => [`${val}%`, METRIC_LABELS[selectedMetric]]}
                labelFormatter={(label) => `${axisDef?.label}: ${label}`}
                contentStyle={{
                  backgroundColor: "rgba(24, 24, 27, 0.9)",
                  borderColor: "rgba(63, 63, 70, 0.8)",
                  borderRadius: "0.75rem",
                  color: "#fff",
                  fontSize: "12px",
                  backdropFilter: "blur(8px)",
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value: ModelType) => (
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {MODEL_LABELS[value] || value}
                  </span>
                )}
              />
              {MODEL_TYPES.map((modelType) => {
                // If treeOnly axis and not a tree model, don't render line
                if (axisDef?.treeOnly && (modelType === "logistic_regression" || modelType === "knn" || modelType === "linear_svm")) {
                  return null;
                }

                return (
                  <Line
                    key={modelType}
                    type="monotone"
                    dataKey={modelType}
                    name={modelType}
                    stroke={MODEL_COLORS[modelType]}
                    strokeWidth={2.5}
                    dot={{ r: 4, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
