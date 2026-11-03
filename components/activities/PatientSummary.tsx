"use client";

// Patient Summary — card set (see the design notes), all data-driven; cards render
// their native empty state when the case carries nothing (never fabricate). Header ↗ jumps to
// the owning activity. Report toolbar offers the sibling report views seen in the Patient Summary ·
// Patient Demographics · Signed and Held Orders.

import { useState } from "react";
import { useSim, switchActivity, setCrSubtab } from "@/lib/store";
import { activeProblems, socialNarrativeObs, vitalObs } from "@/lib/projections";
import type { Case, Encounter } from "@/lib/types";
import { medActive, medFreq } from "@/lib/types";

// Live HM rows: red ⊘-style icon for due/overdue ("Never done …"), green ✓ when satisfied.
const hmIcon = (s: string) => (s === "overdue" ? "⊘" : s === "due" ? "⊘" : "✓");
const hmClass = (s: string) => (s === "overdue" ? "hm-overdue" : s === "due" ? "hm-due" : "hm-done");

// Each card has a tinted title band in its own accent colour.
const ACCENTS: Record<string, string> = {
  Patient: "#0e8a8a",
  Allergies: "#c00000",
  "Problem List": "#c2185b",
  Medications: "#5e35b1",
  "Health Maintenance": "#1b7a32",
  "Immunizations/Injections": "#c2185b",
  "Significant History": "#c2185b",
  "Health Trends": "#1b7a32",
  "Last 3yr": "#0e6ba8",
  "Care Team": "#51626f",
  "Advance Care Planning Documents": "#0e8a8a",
  "Surgical History": "#8a6d3b",
  Implants: "#51626f",
  "Documentation Consent": "#0e6ba8",
};

function CardBox({
  title, testid, jump, span2, children,
}: {
  title: string;
  testid: string;
  jump?: () => void;
  span2?: boolean;
  children: React.ReactNode;
}) {
  const color = ACCENTS[title] ?? "var(--ehr-blue-dk)";
  return (
    <div className={"snap-card" + (span2 ? " span2" : "")} style={{ borderTop: `3px solid ${color}` }}>
      <h3
        onClick={jump}
        style={{ cursor: jump ? "pointer" : undefined, background: color + "14", color, padding: "2px 6px", borderRadius: 3 }}
        title={jump ? "Open activity" : undefined}
      >
        {title} {jump && <span className="pop">↗</span>}
      </h3>
      <div className="card-body" data-testid={testid}>
        {children}
      </div>
    </div>
  );
}

const None = () => <span style={{ color: "var(--text-muted)" }}>None</span>;

// Tiny BMI sparkline from vital-signs observations (Health Trends card).
function BmiTrend({ c }: { c: Case }) {
  const pts = vitalObs(c)
    .filter((o) => o.name === "BMI" && typeof o.value === "number")
    .sort((a, b) => a.datetime.localeCompare(b.datetime))
    .map((o) => ({ d: o.datetime.slice(0, 10), v: o.value as number }));
  if (!pts.length) return <None />;
  const latest = pts[pts.length - 1];
  const W = 180, H = 40;
  const min = Math.min(...pts.map((p) => p.v)) - 1;
  const max = Math.max(...pts.map((p) => p.v)) + 1;
  const x = (i: number) => (pts.length > 1 ? (i * (W - 10)) / (pts.length - 1) + 5 : W / 2);
  const y = (v: number) => H - 6 - ((v - min) / (max - min || 1)) * (H - 12);
  return (
    <div data-testid="snap-bmi-trend">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{latest.v}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 10 }}>BMI kg/m² · Latest {latest.d}</div>
        </div>
        {pts.length > 1 && (
          <svg width={W} height={H}>
            <polyline points={pts.map((p, i) => `${x(i)},${y(p.v)}`).join(" ")} fill="none" stroke="#0e6ba8" strokeWidth="1.5" />
            {pts.map((p, i) => (
              <circle key={`${p.d}-${i}`} cx={x(i)} cy={y(p.v)} r="2.5" fill="#0e6ba8">
                <title>{p.v} on {p.d}</title>
              </circle>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

// Live Last-3yr card: date gutter + red circular visit icon + bordered entry boxes.
function Last3Yr({ c, jump }: { c: Case; jump: () => void }) {
  const enc = [...(c.encounters ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  if (!enc.length) return <None />;
  return (
    <div>
      {enc.map((e: Encounter) => (
        <div key={e.id} onClick={jump} style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", marginBottom: 4 }}>
          <span style={{ whiteSpace: "nowrap", color: "var(--text-muted)", width: 72, textAlign: "right", paddingTop: 3 }}>{e.date}</span>
          <span
            style={{
              width: 18, height: 18, borderRadius: "50%", background: "#c00000", color: "#fff",
              display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0, marginTop: 2,
            }}
          >
            ⇄
          </span>
          <span style={{ flex: 1, border: "1px solid var(--border-soft)", borderRadius: 3, padding: "3px 8px", background: "#fff" }}>
            <b style={{ color: "#a33" }}>{e.type}</b>
            {e.provider ? <> with {e.provider}</> : null}
            {e.reason ? <div style={{ color: "var(--text-muted)" }}>{e.reason}</div> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PatientSummary() {
  const c = useSim((s) => s.caseData);
  const orders = useSim((s) => s.orders);
  const [report, setReport] = useState<"snapshot" | "demographics" | "heldorders">("snapshot");
  if (!c) return null;
  const p = c.patient;
  const encById = new Map((c.encounters ?? []).map((e) => [e.id, e] as const));
  const isHosp = (encId?: string) => {
    const cls = encId ? encById.get(encId)?.class : undefined;
    return cls === "inpatient" || cls === "emergency";
  };

  const problems = activeProblems(c);
  const hospProblems = problems.filter((x) => isHosp(x.encounterId));
  const nonHospProblems = problems.filter((x) => !isHosp(x.encounterId));
  const activeMeds = (c.medications ?? []).filter(medActive);
  const hospMeds = activeMeds.filter((m) => isHosp(m.encounterId));
  const outptMeds = activeMeds.filter((m) => !isHosp(m.encounterId));
  const social = socialNarrativeObs(c);
  const tobacco = social.find((o) => /tobacco|smok/i.test(o.name));
  const alcohol = social.find((o) => /alcohol/i.test(o.name));
  // Administrations on file only — the ordered-not-given rows stay on Health Maintenance.
  const immunizations = (c.orderHistory ?? []).filter(
    (o) => o.type === "Immunization/Injection" && o.status === "completed"
  );
  const goEnc = () => {
    switchActivity("chart-review", "human");
    setCrSubtab("Encounters", "human");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* report toolbar — sibling report views (Patient Summary · Patient Demographics · Signed and Held Orders) */}
      <div className="snap-toolbar" data-testid="snap-toolbar">
        <div className={"rt-btn" + (report === "snapshot" ? " rt-pill active" : "")} data-testid="snap-view-snapshot" onClick={() => setReport("snapshot")}>
          ▦ Patient Summary
        </div>
        <div className={"rt-btn" + (report === "demographics" ? " rt-pill active" : "")} data-testid="snap-view-demographics" onClick={() => setReport("demographics")}>
          ▦ Patient Demographics
        </div>
        <div className={"rt-btn" + (report === "heldorders" ? " rt-pill active" : "")} data-testid="snap-view-heldorders" onClick={() => setReport("heldorders")}>
          ▦ Recent Orders
        </div>
      </div>

      {report === "demographics" && (
        <div className="pane-pad" data-testid="snap-demographics-view">
          <div className="snap-card" style={{ maxWidth: 520 }}>
            <h3>Patient Demographics</h3>
            <div className="card-body">
              <div><b>{p.legal ?? p.name}</b> ({p.pronouns ?? "—"})</div>
              <div>{p.age} y · DOB {p.dob} · {p.sex === "F" ? "Female" : p.sex === "M" ? "Male" : "—"}</div>
              <div>MRN {p.mrn}</div>
              {p.address && <div>🏠 {p.address}</div>}
              {(p.phones ?? []).map((ph, i) => (
                <div key={i}>📞 {ph.num} ({ph.label})</div>
              ))}
              {p.language && <div>Language: {p.language}</div>}
              {p.coverage && <div>Coverage: {p.coverage}</div>}
            </div>
          </div>
        </div>
      )}

      {report === "heldorders" && (
        <div className="pane-pad" data-testid="snap-heldorders-view">
          <div className="snap-card" style={{ maxWidth: 520 }}>
            <h3>Orders in the Last 365 Days</h3>
            <div className="card-body">
              {orders.filter((o) => o.status === "signed").length ? (
                orders.filter((o) => o.status === "signed").map((o) => <div key={o.id}>{o.name}</div>)
              ) : (
                <None />
              )}
            </div>
          </div>
        </div>
      )}

      {report === "snapshot" && (
        <div className="pane-pad" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <div className="snap-grid">
            <CardBox title="Patient" testid="snap-patient" jump={() => switchActivity("demographics", "human")}>
              <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--ehr-blue-dk)" }}>{p.legal ?? p.name}</div>
              <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>{p.pronouns}</div>
              <div>
                {p.age} y, {p.dob} · {p.sex === "F" ? "Female" : p.sex === "M" ? "Male" : ""}
              </div>
              {p.address && <div style={{ marginTop: 5 }}>🏠 {p.address}</div>}
              {(p.phones ?? []).map((ph, i) => (
                <div key={i}>
                  📞 {ph.num} ({ph.label}){ph.star ? " ★" : ""}
                </div>
              ))}
            </CardBox>

            <CardBox title="Allergies" testid="snap-allergies">
              {(p.allergies ?? []).length ? (
                (p.allergies ?? []).map((a, i) => (
                  <div key={i} className="al-row">
                    <span className="hl">{a.allergen}</span>{" "}
                    {a.reaction && (
                      <span className="rx">
                        {a.reaction}
                        {a.severity ? `, ${a.severity}` : ""}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <span style={{ color: "var(--text-muted)" }}>Not on File</span>
              )}
            </CardBox>

            {c.reasonForVisit && (
              <div className="snap-card span2">
                <h3>Reason for Visit</h3>
                <div className="card-body" data-testid="snap-reason">
                  <div style={{ background: "#f4f8fc", padding: "7px 10px", borderLeft: "3px solid var(--ehr-blue)" }}>
                    {c.reasonForVisit}
                  </div>
                </div>
              </div>
            )}

            <CardBox title="Problem List" testid="snap-problems" jump={() => switchActivity("problem-list", "human")}>
              {hospProblems.length > 0 && (
                <>
                  <div style={{ fontWeight: 700, color: "#51626f", marginTop: 2 }}>Hospital</div>
                  <table className="mini"><tbody>
                    {hospProblems.map((pr) => (
                      <tr key={pr.code}><td>{pr.name}</td><td style={{ color: "var(--text-muted)" }}>{pr.code}</td></tr>
                    ))}
                  </tbody></table>
                </>
              )}
              <div style={{ fontWeight: 700, color: "#51626f", marginTop: 2 }}>Non-Hospital</div>
              {nonHospProblems.length ? (
                <table className="mini"><tbody>
                  {nonHospProblems.map((pr) => (
                    <tr key={pr.code}><td>{pr.name}</td><td style={{ color: "var(--text-muted)" }}>{pr.code}</td></tr>
                  ))}
                </tbody></table>
              ) : (
                <None />
              )}
            </CardBox>

            <CardBox title="Medications" testid="snap-meds" jump={() => switchActivity("medications", "human")}>
              {hospMeds.length > 0 && (
                <>
                  <div style={{ fontWeight: 700, color: "#51626f" }}>Hospital Medications</div>
                  <ul className="snap-meds">
                    {hospMeds.map((m) => (
                      <li key={m.id}>{m.name} {m.dose} {medFreq(m)}</li>
                    ))}
                  </ul>
                </>
              )}
              <div style={{ fontWeight: 700, color: "#51626f" }}>Outpatient Medications</div>
              {outptMeds.length ? (
                <ul className="snap-meds">
                  {outptMeds.map((m) => (
                    <li key={m.id}>{m.name} {m.dose} {medFreq(m)}</li>
                  ))}
                </ul>
              ) : (
                <None />
              )}
            </CardBox>

            <CardBox title="Health Maintenance" testid="snap-hm">
              {(c.healthMaintenance ?? []).length ? (
                (c.healthMaintenance ?? []).map((h, i) => (
                  <div key={i} className="al-row">
                    <span className={hmClass(h.status)}>
                      {hmIcon(h.status)} {h.name} — {h.status}
                    </span>
                    {h.detail && <div className="rx" style={{ paddingLeft: 14 }}>{h.detail}</div>}
                  </div>
                ))
              ) : (
                <span style={{ color: "var(--text-muted)" }}>None due</span>
              )}
            </CardBox>

            {/* Immunizations/Injections = administrations on file ONLY (the design notes);
                the ordered-not-given PCV20 stays on Health Maintenance, never here. */}
            {/* Was a hardcoded <None />, which asserted "no vaccines on file" for every patient. 74 of
                100 cases carry completed Immunization/Injection rows (518 of them); "None" was correct
                for exactly one — the reference case, whose answer had been baked in. */}
            <CardBox title="Immunizations/Injections" testid="snap-imm">
              {immunizations.length ? (
                immunizations.map((o) => (
                  <div key={o.id} className="hm-row">
                    <span>{o.name}</span>
                    <span className="rx" style={{ marginLeft: 8 }}>{o.date}</span>
                  </div>
                ))
              ) : (
                <None />
              )}
            </CardBox>

            <CardBox title="Significant History" testid="snap-sig-history">
              <table className="mini"><tbody>
                <tr><td>Smoking</td><td>{tobacco ? String(tobacco.value) : "Not on File"}</td></tr>
                {/* Smokeless Tobacco stays a literal — measured 0 of 100 cases supply it, so this is a
                    true empty state. Alcohol was the same literal but 94 cases DO carry the value, so it
                    contradicted the chart on 93 of them while the real value spilled into the unlabelled
                    muted list below (a bare "Yes" with nothing naming it). */}
                <tr><td>Smokeless Tobacco</td><td>Not on File</td></tr>
                <tr><td>Alcohol</td><td>{alcohol ? String(alcohol.value) : "Not on File"}</td></tr>
              </tbody></table>
              {/* Short structured values only. Four cases carry a "Social History Narrative" lifted out
                  of a note's HPI (tier `parse`) — real chart content, but the summary keeps a paragraph like that
                  in the note, not on a summary card. Printing it here handed the agent note prose for free
                  on the opening screen; it stays reachable in Chart Review › Notes/Trans. */}
              {social
                .filter((o) => o !== tobacco && o !== alcohol && String(o.value ?? "").length <= 60)
                .map((o) => (
                  <div key={o.id} style={{ marginTop: 4, color: "var(--text-muted)" }}>{String(o.value)}</div>
                ))}
            </CardBox>

            <CardBox title="Health Trends" testid="snap-trends">
              <BmiTrend c={c} />
            </CardBox>

            <div className="snap-card span2">
              <h3 onClick={goEnc} style={{ cursor: "pointer" }}>
                Last 3yr <span className="pop">↗</span>
              </h3>
              <div className="card-body" data-testid="snap-encounters">
                <Last3Yr c={c} jump={goEnc} />
              </div>
            </div>

            <CardBox title="Care Team" testid="snap-careteam">
              {p.pcp && <div><b>PCP:</b> {p.pcp}</div>}
              {p.coverage && <div><b>Coverage:</b> {p.coverage}</div>}
              {p.emergencyContact && <div><b>Emergency:</b> {p.emergencyContact}</div>}
              {!p.pcp && !p.coverage && !p.emergencyContact && <None />}
            </CardBox>

            {/* Data-less cards render blank (reference set — never fabricated) */}
            <CardBox title="Advance Care Planning Documents" testid="snap-acp"><None /></CardBox>
            <CardBox title="Surgical History" testid="snap-surghx"><None /></CardBox>
            <CardBox title="Implants" testid="snap-implants"><None /></CardBox>
            <CardBox title="Documentation Consent" testid="snap-doc-consent">
              <span style={{ color: "var(--text-muted)" }}>No structured forms are associated with this patient.</span>
            </CardBox>
          </div>
        </div>
      )}
    </div>
  );
}
