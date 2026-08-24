import { NextResponse } from "next/server";
import { CsvValidationError, parseAndValidateCsv } from "@/lib/csv";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface FinalizeRequestBody {
  blobUrl: string;
  filename: string;
}

// Helper to extract path from public URL for deletion
function getPathFromUrl(url: string) {
  const parts = url.split("/datasets/");
  return parts.length > 1 ? parts[1] : null;
}

/**
 * Called by the client right after a direct-to-Supabase Storage upload completes.
 * We fetch it back, validate, and either persist a dataset row or delete the
 * blob and report the problem.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: FinalizeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { blobUrl, filename } = body;
  if (!blobUrl || !filename) {
    return NextResponse.json(
      { error: "blobUrl and filename are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const filePath = getPathFromUrl(blobUrl);

  let csvText: string;
  try {
    const res = await fetch(blobUrl);
    if (!res.ok) {
      throw new Error(`Could not fetch uploaded file (status ${res.status})`);
    }
    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (contentLength > MAX_UPLOAD_BYTES) {
      throw new CsvValidationError(
        `File exceeds the ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)}MB limit.`
      );
    }
    csvText = await res.text();
  } catch (error) {
    if (filePath) await supabase.storage.from("datasets").remove([filePath]);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const parsed = parseAndValidateCsv(csvText);

    const { data, error } = await supabase
      .from("datasets")
      .insert({
        filename,
        blob_url: blobUrl,
        row_count: parsed.rows.length,
        columns: parsed.columns,
        target_column: null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ dataset: data });
  } catch (error) {
    if (filePath) await supabase.storage.from("datasets").remove([filePath]);
    if (error instanceof CsvValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Validation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
