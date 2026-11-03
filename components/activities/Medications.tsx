"use client";

import { Fragment, useState } from "react";
import { useSim, discontinueMed, modifyMed } from "@/lib/store";
import { medActive, medFreq } from "@/lib/types";

const FREQ_WORDS: Record<string, string> = {
  daily: "once daily",
  BID: "twice daily",
  TID: "three times daily",
  QID: "four times daily",
  QHS: "at bedtime",
  q12h: "every 12 hours",
  weekly: "once weekly",
  PRN: "as needed",
};

const ROUTE_WORDS: Record<string, string> = {
  PO: "by mouth",
  IV: "intravenously",
  SC: "subcutaneously",
  IM: "intramuscularly",
  IN: "intranasally",
  SL: "sublingually",
};

const FREQ_OPTIONS = ["daily", "BID", "TID", "QID", "QHS", "PRN"];

export default function Medications() {
  const c = useSim((s) => s.caseData);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modifyId, setModifyId] = useState<string | null>(null);
  const [draftDose, setDraftDose] = useState("");
  const [draftFreq, setDraftFreq] = useState("");

  if (!c) return null;

  const meds = c.medications ?? [];

  return (
    <div className="pane-pad" data-testid="medications">
      <div className="report-toolbar">
        <div className="rt-btn"><span className="gl">▦</span>Preview</div>
        <div className="rt-btn"><span className="gl">↻</span>Refresh</div>
        <div className="rt-btn disabled">Default Sort</div>
        <div className="rt-btn"><span className="gl">➰</span>Route</div>
      </div>
      <div className="filter-row">
        <span className="f-label">ⓘ Filters</span>
        <span className="f-chip on"><span className="cb">✓</span>Current Meds Only</span>
      </div>
      <div className="grid-wrap">
        <table className="grid" data-testid="med-table" style={{ marginTop: 6 }}>
          <thead>
            <tr>
              <th>Medication</th>
              <th>Dose</th>
              <th>Frequency</th>
              <th>Route</th>
              <th>Started</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {meds.map((m) => {
              const isExpanded = expandedId === m.id;
              const isModifying = modifyId === m.id;
              const routeWords = ROUTE_WORDS[m.route ?? ""] ?? m.route ?? "";
              const freqWords = FREQ_WORDS[medFreq(m)] ?? medFreq(m);
              const sig = m.sig ?? `Take ${m.dose ?? ""} ${routeWords} ${freqWords}`.replace(/\s+/g, " ").trim();
              return (
                <Fragment key={m.id}>
                  <tr className="row" data-testid={`med-${m.id}`}>
                    <td>
                      <b>
                        <a
                          href="#"
                          className="med-link"
                          data-testid={`med-link-${m.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            setExpandedId(isExpanded ? null : m.id);
                          }}
                        >
                          {m.name}
                        </a>
                      </b>
                    </td>
                    <td>{m.dose}</td>
                    <td>{medFreq(m)}</td>
                    <td>{m.route}</td>
                    <td>{m.started}</td>
                    <td>
                      <span className={"pill-status " + (medActive(m) ? "active" : "dc")}>
                        {medActive(m) ? "Active" : "D/C"}
                      </span>
                    </td>
                    <td>
                      {medActive(m) ? (
                        <>
                          <button
                            className="btn tiny"
                            data-testid={`med-modify-${m.id}`}
                            onClick={() => {
                              if (isModifying) {
                                setModifyId(null);
                              } else {
                                setModifyId(m.id);
                                setDraftDose(m.dose ?? "");
                                setDraftFreq(medFreq(m));
                              }
                            }}
                          >
                            Modify
                          </button>{" "}
                          <button
                            className="btn tiny danger"
                            data-testid={`med-dc-${m.id}`}
                            onClick={() => discontinueMed(m.id, "human")}
                          >
                            D/C
                          </button>
                        </>
                      ) : (
                        <i style={{ color: "var(--text-muted)" }}>discontinued</i>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} style={{ background: "var(--ehr-blue-bg)" }}>
                        <div className="ep-kv2" data-testid={`med-detail-${m.id}`}>
                          <div className="ln"><span className="ep-k">Sig: </span><span className="ep-v">{sig}</span></div>
                          <div className="ln"><span className="ep-k">Status: </span><span className="ep-v">{m.status}</span></div>
                          <div className="ln"><span className="ep-k">Start date: </span><span className="ep-v">{m.started || "—"}</span></div>
                          <div className="ln"><span className="ep-k">Route: </span><span className="ep-v">{m.route || "—"}</span></div>
                          {/* Ordering provider / Quantity-Refills / Pharmacy used to be printed here as
                              unconditional literals ("90 (30-day supply) · 3 refills", "Smith, Alice, MD").
                              They contradicted the real sig rendered two lines above — aberrant_drug_screen's
                              Norco reads "dispense 50 tablets; 0 refills" — and 7 rubrics grade dispense or
                              refill content, so the invented line pointed away from the graded answer.
                              Sibling CRReports.tsx MedReport ("values strictly from case") carries no such
                              row either; render refills only when the case actually supplies one. */}
                          {m.refills != null && (
                            <div className="ln"><span className="ep-k">Refills: </span><span className="ep-v">{m.refills}</span></div>
                          )}
                          <div className="ln"><span className="ep-k">Indication: </span><span className="ep-v">{m.indication || "—"}</span></div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {isModifying && medActive(m) && (
                    <tr>
                      <td colSpan={7} style={{ background: "#fffbe8" }}>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, padding: "4px 0" }}>
                          <div>
                            <label style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)", margin: "0 0 2px 0" }}>New dose</label>
                            <input
                              type="text"
                              data-testid={`med-modify-dose-${m.id}`}
                              value={draftDose}
                              onChange={(e) => setDraftDose(e.target.value)}
                              style={{ border: "1px solid var(--border)", borderRadius: 2, padding: "4px 6px", fontSize: 11.5 }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)", margin: "0 0 2px 0" }}>New frequency</label>
                            <select
                              data-testid={`med-modify-freq-${m.id}`}
                              value={draftFreq}
                              onChange={(e) => setDraftFreq(e.target.value)}
                              style={{ border: "1px solid var(--border)", borderRadius: 2, padding: "4px 6px", fontSize: 11.5 }}
                            >
                              {FREQ_OPTIONS.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            className="btn primary"
                            data-testid={`med-modify-save-${m.id}`}
                            onClick={() => {
                              modifyMed(m.id, { dose: draftDose, freq: draftFreq }, "human");
                              setModifyId(null);
                            }}
                          >
                            Save
                          </button>
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
  );
}
