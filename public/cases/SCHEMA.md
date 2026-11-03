# Case data schema (`web/public/cases/*.json`)

> **Canonical, single source of truth** for SimEHR patient cases. The Next.js app (`web/`) fetches
> these at runtime (`/cases/<id>.json`); `index.json` is the manifest. FHIR-aligned; one canonical
> object per case that every UI surface projects from (no hardcoded patient values → no cross-case
> leak). Add a case by dropping a `<id>.json` here and listing it in `index.json` — no code changes.

## Two design decisions

1. **FHIR-*aligned*, not literal FHIR R4.** Each entity is a flat, hand-authorable JSON object that
   maps 1:1 to a FHIR resource type (documented per entity) and carries the FHIR-standard **codes**
   (LOINC / RxNorm / ICD-10 / CPT). This stays readable/diff-able and convertible from source data, while making a later FHIR façade / HAPI export mechanical.

2. **One canonical object; every UI surface is a projection of it.** No surface may read a literal
   patient value or a private static store. Chart Review › Labs and Results Review are two *views* of
   the **same** observation set and cannot desync.

## Top-level fields
| Field | Type | Req | Notes |
|---|---|---|---|
| `id` | string | yes | matches filename + `?case=<id>` |
| `label` | string | yes | shown in lists/toasts |
| `reasonForVisit` | string | no | Patient Summary |
| `provider` | string | no | signed-in clinician in the title bar (from the task's Practitioner, e.g. `practitioners.json`) |
| `department` | string | no | login department/specialty shown in the title-bar crumb |
| `patient` | object | yes | demographics + allergies → **Patient** |
| `encounters` | array | no | visits, keyed by **encounter id** → **Encounter** |
| `problems` | array | no | → **Condition** (ICD-10) |
| `medications` | array | no | → **MedicationRequest** (RxNorm) |
| `observations` | array | no | **unified** labs + vitals + social hx → **Observation** (LOINC) |
| `notes` | array | no | clinical notes **and document-style results** (imaging reports, e-consult orders) → **DocumentReference** |
| `orderHistory` | array | no | historical/completed orders (labs, imaging, ECG, referrals, e-consults, immunization orders) → **ServiceRequest** (status `completed\|active`). Distinct from runtime `orders`. |
| `advisories` | array | no | clinical alerts (clickable → alert modal) |
| `healthMaintenance` | array | no | patient sidebar + Patient Summary HM: `{ name, status: overdue\|due\|done, detail? }` |
| `recentActivity` | array | no | patient sidebar "Recent Activity" bullets (`string[]`) |

Runtime-only (reset on load, never authored): `orders` (agent-created → **ServiceRequest** /
**MedicationRequest**), `deliverable`, `noteExam`, `advisoryResponses`, `visitSigned`. The Schedule day-view is **derived** from the case at render time (Schedule ←
`encounters`), so it stays per-case without a static store.

## Entity shapes (→ FHIR resource)

```jsonc
// → Patient
"patient": {
  "mrn": "1234567", "name": "Last, First", "legal": "Last, First M",
  "dob": "YYYY-MM-DD", "sex": "F|M|U", "age": 67,
  "pronouns": "she/her/hers", "preferred": "Maggie", "language": "English",
  "address": "...", "phones": [{ "label": "Home", "num": "###-###-####", "star": true }],
  "email": "...", "employer": "...", "pcp": "...", "coverage": "...", "emergencyContact": "...",
  "allergies": [{ "allergen": "Penicillin", "reaction": "Rash", "severity": "Moderate" }]
}

// → Encounter   (encounter id is the key; results/meds/notes reference it via encounterId)
// Converted bench cases build these from pat_encounters/ (real date/type/department_name; synthetic encounter id — no
// encounter id in source; department SIMULATED when the extract's name is blank/"UNKNOWN"; provider omitted).
"encounters": [{
  "encounter-id": "8200188978", "class": "ambulatory|inpatient|emergency",
  "type": "Office Visit|Lab Only|Consult|Hospital Admission",
  "date": "YYYY-MM-DD", "dischargeDate": "YYYY-MM-DD|null",
  "department": "ENDOCRINE CLINIC", "provider": "Smith, Alice, MD",
  "reason": "DM/CKD follow-up", "visitType": "...", "har": "...", "visitNum": "..."
}]

// → Condition
"problems": [{ "code": "E11.9", "system": "ICD-10", "name": "Type 2 Diabetes Mellitus",
               "onset": "2015", "clazz": "Chronic|Acute", "status": "Active|Resolved|Progressing",
               "encounterId": "..." }]

// → MedicationRequest
"medications": [{ "id": "m1", "code": "6809", "system": "RxNorm", "name": "Metformin",
                  "dose": "1000 mg", "freq": "BID", "route": "PO",
                  "status": "active|discontinued", "intent": "order",
                  "started": "YYYY-MM-DD", "sig": "...", "indication": "...", "encounterId": "..." }]

// → Observation   (ONE array drives Chart Review›Labs, Results Review, trends, vitals, social hx)
"observations": [{
  "id": "o1", "code": "33914-3", "system": "LOINC", "name": "eGFR",
  "category": "laboratory|vital-signs|social-history",
  "value": 42, "unit": "mL/min/1.73m²",          // value may be number or string ("Positive")
  "refLow": 60, "refHigh": null, "refText": "≥60", // numeric range preferred; refText for non-numeric
  "flag": "H|L|A|null", "status": "final|preliminary|in-process|canceled",  // in-process = pending
  "datetime": "2026-05-20T08:14", "encounterId": "8200188978",
  "accession": "26S-140MI0", "panel": "Comprehensive Metabolic Panel", "specimen": "Blood",
  "unexpected": false
}]

// → DocumentReference
"notes": [{ "id": "n1", "type": "Progress Note", "author": "Smith, Alice, MD",
            "credentials": "MD", "datetime": "2026-02-12T09:30", "encounterId": "8200172110",
            "status": "signed", "text": "SUBJECTIVE\n..." }]

// → ServiceRequest (historical; agent-created orders live in runtime `orders`)
"orderHistory": [{ "id": "oh01", "date": "YYYY-MM-DD", "type": "Lab|Imaging|ECG|E-Consult|Outpatient Referral|...",
                   "name": "CT CHEST WO IV CONTRAST", "cpt": "IMGCT0141", "status": "completed|active" }]

"advisories": [{ "kind": "metformin|sglt2|null", "sev": "alert|warn|info", "text": "HTML string" }]
"healthMaintenance": [{ "name": "Pneumococcal Vaccine (PCV20)", "status": "overdue|due|done" }]
"recentActivity": ["Labs: CMP, HbA1c, UACR (05/20/2026)", "No ED / Inpatient visits"]
```

## Projection: surface → entity (the binding contract)
| UI surface | ← entity (filter) |
|---|---|
| Patient sidebar / banner | `patient` + latest `observations[vital-signs]` + active `problems` + allergies + `healthMaintenance` + `recentActivity` |
| Patient Summary | `patient` · allergies · `reasonForVisit` · `problems` · `medications` · `healthMaintenance` · care team · `encounters` |
| Demographics | `patient` (+ latest `encounters[].id`) |
| Problem List · Chart Review › Meds | `problems` · `medications` |
| **Results Review** (flowsheet + graph) | `observations[category=laboratory]` — pivoted test×date |
| **Chart Review › Labs** (grid + detail report) | `observations[category=laboratory]` — grouped by accession/date |
| Vitals / right-rail vitals | `observations[category=vital-signs]` (latest per code) |
| Chart Review › Encounters · Schedule | `encounters` |
| Chart Review › Notes · note viewer | `notes` |
| Orders · Orders-for-Signature | `orders` (runtime) |
| Clinical alerts · alert modal | `advisories` |
| Chart-Review report letterhead | `patient` + selected `observations` + `encounters` |

> Enforced invariant: a non-default case must leave **no** literal `"Chen"` / `"1234567"` in the
> rendered DOM (checked by `npm run smoke`). Chart Review › Labs and Results Review derive from the
> same `observations[laboratory]` set.

## Notes
- See [`vte-prophylaxis-travel.json`](vte-prophylaxis-travel.json) for a full worked example.
