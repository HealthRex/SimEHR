"use client";

import { switchActivity, useSim } from "@/lib/store";

export default function Toolbar() {
  const provider = useSim((s) => s.caseData)?.provider ?? "SIM Physician";
  const initials = (provider.replace(/,.*$/, "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") || "?").toUpperCase();
  return (
    <div className="toolbar">
      <div className="tb-btn" title="Back">
        <span className="gl">←</span>B
      </div>
      <div className="tb-btn" title="Forward">
        <span className="gl">→</span>F
      </div>
      <div className="tb-sep" />
      <div className="tb-btn">
        <span className="gl">🏠</span>Home
      </div>
      <div className="tb-btn" data-testid="tb-patient-lists" onClick={() => switchActivity("patient-lists", "human")}>
        <span className="gl">≣</span>Patient Lists
      </div>
      <div className="tb-btn">
        <span className="gl">🗒</span>Reports
      </div>
      <div className="tb-btn" data-testid="tb-schedule" onClick={() => switchActivity("schedule", "human")}>
        <span className="gl">🗓</span>Schedule
      </div>
      <div className="spacer" />
      {/* Module wordmark. SimEHR for the same reason as the title-bar logo. */}
      <span className="module-mark">SimEHR</span>
      <span className="avatar" title={provider}>{initials}</span>
    </div>
  );
}
