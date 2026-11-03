"use client";

import { useSim, closeModal, respondAdvisory, signVisit, advisoryId } from "@/lib/store";
import { noteWhen } from "@/lib/types";
import { cardOrders, imagingNotes, labOrders, otherOrders, procOrders, radOrders, referralOrders } from "@/lib/projections";
import CRLabReport from "@/components/activities/CRLabReport";
import { ECGReport, EncounterReport, ImagingReport, MedReport, NoteReport, OrderReport } from "@/components/activities/CRReports";

function AdvisoryModal({ idx }: { idx: number }) {
  const c = useSim((s) => s.caseData)!;
  const advisory = (c.advisories ?? [])[idx];
  if (!advisory) return null;
  const kind = advisoryId(advisory, idx); // never null, so two advisories cannot answer for each other
  return (
    <div className="modal advisory" id="modal-content">
      <div className="modal-header">
        <span>
          <span className="advisory-icon">⚠</span>Clinical Alert
        </span>
        <span className="x" onClick={closeModal}>✕</span>
      </div>
      <div className="modal-body">
        <div dangerouslySetInnerHTML={{ __html: advisory.text }} />
        <label>If overriding, document reason:</label>
        <select style={{ width: "100%" }} data-testid="advisory-reason" defaultValue="—">
          <option>—</option>
          <option>Patient refused</option>
          <option>Will reassess at next visit</option>
          <option>Already addressed</option>
          <option>Not medically appropriate</option>
        </select>
      </div>
      <div className="modal-footer">
        <button className="btn" data-testid="advisory-cancel" onClick={() => respondAdvisory(kind, "cancel", "human")}>
          Cancel
        </button>
        <button className="btn" data-testid="advisory-acknowledge" onClick={() => respondAdvisory(kind, "acknowledge", "human")}>
          Acknowledge
        </button>
        <button className="btn primary" data-testid="advisory-accept" onClick={() => respondAdvisory(kind, "accept", "human")}>
          Accept
        </button>
      </div>
    </div>
  );
}

function SignVisitModal() {
  const orders = useSim((s) => s.orders);
  const deliverable = useSim((s) => s.deliverable);
  const acked = useSim((s) => s.alertsAcked);
  const c = useSim((s) => s.caseData)!;
  const deficiencies: { level: "red" | "yellow"; text: string }[] = [];
  if (deliverable.trim().length < 20) deficiencies.push({ level: "red", text: "Assessment & Plan is missing or too short." });
  if (orders.length === 0) deficiencies.push({ level: "yellow", text: "No orders entered this visit." });
  // The alerts are the bell's recent-activity items (not the withheld advisories, see RightRail.tsx), so
  // this warning can be acted on from the bell.
  const openAlerts = (c.recentActivity ?? []).filter((_, i) => !acked.includes(i)).length;
  if (openAlerts > 0) deficiencies.push({ level: "yellow", text: `${openAlerts} alert${openAlerts === 1 ? "" : "s"} not yet acknowledged (bell icon).` });
  const hasRed = deficiencies.some((d) => d.level === "red");

  return (
    <div className="modal" id="modal-content">
      <div className="modal-header">
        <span>Sign Encounter — Pre-flight Check</span>
        <span className="x" onClick={closeModal}>✕</span>
      </div>
      <div className="modal-body">
        {deficiencies.length === 0 ? (
          <p style={{ color: "var(--ok-green)", fontWeight: 700 }}>✓ No deficiencies. Ready to sign.</p>
        ) : (
          <>
            <p>The following items need attention before signing:</p>
            {deficiencies.map((d, i) => (
              <div
                key={i}
                style={{
                  padding: "5px 8px",
                  margin: "3px 0",
                  borderLeft: `3px solid ${d.level === "red" ? "var(--alert-red)" : "var(--warn-amber)"}`,
                  background: d.level === "red" ? "var(--alert-red-bg)" : "var(--warn-amber-bg)",
                }}
              >
                <b style={{ color: d.level === "red" ? "var(--alert-red)" : "var(--warn-amber)" }}>●</b> {d.text}
              </div>
            ))}
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Red = required · Yellow = warning (can sign anyway)</p>
          </>
        )}
      </div>
      <div className="modal-footer">
        <button className="btn" onClick={closeModal}>Cancel</button>
        {!hasRed && (
          <button className="btn primary" data-testid="sign-final" onClick={() => signVisit("human")}>
            {deficiencies.length === 0 ? "Sign Encounter" : "Sign Anyway"}
          </button>
        )}
      </div>
    </div>
  );
}

// Neutral sign confirmation — NO in-app score/evaluation. Grading is external (benchmark/harness reads
// window.SimEHR.getState()/getAuditLog()); the app must never show the agent a score or checkpoint verdicts.
function SignResultModal() {
  return (
    <div className="modal" id="modal-content">
      <div className="modal-header">
        <span>Visit Signed</span>
        <span className="x" onClick={closeModal}>✕</span>
      </div>
      <div className="modal-body">
        <p style={{ color: "var(--ok-green)", fontWeight: 700, marginTop: 0 }}>✓ The visit has been signed.</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>The encounter is complete.</p>
      </div>
      <div className="modal-footer">
        <button className="btn primary" onClick={closeModal}>Close</button>
      </div>
    </div>
  );
}

// Full-size report viewer, opened by double-clicking a Chart Review row. `kind` is "<family>:<id>" with
// the same families as the sub-tabs, and the body is the sub-tab's own preview renderer.
function ReportModal({ kind }: { kind: string }) {
  const c = useSim((s) => s.caseData)!;
  const i = kind.indexOf(":");
  const what = i < 0 ? kind : kind.slice(0, i);
  const id = i < 0 ? "" : kind.slice(i + 1);
  let title = "Report";
  let body: React.ReactNode = null;
  if (what === "enc") {
    const enc = (c.encounters ?? []).find((e) => e.id === id);
    if (enc) { title = `${enc.type} · ${enc.date}`; body = <EncounterReport c={c} enc={enc} />; }
  } else if (what === "note") {
    const n = (c.notes ?? []).find((x) => x.id === id);
    if (n) { title = `${n.type} · ${n.author}`; body = <NoteReport c={c} note={n} />; }
  } else if (what === "med") {
    const m = (c.medications ?? []).find((x) => x.id === id);
    if (m) { title = `${m.name} ${m.dose ?? ""}`.trim(); body = <MedReport c={c} med={m} />; }
  } else if (what === "lab") {
    const o = labOrders(c).find((x) => x.key === id);
    if (o) {
      title = `${o.panel} · ${o.date}`;
      body = <CRLabReport order={o} patient={c.patient} enc={(c.encounters ?? []).find((e) => e.id === o.id)} />;
    }
  } else if (what === "card") {
    const o = cardOrders(c).find((x) => x.id === id);
    if (o) { title = `${o.name} · ${o.date}`; body = <ECGReport c={c} order={o} />; }
  } else if (what === "rad") {
    const o = radOrders(c).find((x) => x.id === id);
    if (o) {
      title = `${o.name} · ${o.date}`;
      body = <ImagingReport c={c} order={o} note={imagingNotes(c).find((n) => noteWhen(n).slice(0, 10) === o.date)} />;
    }
  } else {
    const o = [...referralOrders(c), ...procOrders(c), ...otherOrders(c)].find((x) => x.id === id);
    if (o) {
      title = o.name;
      const note = (c.notes ?? []).find((n) => n.type === "E-Consult Order" && noteWhen(n).slice(0, 10) === o.date && o.type === "E-Consult");
      body = <OrderReport c={c} order={o} note={note} />;
    }
  }
  return (
    <div className="modal report" id="modal-content" data-testid="report-modal">
      <div className="modal-header">
        <span>{title}</span>
        <span className="x" data-testid="report-modal-close" onClick={closeModal}>✕</span>
      </div>
      <div className="modal-body">{body ?? <span className="ep-dim">This record is not available.</span>}</div>
    </div>
  );
}

export default function ModalHost() {
  const modal = useSim((s) => s.modal);
  if (!modal) return null;
  return (
    <div className="modal-backdrop open" id="modal" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      {modal.type === "advisory" && <AdvisoryModal idx={Number(modal.kind ?? 0)} />}
      {modal.type === "report" && <ReportModal kind={modal.kind ?? ""} />}
      {modal.type === "signvisit" && <SignVisitModal />}
      {modal.type === "signresult" && <SignResultModal />}
    </div>
  );
}
