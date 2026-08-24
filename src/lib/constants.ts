/**
 * Free-tier design constants.
 *
 * These caps exist because the whole pipeline runs on Vercel Hobby serverless
 * functions with a short, unpredictable timeout and no background workers.
 * Keeping datasets small is what keeps every /api/train-one call (one model
 * fit) comfortably inside that budget instead of risking a timeout mid-sweep.
 */

/** Reject any upload larger than this. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

/** Reject any CSV with more data rows than this (header row excluded). */
export const MAX_ROWS = 20_000;

/** Column type detection: a column is treated as categorical if it has at
 * most this many distinct values (or is non-numeric). Otherwise numeric. */
export const CATEGORICAL_UNIQUE_THRESHOLD = 20;

/** Hard cap on distinct classes accepted for the target column. Beyond this,
 * one-vs-rest training (logistic regression, linear SVM, gradient boosting)
 * would multiply the per-call training cost past what a single serverless
 * invocation should take on. */
export const MAX_TARGET_CLASSES = 10;

/** Route segment timeout budget requested for /api/train-one (Vercel Hobby
 * allows up to 60s via vercel.json/route config; each call fits one fit). */
export const TRAIN_ONE_MAX_DURATION_SECONDS = 60;
