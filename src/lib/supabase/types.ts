export type ColumnType = "numeric" | "categorical";

export type DatasetColumn = {
  name: string;
  type: ColumnType;
  /** Distinct values seen, populated for categorical columns (used to build
   * label encoders without re-reading the whole file). */
  categories?: string[];
};

export type DatasetRow = {
  id: string;
  filename: string;
  blob_url: string;
  row_count: number;
  columns: DatasetColumn[];
  target_column: string | null;
  created_at: string;
};

export type RunConfig = {
  /** Which experiment axis this run belongs to, if any (null = baseline). */
  axis: string | null;
  /** Axis-specific sweep value, e.g. training data % or noise level. */
  axisValue?: number | string;
  trainDataPct?: number;
  labelNoisePct?: number;
  featureNoiseStd?: number;
  ablateTopNFeatures?: number;
  imbalanceRatio?: number;
  maxDepth?: number;
  nEstimators?: number;
  [key: string]: unknown;
};

export type RunRow = {
  id: string;
  dataset_id: string;
  model_type: string;
  config: RunConfig;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  training_time_ms: number;
  inference_time_ms: number;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      datasets: {
        Row: DatasetRow;
        Insert: Omit<DatasetRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<DatasetRow>;
        Relationships: [];
      };
      runs: {
        Row: RunRow;
        Insert: Omit<RunRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<RunRow>;
        Relationships: [
          {
            foreignKeyName: "runs_dataset_id_fkey";
            columns: ["dataset_id"];
            isOneToOne: false;
            referencedRelation: "datasets";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
