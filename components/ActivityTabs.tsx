"use client";

import { useSim, switchActivity } from "@/lib/store";

// Patient Summary is deliberately NOT here. It is not on the activity strip — it has
// to be pulled up through Chart Search or the main menu (verified 2026-08-20). Having it pinned as a
// permanent one-click tab handed over the aggregate it exists to provide: the full outpatient medication
// list with dose and frequency, the problem list, allergies, immunizations and health maintenance, all on
// one screen. Measured on the 20-task sample, opening it lifts the share of graded values legible without
// real retrieval from 41% to 48%. It stays reachable — ACTIVITY_TITLES feeds both the Ctrl+K chart
// search and the main menu — so finding it becomes a retrieval action instead of a free affordance.
// Those two routes were used in 0 of 40 runs while this tab existed.
const TABS: [string, string][] = [
  ["chart-review", "Chart Review"],
  ["flowsheets", "Flowsheets"],
  ["results", "Results Review"],
  ["problem-list", "Problem List"],
  ["medications", "Medications"],
  ["orders", "Orders"],
  ["notewriter", "Clinical Notes"],
  ["demographics", "Demographics"],
];

export default function ActivityTabs() {
  const active = useSim((s) => s.activity);
  return (
    <nav className="activity-tabs">
      <div className="nav-arrows">
        <span>◀</span>
        <span>▶</span>
      </div>
      {TABS.map(([id, label]) => (
        <div
          key={id}
          className={"a-tab" + (active === id ? " active" : "")}
          data-activity={id}
          data-testid={`tab-${id}`}
          onClick={() => switchActivity(id, "human")}
        >
          {label}
        </div>
      ))}
      <div className="a-tab wrench" title="Manage tabs">⚙</div>
    </nav>
  );
}
