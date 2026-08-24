import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";

/**
 * Issues short-lived client tokens for direct browser -> Vercel Blob
 * uploads. A server-side "upload the file to my API route" approach would
 * route the whole CSV through the Next.js request body, which Vercel caps at
 * 4.5MB — below our own 5MB dataset cap. Uploading directly from the client
 * avoids that ceiling entirely; the server never sees the raw bytes here.
 * Row-count/schema validation still happens server-side, in
 * /api/datasets/finalize, once the blob exists.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: ["text/csv", "application/vnd.ms-excel"],
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
