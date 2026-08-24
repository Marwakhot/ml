import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("datasets")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  return NextResponse.json({ dataset: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const body = await request.json();
  const { target_column } = body as { target_column?: string };

  if (!target_column) {
    return NextResponse.json(
      { error: "target_column is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: dataset, error: fetchError } = await supabase
    .from("datasets")
    .select("columns")
    .eq("id", id)
    .single();

  if (fetchError || !dataset) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  const columnNames = dataset.columns.map((c) => c.name);
  if (!columnNames.includes(target_column)) {
    return NextResponse.json(
      { error: `Column "${target_column}" does not exist in this dataset` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("datasets")
    .update({ target_column })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dataset: data });
}
