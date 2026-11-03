"use client";

// Chart Review bottom-pane report renderers (report-viewer style), one per sub-tab
// family: ECG result report (Card), imaging report (Rad), note report (Notes/Trans),
// encounter summary (Encounters), and a generic order report (Referrals / Proc / Other
// Orders). All entirely data-driven from the case — no hardcoded patient values.

import { medFreq, noteWhen } from "@/lib/types";
import type { Case, ClinicalNote, Encounter, Medication, Observation, OrderHistoryItem } from "@/lib/types";
import { chargesOn, ecgObs } from "@/lib/projections";
import { openChartNote, sendPatientReply, setPatientReplyDraft, useSim } from "@/lib/store";

export function EpSec({ title, variant }: { title: string; variant?: string }) {
  return (
    <div className={"ep-sec" + (variant ? " " + variant : "")}>
      {title}
      <span className="rule" />
      <span className="chev">▾</span>
    </div>
  );
}

function Letterhead({ c, title, when }: { c: Case; title: string; when: string }) {
  const p = c.patient;
  return (
    <div className="ep-letterhead">
      <div className="org">
        SimEHR Health Care
        <div className="dept" style={{ fontSize: 11, fontWeight: 400 }}>
          SIM PRIMARY CARE CLINIC
          <br />
          1 Simulation Way, Anytown ST 00000
        </div>
      </div>
      <div className="dept">
        {title}
        <br />
        Printed {when}
      </div>
      <div className="pt">
        {p.name}
        <br />
        MRN: {p.mrn}, DOB: {p.dob}, Legal Sex: {p.sex}
      </div>
    </div>
  );
}

// --- Card: ECG result report — impression + discrete-value table (the design notes) ---
export function ECGReport({ c, order }: { c: Case; order: OrderHistoryItem }) {
  const all = ecgObs(c);
  // Result rows belong to this order when their date matches (accession groups one tracing).
  const rows = all.filter((o) => o.datetime.slice(0, 10) === order.date);
  const impression = rows.find((o) => /impression/i.test(o.name));
  const discretes = rows.filter((o) => o !== impression);
  const resulted = rows.length > 0;
  const when = (rows[0]?.datetime ?? order.date).replace("T", " ");

  return (
    <div data-testid="cr-ecg-report">
      <Letterhead c={c} title="ECG Report" when={when} />
      <div className="ep-bighead">
        Order<span className="ref">{order.name} ({order.cpt ?? order.id})</span>
      </div>
      <EpSec title="Order Information" />
      <div className="ep-indent">
        <div className="ep-ln"><span className="ep-dim">Ordered:</span> <b>{order.date}</b></div>
        <div className="ep-ln"><span className="ep-dim">Status:</span> <b>{resulted ? "Final result" : order.status}</b></div>
        {rows[0]?.accession && (
          <div className="ep-ln"><span className="ep-dim">Accession #:</span> <b>{rows[0].accession}</b></div>
        )}
      </div>
      {impression && (
        <>
          <EpSec title="Impression" variant="dark" />
          <div className="ep-indent" data-testid="ecg-impression">
            <b>{String(impression.value)}</b>
          </div>
        </>
      )}
      {discretes.length > 0 && (
        <>
          <EpSec title="Discrete Values" />
          <table className="components ep-indent">
            <thead>
              <tr>
                <th>Component</th>
                <th>Value</th>
                <th>Units</th>
              </tr>
            </thead>
            <tbody>
              {discretes.map((o: Observation) => (
                <tr key={o.id}>
                  <td>{o.name}</td>
                  <td><b>{o.value}</b></td>
                  <td>{o.unit ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {!resulted && (
        <div className="ep-indent ep-dim" style={{ marginTop: 6 }}>
          {/SCANNED|EXT /.test(order.name)
            ? "Scanned outside tracing — the source document files under Media, attached to this order."
            : "No discrete result on file for this order."}
        </div>
      )}
    </div>
  );
}

// --- Rad: imaging report — the CT read (note.type === "Imaging") attached to the order ---
export function ImagingReport({ c, order, note }: { c: Case; order: OrderHistoryItem; note?: ClinicalNote }) {
  const when = (note?.datetime ?? order.date).replace("T", " ");
  return (
    <div data-testid="cr-imaging-report">
      <Letterhead c={c} title="Imaging Result" when={when} />
      <div className="ep-bighead">
        Order<span className="ref">{order.name} ({order.cpt ?? order.id})</span>
      </div>
      <EpSec title="Exam Information" />
      <div className="ep-indent">
        <div className="ep-ln"><span className="ep-dim">Exam date:</span> <b>{order.date}</b></div>
        <div className="ep-ln"><span className="ep-dim">Status:</span> <b>{note ? "Final result" : order.status}</b></div>
        {note?.author && (
          <div className="ep-ln"><span className="ep-dim">Resulted by:</span> <b>{note.author}</b></div>
        )}
      </div>
      {note ? (
        <>
          <EpSec title="Narrative & Impression" variant="dark" />
          <div className="ep-indent note-line" style={{ whiteSpace: "pre-wrap" }} data-testid="imaging-narrative">
            {note.text}
          </div>
        </>
      ) : (
        <div className="ep-indent ep-dim" style={{ marginTop: 6 }}>
          No report document on file for this order.
        </div>
      )}
    </div>
  );
}

// --- Reply composer, shown under a patient message (its note and its encounter report). The draft lives
// in the store so it survives navigation; Send records the reply and one audit entry. ---
export function PatientReplyBox() {
  const draft = useSim((s) => s.patientReplyDraft);
  const sent = useSim((s) => s.patientReply);
  return (
    <div className="reply-box" data-testid="patient-reply-box">
      <div className="rb-head">Reply to patient</div>
      <textarea
        data-testid="patient-reply"
        value={draft}
        placeholder="Write your reply to the patient…"
        onChange={(e) => setPatientReplyDraft(e.target.value)}
      />
      <div className="rb-foot">
        <button className="btn primary" data-testid="send-patient-reply" disabled={!draft.trim()} onClick={() => sendPatientReply(draft.trim(), "human")}>
          {sent ? "Send update" : "Send"}
        </button>
        {sent && <span className="rb-sent" data-testid="patient-reply-sent">✓ Reply sent ({sent.length} characters)</span>}
      </div>
    </div>
  );
}

// --- Notes/Trans: full note report ---
export function NoteReport({ c, note }: { c: Case; note: ClinicalNote }) {
  return (
    <div data-testid="cr-note-report">
      <div className="note-head">
        <div className="note-author">
          <div className="nm">{note.author}</div>
          <div className="role">{note.credentials}</div>
        </div>
        <div className="note-type">
          <span className="nt">{note.type}</span> <span className="st">{note.status}</span>
        </div>
        <div className="note-dos">
          Date of Service: {noteWhen(note).replace("T", " ")} · Encounter ID {note.encounterId ?? "—"}
        </div>
      </div>
      <div className="note-body">
        <div className="note-line" style={{ whiteSpace: "pre-wrap" }}>{note.text}</div>
      </div>
      {/message/i.test(note.type) && <PatientReplyBox />}
    </div>
  );
}

// --- Encounters: encounter summary report (right-rail sections; Level of
// Service is the ONLY surface where PR Charges appear — mapping row 14) ---
export function EncounterReport({ c, enc }: { c: Case; enc: Encounter }) {
  const dxs = (c.problems ?? []).filter((p) => p.encounterId === enc.id);
  const meds = (c.medications ?? []).filter((m) => m.encounterId === enc.id);
  const notes = (c.notes ?? []).filter((n) => n.encounterId === enc.id);
  const placed = (c.orderHistory ?? []).filter((o) => o.date === enc.date && o.type !== "PR Charge");
  const los = chargesOn(c, enc.date);
  return (
    <div data-testid="cr-encounter-report" style={{ display: "flex", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ep-bighead">
          {enc.type} <span className="ref">{enc.date}</span>
        </div>
        <div className="ep-indent">
          <div className="ep-ln"><b>{enc.provider ?? "—"}</b></div>
          <div className="ep-ln ep-dim">{enc.department ?? "—"}</div>
          {enc.reason && <div className="ep-ln"><span className="ep-dim">Reason:</span> <b>{enc.reason}</b></div>}
          <div className="ep-ln"><span className="ep-dim">Encounter ID:</span> {enc.id}{enc.har ? <> · <span className="ep-dim">Account ID:</span> {enc.har}</> : null}</div>
        </div>
        {notes.length > 0 && (
          <>
            <EpSec title="Additional Documentation" />
            <div className="ep-indent">
              {notes.map((n) => (
                <div key={n.id} className="ep-ln">
                  🗎{" "}
                  <span className="ep-link" data-testid={`cr-enc-note-${n.id}`} title="Open in Notes" onClick={() => openChartNote(n.id, "human")}>
                    {n.type} — {n.author} ({n.status})
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {/message/i.test(enc.type) && <PatientReplyBox />}
      </div>
      <div style={{ width: 250, flexShrink: 0 }}>
        <div className="rr-card" style={{ marginBottom: 8 }}>
          <b>Orders Placed</b>
          <div>{placed.length ? placed.map((o) => <div key={o.id} style={{ fontSize: 11 }}>{o.name}</div>) : <span className="ep-dim">None</span>}</div>
        </div>
        <div className="rr-card" style={{ marginBottom: 8 }}>
          <b>Medication Changes</b>
          <div>{meds.length ? meds.map((m) => <div key={m.id} style={{ fontSize: 11 }}>{m.name} {m.dose}</div>) : <span className="ep-dim">None</span>}</div>
        </div>
        <div className="rr-card" style={{ marginBottom: 8 }}>
          <b>Visit Diagnoses</b>
          <div>{dxs.length ? dxs.map((p) => <div key={p.code} style={{ fontSize: 11 }}>◆ {p.name}</div>) : <span className="ep-dim">None</span>}</div>
        </div>
        <div className="rr-card" data-testid="enc-los">
          <b>Level of Service</b>
          <div>
            {los.length ? (
              los.map((o) => <div key={o.id} style={{ fontSize: 11 }}>{o.name}{o.cpt ? ` [${o.cpt}]` : ""}</div>)
            ) : (
              <span className="ep-dim">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Meds: medication order report ---
export function MedReport({ c, med }: { c: Case; med: Medication }) {
  const enc = (c.encounters ?? []).find((e) => e.id === med.encounterId);
  return (
    <div data-testid="cr-med-report">
      <div className="ep-bighead">
        Medication<span className="ref">{med.name} {med.dose ?? ""}</span>
      </div>
      <EpSec title="Order Information" />
      <div className="ep-indent">
        <div className="ep-ln"><span className="ep-dim">Ordered:</span> <b>{med.started ?? "—"}</b></div>
        <div className="ep-ln"><span className="ep-dim">Status:</span> <b>{med.status}</b></div>
        <div className="ep-ln"><span className="ep-dim">Priority:</span> (none)</div>
        {enc?.department && <div className="ep-ln"><span className="ep-dim">Unit:</span> <b>{enc.department}</b></div>}
      </div>
      <EpSec title="Provider Information" variant="dark" />
      <div className="ep-indent">
        <div className="ep-ln"><span className="ep-dim">Authorizing Provider:</span> <b>{enc?.provider ?? "—"}</b></div>
        <div className="ep-ln"><span className="ep-dim">Ordering Provider:</span> <b>{enc?.provider ?? "—"}</b></div>
      </div>
      <EpSec title="Medication Detail" />
      <div className="ep-indent">
        <div className="ep-ln"><b>{med.name} {med.dose ?? ""}</b></div>
        {med.route && <div className="ep-ln"><span className="ep-dim">Route:</span> {med.route}</div>}
        {(med.dose || medFreq(med)) && (
          <div className="ep-ln"><span className="ep-dim">Dose / Frequency:</span> {med.dose ?? "—"} · {medFreq(med) || "—"}</div>
        )}
        {med.started && <div className="ep-ln"><span className="ep-dim">Start:</span> {med.started}</div>}
        {med.sig && <div className="ep-ln"><span className="ep-dim">Admin Instructions:</span> {med.sig}</div>}
        {med.indication && <div className="ep-ln"><span className="ep-dim">Indication:</span> {med.indication}</div>}
      </div>
    </div>
  );
}

// --- Referrals / Proc / Other Orders: generic order report ---
export function OrderReport({ c, order, note }: { c: Case; order: OrderHistoryItem; note?: ClinicalNote }) {
  return (
    <div data-testid="cr-order-report">
      <div className="ep-bighead">
        Order<span className="ref">{order.name} ({order.cpt ?? order.id})</span>
      </div>
      <EpSec title="Order Information" />
      <div className="ep-indent">
        <div className="ep-ln"><span className="ep-dim">Order date:</span> <b>{order.date}</b></div>
        <div className="ep-ln"><span className="ep-dim">Type:</span> <b>{order.type}</b></div>
        <div className="ep-ln"><span className="ep-dim">Status:</span> <b>{order.status}</b></div>
      </div>
      {note && (
        <>
          <EpSec title="Linked Documentation" variant="dark" />
          <div className="ep-indent">
            <div className="ep-ln ep-dim">{note.type} — {note.author} · {noteWhen(note).replace("T", " ")}</div>
            <div className="note-line" style={{ whiteSpace: "pre-wrap" }}>{note.text}</div>
          </div>
        </>
      )}
    </div>
  );
}
