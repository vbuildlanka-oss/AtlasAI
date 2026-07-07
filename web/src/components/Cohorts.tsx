import type { Cohorts as CohortsType, CohortBar } from "../types";

function Bars({ title, data, maxRate }: { title: string; data: CohortBar[]; maxRate: number }) {
  return (
    <div className="cohort">
      <h4>{title}</h4>
      {data.map((b) => (
        <div className="cbar" key={b.label}>
          <div className="cl" title={b.label}>
            {b.label}
          </div>
          <div className="ctrack">
            <div className="cfill" style={{ width: `${(b.rate / maxRate) * 100}%` }} />
          </div>
          <div className="cv">{(b.rate * 100).toFixed(0)}%</div>
        </div>
      ))}
    </div>
  );
}

export default function Cohorts({ cohorts }: { cohorts: CohortsType }) {
  const all = [
    ...cohorts.contract,
    ...cohorts.internet,
    ...cohorts.payment,
    ...cohorts.tenure,
  ];
  const maxRate = Math.max(...all.map((b) => b.rate), 0.1);
  return (
    <div className="card">
      <h2>Churn by segment</h2>
      <p className="sub">
        Ground-truth churn rates across {cohorts.overall.count.toLocaleString()} customers
        (overall {(cohorts.overall.rate * 100).toFixed(1)}%).
      </p>
      <Bars title="Contract type" data={cohorts.contract} maxRate={maxRate} />
      <Bars title="Internet service" data={cohorts.internet} maxRate={maxRate} />
      <Bars title="Tenure (months)" data={cohorts.tenure} maxRate={maxRate} />
      <Bars title="Payment method" data={cohorts.payment} maxRate={maxRate} />
    </div>
  );
}
