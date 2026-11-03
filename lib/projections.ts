// Pure projections: derive each UI surface from the one Case object. Chart Review > Labs and
// Results Review BOTH read labs() — two views of one observation set, so they cannot desync.

import type { Case, ClinicalNote, Observation, OrderHistoryItem } from "./types";

// ECG routing (the design notes + §9 decision): ECG discretes stay category="laboratory"
// (provenance guard) but are EXCLUDED from labs() and rendered in Chart Review › Card.
export const isECG = (o: Observation): boolean => (o.panel ?? "").startsWith("ECG");

export const labs = (c: Case): Observation[] =>
  (c.observations ?? []).filter((o) => o.category === "laboratory" && !isECG(o));

export const ecgObs = (c: Case): Observation[] =>
  (c.observations ?? []).filter((o) => o.category === "laboratory" && isECG(o));

export const vitalObs = (c: Case): Observation[] =>
  (c.observations ?? []).filter((o) => o.category === "vital-signs");

export function labDatesDesc(c: Case): string[] {
  const s = new Set(labs(c).map((o) => o.datetime.slice(0, 10)));
  return [...s].sort().reverse();
}

const refOf = (o: Observation): string =>
  o.refText ??
  (o.refLow != null || o.refHigh != null ? `${o.refLow ?? ""}–${o.refHigh ?? ""}` : "");

export interface FlowRow {
  key: string;
  name: string;
  code?: string;
  unit?: string;
  ref: string;
  byDate: Record<string, Observation>;
}

// Results Review flowsheet: rows = test (by code/name), cols = dates.
export function flowsheet(c: Case): { dates: string[]; rows: FlowRow[] } {
  const dates = labDatesDesc(c);
  const rows = new Map<string, FlowRow>();
  for (const o of labs(c)) {
    const key = o.code || o.name;
    if (!rows.has(key)) rows.set(key, { key, name: o.name, code: o.code, unit: o.unit, ref: refOf(o), byDate: {} });
    rows.get(key)!.byDate[o.datetime.slice(0, 10)] = o;
  }
  return { dates, rows: [...rows.values()] };
}

export interface LabPanel {
  panel: string;
  datetime: string;
  date: string;
  accession?: string;
  rows: Observation[];
}

// Chart Review > Labs grid: grouped by accession/panel/date (most recent first).
export function labPanels(c: Case): LabPanel[] {
  const groups = new Map<string, LabPanel>();
  for (const o of labs(c)) {
    const key = o.accession || `${o.panel}@${o.datetime}`;
    if (!groups.has(key))
      groups.set(key, { panel: o.panel ?? "Lab", datetime: o.datetime, date: o.datetime.slice(0, 10), accession: o.accession, rows: [] });
    groups.get(key)!.rows.push(o);
  }
  return [...groups.values()].sort((a, b) => b.datetime.localeCompare(a.datetime));
}

export function trend(c: Case, name: string): { date: string; value: number }[] {
  return labs(c)
    .filter((o) => o.name === name && typeof o.value === "number")
    .map((o) => ({ date: o.datetime.slice(0, 10), value: o.value as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function latestVitals(c: Case): Observation[] {
  const map = new Map<string, Observation>();
  for (const o of vitalObs(c)) {
    const k = o.code || o.name;
    const prev = map.get(k);
    if (!prev || o.datetime > prev.datetime) map.set(k, o);
  }
  return [...map.values()];
}

export const activeProblems = (c: Case) => (c.problems ?? []).filter((p) => (p.status ?? "Active") !== "Resolved");

// Key labs for the right rail: most-recent panel's flagged rows.
export function keyLabs(c: Case): Observation[] {
  const panels = labPanels(c);
  if (!panels.length) return [];
  return panels[0].rows.filter((r) => r.flag === "H" || r.flag === "L");
}

export const isAbnormal = (o: Observation) => o.flag === "H" || o.flag === "L" || o.flag === "A";

// Chart Review > Labs is an ORDER grid (one row per accession/panel), not a value table.
// Values live under each order (shown on expand) — the same observations Results Review pivots.
export interface LabOrder {
  key: string;
  accession?: string;
  panel: string;
  datetime: string;
  date: string;
  status: string;
  provider?: string;
  dept?: string;
  encType?: string;
  id?: string;
  rows: Observation[];
}

export function labOrders(c: Case): LabOrder[] {
  const encByCsn = new Map((c.encounters ?? []).map((e) => [e.id, e] as const));
  return labPanels(c).map((p) => {
    const first = p.rows[0];
    const enc = first.encounterId ? encByCsn.get(first.encounterId) : undefined;
    const status =
      first.status === "final" ? "Final result" : first.status === "in-process" ? "In process" : first.status ?? "Final result";
    return {
      key: p.accession ?? p.panel + p.datetime,
      accession: p.accession,
      panel: p.panel,
      datetime: p.datetime,
      date: p.date,
      status,
      provider: enc?.provider,
      dept: enc?.department,
      encType: enc?.type,
      id: first.encounterId,
      rows: p.rows,
    };
  });
}

// Fuzzy time-group label relative to the newest lab date (grouped as Recent / 6 Months Ago / 1 Year Ago).
export function timeBucket(datetime: string, newestDate: string): string {
  const d = new Date(datetime.slice(0, 10) + "T00:00:00").getTime();
  const n = new Date(newestDate.slice(0, 10) + "T00:00:00").getTime();
  const days = Math.round((n - d) / 86400000);
  if (days < 45) return "Recent";
  if (days < 180) return "6 Months Ago";
  return "1 Year Ago";
}

// ---------------------------------------------------------------------------
// orderHistory routing (the design notes + §9): typed selectors per Chart Review sub-tab.
// PR Charge is suppressed from EVERY Chart Review surface (mapping row 14) — charges
// live only on the encounter report (Level of Service), never as CR rows.
// ---------------------------------------------------------------------------
export const orderHistory = (c: Case): OrderHistoryItem[] =>
  (c.orderHistory ?? []).filter((o) => o.type !== "PR Charge");

// Card: ECG / cardiac-monitor orders (12-lead, Zio-class monitors, scanned externals).
export const cardOrders = (c: Case): OrderHistoryItem[] =>
  orderHistory(c).filter((o) => o.type === "ECG");

// Rad: imaging orders; the CT read (note.type === "Imaging") is the result report.
export const radOrders = (c: Case): OrderHistoryItem[] =>
  orderHistory(c).filter((o) => o.type === "Imaging");

export const imagingNotes = (c: Case): ClinicalNote[] =>
  (c.notes ?? []).filter((n) => n.type === "Imaging");

// Referrals: e-consult + outpatient referral share the surface, split by type (mapping rows 10/11).
export const referralOrders = (c: Case): OrderHistoryItem[] =>
  orderHistory(c).filter((o) => o.type === "E-Consult" || o.type === "Outpatient Referral");

// Proc: manual-entry / external procedures (mapping row 12).
export const procOrders = (c: Case): OrderHistoryItem[] =>
  orderHistory(c).filter((o) => o.type === "Manual Entry Procedures");

// Other Orders: residual — not routed to Card/Rad/Referrals/Proc and not a lab order
// (Lab + "Lab Panel" collapse into the Labs grid, which derives from observations; re-rendering
// them here would duplicate the same orders — mapping row 2).
const ROUTED_TYPES = new Set(["ECG", "Imaging", "E-Consult", "Outpatient Referral", "Manual Entry Procedures", "Lab", "Lab Panel"]);
export const otherOrders = (c: Case): OrderHistoryItem[] =>
  orderHistory(c).filter((o) => !ROUTED_TYPES.has(o.type));

// PR Charges for one encounter date — surfaced ONLY inside the encounter report (Level of Service).
export const chargesOn = (c: Case, date: string): OrderHistoryItem[] =>
  (c.orderHistory ?? []).filter((o) => o.type === "PR Charge" && o.date === date);

// PHQ-9 / screenings: panel="Mental Health Screening" leaves Social History → flowsheet surface.
export const screeningObs = (c: Case): Observation[] =>
  (c.observations ?? []).filter((o) => o.category === "social-history" && o.panel === "Mental Health Screening");

export const socialNarrativeObs = (c: Case): Observation[] =>
  (c.observations ?? []).filter((o) => o.category === "social-history" && o.panel !== "Mental Health Screening");

// Pending / not-resulted labs (Results Review "Not Resulted" panel).
export const pendingLabs = (c: Case): Observation[] =>
  labs(c).filter((o) => o.status === "in-process" || o.status === "preliminary");

// Generic time-grouping for any dated order list.
export function bucketize<T extends { date?: string; datetime?: string }>(items: T[]): { label: string; items: T[] }[] {
  const dt = (x: T) => x.datetime ?? x.date ?? "";
  const sorted = [...items].sort((a, b) => dt(b).localeCompare(dt(a)));
  if (!sorted.length) return [];
  const newest = dt(sorted[0]);
  const out: { label: string; items: T[] }[] = [];
  for (const it of sorted) {
    const b = timeBucket(dt(it), newest);
    let g = out.find((x) => x.label === b);
    if (!g) out.push((g = { label: b, items: [] }));
    g.items.push(it);
  }
  return out;
}

// Problem List row expansion — the medications shown under a problem come from the diagnosis
// association made AT ORDER ENTRY, which this sandbox has no field for. The nearest honest substitute
// is the encounter: meds started at the same visit where the problem was noted. That is a MECHANICAL
// rule over data already in the case (83 of 100 cases share a encounter id between the two), not a hand-authored
// "relevant" list — curating one per case would re-create the answer leak the advisories were pulled for.
export function relevantMeds(c: Case, p: { encounterId?: string | null }) {
  const encId = p?.encounterId;
  if (!encId) return [];
  return (c.medications ?? []).filter((m) => m.encounterId === encId);
}
