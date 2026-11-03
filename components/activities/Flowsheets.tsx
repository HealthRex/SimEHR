"use client";

// Flowsheets — the home for screening questionnaires (the design notes
// §4 row 5: PHQ-9 is a flowsheet family, NOT Social History and NOT a lab). Data-driven from
// observations[panel="Mental Health Screening"] (score rows + computed total) plus a lab
// "Chart Review Lab Dynamic View"-style flowsheet reachable from Chart Review › Labs → Lab
// Flowsheet. Renders the native empty state when the case carries no screening data.

import { useState } from "react";
import { useSim } from "@/lib/store";
import { labs, screeningObs } from "@/lib/projections";
import type { Case, Observation } from "@/lib/types";

function ScreeningFlowsheet({ c }: { c: Case }) {
  const obs = screeningObs(c);
  if (!obs.length)
    return <div className="rr-empty">No data found for this flowsheet in the selected time range.</div>;
  const dates = [...new Set(obs.map((o) => o.datetime.slice(0, 10)))].sort().reverse();
  const rows = new Map<string, Record<string, Observation>>();
  for (const o of obs) {
    if (!rows.has(o.name)) rows.set(o.name, {});
    rows.get(o.name)![o.datetime.slice(0, 10)] = o;
  }
  const totals: Record<string, number> = {};
  for (const d of dates) {
    const vals = obs.filter((o) => o.datetime.slice(0, 10) === d && typeof o.value === "number");
    if (vals.length) totals[d] = vals.reduce((s, o) => s + (o.value as number), 0);
  }
  return (
    <table className="rr-flowsheet" data-testid="flowsheet-screening">
      <thead>
        <tr>
          <th className="comp-h">Row</th>
          {dates.map((d) => (
            <th key={d}>{d}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...rows.entries()].map(([name, byDate]) => (
          <tr key={name} data-testid={`fs-row-${name.replace(/[^a-zA-Z0-9]+/g, "-")}`}>
            <td className="comp" style={{ cursor: "default" }}>{name}</td>
            {dates.map((d) => (
              <td key={d} className="val">{byDate[d] ? String(byDate[d].value) : "–"}</td>
            ))}
          </tr>
        ))}
        {Object.keys(totals).length > 0 && (
          <tr data-testid="fs-row-total">
            <td className="comp" style={{ cursor: "default" }}><b>Score (total)</b></td>
            {dates.map((d) => (
              <td key={d} className="val"><b>{totals[d] ?? "–"}</b></td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}

// Lab Flowsheet (launched from Chart Review › Labs toolbar) — same observation set as
// Results Review, plain component×date matrix.
function LabFlowsheet({ c }: { c: Case }) {
  const obs = labs(c);
  if (!obs.length) return <div className="rr-empty">No data found for this flowsheet.</div>;
  const dates = [...new Set(obs.map((o) => o.datetime.slice(0, 10)))].sort().reverse();
  const rows = new Map<string, Record<string, Observation>>();
  for (const o of obs) {
    if (!rows.has(o.name)) rows.set(o.name, {});
    rows.get(o.name)![o.datetime.slice(0, 10)] = o;
  }
  return (
    <table className="rr-flowsheet" data-testid="flowsheet-labs">
      <thead>
        <tr>
          <th className="comp-h">Component</th>
          {dates.map((d) => (
            <th key={d}>{d}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...rows.entries()].map(([name, byDate]) => (
          <tr key={name}>
            <td className="comp" style={{ cursor: "default" }}>{name}</td>
            {dates.map((d) => {
              const o = byDate[d];
              return (
                <td key={d} className="val">
                  {o ? (
                    <span className={o.flag === "H" || o.flag === "A" ? "flag-high" : o.flag === "L" ? "flag-low" : ""}>
                      {String(o.value).length > 24 ? String(o.value).slice(0, 24) + "…" : o.value}
                      {o.flag ? ` ${o.flag}` : ""}
                    </span>
                  ) : (
                    "–"
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Flowsheets() {
  const c = useSim((s) => s.caseData);
  const [sheet, setSheet] = useState<"screening" | "labs">("screening");
  if (!c) return null;
  const hasScreening = screeningObs(c).length > 0;
  return (
    <div className="flowsheet-wrap" data-testid="flowsheets">
      <div style={{ marginBottom: 8, fontSize: 11.5 }}>
        Select a Flowsheet:{" "}
        <select value={sheet} data-testid="fs-select" onChange={(e) => setSheet(e.target.value as "screening" | "labs")} style={{ fontSize: 11.5 }}>
          <option value="screening">Mental Health Screening (PHQ){hasScreening ? "" : " — no data"}</option>
          <option value="labs">Laboratory Trends</option>
        </select>
      </div>
      {sheet === "screening" ? <ScreeningFlowsheet c={c} /> : <LabFlowsheet c={c} />}
    </div>
  );
}
