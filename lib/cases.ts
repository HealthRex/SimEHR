// Case loading. Cases are static JSON under public/cases/ (served at /cases/*), with index.json
// as the manifest — same authoring model as the vanilla mock, no HTML/TS changes to add a case.

import type { Case } from "./types";

export interface CaseIndexEntry {
  id: string;
  label: string;
  file: string;
  specialty?: string;
}
export interface CaseIndex {
  default: string;
  cases: CaseIndexEntry[];
}

let cachedIndex: CaseIndex | null = null;

export async function fetchIndex(): Promise<CaseIndex> {
  if (cachedIndex) return cachedIndex;
  const res = await fetch("/cases/index.json");
  cachedIndex = (await res.json()) as CaseIndex;
  return cachedIndex;
}

export async function fetchCase(id: string): Promise<Case | null> {
  const idx = await fetchIndex();
  const entry = idx.cases.find((c) => c.id === id);
  if (!entry) return null;
  const res = await fetch(`/cases/${entry.file}`);
  if (!res.ok) return null;
  return (await res.json()) as Case;
}

export async function listCaseIds(): Promise<string[]> {
  return (await fetchIndex()).cases.map((c) => c.id);
}

export async function defaultCaseId(): Promise<string> {
  return (await fetchIndex()).default;
}

export interface RosterEntry {
  id: string;
  label: string;
  specialty?: string;
  name: string;
  mrn: string;
  age: number;
  sex: string;
  problem: string;
}

// The Patient Lists workbench roster = every case in the manifest, one patient row each.
export async function fetchRoster(): Promise<RosterEntry[]> {
  const idx = await fetchIndex();
  const out: RosterEntry[] = [];
  for (const e of idx.cases) {
    const c = await fetchCase(e.id);
    if (!c) continue;
    out.push({
      id: e.id,
      label: e.label,
      specialty: e.specialty,
      name: c.patient.name,
      mrn: c.patient.mrn,
      age: c.patient.age,
      sex: c.patient.sex,
      problem: c.problems?.[0]?.name ?? "",
    });
  }
  return out;
}
