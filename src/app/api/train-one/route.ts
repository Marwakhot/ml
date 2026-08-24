import { NextResponse } from "next/server";
import { parseAndValidateCsv } from "@/lib/csv";
import { MAX_TARGET_CLASSES } from "@/lib/constants";
import { prepareTrainingData } from "@/lib/experiments/prepareTrainingData";
import { computeMetrics } from "@/lib/metrics";
import { getModelTrainer } from "@/lib/models";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { RunConfig } from "@/lib/supabase/types";

/**
 * The whole free-tier architecture hinges on this route doing exactly one
 * model fit per invocation — see the "Hard constraints" section of the
 * project README. A sweep across models x experiment axes is orchestrated
 * by the client calling this endpoint many times in sequence, never by a
 * server-side loop, so no single call can blow past Vercel's timeout no
 * matter how large the sweep grid gets.
 */
// Route segment config exports must be statically analyzable literals (Next
// parses them via AST, it doesn't execute the module) — keep this in sync
// with TRAIN_ONE_MAX_DURATION_SECONDS in lib/constants.ts.
export const maxDuration = 60;

interface TrainOneRequestBody {
  dataset_id: string;
  model_type: string;
  config?: RunConfig;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: TrainOneRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { dataset_id, model_type } = body;
  const config: RunConfig = body.config ?? { axis: null };

  if (!dataset_id || !model_type) {
    return NextResponse.json(
      { error: "dataset_id and model_type are required" },
      { status: 400 }
    );
  }

  let trainer;
  try {
    trainer = getModelTrainer(model_type);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown model_type" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data: dataset, error: datasetError } = await supabase
    .from("datasets")
    .select("*")
    .eq("id", dataset_id)
    .single();

  if (datasetError || !dataset) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }
  if (!dataset.target_column) {
    return NextResponse.json(
      { error: "Dataset has no target column set" },
      { status: 400 }
    );
  }

  let csvText: string;
  try {
    const res = await fetch(dataset.blob_url);
    if (!res.ok) throw new Error(`Could not fetch dataset file (status ${res.status})`);
    csvText = await res.text();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load dataset" },
      { status: 500 }
    );
  }

  try {
    const parsed = parseAndValidateCsv(csvText);

    const distinctTargetValues = new Set(
      parsed.rows.map((r) => r[parsed.headers.indexOf(dataset.target_column!)])
    );
    if (distinctTargetValues.size > MAX_TARGET_CLASSES) {
      return NextResponse.json(
        {
          error: `Target column has ${distinctTargetValues.size} distinct values, which exceeds the ${MAX_TARGET_CLASSES}-class limit for this demo.`,
        },
        { status: 400 }
      );
    }
    if (distinctTargetValues.size < 2) {
      return NextResponse.json(
        { error: "Target column must have at least 2 distinct classes." },
        { status: 400 }
      );
    }

    const prepared = prepareTrainingData(
      dataset_id,
      parsed.rows,
      dataset.columns,
      dataset.target_column,
      config
    );

    const trainStart = performance.now();
    const model = trainer(prepared.XTrain, prepared.yTrain, prepared.numClasses, config);
    const trainingTimeMs = performance.now() - trainStart;

    const inferenceStart = performance.now();
    const predictions = model.predict(prepared.XTest);
    const inferenceTimeMs = performance.now() - inferenceStart;

    const metrics = computeMetrics(prepared.yTest, predictions, prepared.numClasses);

    const { data: run, error: insertError } = await supabase
      .from("runs")
      .insert({
        dataset_id,
        model_type,
        config,
        accuracy: metrics.accuracy,
        precision: metrics.precision,
        recall: metrics.recall,
        f1: metrics.f1,
        training_time_ms: Math.round(trainingTimeMs),
        inference_time_ms: Math.round(inferenceTimeMs),
      })
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Training failed" },
      { status: 500 }
    );
  }
}
