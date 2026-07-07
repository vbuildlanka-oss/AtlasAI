import type {
  Contribution,
  InputRecord,
  ModelSpec,
  Prediction,
  SchemaField,
} from "../types";

const ADDON = new Set([
  "OnlineSecurity",
  "OnlineBackup",
  "DeviceProtection",
  "TechSupport",
  "StreamingTV",
  "StreamingMovies",
]);

const EXTRA_LABELS: Record<string, string> = {
  num_addon_services: "Add-on services",
};

export function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

export function labelFor(feature: string, schema: SchemaField[]): string {
  const f = schema.find((s) => s.feature === feature);
  return f?.label ?? EXTRA_LABELS[feature] ?? feature;
}

/**
 * Enforce the same structural constraints the raw data has, so the what-if
 * simulator never produces an impossible customer:
 *  - no internet  => internet-dependent services become "No internet service"
 *  - no phone     => MultipleLines becomes "No phone service"
 * Then (re)derive the engineered `num_addon_services` feature exactly as the
 * Python `add_engineered_features` does.
 */
export function normalize(record: InputRecord): InputRecord {
  const r: InputRecord = { ...record };

  if (r.InternetService === "No") {
    for (const svc of [
      "OnlineSecurity",
      "OnlineBackup",
      "DeviceProtection",
      "TechSupport",
      "StreamingTV",
      "StreamingMovies",
    ]) {
      if (svc in r) r[svc] = "No internet service";
    }
  }
  if (r.PhoneService === "No") {
    r.MultipleLines = "No phone service";
  }

  let addons = 0;
  for (const svc of ADDON) if (r[svc] === "Yes") addons += 1;
  r.num_addon_services = addons;

  return r;
}

/** Exact logistic-regression inference + additive (linear-SHAP) attributions. */
export function predict(
  model: ModelSpec,
  schema: SchemaField[],
  rawRecord: InputRecord,
): Prediction {
  const record = normalize(rawRecord);
  const byFeature = new Map<string, number>();
  let logit = model.intercept;

  for (const term of model.terms) {
    let enc: number;
    if (term.kind === "numeric") {
      enc = (Number(record[term.feature]) - term.center) / term.scale;
    } else {
      enc = String(record[term.feature]) === term.value ? 1 : 0;
    }
    logit += term.coef * enc;
    const contribution = term.coef * (enc - term.mean);
    byFeature.set(
      term.feature,
      (byFeature.get(term.feature) ?? 0) + contribution,
    );
  }

  const contributions: Contribution[] = [...byFeature.entries()]
    .map(([feature, contribution]) => ({
      feature,
      label: labelFor(feature, schema),
      value: record[feature],
      contribution,
    }))
    .filter((c) => Math.abs(c.contribution) > 1e-6)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return {
    probability: sigmoid(logit),
    logit,
    baselineProb: sigmoid(model.baseline_logit),
    contributions,
  };
}

export interface RiskTier {
  label: string;
  color: string;
  advice: string;
}

export function riskTier(p: number): RiskTier {
  if (p >= 0.65)
    return {
      label: "Critical",
      color: "var(--danger)",
      advice: "Immediate retention outreach recommended.",
    };
  if (p >= 0.4)
    return {
      label: "High",
      color: "var(--warn)",
      advice: "Prioritise for a proactive offer.",
    };
  if (p >= 0.2)
    return {
      label: "Elevated",
      color: "var(--amber)",
      advice: "Monitor and nurture engagement.",
    };
  return {
    label: "Low",
    color: "var(--good)",
    advice: "Healthy account - keep it that way.",
  };
}

export function toInputRecord(inputs: Record<string, string | number>): InputRecord {
  return { ...inputs };
}
