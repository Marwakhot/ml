"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_ROWS, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { SAMPLE_DATASETS, type SampleDataset } from "@/lib/sampleDatasets";
import type { DatasetRow } from "@/lib/supabase/types";

type Stage = "idle" | "uploading" | "validating" | "choose-target" | "saving";

export function UploadForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dataset, setDataset] = useState<DatasetRow | null>(null);
  const [targetColumn, setTargetColumn] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);

  async function processFile(file: File, suggestedTarget?: string) {
    setError(null);
    setDataset(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a valid CSV file (.csv).");
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `File is ${(file.size / 1024 / 1024).toFixed(2)}MB, which exceeds the ${(
          MAX_UPLOAD_BYTES /
          1024 /
          1024
        ).toFixed(0)}MB free-tier serverless limit.`
      );
      return;
    }

    try {
      setStage("uploading");
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
        contentType: "text/csv",
      });

      setStage("validating");
      const res = await fetch("/api/datasets/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl: blob.url, filename: file.name }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Upload validation failed");
      }

      const ds = json.dataset as DatasetRow;
      setDataset(ds);
      if (suggestedTarget && ds.columns.some((c) => c.name === suggestedTarget)) {
        setTargetColumn(suggestedTarget);
      } else if (ds.columns.length > 0) {
        // default to last column (common ML convention)
        setTargetColumn(ds.columns[ds.columns.length - 1].name);
      }
      setStage("choose-target");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStage("idle");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleLoadSample(sample: SampleDataset) {
    const blob = new Blob([sample.csv], { type: "text/csv" });
    const file = new File([blob], sample.filename, { type: "text/csv" });
    processFile(file, sample.defaultTarget);
  }

  async function handleConfirmTarget() {
    if (!dataset || !targetColumn) return;
    setError(null);
    setStage("saving");
    try {
      const res = await fetch(`/api/datasets/${dataset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_column: targetColumn }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Could not save target column");
      }
      router.push(`/experiment/${dataset.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("choose-target");
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-zinc-200/80 bg-white/70 p-6 shadow-xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60 sm:p-8">
      {stage === "idle" || stage === "uploading" || stage === "validating" ? (
        <div className="flex flex-col gap-5">
          <label
            htmlFor="csv-file"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
              isDragging
                ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/30 scale-[1.01]"
                : "border-zinc-300/80 bg-zinc-50/50 hover:border-zinc-400 hover:bg-zinc-100/50 dark:border-zinc-700/80 dark:bg-zinc-900/30 dark:hover:border-zinc-600"
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950">
              {stage === "uploading" || stage === "validating" ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {stage === "idle" && "Drop your CSV file here, or browse"}
                {stage === "uploading" && "Uploading to Vercel Blob..."}
                {stage === "validating" && "Validating structure & schema..."}
              </span>
              <span className="text-xs text-zinc-500">
                Max {(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)}MB · Max{" "}
                {MAX_ROWS.toLocaleString()} rows · UTF-8 CSV
              </span>
            </div>

            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={stage !== "idle"}
              onChange={handleFileChange}
            />
          </label>

          {/* Quick Demo Pre-loaded Datasets */}
          {stage === "idle" && (
            <div className="flex flex-col gap-2.5 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  Or Try a One-Click Benchmark Dataset:
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SAMPLE_DATASETS.map((sample) => (
                  <button
                    key={sample.filename}
                    type="button"
                    onClick={() => handleLoadSample(sample)}
                    className="flex flex-col items-start gap-1 rounded-xl border border-zinc-200/80 bg-white/60 p-3.5 text-left transition-all hover:border-zinc-400 hover:bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-600"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {sample.name}
                      </span>
                      <span className="text-xs font-mono text-zinc-500">
                        {sample.filename}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {sample.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {(stage === "choose-target" || stage === "saving") && dataset ? (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Uploaded{" "}
              <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                {dataset.filename}
              </strong>{" "}
              — {dataset.row_count.toLocaleString()} rows,{" "}
              {dataset.columns.length} columns detected.
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="target-column"
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >
              Select Target Column to Predict:
            </label>
            <select
              id="target-column"
              className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-medium shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              value={targetColumn}
              onChange={(e) => setTargetColumn(e.target.value)}
              disabled={stage === "saving"}
            >
              <option value="">Select prediction target column...</option>
              {dataset.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Detected Feature Schema
            </span>
            <ul className="max-h-48 overflow-y-auto rounded-xl border border-zinc-200/80 bg-white/40 text-xs dark:border-zinc-800 dark:bg-zinc-900/30">
              {dataset.columns.map((c) => (
                <li
                  key={c.name}
                  className={`flex justify-between border-b border-zinc-100 px-3.5 py-2 last:border-b-0 dark:border-zinc-800/60 ${
                    c.name === targetColumn
                      ? "bg-blue-500/10 font-semibold text-blue-700 dark:text-blue-300"
                      : ""
                  }`}
                >
                  <span className="text-zinc-800 dark:text-zinc-200">
                    {c.name}
                    {c.name === targetColumn && " (Target)"}
                  </span>
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {c.type}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={handleConfirmTarget}
            disabled={!targetColumn || stage === "saving"}
            className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {stage === "saving" ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>Preparing Experiment Workspace...</span>
              </>
            ) : (
              <span>Proceed to Experiment Lab →</span>
            )}
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          ⚠️ {error}
        </div>
      ) : null}
    </div>
  );
}
