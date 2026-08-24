import Papa from "papaparse";
import {
  CATEGORICAL_UNIQUE_THRESHOLD,
  MAX_ROWS,
  MAX_UPLOAD_BYTES,
} from "./constants";
import type { DatasetColumn } from "./supabase/types";

export class CsvValidationError extends Error {}

export interface ParsedCsv {
  headers: string[];
  /** Row values, still as strings — numeric parsing happens in preprocessing. */
  rows: string[][];
  columns: DatasetColumn[];
}

export function validateUploadSize(byteLength: number) {
  if (byteLength > MAX_UPLOAD_BYTES) {
    throw new CsvValidationError(
      `File is ${(byteLength / 1024 / 1024).toFixed(2)}MB, which exceeds the ${(
        MAX_UPLOAD_BYTES /
        1024 /
        1024
      ).toFixed(0)}MB limit.`
    );
  }
}

function isNumeric(value: string): boolean {
  if (value.trim() === "") return false;
  return Number.isFinite(Number(value));
}

/**
 * Parses raw CSV text, validates row count, and infers a type per column
 * (numeric vs categorical) from the sampled values. Throws
 * CsvValidationError on any hard-cap violation or structural problem.
 */
export function parseAndValidateCsv(csvText: string): ParsedCsv {
  const result = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    const fatal = result.errors.find((e) => e.type !== "FieldMismatch");
    if (fatal) {
      throw new CsvValidationError(`Could not parse CSV: ${fatal.message}`);
    }
  }

  const data = result.data as string[][];
  if (data.length < 2) {
    throw new CsvValidationError(
      "CSV must have a header row plus at least one data row."
    );
  }

  const headers = data[0].map((h) => h.trim());
  if (new Set(headers).size !== headers.length) {
    throw new CsvValidationError("CSV has duplicate column names.");
  }
  if (headers.some((h) => h === "")) {
    throw new CsvValidationError("CSV has one or more blank column headers.");
  }

  const rows = data.slice(1).filter((r) => r.length > 0);

  if (rows.length > MAX_ROWS) {
    throw new CsvValidationError(
      `CSV has ${rows.length} data rows, which exceeds the ${MAX_ROWS} row limit.`
    );
  }

  const malformed = rows.find((r) => r.length !== headers.length);
  if (malformed) {
    throw new CsvValidationError(
      `Found a row with ${malformed.length} values but the header has ${headers.length} columns.`
    );
  }

  const columns: DatasetColumn[] = headers.map((name, colIdx) => {
    const values = rows.map((r) => r[colIdx]);
    const nonEmpty = values.filter((v) => v.trim() !== "");
    const allNumeric =
      nonEmpty.length > 0 && nonEmpty.every((v) => isNumeric(v));

    if (allNumeric) {
      return { name, type: "numeric" };
    }

    const distinct = Array.from(new Set(nonEmpty));
    if (distinct.length <= CATEGORICAL_UNIQUE_THRESHOLD) {
      return { name, type: "categorical", categories: distinct.sort() };
    }

    // High-cardinality non-numeric column (e.g. free text, IDs): still
    // categorical so it can be encoded, but flagged via a large category
    // list rather than silently dropped.
    return { name, type: "categorical", categories: distinct.sort() };
  });

  return { headers, rows, columns };
}
