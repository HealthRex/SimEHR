// Schema v2 — the canonical, FHIR-aligned case model. See web/public/cases/SCHEMA.md.
// One Case object is the single source of truth; every UI surface is a projection of it.

export type Sex = "F" | "M" | "U";

export interface Allergy {
  allergen: string;
  reaction?: string;
  severity?: string;
}

export interface Phone {
  label: string;
  num: string;
  star?: boolean;
}

export interface Patient {
  mrn: string;
  name: string;
  legal?: string;
  dob: string;
  sex: Sex;
  age: number;
  pronouns?: string;
  preferred?: string;
  language?: string;
  race?: string;
  ethnicity?: string;
  address?: string;
  phones?: Phone[];
  email?: string;
  employer?: string;
  pcp?: string;
  coverage?: string;
  emergencyContact?: string;
  allergies?: Allergy[];
}

export interface Encounter {
  id: string;
  class?: string;
  type: string;
  date: string;
  dischargeDate?: string | null;
  department?: string;
  provider?: string;
  reason?: string;
  visitType?: string;
  har?: string;
  visitNum?: string;
}

export interface Problem {
  code: string;
  system?: string;
  name: string;
  onset?: string;
  clazz?: string;
  status?: string;
  encounterId?: string;
}

export interface Medication {
  id: string;
  code?: string;
  system?: string;
  name: string;
  dose?: string;
  /** Four converter-generated cases key this `frequency`. Read it through medFreq(), never directly. */
  freq?: string;
  frequency?: string;
  route?: string;
  /** The same four cases capitalise this ("Active" / "Completed"). Test it with medActive(). */
  status: "active" | "discontinued" | string;
  intent?: string;
  started?: string;
  sig?: string;
  indication?: string;
  refills?: number; // present on 238 meds across 4 cases; rendered only when supplied
  encounterId?: string;
}

export type ObsCategory = "laboratory" | "vital-signs" | "social-history";

export interface Observation {
  id: string;
  code?: string;
  system?: string;
  name: string;
  category: ObsCategory;
  value: number | string;
  unit?: string;
  refLow?: number | null;
  refHigh?: number | null;
  refText?: string;
  flag?: "H" | "L" | "A" | null;
  status?: string;
  datetime: string;
  encounterId?: string;
  accession?: string;
  panel?: string;
  specimen?: string;
  unexpected?: boolean;
}

export interface ClinicalNote {
  id: string;
  type: string;
  author?: string;
  credentials?: string;
  /** Four converter-generated cases key this `date` instead. Read it through noteWhen(), never directly:
   *  an unguarded `note.datetime.localeCompare` used to unmount the whole app on those cases. */
  datetime?: string;
  date?: string;
  encounterId?: string;
  status?: string;
  text: string;
}

/** When a note was filed, tolerating both key spellings the converter has produced. */
export const noteWhen = (n: { datetime?: string; date?: string }): string => n.datetime ?? n.date ?? "";

/** A medication's dosing frequency, tolerating both key spellings the converter has produced. */
export const medFreq = (m: { freq?: string; frequency?: string }): string => m.freq ?? m.frequency ?? "";

/** Is this medication current? The converter emits both "active" and "Active"; a case-sensitive test
 *  rendered every one of a 97-row list as "D/C · discontinued", including the patient's active
 *  prednisone, and blanked the Frequency column with it. Both models then documented the regimen as
 *  discontinued — a chart that lies is worse than one that omits. */
export const medActive = (m: { status?: string }): boolean =>
  (m.status ?? "").toLowerCase() === "active";

export interface Advisory {
  kind: string | null;
  sev: "alert" | "warn" | "info";
  text: string;
}

// Historical/completed orders authored into a case (→ ServiceRequest, status completed|active).
// Distinct from runtime `Order` (agent-created during the session).
export interface OrderHistoryItem {
  id: string;
  date: string;
  type: string; // Lab | Imaging | ECG | E-Consult | Outpatient Referral | Immunization/Injection | ...
  name: string;
  cpt?: string;
  status: "completed" | "active" | string;
}

export interface Case {
  id: string;
  label: string;
  reasonForVisit?: string;
  provider?: string; // the signed-in / attending clinician shown in the title bar (from the task's Practitioner)
  department?: string; // the login department/specialty shown in the title-bar crumb
  patient: Patient;
  encounters?: Encounter[];
  problems?: Problem[];
  medications?: Medication[];
  observations?: Observation[];
  notes?: ClinicalNote[];
  orderHistory?: OrderHistoryItem[];
  advisories?: Advisory[];
  healthMaintenance?: HealthMaintenanceItem[];
  recentActivity?: string[];
}

export interface HealthMaintenanceItem {
  name: string;
  status: "overdue" | "due" | "done" | string;
  detail?: string;
}

// Runtime-only (reset on case load) — never authored into a case file.
export interface Order {
  id: string;
  resourceType?: "ServiceRequest" | "MedicationRequest";
  name: string;
  type?: string; // lab | imaging | med | referral | procedure
  code?: string;
  system?: string;
  status: string; // draft | active (signed)
  intent?: string;
  priority?: string;
  indication?: string;
  datetime?: string;
  // Medication orders only: entered in the cart's sig row; `sig` is the joined display form.
  dose?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  sig?: string;
}

export interface AuditEntry {
  ts: string;
  actor: string; // human | agent | system
  action: string;
  detail?: string;
}
