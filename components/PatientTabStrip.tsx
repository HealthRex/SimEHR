"use client";

import { useSim, switchActivity } from "@/lib/store";

export default function PatientTabStrip() {
  const name = useSim((s) => s.caseData?.patient.name);
  return (
    <div className="pt-tabstrip">
      <div className="pt-tab" data-testid="pt-tab" onClick={() => switchActivity("snapshot", "human")} title="Open chart">
        <span style={{ color: "var(--brand-red)" }}>▮</span>
        <span data-testid="pt-tab-name">{name}</span>
        <span
          className="x"
          data-testid="pt-tab-close"
          title="Close chart"
          onClick={(e) => {
            e.stopPropagation();
            switchActivity("patient-lists", "human");
          }}
        >
          ✕
        </span>
      </div>
    </div>
  );
}
