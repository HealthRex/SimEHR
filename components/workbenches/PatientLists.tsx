"use client";

import { Fragment, useEffect, useState } from "react";
import { fetchRoster, fetchCase, type RosterEntry } from "@/lib/cases";
import { loadCase, switchActivity } from "@/lib/store";

// Row quick-actions — each opens that patient's chart directly at the activity (mock openPatientChartTo).
const ACTIONS: [string, string, string][] = [
  ["pl-act-notes", "📝 Notes", "notewriter"],
  ["pl-act-results", "🧪 Results Review", "results"],
  ["pl-act-medhx", "💊 Med Hx", "medications"],
  ["pl-act-chartreview", "📁 Chart Review", "chart-review"],
];

export default function PatientLists() {
  const [rows, setRows] = useState<RosterEntry[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    fetchRoster().then(setRows);
  }, []);

  const openChart = async (id: string, activity: string) => {
    const c = await fetchCase(id);
    if (c) {
      loadCase(c, "human");
      switchActivity(activity, "human");
    }
  };

  const selected = rows.find((r) => r.id === sel) ?? null;

  return (
    <div className="pl-body" data-testid="patient-lists">
      <div className="pl-lists">
        <div className="pl-cat">▾ Shared Patient Lists</div>
        <div className="pl-list active" data-testid="pl-list-my">
          <span className="gl">≣</span> My Patients <span className="pl-ct">({rows.length})</span>
        </div>
        <div className="pl-list" data-testid="pl-list-clinic">
          <span className="gl">≣</span> Today&rsquo;s Clinic <span className="pl-ct">({rows.length})</span>
        </div>
        <div className="pl-list" data-testid="pl-list-admitted">
          <span className="gl">≣</span> Admitted <span className="pl-ct">(0)</span>
        </div>
        <div className="pl-cat" style={{ marginTop: 8 }}>▸ Available Lists</div>
        <div className="pl-list" style={{ color: "var(--text-muted)", cursor: "default" }}>
          System Lists · Recent Searches · Department
        </div>
      </div>

      <div className="pl-rightwrap">
        <div className="pl-main">
          <div className="pl-list-title">
            My Patients <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>· {rows.length} patients</span>
          </div>
          <div className="pl-grid-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th style={{ width: 16 }}></th>
                  <th>Patient</th>
                  <th>MRN</th>
                  <th>Age/Sex</th>
                  <th>Problem</th>
                  <th>Specialty</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr
                      className={"row" + (sel === r.id ? " selected" : "")}
                      data-testid={`pl-row-${r.id}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSel(r.id)}
                      onDoubleClick={() => openChart(r.id, "snapshot")}
                    >
                      <td className="cell-ico">🧑</td>
                      <td>
                        <b>{r.name}</b>
                      </td>
                      <td>{r.mrn}</td>
                      <td>
                        {r.age} / {r.sex}
                      </td>
                      <td>{r.problem}</td>
                      <td>{r.specialty}</td>
                    </tr>
                    {sel === r.id && (
                      <tr className="pl-actions-row">
                        <td colSpan={6}>
                          <div className="pl-actions">
                            {ACTIONS.map(([tid, label, act]) => (
                              <button key={tid} className="btn tiny" data-testid={tid} onClick={() => openChart(r.id, act)}>
                                {label}
                              </button>
                            ))}
                            <button className="btn tiny primary" data-testid="pl-act-open" onClick={() => openChart(r.id, "snapshot")}>
                              🗂 Open Chart
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ color: "var(--text-muted)", padding: 10 }}>
                      Loading patients…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <div className="pl-preview" data-testid="pl-preview">
            <div className="pl-prev-head">
              <b>{selected.name}</b>
              <span className="pl-prev-meta">
                {selected.age} / {selected.sex} · MRN {selected.mrn} · {selected.specialty}
              </span>
            </div>
            <div className="pl-prev-toolbar report-toolbar">
              <div className="rt-btn active" data-testid="plp-vitals">Vitals (24 hr)</div>
              <div className="rt-btn" data-testid="plp-io">I/O</div>
              <div className="rt-btn" data-testid="plp-rslts">New Results</div>
              <div className="rt-btn" data-testid="plp-meds">Meds</div>
              <div className="rt-btn" data-testid="plp-pl">Problems</div>
              <div className="rt-btn" data-testid="plp-team">Care Team</div>
              <div className="rt-btn">More ▾</div>
            </div>
            <div className="pl-prev-body">
              <div className="pl-prev-rpt-title">Vitals (Last 24 hours)</div>
              <div className="pl-prev-none">
                Summary view — use the row actions or <b>Open Chart</b> for full data.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
