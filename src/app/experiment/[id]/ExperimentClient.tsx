"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AXES, type AxisId } from "@/lib/experiments/axes";
import { MODEL_LABELS, MODEL_TYPES, type ModelType } from "@/lib/models/types";
import { generateSweepJobs, type SweepJob } from "@/lib/sweep";
import type { DatasetRow, RunRow } from "@/lib/supabase/types";
import { BestModelView } from "@/components/dashboard/BestModelView";
import { ResearchView } from "@/components/dashboard/ResearchView";

interface ExperimentClientProps {
  dataset: DatasetRow;
  initialRuns: RunRow[];
}

type TabKey = "best-model" | "research" | "sweep-config";

export function ExperimentClient({
  dataset,
  initialRuns,
}: ExperimentClientProps) {
  const [runs, setRuns] = useState<RunRow[]>(initialRuns);
  const [activeTab, setActiveTab] = useState<TabKey>(
    initialRuns.length > 0 ? "best-model" : "sweep-config"
  );

  // Sweep configuration options
  const [selectedModels, setSelectedModels] = useState<ModelType[]>(MODEL_TYPES);
  const [selectedAxes, setSelectedAxes] = useState<AxisId[]>(
    AXES.map((a) => a.id)
  );
  const [includeBaseline, setIncludeBaseline] = useState<boolean>(true);

  // Sweep state
  const [isSweeping, setIsSweeping] = useState<boolean>(false);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [completedJobs, setCompletedJobs] = useState<number>(0);
  const [currentJob, setCurrentJob] = useState<SweepJob | null>(null);
  const [errorCount, setErrorCount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const abortControllerRef = useRef<AbortController | null>(null);

  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  // Update elapsed time every second while sweeping
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSweeping && startTime) {
      interval = setInterval(() => {
        setElapsedMs(Date.now() - startTime);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSweeping, startTime]);

  // Compute sweep config
  const plannedJobs = generateSweepJobs({
    models: selectedModels,
    axes: selectedAxes,
    includeBaseline,
  });

  const toggleModel = (model: ModelType) => {
    setSelectedModels((prev) =>
      prev.includes(model)
        ? prev.filter((m) => m !== model)
        : [...prev, model]
    );
  };

  const toggleAxis = (axisId: AxisId) => {
    setSelectedAxes((prev) =>
      prev.includes(axisId)
        ? prev.filter((a) => a !== axisId)
        : [...prev, axisId]
    );
  };

  const startSweep = useCallback(async () => {
    if (plannedJobs.length === 0) return;

    setIsSweeping(true);
    setTotalJobs(plannedJobs.length);
    setCompletedJobs(0);
    setErrorCount(0);
    setStatusMessage("Starting experiment sweep...");
    setStartTime(Date.now());
    setElapsedMs(0);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const newRuns: RunRow[] = [];

    for (let i = 0; i < plannedJobs.length; i++) {
      if (abortController.signal.aborted) {
        setStatusMessage("Sweep cancelled by user.");
        break;
      }

      const job = plannedJobs[i];
      setCurrentJob(job);
      setStatusMessage(
        `Training ${MODEL_LABELS[job.modelType]} (${job.description}) [${
          i + 1
        }/${plannedJobs.length}]`
      );

      try {
        const res = await fetch("/api/train-one", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataset_id: dataset.id,
            model_type: job.modelType,
            config: job.config,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn(
            `Job ${job.id} failed with status ${res.status}:`,
            errData.error
          );
          setErrorCount((prev) => prev + 1);
        } else {
          const data = await res.json();
          if (data.run) {
            newRuns.push(data.run);
            setRuns((prev) => [data.run, ...prev]);
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setStatusMessage("Sweep aborted.");
          break;
        }
        console.error(`Error executing job ${job.id}:`, err);
        setErrorCount((prev) => prev + 1);
      }

      setCompletedJobs(i + 1);
    }

    setIsSweeping(false);
    setCurrentJob(null);
    setStartTime(null);
    if (!abortController.signal.aborted) {
      setStatusMessage("Sweep completed successfully!");
      setActiveTab("best-model");
    }
  }, [plannedJobs, dataset.id]);

  const cancelSweep = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsSweeping(false);
    setStartTime(null);
    setStatusMessage("Sweep cancelled.");
  };

  const progressPct =
    totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

  // Format time helpers
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  const msPerJob = completedJobs > 0 ? elapsedMs / completedJobs : 0;
  const remainingMs = msPerJob * (totalJobs - completedJobs);
  const showEstimate = completedJobs >= 2 && isSweeping; // wait for 2 jobs to get a stable estimate

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-8 dark:bg-zinc-950 sm:px-6 lg:px-8">
      <div className="flex w-full max-w-6xl flex-col gap-6">
        {/* Top Header Card */}
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white/70 p-6 shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                ← Back to Upload
              </Link>
              <span className="h-3.5 w-px bg-zinc-200 dark:bg-zinc-700" />
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                Dataset Active
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {dataset.filename}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
              <span>
                <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {dataset.row_count.toLocaleString()}
                </strong>{" "}
                rows
              </span>
              <span>•</span>
              <span>
                <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {dataset.columns.length}
                </strong>{" "}
                features
              </span>
              <span>•</span>
              <span>
                Target:{" "}
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  {dataset.target_column}
                </code>
              </span>
              <span>•</span>
              <span>
                <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {runs.length}
                </strong>{" "}
                completed runs
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isSweeping ? (
              <button
                type="button"
                onClick={startSweep}
                disabled={plannedJobs.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                <span>⚡ Run Sweep</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs dark:bg-black/20">
                  {plannedJobs.length} fits
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={cancelSweep}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-all hover:bg-red-100 active:scale-95 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              >
                <span>⏹ Cancel Sweep</span>
              </button>
            )}
          </div>
        </div>

        {/* Sweep Active Progress Card */}
        {isSweeping && (
          <div className="overflow-hidden rounded-2xl border border-blue-500/40 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-5 shadow-xs backdrop-blur-md dark:border-blue-400/30">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500"></span>
                  </span>
                  <span className="text-xs font-bold tracking-wide text-blue-800 uppercase dark:text-blue-200">
                    Live Client-Side Sweep in Progress
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium">
                  {showEstimate && (
                    <span className="text-blue-700/80 dark:text-blue-300/80">
                      ~{formatTime(remainingMs)} remaining
                    </span>
                  )}
                  <span className="font-mono text-sm font-bold text-blue-900 dark:text-blue-100">
                    {completedJobs} / {totalJobs} ({progressPct}%)
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 bg-white/50 dark:bg-black/20 p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
                <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-ellipsis">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {statusMessage}
                  </span>
                </div>
                {errorCount > 0 && (
                  <span className="shrink-0 text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/50">
                    {errorCount} {errorCount === 1 ? "error" : "errors"}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-1 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("best-model")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all ${
                activeTab === "best-model"
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <span>🏆 Best Model View</span>
              {runs.length > 0 && (
                <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {runs.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("research")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all ${
                activeTab === "research"
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <span>📊 Research View</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("sweep-config")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all ${
                activeTab === "sweep-config"
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <span>⚙️ Sweep Settings</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "best-model" && (
          <BestModelView runs={runs} datasetFilename={dataset.filename} />
        )}

        {activeTab === "research" && <ResearchView runs={runs} />}

        {activeTab === "sweep-config" && (
          <div className="flex flex-col gap-6 rounded-2xl border border-zinc-200/80 bg-white/70 p-6 shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Experiment Sweep Matrix
              </h2>
              <p className="text-xs text-zinc-500">
                Customize which classical ML models and experimental axes to
                evaluate on this dataset.
              </p>
            </div>

            {/* Model Selection Grid */}
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                1. Select ML Architectures
              </label>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {MODEL_TYPES.map((model) => {
                  const isSelected = selectedModels.includes(model);
                  return (
                    <button
                      key={model}
                      type="button"
                      onClick={() => toggleModel(model)}
                      className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                        isSelected
                          ? "border-zinc-900 bg-zinc-900/5 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-100/10 dark:text-zinc-50"
                          : "border-zinc-200/80 bg-white/40 text-zinc-500 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/40"
                      }`}
                    >
                      <span className="text-sm font-medium">
                        {MODEL_LABELS[model]}
                      </span>
                      <span
                        className={`h-4 w-4 rounded-md border flex items-center justify-center text-xs ${
                          isSelected
                            ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                            : "border-zinc-300 dark:border-zinc-700"
                        }`}
                      >
                        {isSelected ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Axis Selection Grid */}
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                2. Select Experimental Axes
              </label>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {AXES.map((axis) => {
                  const isSelected = selectedAxes.includes(axis.id);
                  return (
                    <button
                      key={axis.id}
                      type="button"
                      onClick={() => toggleAxis(axis.id)}
                      className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition-all ${
                        isSelected
                          ? "border-zinc-900 bg-zinc-900/5 dark:border-zinc-100 dark:bg-zinc-100/10"
                          : "border-zinc-200/80 bg-white/40 opacity-70 hover:opacity-100 dark:border-zinc-800 dark:bg-zinc-900/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {axis.label}
                        </span>
                        <span
                          className={`h-4 w-4 rounded-md border flex items-center justify-center text-xs ${
                            isSelected
                              ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                              : "border-zinc-300 dark:border-zinc-700"
                          }`}
                        >
                          {isSelected ? "✓" : ""}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500">
                        Values: {axis.values.map((v) => axis.describeValue(v)).join(", ")}
                        {axis.treeOnly && " (Tree models only)"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Action presets */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModels(MODEL_TYPES);
                    setSelectedAxes(AXES.map((a) => a.id));
                    setIncludeBaseline(true);
                  }}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Select All ({generateSweepJobs().length} fits)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModels(MODEL_TYPES);
                    setSelectedAxes([]);
                    setIncludeBaseline(true);
                  }}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Baselines Only (6 fits)
                </button>
              </div>

              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Total planned calls:{" "}
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  {plannedJobs.length}
                </span>{" "}
                (1 fit / serverless invocation)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
