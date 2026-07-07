// Types mirror the JSON artifact produced by ml/run.py (build_model_spec etc.)

export interface Meta {
  name: string;
  version: string;
  generatedAt: string;
  datasetSource: string;
  datasetIsReal: boolean;
  rows: number;
  productionModel: string;
  features: { numeric: string[]; categorical: string[] };
}

export interface Benchmark {
  name: string;
  cvAucMean: number;
  cvAucStd: number;
}

export interface Metrics {
  threshold: number;
  roc_auc: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  brier: number;
  base_rate: number;
  confusion_matrix: { tn: number; fp: number; fn: number; tp: number };
  roc_curve: { fpr: number; tpr: number }[];
  pr_curve: { recall: number; precision: number }[];
  calibration: { predicted: number; observed: number; count: number }[];
}

export type Term =
  | {
      feature: string;
      kind: "numeric";
      center: number;
      scale: number;
      coef: number;
      mean: number;
    }
  | {
      feature: string;
      kind: "categorical";
      value: string;
      coef: number;
      mean: number;
    };

export interface Importance {
  feature: string;
  label: string;
  importance: number;
}

export interface ModelSpec {
  intercept: number;
  baseline_logit: number;
  baseline_prob: number;
  terms: Term[];
  importance: Importance[];
  threshold: number;
}

export interface NumericField {
  feature: string;
  label: string;
  type: "numeric";
  min: number;
  max: number;
  median: number;
  step: number;
  unit: string;
}

export interface CategoricalField {
  feature: string;
  label: string;
  type: "categorical";
  options: string[];
  isAddon: boolean;
}

export type SchemaField = NumericField | CategoricalField;

export interface CohortBar {
  label: string;
  rate: number;
  count: number;
}

export interface Cohorts {
  overall: { rate: number; count: number };
  contract: CohortBar[];
  internet: CohortBar[];
  payment: CohortBar[];
  tenure: CohortBar[];
}

export interface Sample {
  name: string;
  actualChurn: boolean;
  modelProb: number;
  inputs: Record<string, string | number>;
}

export interface OnnxInfo {
  available: boolean;
  opset?: number;
  parityMaxDiff?: number;
  parityOk?: boolean;
  sizeBytes?: number;
  reason?: string;
}

export interface Artifact {
  meta: Meta;
  benchmarks: Benchmark[];
  metrics: Metrics;
  model: ModelSpec;
  schema: SchemaField[];
  cohorts: Cohorts;
  samples: Sample[];
  onnx: OnnxInfo;
}

export type InputRecord = Record<string, string | number>;

export interface Contribution {
  feature: string;
  label: string;
  value: string | number;
  contribution: number; // in logit space
}

export interface Prediction {
  probability: number;
  logit: number;
  baselineProb: number;
  contributions: Contribution[];
}
