import { UploadForm } from "@/components/UploadForm";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-radial-[at_top] from-zinc-100 via-zinc-50 to-zinc-50 px-4 py-12 dark:from-zinc-900 dark:via-zinc-950 dark:to-black sm:px-6 lg:px-8">
      <main className="flex w-full max-w-3xl flex-col gap-10">
        {/* Hero Section */}
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/80 px-3.5 py-1 text-xs font-semibold text-zinc-800 shadow-2xs backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-200">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span>100% Free-Tier Classical ML Benchmark Suite</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-950 sm:text-5xl dark:text-zinc-50">
            AI Research Lab
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Upload any tabular CSV dataset. Sweep classical ML models across 5
            empirical axes — from learning curves to noise tolerance — with
            real-time diagnostics and actionable insights.
          </p>

          {/* Architecture Feature Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span className="rounded-lg bg-zinc-200/60 px-2.5 py-1 dark:bg-zinc-800/60">
              6 Classical ML Models
            </span>
            <span className="rounded-lg bg-zinc-200/60 px-2.5 py-1 dark:bg-zinc-800/60">
              5 Empirical Sweep Axes
            </span>
            <span className="rounded-lg bg-zinc-200/60 px-2.5 py-1 dark:bg-zinc-800/60">
              One-Fit-Per-Call Serverless
            </span>
            <span className="rounded-lg bg-zinc-200/60 px-2.5 py-1 dark:bg-zinc-800/60">
              Supabase Postgres Storage
            </span>
          </div>
        </header>

        {/* Upload Form Component */}
        <UploadForm />

        {/* 3-Step Process Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200/80 bg-white/40 p-5 shadow-2xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/40">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 font-mono text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
              01
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Upload & Preprocess
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Automatic categorical one-hot encoding, mean numeric imputation,
              and z-score feature scaling.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200/80 bg-white/40 p-5 shadow-2xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/40">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 font-mono text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
              02
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Client Sweep Loop
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Runs ~150 isolated single-fit jobs without server timeouts or job
              queues.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200/80 bg-white/40 p-5 shadow-2xs backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/40">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 font-mono text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
              03
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Insight Engine
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Auto-generated plain-language tradeoffs, diminishing returns, and
              model recommendations.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
