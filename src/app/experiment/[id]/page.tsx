import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ExperimentClient } from "./ExperimentClient";

export default async function ExperimentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: dataset, error: datasetError } = await supabase
    .from("datasets")
    .select("*")
    .eq("id", id)
    .single();

  if (datasetError || !dataset) {
    notFound();
  }

  // Fetch any existing runs for this dataset
  const { data: runs } = await supabase
    .from("runs")
    .select("*")
    .eq("dataset_id", id)
    .order("created_at", { ascending: false });

  return <ExperimentClient dataset={dataset} initialRuns={runs ?? []} />;
}
