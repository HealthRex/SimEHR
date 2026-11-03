"use client";

import { useSim, switchActivity } from "@/lib/store";
import { latestVitals, activeProblems } from "@/lib/projections";
import { medActive } from "@/lib/types";

function initials(name?: string) {
  if (!name) return "";
  const [last, first] = name.split(",").map((s) => s.trim());
  return ((first?.[0] ?? "") + (last?.[0] ?? "")).toUpperCase();
}

export default function PatientSidebar() {
  const c = useSim((s) => s.caseData);
  if (!c) return null;
  const p = c.patient;
  const vit = latestVitals(c);
  const v = (n: string) => vit.find((o) => o.name === n);
  const sys = v("Systolic BP");
  const dia = v("Diastolic BP");
  const bp = sys && dia ? `${sys.value}/${dia.value}` : "—";
  const activeMeds = (c.medications ?? []).filter(medActive);
  const allergies = p.allergies ?? [];

  return (
    <aside className="patient-sidebar">
      <div className="sb-top">
        <div className="sb-photo-row">
          <div className="sb-photo">{initials(p.name)}</div>
        </div>
        <div className="sb-name" data-testid="pt-name">{p.name}</div>
        {p.preferred && <div className="sb-pref">&ldquo;{p.preferred}&rdquo;</div>}
        {p.pronouns && (
          <div className="sb-kv">
            <span className="k">Pronouns:</span> {p.pronouns}
          </div>
        )}
        <div className="sb-demo">
          <div className="sexline">
            <span className="fico">{p.sex === "F" ? "♀" : p.sex === "M" ? "♂" : "⚥"}</span>{" "}
            {p.sex === "F" ? "Female" : p.sex === "M" ? "Male" : "—"}, {p.age} y, {p.dob}
          </div>
        </div>
        <div className="sb-kv">
          <span className="k">MRN:</span> <span data-testid="pt-mrn">{p.mrn}</span>
        </div>
        {p.language && (
          <div className="sb-kv">
            <span className="k">Language:</span> {p.language}
          </div>
        )}
      </div>

      <div className="sb-band" data-testid="chip-acp" title="Advance Care Planning">Advance Care Plan:</div>
      <div className="sb-line">
        <span className="k">Patient Portal:</span> <span className="v">Enrolled</span>
      </div>
      <hr className="sb-hr" />
      <div className="sb-line">
        <span className="k">Isolation:</span> None
      </div>
      <hr className="sb-hr" />

      <div className="sb-band" data-testid="chip-allergy" title="Allergies">
        Allergies ({allergies.length}): {allergies.map((a) => a.allergen).join(", ") || "None"}
      </div>
      <div className="sb-line">
        <span className="k">Current Meds:</span> <span className="v">{activeMeds.length}</span>
      </div>
      <div className="sb-line">
        <span className="k">Infection:</span> None
      </div>
      <hr className="sb-hr" />

      {p.pcp && (
        <div className="sb-pcp">
          <div className="who">
            <b>{p.pcp.split("—")[0].trim()}</b>
            <span>PCP</span>
          </div>
        </div>
      )}
      {p.coverage && (
        <div className="sb-line">
          <span className="k">Primary Cvg:</span> {p.coverage}
        </div>
      )}
      <hr className="sb-hr" />

      <div className="sb-line">
        <span className="k">BP:</span> <span className="v" data-testid="sb-bp">{bp}</span>
      </div>
      {v("Pulse") && (
        <div className="sb-line">
          <span className="k">Pulse:</span> <span className="v">{v("Pulse")!.value}</span>
        </div>
      )}
      {v("Weight") && (
        <div className="sb-line">
          <span className="k">Weight:</span> <span className="v">{v("Weight")!.value} {v("Weight")!.unit}</span>
        </div>
      )}
      <hr className="sb-hr" />

      {(c.recentActivity ?? []).length > 0 && (
        <>
          <hr className="sb-hr" />
          <div className="sb-cap">Recent Activity</div>
          <div data-testid="sb-recent-activity">
            {(c.recentActivity ?? []).map((t, i) => (
              <div key={i} className="sb-item">
                <span className="bullet">•</span>
                {t}
              </div>
            ))}
          </div>
        </>
      )}

      {(c.healthMaintenance ?? []).length > 0 && (
        <>
          <hr className="sb-hr" />
          <div className="sb-cap redcap">Health Maintenance</div>
          <div data-testid="sb-health-maintenance">
            {(c.healthMaintenance ?? []).map((h, i) => {
              const overdue = h.status === "overdue";
              return (
                <div key={i} className={"sb-item" + (overdue ? " red" : "")}>
                  <span className="bullet">{overdue ? "❗" : "○"}</span>
                  {h.name}
                </div>
              );
            })}
          </div>
        </>
      )}

      <hr className="sb-hr" />
      <div className="sb-problem-head" data-testid="problem-list-link" onClick={() => switchActivity("problem-list", "human")}>
        Problem List ({activeProblems(c).length})
      </div>
      <div data-testid="sb-problems">
        {activeProblems(c).map((pr) => (
          <div key={pr.code} className="sb-item">
            <span className="bullet">•</span>
            {pr.name}
          </div>
        ))}
      </div>
      <div style={{ height: 10 }} />
    </aside>
  );
}
