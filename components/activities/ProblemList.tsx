"use client";

import { Fragment, useState } from "react";
import { useSim, addProblem, setProblemStatus } from "@/lib/store";
import { relevantMeds } from "@/lib/projections";
import { medFreq } from "@/lib/types";
import { DX_CATALOG } from "@/lib/dxCatalog";

// Diagnosis search for the Add Problem form: every query word must appear in the code or the name;
// shorter names first on ties. Free text still saves when nothing matches.
function searchDx(q: string) {
  const toks = q.toLowerCase().split(/[^a-z0-9.]+/).filter(Boolean);
  if (!toks.length) return [];
  return DX_CATALOG.filter((d) => {
    const hay = `${d.code} ${d.name}`.toLowerCase();
    return toks.every((t) => hay.includes(t));
  })
    .sort((a, b) => a.name.length - b.name.length)
    .slice(0, 8);
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function ProblemList() {
  const c = useSim((s) => s.caseData);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [clazz, setClazz] = useState("Chronic");
  const [dxOpen, setDxOpen] = useState(false);

  if (!c) return null;

  function save() {
    const nm = name.trim();
    if (!nm) return;
    addProblem({ name: nm, code: code.trim() || "—", clazz });
    setName("");
    setCode("");
    setClazz("Chronic");
    setAdding(false);
  }

  return (
    <div data-testid="problem-list">
      <div className="report-toolbar">
        <div className="rt-btn" data-testid="pl-add-problem" onClick={() => setAdding((v) => !v)}>
          <span className="gl">＋</span>Add Problem
        </div>
        <div className="rt-btn">
          <span className="gl">▦</span>Preview
        </div>
        <div className="rt-btn">
          <span className="gl">↻</span>Refresh
        </div>
        <div className="rt-sep"></div>
        <div className="rt-btn disabled">Resolve</div>
        <div className="rt-btn disabled">Delete</div>
      </div>
      <div className="filter-row">
        <span className="f-label">ⓘ Filters</span>
        <span className="f-chip on">
          <span className="cb">✓</span>Show Resolved
        </span>
        <span className="f-chip">
          <span className="cb"></span>Hospital Problems
        </span>
      </div>
      <div className="pane-pad">
        {adding && (
          <div className="oc-form" style={{ marginBottom: 10 }}>
            <label>Problem</label>
            <div className="order-search-wrap">
              <input
                className="oc-in"
                data-testid="pl-add-name"
                placeholder="Search diagnoses, e.g., chronic kidney disease (free text is accepted)"
                autoComplete="off"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDxOpen(searchDx(e.target.value).length > 0);
                }}
                onFocus={() => setDxOpen(searchDx(name).length > 0)}
                onBlur={() => setTimeout(() => setDxOpen(false), 200)}
              />
              <div className={"order-results" + (dxOpen ? " open" : "")}>
                {searchDx(name).map((d) => (
                  <div
                    key={d.code}
                    className="order-result"
                    data-testid={`pl-dx-result-${slug(d.code)}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setName(d.name);
                      setCode(d.code);
                      setDxOpen(false);
                    }}
                  >
                    <span className="name"><b>{d.name}</b></span>
                    <span className="type lab">{d.code}</span>
                  </div>
                ))}
              </div>
            </div>
            <label>ICD-10</label>
            <input
              className="oc-in"
              data-testid="pl-add-code"
              placeholder="e.g., N18.31"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <label>Class</label>
            <select
              className="oc-in"
              data-testid="pl-add-class"
              value={clazz}
              onChange={(e) => setClazz(e.target.value)}
            >
              <option>Chronic</option>
              <option>Acute</option>
            </select>
            <div style={{ marginTop: 10 }}>
              <button className="btn primary" data-testid="pl-add-save" onClick={save}>
                Save
              </button>{" "}
              <button className="btn" data-testid="pl-add-cancel" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="grid-wrap">
          <table className="grid">
            <thead>
              <tr>
                {/* The reference grid carries Diagnosis / Priority / Diagnosed / Resolved / Updated; the ICD
                    code and the noted date live in the row EXPANSION, not in a column. Keeping them as
                    columns handed the agent 60 of 100 tasks' graded problem codes without a click. */}
                <th>Problem</th>
                <th>Class</th>
                <th>Status</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(c.problems ?? []).map((p) => {
                const resolved = p.status === "Resolved";
                const isOpen = open.has(p.code);
                const meds = isOpen ? relevantMeds(c, p) : [];
                return (
                  <Fragment key={p.code}>
                  <tr
                    className="row"
                    data-testid={`problem-${p.code}`}
                    style={resolved ? { opacity: 0.55 } : undefined}
                  >
                    <td style={resolved ? { textDecoration: "line-through" } : undefined}>{p.name}</td>
                    <td>{p.clazz}</td>
                    <td>
                      {p.status === "Progressing" ? (
                        <span className="flag-high">Progressing</span>
                      ) : (
                        p.status
                      )}
                    </td>
                    <td className="pl-row-actions">
                      {resolved ? (
                        <button
                          className="btn tiny"
                          data-testid={`prob-reactivate-${p.code}`}
                          onClick={() => setProblemStatus(p.code, "Active")}
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          className="btn tiny"
                          data-testid={`prob-resolve-${p.code}`}
                          onClick={() => setProblemStatus(p.code, "Resolved")}
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                    {/* NOT .pl-row-actions — that class is hover-only (ehr.css), and the reference row
                        expander is always on screen. A hover-gated control is invisible to a pixel agent
                        working from screenshots, so it would be unreachable rather than merely subtle. */}
                    <td>
                      <button
                        className="btn tiny"
                        data-testid={`prob-expand-${p.code}`}
                        title={isOpen ? "Collapse" : "Expand"}
                        onClick={() =>
                          setOpen((s) => {
                            const n = new Set(s);
                            n.has(p.code) ? n.delete(p.code) : n.add(p.code);
                            return n;
                          })
                        }
                      >
                        {isOpen ? "⌃" : "⌄"}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="row" data-testid={`problem-detail-${p.code}`}>
                      <td colSpan={5} style={{ background: "var(--pane-alt, #f7f9fb)" }}>
                        <div style={{ padding: "6px 10px 8px 22px", fontSize: 11.5 }}>
                          <div style={{ marginBottom: 6 }}>
                            <b>Details</b>
                            <span style={{ marginLeft: 14, color: "var(--text-muted)" }}>Code:</span> {p.code}
                            <span style={{ marginLeft: 14, color: "var(--text-muted)" }}>Noted:</span> {p.onset}
                            <span style={{ marginLeft: 14, color: "var(--text-muted)" }}>Class:</span> {p.clazz}
                          </div>
                          <div className="section" style={{ fontSize: 11.5, marginBottom: 4 }}>Relevant Medications</div>
                          {meds.length === 0 ? (
                            <div style={{ color: "var(--text-muted)" }}>No medications related to this problem</div>
                          ) : (
                            <table className="grid" style={{ width: "auto", minWidth: 520 }}>
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>Dose, Route, Freq</th>
                                  <th>Start</th>
                                </tr>
                              </thead>
                              <tbody>
                                {meds.map((m) => (
                                  <tr key={m.id} className="row">
                                    <td>{m.name}</td>
                                    <td>{[m.dose, m.route, medFreq(m)].filter(Boolean).join(", ")}</td>
                                    <td>{m.started}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
