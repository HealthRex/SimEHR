// Canonical state store — single source of truth, framework-light (no external dep).
// Mutations are synchronous (store updates immediately; getState() is fresh right after a
// mutation) so the structured-API modality keeps read-after-write semantics for grading.
// React subscribes via useSim() (useSyncExternalStore). The agent API (agentApi.ts) bridges
// these same actions onto window.SimEHR, so UI clicks and programmatic calls share one path.

import { useSyncExternalStore } from "react";
import type { Case, Medication, Order, Problem, AuditEntry } from "./types";
import { NORMAL_DEFAULTS } from "./noteTemplate";

export interface Modal {
  type: "advisory" | "signvisit" | "signresult" | "menu" | "report";
  kind?: string | null;
}

export interface SimState {
  caseData: Case | null;
  activity: string;
  crSubtab: string;
  crNoteSel: string | null; // a note to select when Chart Review › Notes next renders (set by an encounter report link)
  alertsAcked: number[]; // indices into caseData.recentActivity acknowledged through the bell
  orders: Order[];
  deliverable: string;
  noteDraft: string;
  patientReply: string; // the reply sent to the patient's message (the last Send wins)
  patientReplyDraft: string;
  noteExam: Record<string, string[]>;
  advisoryResponses: { kind: string | null; action: string }[];
  visitSigned: boolean;
  modal: Modal | null;
  menuOpen: boolean;
  searchOpen: boolean;
  audit: AuditEntry[];
  runId: string;
}

// Opening a patient lands on Chart Review › Encounters (the
// activity strip opens on Chart Review and its sub-tab bar sits on Encounters, not Labs). Patient Summary stays
// reachable from the tab strip. Measured on the 20-task sample, this drops the share of graded values
// legible without navigating from 48% to 41% — the remainder is the patient sidebar, which pins vitals in production
// charts too, so some free exposure is inherent to the chart rather than a defect in this mock.
const START_ACTIVITY = "chart-review";
const START_SUBTAB = "Encounters";

const rid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

let state: SimState = {
  caseData: null,
  activity: START_ACTIVITY,
  crSubtab: START_SUBTAB,
  crNoteSel: null,
  alertsAcked: [],
  orders: [],
  deliverable: "",
  noteDraft: "",
  patientReply: "",
  patientReplyDraft: "",
  noteExam: {},
  advisoryResponses: [],
  visitSigned: false,
  modal: null,
  menuOpen: false,
  searchOpen: false,
  audit: [],
  runId: rid(),
};

const listeners = new Set<() => void>();
export const getState = (): SimState => state;
function set(patch: Partial<SimState> | ((s: SimState) => Partial<SimState>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

// ---- actions (every mutation funnels through here + logs) ----
export function log(actor: string, action: string, detail = "") {
  set((s) => ({ audit: [...s.audit, { ts: now(), actor, action, detail }] }));
}

const FRESH: Partial<SimState> = { orders: [], deliverable: "", noteDraft: "", patientReply: "", patientReplyDraft: "", noteExam: {}, advisoryResponses: [], visitSigned: false, modal: null, crNoteSel: null, alertsAcked: [], menuOpen: false, searchOpen: false };

export function loadCase(c: Case, actor = "system") {
  _orderSeq = 0;   // ids restart per episode, so an audit log id means the same thing across runs
  set({ caseData: structuredClone(c), activity: START_ACTIVITY, crSubtab: START_SUBTAB, runId: rid(), ...FRESH });
  log(actor, "load_case", c.id);
}

export function reset(actor = "system") {
  const c = state.caseData;
  _orderSeq = 0;
  set({ activity: START_ACTIVITY, crSubtab: START_SUBTAB, audit: [], runId: rid(), ...FRESH });
  if (c) set({ caseData: structuredClone(c) });
  log(actor, "reset_state", c?.id ?? "");
}

// ---- patient reply: the answer to a patient message, composed under the message in Chart Review ----
export function setPatientReplyDraft(text: string) {
  set({ patientReplyDraft: text });
}
export function sendPatientReply(text: string, actor = "human") {
  set({ patientReply: text, patientReplyDraft: text });
  log(actor, "send_patient_reply", `${text.length} characters`);
}

// ---- modal ----
export function openModal(type: Modal["type"], kind?: string | null, actor = "human") {
  set({ modal: { type, kind } });
  if (type === "advisory") log("system", "advisory_fired", kind ?? "");
}
export function closeModal() {
  set({ modal: null });
}

// ---- master menu + Ctrl+K search overlay ----
export function openMainMenu(actor = "human") {
  set({ menuOpen: true, searchOpen: false });
  log(actor, "open_main_menu", "");
}
export function closeMainMenu() {
  set({ menuOpen: false });
}
export function openSearch(actor = "human") {
  set({ searchOpen: true, menuOpen: false });
  log(actor, "open_chart_search", "");
}
export function closeSearch() {
  set({ searchOpen: false });
}
export function menuSelect(cat: string, label: string, actor = "human") {
  log(actor, "main_menu_select", `${cat} › ${label}`);
  set({ menuOpen: false });
}

// ---- Clinical Notes exam pills ----
export function togglePill(section: string, pill: string, actor = "human") {
  set((s) => {
    const exam = { ...s.noteExam };
    const arr = [...(exam[section] ?? [])];
    const i = arr.indexOf(pill);
    if (i === -1) arr.push(pill);
    else arr.splice(i, 1);
    exam[section] = arr;
    return { noteExam: exam };
  });
  log(actor, "toggle_pill", `${section}: ${pill}`);
}
export function applyNormalExam(actor = "human") {
  set({ noteExam: structuredClone(NORMAL_DEFAULTS) });
  log(actor, "apply_macro", "Normal Exam");
}
export function clearExam(actor = "human") {
  set({ noteExam: {} });
  log(actor, "clear_exam", "all sections");
}
export function signNote(actor = "human") {
  log(actor, "sign_note", `${state.deliverable.length} chars A&P`);
}

// ---- advisory ----
export function respondAdvisory(kind: string | null, action: string, actor = "human") {
  // Generic recorder — no case-specific side-effects. The agent must enact any suggested change itself
  // (place the order / modify the med); the benchmark grades that, not a free auto-apply on "accept".
  set((s) => ({ advisoryResponses: [...s.advisoryResponses, { kind, action }], modal: null }));
  log(actor, "advisory_response", `${kind}: ${action}`);
}

/** Identity of advisory i. The case data leaves `kind` null in every shipped case, so responses would all
 *  collapse to the same key and a second advisory could never be told apart from the first. */
export const advisoryId = (b: { kind?: string | null }, i: number) => b?.kind ?? String(i);

// ---- Sign Visit ----
export function signVisit(actor = "human") {
  set({ visitSigned: true, modal: { type: "signresult" } });
  log(actor, "sign_visit", "");
}

export function switchActivity(name: string, actor = "human") {
  set({ activity: name });
  log(actor, "switch_activity", name);
}

export function setCrSubtab(name: string, actor = "human") {
  set({ crSubtab: name });
  log(actor, "chart_review_subtab", name);
}

/** Open one note in Chart Review › Notes, e.g. from the documentation list of an encounter report. */
export function openChartNote(noteId: string, actor = "human") {
  if (state.activity !== "chart-review") switchActivity("chart-review", actor);
  setCrSubtab("Notes/Trans", actor);
  set({ crNoteSel: noteId, modal: null });
  log(actor, "open_note", noteId);
}
export function clearChartNote() {
  set({ crNoteSel: null });
}

// ---- alerts (the bell). The items are the chart's recent-activity entries: events, not assessments, so
// nothing graded is handed over. Each can be opened (a keyword heuristic picks the activity) and acknowledged.
export function alertTarget(text: string): { activity: string; subtab?: string } {
  const t = text.toLowerCase();
  if (/consult|referral/.test(t)) return { activity: "chart-review", subtab: "Referrals" };
  if (/message|portal|phone|telephone|email/.test(t)) return { activity: "chart-review", subtab: "Encounters" };
  if (/imaging|\bct\b|mri|ultrasound|x-ray|\bxr\b|echo|scan|radiolog/.test(t)) return { activity: "chart-review", subtab: "Rad" };
  if (/lab|result|panel|a1c|tsh|cbc|cmp|bmp|creatinine|level|culture|biopsy|patholog/.test(t)) return { activity: "results" };
  if (/medication|refill|prescri|dose|started|stopped|discontinu/.test(t)) return { activity: "medications" };
  if (/problem list|diagnos/.test(t)) return { activity: "problem-list" };
  return { activity: "chart-review", subtab: "Encounters" };
}
export function openAlert(i: number, actor = "human") {
  const text = state.caseData?.recentActivity?.[i] ?? "";
  const target = alertTarget(text);
  log(actor, "open_alert", text.slice(0, 80));
  switchActivity(target.activity, actor);
  if (target.subtab) setCrSubtab(target.subtab, actor);
}
export function ackAlert(i: number, actor = "human") {
  if (state.alertsAcked.includes(i)) return;
  set((s) => ({ alertsAcked: [...s.alertsAcked, i] }));
  log(actor, "alert_ack", (state.caseData?.recentActivity?.[i] ?? "").slice(0, 80));
}

/** Show a chart record in the full-size report viewer (double-click on a Chart Review row). */
export function openReport(kind: string, actor = "human") {
  set({ modal: { type: "report", kind } });
  log(actor, "open_report", kind);
}

// Monotonic, never reused. Deriving the id from orders.length collided after any removal: add four, drop
// ord3, and the next add computes "ord" + (3 + 1) = ord4, which already exists. adrenal_incidentaloma did
// exactly that and ended with two rows keyed ord4, which React reports as "two children with the same key"
// (24 times) and which lets an action on one row address the other, since key is how it identifies rows.
let _orderSeq = 0;

export function addOrder(o: Partial<Order>, actor = "human") {
  set((s) => ({
    orders: [
      ...s.orders,
      {
        id: "ord" + (_orderSeq = Math.max(_orderSeq + 1, s.orders.length + 1)),
        status: "pending",
        intent: "order",
        datetime: now(),
        name: "Order",
        ...o,
      } as Order,
    ],
  }));
  log(actor, "add_order", `${o.type ?? ""} ${o.name ?? ""}`.trim());
}

export function removeOrder(id: string, actor = "human") {
  set((s) => ({ orders: s.orders.filter((o) => o.id !== id) }));
  log(actor, "remove_order", id);
}

/** Edit a pending medication order's sig (dose / route / frequency / duration). Keystrokes update the
 *  store silently; `commit` (a select change, or leaving a text field) writes one audit entry. */
export function updateOrder(id: string, patch: Partial<Order>, actor = "human", commit = true) {
  set((s) => ({
    orders: s.orders.map((o) => {
      if (o.id !== id) return o;
      const n = { ...o, ...patch };
      n.sig = [n.dose, n.route, n.frequency, n.duration].filter((x) => x && x.trim()).join(" ") || undefined;
      return n;
    }),
  }));
  if (commit) {
    const o = state.orders.find((x) => x.id === id);
    log(actor, "edit_order", `${o?.name ?? id}: ${o?.sig ?? "—"}`);
  }
}

export function signOrders(actor = "human") {
  // NOTE: signing is deliberately unconditional for now. A sign-time gate (production EHRs batch their advisories
  // here) would give the write a way to fail — today 24 of 24 runs that placed orders signed 100% of
  // them, so the completion axis carries no signal — but the only available trigger was the advisory
  // text, which leaks graded content, and duplicate-order detection has no reliable key (case
  // orderHistory carries batch ids, not test identities, so name matching produced more false hits than
  // true ones). Revisit once visit-diagnosis association exists: that gate demands OUTPUT from the agent
  // rather than handing it input.
  let n = 0;
  set((s) => {
    const orders = s.orders.map((o) => {
      if (o.status === "pending") {
        n++;
        return { ...o, status: "signed" };
      }
      return o;
    });
    return { orders };
  });
  log(actor, "sign_orders", `${n} signed`);
}

export function addMed(m: Partial<Medication>, actor = "human") {
  set((s) => {
    if (!s.caseData) return {};
    const c = structuredClone(s.caseData);
    c.medications = [
      ...(c.medications ?? []),
      { id: "m_new" + ((c.medications?.length ?? 0) + 1), status: "active", intent: "order", name: "Medication", ...m } as Medication,
    ];
    return { caseData: c };
  });
  log(actor, "add_med", `${m.name ?? ""} ${m.dose ?? ""} ${m.freq ?? m.frequency ?? ""}`.trim());
}

export function modifyMed(id: string, patch: Partial<Medication>, actor = "human") {
  set((s) => {
    if (!s.caseData) return {};
    const c = structuredClone(s.caseData);
    c.medications = (c.medications ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m));
    return { caseData: c };
  });
  log(actor, "modify_med", `${id} ${patch.dose ?? ""} ${patch.freq ?? patch.frequency ?? ""}`.trim());
}

export function discontinueMed(id: string, actor = "human") {
  set((s) => {
    if (!s.caseData) return {};
    const c = structuredClone(s.caseData);
    c.medications = (c.medications ?? []).map((m) => (m.id === id ? { ...m, status: "discontinued" } : m));
    return { caseData: c };
  });
  log(actor, "discontinue_med", id);
}

export function addProblem(p: Partial<Problem>, actor = "human") {
  set((s) => {
    if (!s.caseData) return {};
    const c = structuredClone(s.caseData);
    c.problems = [
      ...(c.problems ?? []),
      { code: "", system: "ICD-10", name: "New problem", clazz: "Chronic", status: "Active", ...p } as Problem,
    ];
    return { caseData: c };
  });
  log(actor, "add_problem", `${p.name ?? ""} ${p.code ?? ""}`.trim());
}

export function setProblemStatus(code: string, status: string, actor = "human") {
  set((s) => {
    if (!s.caseData) return {};
    const c = structuredClone(s.caseData);
    c.problems = (c.problems ?? []).map((p) => (p.code === code ? { ...p, status } : p));
    return { caseData: c };
  });
  log(actor, status === "Resolved" ? "resolve_problem" : "reactivate_problem", code);
}

export function saveDeliverable(text: string, actor = "human") {
  set({ deliverable: text ?? "", noteDraft: text ?? "" });
  log(actor, "save_deliverable", `${(text ?? "").length} chars`);
}

/** The Clinical Notes free-text box. It lives in the store so a study checkpoint can carry an unsaved draft;
 *  it is not audited and not part of the graded snapshot. saveDeliverable() is what commits it. */
export function setNoteDraft(text: string) {
  set({ noteDraft: text ?? "" });
}

// ---- checkpoint and resume (study layer) ----
// Everything a participant can change, plus the audit log and the order counter, so a reload or a new
// browser lands back in the same episode. The case itself is refetched; only its editable parts
// (medications, problems) are carried.
export interface Checkpoint {
  runId: string;
  savedAt: string;
  activity: string;
  crSubtab: string;
  orders: Order[];
  orderSeq: number;
  deliverable: string;
  noteDraft: string;
  patientReply?: string;
  noteExam: Record<string, string[]>;
  advisoryResponses: { kind: string | null; action: string }[];
  alertsAcked?: number[];
  visitSigned: boolean;
  audit: AuditEntry[];
  case: { id: string; medications?: Medication[]; problems?: Problem[] } | null;
}

export function checkpoint(): Checkpoint {
  const s = state;
  return JSON.parse(
    JSON.stringify({
      runId: s.runId,
      savedAt: now(),
      activity: s.activity,
      crSubtab: s.crSubtab,
      orders: s.orders,
      orderSeq: _orderSeq,
      deliverable: s.deliverable,
      noteDraft: s.noteDraft,
      patientReply: s.patientReply,
      noteExam: s.noteExam,
      advisoryResponses: s.advisoryResponses,
      alertsAcked: s.alertsAcked,
      visitSigned: s.visitSigned,
      audit: s.audit,
      case: s.caseData ? { id: s.caseData.id, medications: s.caseData.medications, problems: s.caseData.problems } : null,
    }),
  );
}

/** Restore a checkpoint over a freshly fetched case and log one `resume` entry. */
export function hydrate(c: Case, cp: Checkpoint, actor = "system") {
  const fresh = structuredClone(c);
  if (cp.case?.medications) fresh.medications = cp.case.medications;
  if (cp.case?.problems) fresh.problems = cp.case.problems;
  _orderSeq = Math.max(cp.orderSeq ?? 0, ...cp.orders.map((o) => Number(/^ord(\d+)$/.exec(o.id)?.[1] ?? 0)));
  set({
    caseData: fresh,
    activity: cp.activity,
    crSubtab: cp.crSubtab,
    orders: cp.orders,
    deliverable: cp.deliverable ?? "",
    noteDraft: cp.noteDraft ?? cp.deliverable ?? "",
    patientReply: cp.patientReply ?? "",
    patientReplyDraft: cp.patientReply ?? "",
    noteExam: cp.noteExam ?? {},
    advisoryResponses: cp.advisoryResponses ?? [],
    alertsAcked: cp.alertsAcked ?? [],
    visitSigned: !!cp.visitSigned,
    audit: cp.audit ?? [],
    runId: cp.runId,
    modal: null,
    menuOpen: false,
    searchOpen: false,
  });
  log(actor, "resume", cp.savedAt);
}

// ---- React binding. Select narrow, stable slices (caseData/activity/orders are stable refs
// between renders; do projection work in the component, not in the selector). ----
export function useSim<T>(selector: (s: SimState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}
