"use client";

// Full lab-order report shown in the Chart Review bottom preview pane. Entirely data-driven from the selected order + case patient/encounter — no
// hardcoded patient values.
import type { LabOrder } from "@/lib/projections";
import type { Patient, Encounter } from "@/lib/types";

function EpSec({ title, variant }: { title: string; variant?: string }) {
  return (
    <div className={"ep-sec" + (variant ? " " + variant : "")}>
      {title}
      <span className="rule" />
      <span className="chev">▾</span>
    </div>
  );
}

function EpGrid({ cols, cells }: { cols: 2 | 3 | 4 | 5; cells: [string, string][] }) {
  return (
    <div className={`ep-grid c${cols}`}>
      {cells.map(([l, v], i) => (
        <div key={i} className="cell">
          <div className="gl">{l}</div>
          <div className="gv" dangerouslySetInnerHTML={{ __html: v || "—" }} />
        </div>
      ))}
    </div>
  );
}

const ref = (o: { refText?: string; refLow?: number | null; refHigh?: number | null }) =>
  o.refText ?? (o.refLow != null || o.refHigh != null ? `${o.refLow ?? ""}–${o.refHigh ?? ""}` : "");

export default function CRLabReport({ order, patient, enc }: { order: LabOrder; patient: Patient; enc?: Encounter }) {
  const test = order.panel;
  const orderId = "40000" + (order.accession ?? "").replace(/\D/g, "").padStart(5, "0").slice(-5);
  const collected = order.datetime.replace("T", " ");
  const ordProv = order.provider ?? enc?.provider ?? "Smith, Alice, MD";
  const specimen = order.rows[0]?.specimen ?? "Blood, venous";
  const lab = "SIM CLINICAL LABORATORY";
  const sexWord = patient.sex === "F" ? "Female" : patient.sex === "M" ? "Male" : "Unknown";

  return (
    <>
      {/* letterhead */}
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
          Lab Order Report
          <br />
          Printed {collected}
        </div>
        <div className="pt">
          {patient.name}
          <br />
          MRN: {patient.mrn}, DOB: {patient.dob}, Legal Sex: {patient.sex}
          <br />
          Encounter ID: {order.id ?? enc?.id ?? "—"}
        </div>
      </div>

      <div className="ep-bighead">
        Order<span className="ref">{test} (Order {orderId})</span>
      </div>

      <EpSec title="Collection Information" />
      <div className="ep-indent">
        <div>
          <b>{specimen}</b>
        </div>
        <div className="ep-ln">
          <span className="ep-dim">Resulting Agency:</span> <b>{lab}</b>
        </div>
        <div className="ep-indent ep-dim">
          1 Simulation Way
          <br />
          Anytown ST 00000
        </div>
      </div>

      <EpSec title="Patient Information" />
      <EpGrid
        cols={5}
        cells={[
          ["Patient Name", patient.name],
          ["MRN", patient.mrn],
          ["Legal Sex", sexWord],
          ["DOB (Age)", `${patient.dob} (${patient.age} Y)`],
          ["Current Location", enc?.department ?? "SIM PRIMARY CARE"],
        ]}
      />

      <EpSec title="Provider Information" variant="dark" />
      <EpGrid
        cols={3}
        cells={[
          ["Ordering Provider", `${ordProv} (S0100001)`],
          ["Authorizing Provider", `${ordProv} (S0100001)`],
          ["Encounter Dept", enc?.department ?? "—"],
        ]}
      />

      <EpSec title="Order Details" />
      <EpGrid cols={3} cells={[["Frequency", "LAB ONE TIME"], ["Priority", "Routine"], ["Order Class", "Normal"]]} />

      <EpSec title="Order Information" />
      <EpGrid cols={2} cells={[["Order Date/Time", collected], ["Physician Start Date/Time", collected]]} />

      <EpSec title="Results" />
      <div className="ep-indent" style={{ fontSize: "10.5px", color: "#51626f", marginBottom: 4 }}>
        <div>Test Result Released: No (not released to the patient portal)</div>
        <div>0 Result Notes</div>
      </div>
      <table className="components ep-indent">
        <thead>
          <tr>
            <th>Component</th>
            <th>Value</th>
            <th>Reference Range</th>
            <th>Flag</th>
          </tr>
        </thead>
        <tbody>
          {order.rows.map((r) => (
            <tr key={r.id} className={r.flag ? "abn" : ""}>
              <td>{r.flag ? <b>{r.name}</b> : r.name}</td>
              <td>
                {r.flag ? <b>{r.value}{r.unit ? ` ${r.unit}` : ""}</b> : <>{r.value}{r.unit ? ` ${r.unit}` : ""}</>}
              </td>
              <td>{ref(r)}</td>
              <td className="flagcell">
                {r.flag === "H" ? <span className="flag-high">H</span> : r.flag === "L" ? <span className="flag-low">L</span> : r.flag ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <EpSec title="Account Information" />
      <div className="ep-indent">
        <div className="ep-dim" style={{ fontSize: "10.5px" }}>Encounter ID #</div>
        <div>{order.id ?? enc?.id ?? "—"}</div>
      </div>

      {/* signed order block */}
      <div className="ep-title">
        {test} [{orderId}]
        <span className="stat">
          Status: <b>{order.status}</b>
        </span>
      </div>
      <div className="ep-ln">
        Electronically signed by: <b>{ordProv}</b>
      </div>

      <EpSec title="Order Tracking" />
      <div className="ep-track">
        {[
          { lbl: "Ordered", sub: collected },
          { lbl: "Collected", sub: collected },
          { lbl: "In Transit", sub: "To MAINLAB" },
          { lbl: "Received in Lab", sub: "" },
          { lbl: "Final Result", sub: collected },
        ].map((s) => (
          <div key={s.lbl} className="ep-step done">
            <div className="icon">🗎</div>
            <div className="lbl">{s.lbl}</div>
            <div className="sub">{s.sub}</div>
          </div>
        ))}
      </div>
    </>
  );
}
