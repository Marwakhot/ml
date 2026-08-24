"use client";

import { useMemo, useState } from "react";
import { MODEL_LABELS, type ModelType } from "@/lib/models/types";
import { getAxis } from "@/lib/experiments/axes";
import type { RunRow } from "@/lib/supabase/types";
import {
  generateBestModelInsights,
  METRIC_LABELS,
  type MetricKey,
} from "./InsightEngine";

interface BestModelViewProps {
  runs: RunRow[];
  datasetFilename: string;
}

type SortField = MetricKey | "training_time_ms" | "inference_time_ms" | "created_at";

export function BestModelView({ runs, datasetFilename }: BestModelViewProps) {
  const [targetMetric, setTargetMetric] = useState<MetricKey>("f1");
  const [sortField, setSortField] = useState<SortField>("f1");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [axisFilter, setAxisFilter] = useState<string>("all");

  const insights = useMemo(
    () => generateBestModelInsights(runs, targetMetric),
    [runs, targetMetric]
  );

  const filteredAndSortedRuns = useMemo(() => {
    let result = [...runs];

    if (modelFilter !== "all") {
      result = result.filter((r) => r.model_type === modelFilter);
    }

    if (axisFilter !== "all") {
      if (axisFilter === "baseline") {
        result = result.filter((r) => r.config.axis === null);
      } else {
        result = result.filter((r) => r.config.axis === axisFilter);
      }
    }

    result.sort((a, b) => {
      let aVal = a[sortField as keyof RunRow];
      let bVal = b[sortField as keyof RunRow];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    return result;
  }, [runs, modelFilter, axisFilter, sortField, sortAsc]);

  const uniqueModels = useMemo(() => {
    return Array.from(new Set(runs.map((r) => r.model_type)));
  }, [runs]);

  const uniqueAxes = useMemo(() => {
    const axes = new Set<string>();
    runs.forEach((r) => {
      if (r.config.axis) axes.add(r.config.axis);
    });
    return Array.from(axes);
  }, [runs]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  const winnerRunId = insights?.winner?.id;

  if (runs.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-12 text-center shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <svg
            className="h-6 w-6 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          No training runs completed yet
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Run the experimental sweep above to view model benchmarks and AI recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Top Winner & AI Insights Banner */}
      {insights && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-6 shadow-sm backdrop-blur-md dark:border-amber-400/20 dark:from-amber-400/10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">
                  <span className="text-sm">🏆</span> Best Model Recommendation
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Evaluated on {datasetFilename}
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {insights.bestModelLabel}{" "}
                <span className="text-amber-600 dark:text-amber-400">
                  ({(insights.bestMetricScore * 100).toFixed(1)}% {METRIC_LABELS[targetMetric]})
                </span>
              </h2>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Key Suggestion:
                </span>{" "}
                {insights.suggestion}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <div className="rounded-xl border border-zinc-200/80 bg-white/80 px-4 py-3 text-center backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="text-xs font-medium text-zinc-500">Training Speed</div>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {insights.winner.training_time_ms} ms
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200/80 bg-white/80 px-4 py-3 text-center backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="text-xs font-medium text-zinc-500">Accuracy</div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {(insights.winner.accuracy * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Key Takeaways list */}
          <div className="mt-4 border-t border-amber-500/20 pt-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {insights.keyTakeaways.map((takeaway, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{takeaway}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Controls / Filters / Metric Selector */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white/70 p-4 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Primary Metric:</span>
          {(["f1", "accuracy", "precision", "recall"] as MetricKey[]).map(
            (metric) => (
              <button
                key={metric}
                type="button"
                onClick={() => {
                  setTargetMetric(metric);
                  setSortField(metric);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  targetMetric === metric
                    ? "bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-950"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {METRIC_LABELS[metric]}
              </button>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Model Filter */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="model-filter"
              className="text-xs font-medium text-zinc-500"
            >
              Model:
            </label>
            <select
              id="model-filter"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <option value="all">All Models ({runs.length})</option>
              {uniqueModels.map((m) => (
                <option key={m} value={m}>
                  {MODEL_LABELS[m as ModelType] || m}
                </option>
              ))}
            </select>
          </div>

          {/* Axis Filter */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="axis-filter"
              className="text-xs font-medium text-zinc-500"
            >
              Condition:
            </label>
            <select
              id="axis-filter"
              value={axisFilter}
              onChange={(e) => setAxisFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <option value="all">All Conditions</option>
              <option value="baseline">Baseline Only</option>
              {uniqueAxes.map((axisId) => (
                <option key={axisId} value={axisId}>
                  {getAxis(axisId)?.label || axisId}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Benchmarks Leaderboard Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/70 shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Experimental Condition</th>
                <th
                  onClick={() => handleSort("f1")}
                  className="cursor-pointer px-4 py-3 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <div className="flex items-center gap-1">
                    F1 Score
                    {sortField === "f1" && (sortAsc ? " ↑" : " ↓")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("accuracy")}
                  className="cursor-pointer px-4 py-3 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <div className="flex items-center gap-1">
                    Accuracy
                    {sortField === "accuracy" && (sortAsc ? " ↑" : " ↓")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("precision")}
                  className="cursor-pointer px-4 py-3 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <div className="flex items-center gap-1">
                    Precision
                    {sortField === "precision" && (sortAsc ? " ↑" : " ↓")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("recall")}
                  className="cursor-pointer px-4 py-3 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <div className="flex items-center gap-1">
                    Recall
                    {sortField === "recall" && (sortAsc ? " ↑" : " ↓")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("training_time_ms")}
                  className="cursor-pointer px-4 py-3 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <div className="flex items-center gap-1">
                    Train Time
                    {sortField === "training_time_ms" && (sortAsc ? " ↑" : " ↓")}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filteredAndSortedRuns.map((run, index) => {
                const isWinner = run.id === winnerRunId;
                const axis = run.config.axis ? getAxis(run.config.axis) : null;
                const conditionDesc = axis
                  ? `${axis.label} (${
                      typeof run.config.axisValue === "number"
                        ? axis.describeValue(run.config.axisValue)
                        : run.config.axisValue
                    })`
                  : "Baseline (100% clean data)";

                return (
                  <tr
                    key={run.id}
                    className={`transition-colors ${
                      isWinner
                        ? "bg-amber-500/10 font-medium hover:bg-amber-500/15 dark:bg-amber-400/10 dark:hover:bg-amber-400/15"
                        : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {isWinner ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white shadow-xs">
                          1
                        </span>
                      ) : (
                        <span className="text-zinc-400">#{index + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {MODEL_LABELS[run.model_type as ModelType] ||
                            run.model_type}
                        </span>
                        {isWinner && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 uppercase dark:text-amber-300">
                            Winner
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {conditionDesc}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {(run.f1 * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {(run.accuracy * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {(run.precision * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {(run.recall * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {run.training_time_ms} ms
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
