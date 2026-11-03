"use client";

// Schedule (workbench) — provider day view. The patient row is DERIVED from the loaded
// case (patient name + current encounter reason/provider) so it stays data-driven per case, and
// the remaining rows are clearly-synthetic fillers to populate the day.

import { useSim } from "@/lib/store";
import type { Case, Encounter } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  Arrived: "#1f8b4c",
  "Checked In": "#1a6bb0",
  Completed: "#6b7886",
  "No Show": "#c0392b",
  Scheduled: "#2c4863",
};

interface Appt {
  time: string;
  status: string;
  patient: string;
  type: string;
  provider: string;
  room: string;
}

// The schedule grid lists "Last, First" — flip the case's "First Last" display name for the schedule grid.
function flipName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  return `${last}, ${first}`;
}

function currentEncounter(c: Case): Encounter | undefined {
  const encs = c.encounters ?? [];
  if (!encs.length) return undefined;
  return [...encs].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
}

export default function Schedule() {
  const c = useSim((s) => s.caseData);
  if (!c) return null;

  const enc = currentEncounter(c);
  // Fall back to the CASE's own provider, never to a literal. No encounter in any of the 100 cases
  // carries a `provider`, so the old hard-coded fallback fired on every single one — and it was a real
  // person's name left behind from a mocking session, which this project may not ship.
  const provider = enc?.provider ?? c.provider ?? "Attending Physician";
  const date = enc?.date ?? c.encounters?.[0]?.date ?? "";
  const patientRow: Appt = {
    time: "08:00",
    status: "Arrived",
    patient: flipName(c.patient?.name ?? "Patient"),
    type: enc?.reason ?? enc?.visitType ?? enc?.type ?? "Follow-up",
    provider,
    room: "PC-3",
  };

  // Only the patient actually under review. The day used to be padded with five invented appointments
  // (Testpatient Alpha..Echo) purely so the grid looked busy — content grounded in nothing, on a
  // workbench no run has ever opened (0 of 40). Everything shown here now derives from the case.
  const appts: Appt[] = [patientRow];

  return (
    <section data-testid="schedule">
      <div className="report-toolbar">
        <div className="rt-btn"><span className="gl">◴</span>Open Slots</div>
        <div className="rt-btn"><span className="gl">📁</span>Chart</div>
        <div className="rt-btn"><span className="gl">▦</span>Patient Summary</div>
        <div className="rt-btn"><span className="gl">↻</span>Refresh</div>
      </div>
      <div className="sched-head" data-testid="sched-head">
        <b>{provider}</b> · {date} · Total: {appts.length}
      </div>
      <div className="pane-pad">
        <table className="grid" data-testid="schedule-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Status</th>
              <th>Patient</th>
              <th>Visit Type</th>
              <th>Provider</th>
              <th>Room</th>
            </tr>
          </thead>
          <tbody>
            {appts.map((a, i) => (
              <tr className="row" data-testid={`sched-row-${i}`} key={i} style={{ cursor: "pointer" }}>
                <td>{a.time}</td>
                <td style={{ color: STATUS_COLOR[a.status] ?? "#2c4863", fontWeight: 600 }}>{a.status}</td>
                <td><b>{a.patient}</b></td>
                <td>{a.type}</td>
                <td>{a.provider}</td>
                <td>{a.room}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
