"use client";

import { useSim } from "@/lib/store";
import { latestVitals, keyLabs } from "@/lib/projections";

// The Best Practice Advisories card used to sit here. It was withdrawn because the shipped advisory text
// is written from the answer key rather than from a trigger rule: 45 of 100 cases quoted graded values
// verbatim, and 89 checkpoints shared >=8 clinical terms with their case's advisory (e.g. chronic_cough_
// geriatric's cp1 shares "bronchiectasis / cylindrical / attenuation" — the very CT findings it grades).
// case.advisories is still carried in the data and AdvisoryModal still renders it, so this can be restored once the
// text states only what fired the rule and leaves the assessment to the agent.
export default function RightRail() {
  const c = useSim((s) => s.caseData);
  if (!c) return null;

  return (
    <aside className="right-rail">
      <div className="rr-card">
        <h4>Vital Signs (Latest)</h4>
        <div data-testid="rail-vitals">
          {latestVitals(c).map((v) => (
            <div key={v.id} className="vrow">
              <span className="label">{v.name}</span>
              <span className="val">
                {v.value}
                {v.unit ? ` ${v.unit}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rr-card">
        <h4>Key Labs</h4>
        <div data-testid="rail-keylabs">
          {keyLabs(c).map((o) => (
            <div key={o.id} className="vrow">
              <span className="label">{o.name}</span>
              <span className="val">
                <span className={o.flag === "H" ? "flag-high" : o.flag === "L" ? "flag-low" : ""}>
                  {o.value}
                  {o.flag ? ` ${o.flag}` : ""}
                </span>
              </span>
            </div>
          ))}
          {keyLabs(c).length === 0 && <div style={{ color: "var(--text-muted)" }}>No flagged labs</div>}
        </div>
      </div>
    </aside>
  );
}
