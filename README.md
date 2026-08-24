# AI Research Lab (Free-Tier Architecture)

An automated Machine Learning benchmarking and research laboratory that runs classical ML models across empirical experimental axes, logs metrics in Supabase, and provides automated diagnostic insights and tradeoff curves.

Built to run **100% on free-tier infrastructure** (Vercel Hobby, Vercel Blob, Supabase Free Tier Postgres).

---

## 🏛 Architecture & Free-Tier Design Rationale

Serverless platforms like Vercel Hobby impose strict limits:
1. **Request Body Size Limit**: 4.5MB max on serverless API routes.
2. **Function Execution Timeout**: 10s–60s limit with no persistent background processes or long-running worker queues.
3. **Hardware**: Zero GPU availability.

To overcome these constraints without paid infrastructure, AI Research Lab is built around intentional architecture patterns:

```
[Browser Client]
   │
   ├─ 1. Client-to-Blob Direct Upload (Token Auth) ──> [Vercel Blob Storage]
   │     (Bypasses Vercel's 4.5MB server request body cap)
   │
   ├─ 2. Finalize & Validate Schema ──> [POST /api/datasets/finalize] ──> [Supabase Postgres]
   │
   ├─ 3. Client-Orchestrated Sweep Loop
   │     (Sequential POST /api/train-one calls)
   │     │
   │     ├── Call 1: Logistic Regression (Baseline) ──────> Fit ──> Metric Log
   │     ├── Call 2: Random Forest (10% Data) ───────────> Fit ──> Metric Log
   │     └── Call N: Gradient Boosting (Noise 30%) ──────> Fit ──> Metric Log
   │
   └─ 4. Dashboard Views (Supabase Query)
         ├── 🏆 Best Model View (Leaderboard + Actionable Recommendations)
         └── 📊 Research View (Recharts Empirical Tradeoff Curves + Diminishing Returns)
```

### Key Architectural Decisions

- **Direct-to-Blob Upload**: Uploads go directly from the browser to Vercel Blob via `@vercel/blob/client` short-lived tokens, completely bypassing the Next.js server payload limit.
- **One Model Fit per Function Call (`/api/train-one`)**: Instead of running a large server-side loop that times out, the client generates the discrete job list (~150 fits) and executes them sequentially. If any call fails, it can retry without losing previous run metrics.
- **Dataset Caps**: Uploads are capped at **5MB** and **20,000 rows** (`src/lib/constants.ts`), ensuring every training step finishes in <500ms on serverless CPUs.
- **Pure TypeScript ML Engine**: High-performance pure-JS classical ML algorithms with deterministic seeding (`mulberry32`), eliminating Python container cold starts and C-extension deployment issues on serverless.

---

## 🤖 Supported ML Models

- **Logistic Regression**: Multi-class logistic regression via one-vs-all gradient descent.
- **Decision Tree**: Fast recursive binary splitter supporting classification and regression.
- **Random Forest**: Bagged ensemble of randomized decision trees.
- **Gradient Boosting**: Lightweight additive boosting of shallow regression stumps on binary log-loss residuals (One-vs-Rest for multiclass).
- **k-Nearest Neighbors (KNN)**: Euclidean distance-weighted neighbor voting.
- **Linear SVM**: Multi-class linear Support Vector Machine via Pegasos stochastic subgradient descent.

---

## 🔬 Supported Experimental Axes

1. **Training Data Quantity**: Sweeps `[10%, 20%, 40%, 60%, 80%, 100%]` of training samples to construct empirical learning curves and identify data saturation points.
2. **Label Noise Injection**: Sweeps `[0%, 5%, 10%, 20%, 30%]` synthetic target corruption on training data to measure model noise tolerance.
3. **Feature Noise Injection**: Adds `[0, 0.1, 0.25, 0.5, 1.0]σ` Gaussian noise to input features.
4. **Feature Ablation**: Removes top-N correlated features `[0, 1, 2, 3]` based on Pearson correlation ranking.
5. **Class Imbalance**: Downsamples minority classes to `[1.0, 0.5, 0.25, 0.1, 0.05]` majority ratio to test macro-F1 sensitivity.
6. **Model Complexity (Tree Models)**: Sweeps tree `max_depth` across `[2, 3, 5, 8, 12]` to observe underfitting vs. overfitting.

---

## 🚀 Setup & Local Development

### 1. Prerequisites

- Node.js 18+
- A free [Supabase](https://supabase.com) account
- A free [Vercel](https://vercel.com) account (for Blob storage)

### 2. Configure Supabase Schema

1. Go to your Supabase project's **SQL Editor**.
2. Run the SQL schema from [`supabase/schema.sql`](supabase/schema.sql):

```sql
create extension if not exists "pgcrypto";

create table if not exists datasets (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  blob_url text not null,
  row_count integer not null,
  columns jsonb not null,
  target_column text,
  created_at timestamptz not null default now()
);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references datasets(id) on delete cascade,
  model_type text not null,
  config jsonb not null default '{}'::jsonb,
  accuracy double precision not null,
  precision double precision not null,
  recall double precision not null,
  f1 double precision not null,
  training_time_ms integer not null,
  inference_time_ms integer not null,
  created_at timestamptz not null default now()
);
```

### 3. Configure Environment Variables

Create a `.env.local` file with:

```env
# Supabase (Project Settings -> API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Vercel Blob (Storage -> Create Blob Store -> .env.local tab)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

### 4. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📈 Scaling This Up (Beyond Free-Tier)

When scaling to larger production workloads:
1. **Background Job Queue**: Replace client-side sequential looping with an async queue system (e.g. Inngest, BullMQ with Redis, or AWS SQS + Celery).
2. **Dedicated Worker Nodes**: Offload model training to persistent worker instances or GPU-enabled microservices (e.g., Python FastAPI with scikit-learn, XGBoost, LightGBM, PyTorch).
3. **Dataset Streaming**: Support multi-gigabyte datasets via chunked Parquet streaming from S3/GCS.
4. **Hyperparameter Tuning**: Integrate Bayesian optimization (Optuna / Ray Tune) across continuous hyperparameter search spaces.
