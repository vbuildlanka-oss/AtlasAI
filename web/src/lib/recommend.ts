import type { InputRecord, ModelSpec, SchemaField } from "../types";
import { predict } from "./inference";

export interface Recommendation {
  label: string;
  detail: string;
  change: InputRecord;
  newProb: number;
  delta: number; // negative == risk reduction
}

interface Lever {
  label: string;
  detail: string;
  change: InputRecord;
  applicable: (r: InputRecord) => boolean;
}

/**
 * Business "levers" a retention team could actually pull. We apply each to the
 * current customer, re-run the exact model, and rank by realised risk drop.
 */
function levers(record: InputRecord): Lever[] {
  const hasInternet = record.InternetService !== "No";
  const all: Lever[] = [
    {
      label: "Move to a 1-year contract",
      detail: "Offer an incentive to leave month-to-month billing.",
      change: { Contract: "One year" },
      applicable: (r) => r.Contract === "Month-to-month",
    },
    {
      label: "Move to a 2-year contract",
      detail: "Lock-in with a loyalty discount.",
      change: { Contract: "Two year" },
      applicable: (r) => r.Contract !== "Two year",
    },
    {
      label: "Add Tech Support",
      detail: "Bundle premium support at no cost for 6 months.",
      change: { TechSupport: "Yes" },
      applicable: (r) => hasInternet && r.TechSupport !== "Yes",
    },
    {
      label: "Add Online Security",
      detail: "Include the security add-on in the plan.",
      change: { OnlineSecurity: "Yes" },
      applicable: (r) => hasInternet && r.OnlineSecurity !== "Yes",
    },
    {
      label: "Switch to auto-pay",
      detail: "Migrate from electronic check to automatic bank transfer.",
      change: { PaymentMethod: "Bank transfer (automatic)" },
      applicable: (r) => r.PaymentMethod === "Electronic check",
    },
    {
      label: "Enable paperless discount",
      detail: "Turn off paper billing surcharge friction.",
      change: { PaperlessBilling: "No" },
      applicable: (r) => r.PaperlessBilling === "Yes",
    },
  ];
  return all.filter((l) => l.applicable(record));
}

export function recommend(
  model: ModelSpec,
  schema: SchemaField[],
  record: InputRecord,
  topN = 3,
): Recommendation[] {
  const base = predict(model, schema, record).probability;
  const results: Recommendation[] = [];
  for (const lever of levers(record)) {
    const candidate = { ...record, ...lever.change };
    const newProb = predict(model, schema, candidate).probability;
    results.push({
      label: lever.label,
      detail: lever.detail,
      change: lever.change,
      newProb,
      delta: newProb - base,
    });
  }
  return results
    .filter((r) => r.delta < -0.005)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, topN);
}
