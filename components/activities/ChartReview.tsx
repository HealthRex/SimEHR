"use client";

// Chart Review — 17 sub-tabs (set, the design notes), routed per the
// verified the design notes: Card ← ECG discretes + ECG orders; Rad ← imaging orders + CT-read
// note; Referrals ← e-consult + outpatient referral; Proc ← manual-entry procedures;
// Other Orders ← residual orderHistory; PR Charge suppressed everywhere. Filters actually
// filter (active → yellow banner, named saves); every populated tab has a bottom report pane.

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSim, setCrSubtab, switchActivity, log, openReport, clearChartNote } from "@/lib/store";
import {
  labOrders, labDatesDesc, timeBucket, bucketize, cardOrders, radOrders, imagingNotes,
  referralOrders, procOrders, otherOrders, ecgObs, type LabOrder,
} from "@/lib/projections";
import { medActive, medFreq, noteWhen } from "@/lib/types";
import type { Case, ClinicalNote, Encounter, Medication, OrderHistoryItem } from "@/lib/types";
import CRLabReport from "./CRLabReport";
import { ECGReport, ImagingReport, NoteReport, EncounterReport, OrderReport, MedReport } from "./CRReports";

const SUBTABS = [
  "Encounters", "Notes/Trans", "Letters", "ED Visits", "Anes", "Proc", "Card", "Labs", "Rad",
  "Meds", "Referrals", "Media", "Other Orders", "Episodes", "LDAs", "Consents", "Misc Rpts",
];
// Display labels. The ids above are what the store, the audit log, the rubrics and the test ids use,
// so renaming a tab changes only what is painted.
const SUBTAB_LABEL: Record<string, string> = {
  "Notes/Trans": "Notes", Anes: "Anesthesia", Proc: "Procedures", Card: "Cardiac", Rad: "Imaging",
  LDAs: "Lines/Drains", "Misc Rpts": "Reports",
};

// Sub-tab underline indicators (constant per tab).
const SUBTAB_TINT: Record<string, string> = {
  Encounters: "#3f9c46", "ED Visits": "#c00000", Card: "#e0b400", Labs: "#e0b400",
  Meds: "#7a4fd0", Media: "#3f9c46",
};

// Per-tab toolbar button sets. "!" prefix = grayed/disabled.
const TOOLBARS: Record<string, string[]> = {
  Encounters: ["Preview", "Refresh", "Encounter", "Route", "Patient Images", "Outside Images ▾", "Ophthalmology Images"],
  "Notes/Trans": ["Preview", "Refresh", "Route", "Patient Images", "!Edit Note"],
  Letters: ["Preview", "Refresh", "Route", "!Edit Letter"],
  "ED Visits": ["Preview", "Refresh"],
  Anes: ["Preview", "Refresh", "Encounter", "!Default Sort", "Route"],
  Proc: ["Preview", "Refresh", "Route", "Patient Images"],
  Card: ["Preview", "Refresh", "Encounter", "Lab Flowsheet", "!Default Sort", "Financial", "Route ▾", "Outside Images", "Consents"],
  Labs: ["Results Review", "Preview", "Refresh", "Lab Flowsheet", "Route ▾"],
  Rad: ["Preview", "Refresh", "Route ▾", "Patient Images", "Outside Images ▾"],
  Meds: ["Preview", "Refresh", "!Default Sort", "Route"],
  Referrals: ["Preview", "Refresh", "Route"],
  Media: ["Preview", "Refresh", "Encounter", "Route", "Patient Images", "Correct Chart ▾", "Ophthalmology Images"],
  "Other Orders": ["Preview", "Refresh", "Route"],
  Episodes: ["Preview", "Refresh", "Route"],
  LDAs: ["Preview", "Refresh"],
  Consents: ["Preview", "Refresh", "!Correct Chart ▾", "Consents"],
  "Misc Rpts": ["Preview", "Refresh", "Route"],
};

// Chip sets + column headers for data-less tabs — rendered over an EMPTY grid. No fabricated rows.
const EMPTY_TABS: Record<string, { chips: [string, boolean][]; cols: string[] }> = {
  Letters: {
    chips: [["Default filter", true], ["Unsent", false], ["Deleted Templates", true]],
    cols: ["Enc Date", "Filing Date", "Author", "Pt Dept", "Reason", "Comments", "Status", "Routed To"],
  },
  "ED Visits": {
    chips: [["Hide Non-ED", true], ["Admissions", false]],
    cols: ["When", "Type", "With", "Description", "Encounter ID", "ED Diagnosis"],
  },
  Anes: {
    chips: [["Admissions", false]],
    cols: ["When", "With", "Status", "Procedure", "Associated With"],
  },
  Media: {
    chips: [["Outside Referral", false], ["Outside Records", false], ["Adv Directive/POLST", false], ["Consent", false], ["Photos", false]],
    cols: ["Enc Date", "Document type", "Description", "Enc Dept", "Scan Date/Time", "File Attached to", "Received by/Signed by", "Encounter ID", "Account ID"],
  },
  Episodes: {
    chips: [["Exclude Deleted", true]],
    cols: ["Date Noted", "Status", "Date Resolved", "Type", "Episode", "Comments"],
  },
  LDAs: {
    chips: [["Show active only", true]],
    cols: ["LDA Name", "Placement Date", "Site", "Status", "Removal Date", "Days Active", "Description"],
  },
  Consents: {
    chips: [],
    cols: ["Created Date", "Consent Type", "Consent for", "Last Signed / Scanned", "Signature Status", "Linked to", "Provider", "Department", "Released to Patient Portal"],
  },
};

const NoRecords = () => (
  <div className="pane-pad" style={{ color: "var(--text-muted)" }}>No records of this type.</div>
);

// Data-less tab: filter chips + column headers render over an empty grid.
function EmptyTab({ tab }: { tab: string }) {
  const def = EMPTY_TABS[tab];
  const [on, setOn] = useState<Set<string>>(new Set(def?.chips.filter(([, d]) => d).map(([l]) => l) ?? []));
  if (!def) return <NoRecords />;
  return (
    <div data-testid={`cr-empty-${tab.replace(/[^a-zA-Z0-9]+/g, "-")}`} style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {def.chips.length > 0 && (
        <div className="filter-row">
          <span className="f-label">⧩ Filters</span>
          {def.chips.map(([label]) => (
            <span
              key={label}
              className={"f-chip" + (on.has(label) ? " on" : "")}
              onClick={() =>
                setOn((prev) => {
                  const n = new Set(prev);
                  if (n.has(label)) n.delete(label);
                  else n.add(label);
                  return n;
                })
              }
            >
              <span className="cb">{on.has(label) ? "✓" : ""}</span>
              {label}
            </span>
          ))}
          <span className="clear-filters" onClick={() => setOn(new Set())}>✕ Clear Filters</span>
        </div>
      )}
      <div className="grid-wrap" style={{ flex: 1, minHeight: 0 }}>
        <table className="grid">
          <thead>
            <tr>
              <th style={{ width: 16 }}></th>
              {def.cols.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter chips: per-tab defs. Semantics:
// clicking a chip checks it and filters the grid INSTANTLY; "type"-family chips are a UNION
// (Procedures + H&P = rows matching either — never AND-to-empty); "scope" chips (Hide X /
// Final / Me) AND on top. Chips with no matching data still render (live shows the full
// build chip set — e.g. Echo / Device Checks). The active-filter affordance is the
// highlighted chip + "Clear Filters"; the yellow count banner below is a Prompt-B aid shown
// only when active filters actually hide rows.
// ---------------------------------------------------------------------------
interface Chip<T> {
  label: string;
  defaultOn?: boolean;
  kind?: "scope" | "type"; // default "type"
  pred: (item: T) => boolean;
}

function useChips<T>(chips: Chip<T>[], items: T[]) {
  const [on, setOn] = useState<Set<string>>(new Set(chips.filter((c) => c.defaultOn).map((c) => c.label)));
  const toggle = (label: string) => {
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
    log("human", "toggle_filter", label);
  };
  const clear = () => setOn(new Set()); // every chip off, so the full record set shows
  const scopeOn = chips.filter((c) => on.has(c.label) && c.kind === "scope");
  const typeOn = chips.filter((c) => on.has(c.label) && c.kind !== "scope");
  const nonDefault = [...on].sort().join("|") !== chips.filter((c) => c.defaultOn).map((c) => c.label).sort().join("|");
  const filtered = items.filter(
    (it) => scopeOn.every((c) => c.pred(it)) && (typeOn.length === 0 || typeOn.some((c) => c.pred(it))),
  );
  return { on, toggle, clear, filtered, nonDefault, setOn };
}

function FilterRow<T>({
  chips, ctl, tab, total, shown,
}: {
  chips: Chip<T>[];
  ctl: ReturnType<typeof useChips<T>>;
  tab: string;
  total: number;
  shown: number;
}) {
  const [saved, setSaved] = useState<Record<string, string[]>>({});
  const [name, setName] = useState("");
  return (
    <>
      <div className="filter-row">
        <span className="f-label">⧩ Filters</span>
        {chips.map((f) => (
          <span
            key={f.label}
            className={"f-chip" + (ctl.on.has(f.label) ? " on" : "")}
            data-testid={`cr-filter-${tab}-${f.label.replace(/[^a-zA-Z0-9]+/g, "-")}`}
            onClick={() => ctl.toggle(f.label)}
          >
            <span className="cb">{ctl.on.has(f.label) ? "✓" : ""}</span>
            {f.label}
          </span>
        ))}
        {Object.keys(saved).map((n) => (
          <span key={n} className="f-chip" title="Apply saved filter" onClick={() => ctl.setOn(new Set(saved[n]))}>
            ★ {n}
          </span>
        ))}
        <span className="clear-filters" onClick={ctl.clear}>✕ Clear Filters</span>
      </div>
      {ctl.nonDefault && shown < total && (
        <div className="banner yellow" data-testid="cr-filter-banner">
          <span>⚠ Filters applied — showing {shown} of {total} records.</span>
          <input
            placeholder="Save as…"
            value={name}
            data-testid="cr-filter-save-name"
            onChange={(e) => setName(e.target.value)}
            style={{ marginLeft: 10, fontSize: 11, padding: "1px 4px", border: "1px solid #c9b96a" }}
          />
          <span
            className="b-btn"
            data-testid="cr-filter-save"
            onClick={() => {
              if (!name.trim()) return;
              setSaved((s) => ({ ...s, [name.trim()]: [...ctl.on] }));
              setName("");
            }}
          >
            Save filter
          </span>
          <span className="spacer" />
          <span className="b-btn" onClick={ctl.clear}>✕ Clear Filters</span>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Generic order grid + bottom report pane (time-grouped).
// ---------------------------------------------------------------------------
interface Col<T> {
  h: string;
  v: (item: T) => React.ReactNode;
}

function OrderGrid<T extends { date?: string; datetime?: string }>({
  items, cols, keyOf, testid, rowTestid, icon, preview, previewTitle, reportKind,
}: {
  items: T[];
  cols: Col<T>[];
  keyOf: (item: T) => string;
  testid: string;
  rowTestid: (item: T) => string;
  icon?: string;
  reportKind?: string; // report-viewer family for double-click: card | rad | ref | proc | other
  preview: (item: T) => React.ReactNode;
  previewTitle: (item: T) => string;
}) {
  const [sel, setSel] = useState<string | null>(null);
  if (!items.length) return <NoRecords />;
  const buckets = bucketize(items);
  const selected = items.find((i) => keyOf(i) === sel) ?? items[0];
  return (
    <div data-testid={testid} style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div className="grid-wrap" style={{ flex: 1, minHeight: 0 }}>
        <table className="grid">
          <thead>
            <tr>
              <th style={{ width: 16 }}></th>
              {cols.map((c) => (
                <th key={c.h}>{c.h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buckets.map((g) => (
              <Fragment key={g.label}>
                <tr className="group">
                  <td colSpan={cols.length + 1}>
                    {g.label}
                    <span className="rule" />
                  </td>
                </tr>
                {g.items.map((it) => (
                  <tr
                    key={keyOf(it)}
                    className={"row" + (keyOf(selected) === keyOf(it) ? " selected" : "")}
                    data-testid={rowTestid(it)}
                    onClick={() => setSel(keyOf(it))}
                    onDoubleClick={() => reportKind && openReport(`${reportKind}:${keyOf(it)}`)}
                  >
                    <td className="cell-ico">{icon ?? "🗎"}</td>
                    {cols.map((c) => (
                      <td key={c.h}>{c.v(it)}</td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cr-preview open">
        <div className="prev-tools">
          <span className="pt-ico" title="Print">🖨</span>
          <span className="pt-ico" title="Refresh">↻</span>
          <span className="pt-sep" />
          <span style={{ fontSize: 11, color: "#51626f", fontWeight: 600 }}>{previewTitle(selected)}</span>
          <span className="pt-spacer" />
        </div>
        <div className="prev-body">{preview(selected)}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Labs (order grid derives from observations; Lab vs "Lab Panel" orderHistory rows collapse
// into this same grid — the design notes)
// ---------------------------------------------------------------------------
function Labs({ c }: { c: Case }) {
  const [sel, setSel] = useState<string | null>(null);
  const all = labOrders(c);
  const chips: Chip<LabOrder>[] = [
    { label: "Hide Canceled Orders", defaultOn: true, kind: "scope", pred: (o) => o.status !== "canceled" },
    { label: "Final", kind: "scope", pred: (o) => o.status === "Final result" },
    { label: "Blood", pred: (o) => (o.rows[0]?.specimen ?? "").toLowerCase().includes("blood") },
    { label: "Stool", pred: (o) => (o.rows[0]?.specimen ?? "").toLowerCase().includes("stool") },
    { label: "Urine", pred: (o) => (o.rows[0]?.specimen ?? "").toLowerCase().includes("urine") },
    { label: "Body Fluid", pred: (o) => (o.rows[0]?.specimen ?? "").toLowerCase().includes("fluid") },
    { label: "Microbiology", pred: (o) => /culture|viral|micro/i.test(o.panel) },
    { label: "HLA", pred: (o) => /HLA/i.test(o.panel) },
    { label: "Pathology", pred: (o) => /path|cytolog/i.test(o.panel) },
  ];
  const ctl = useChips(chips, all);
  const orders = ctl.filtered;
  const newest = labDatesDesc(c)[0];
  const buckets: { label: string; items: LabOrder[] }[] = [];
  for (const o of orders) {
    const b = timeBucket(o.datetime, newest);
    let g = buckets.find((x) => x.label === b);
    if (!g) buckets.push((g = { label: b, items: [] }));
    g.items.push(o);
  }
  const selectedOrder = orders.find((o) => o.key === sel) ?? orders[0];
  const enc = (c.encounters ?? []).find((e) => e.id === selectedOrder?.id);

  return (
    <>
      <FilterRow chips={chips} ctl={ctl} tab="Labs" total={all.length} shown={orders.length} />
      {!orders.length ? (
        <NoRecords />
      ) : (
        <div data-testid="cr-labs" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className="grid-wrap" style={{ flex: 1, minHeight: 0 }}>
            <table className="grid">
              <thead>
                <tr>
                  <th style={{ width: 16 }}></th>
                  <th>Date/Time</th>
                  <th>Test</th>
                  <th>Status</th>
                  <th>Auth Provider</th>
                  <th>Accession #</th>
                  <th>Dept</th>
                  <th>Enc Type</th>
                  <th>Encounter ID</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((g) => (
                  <Fragment key={g.label}>
                    <tr className="group">
                      <td colSpan={9}>
                        {g.label}
                        <span className="rule" />
                      </td>
                    </tr>
                    {g.items.map((o) => (
                      <tr
                        key={o.key}
                        className={"row" + (selectedOrder.key === o.key ? " selected" : "")}
                        data-testid={`cr-lab-${o.accession ?? o.key}`}
                        onClick={() => setSel(o.key)}
                        onDoubleClick={() => openReport(`lab:${o.key}`)}
                      >
                        <td className="cell-ico">🧪</td>
                        <td>{o.date} {o.datetime.slice(11, 16)}</td>
                        <td>{o.panel}</td>
                        <td>{o.status}</td>
                        <td>{o.provider}</td>
                        <td>{o.accession}</td>
                        <td>{o.dept}</td>
                        <td>{o.encType}</td>
                        <td>{o.id}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cr-preview open">
            <div className="prev-tools">
              <span className="pt-ico" title="Print">🖨</span>
              <span className="pt-ico" title="Refresh">↻</span>
              <span className="pt-sep" />
              <span style={{ fontSize: 11, color: "#51626f", fontWeight: 600 }}>
                {selectedOrder.panel} · {selectedOrder.date}
              </span>
              <span className="pt-spacer" />
            </div>
            <div className="prev-body">
              <CRLabReport order={selectedOrder} patient={c.patient} enc={enc} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Card — ECG discretes (result report) + ECG/monitor orders. Chip set per the design notes.
// ---------------------------------------------------------------------------
function Card({ c }: { c: Case }) {
  const all = cardOrders(c);
  const resultDates = new Set(ecgObs(c).map((o) => o.datetime.slice(0, 10)));
  const isResulted = (o: OrderHistoryItem) => resultDates.has(o.date) && !/SCANNED|EXT /.test(o.name);
  const encByCsn = new Map((c.encounters ?? []).map((e) => [e.id, e] as const));
  const resultedBy = (o: OrderHistoryItem) => {
    if (!isResulted(o)) return "";
    const obs = ecgObs(c).find((x) => x.datetime.slice(0, 10) === o.date && x.encounterId);
    return (obs?.encounterId && encByCsn.get(obs.encounterId)?.provider) || "";
  };
  const chips: Chip<OrderHistoryItem>[] = [
    { label: "Invasive Procedures", pred: () => false },
    { label: "ECG/Monitors", pred: (o) => /ZIO|MONITOR|ECG>48|EKG/i.test(o.name) },
    { label: "Echo", pred: (o) => /echo/i.test(o.name) },
    { label: "Device Checks", pred: (o) => /device/i.test(o.name) },
    { label: "Final result", kind: "scope", pred: isResulted },
    { label: "Hide Discontinued", defaultOn: true, kind: "scope", pred: (o) => o.status !== "discontinued" },
  ];
  const ctl = useChips(chips, all);
  return (
    <>
      <FilterRow chips={chips} ctl={ctl} tab="Card" total={all.length} shown={ctl.filtered.length} />
      <OrderGrid
        items={ctl.filtered}
        keyOf={(o) => o.id}
        testid="cr-card"
        reportKind="card"
        rowTestid={(o) => `cr-card-${o.id}`}
        icon="📈"
        cols={[
          { h: "Ordered", v: (o) => o.date },
          { h: "Description", v: (o) => o.name },
          { h: "Status", v: (o) => (isResulted(o) ? "Final result" : o.status) },
          { h: "Resulted By", v: resultedBy },
          { h: "Accession #", v: (o) => (isResulted(o) ? ecgObs(c).find((x) => x.datetime.slice(0, 10) === o.date)?.accession ?? "" : "") },
          { h: "Dept", v: (o) => { const obs = ecgObs(c).find((x) => x.datetime.slice(0, 10) === o.date && x.encounterId); return (obs?.encounterId && encByCsn.get(obs.encounterId)?.department) || ""; } },
        ]}
        preview={(o) => <ECGReport c={c} order={o} />}
        previewTitle={(o) => `${o.name} · ${o.date}`}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Rad — imaging orders + the CT read (note.type === "Imaging") as the result report.
// ---------------------------------------------------------------------------
function Rad({ c }: { c: Case }) {
  const all = radOrders(c);
  const notes = imagingNotes(c);
  const noteFor = (o: OrderHistoryItem): ClinicalNote | undefined =>
    notes.find((n) => noteWhen(n).slice(0, 10) === o.date);
  const chips: Chip<OrderHistoryItem>[] = [
    { label: "Final", kind: "scope", pred: (o) => !!noteFor(o) },
    { label: "US", pred: (o) => /\bUS\b|ULTRASOUND/i.test(o.name) },
    { label: "CT", pred: (o) => /\bCT\b/i.test(o.name) },
    { label: "MR", pred: (o) => /\bMRI?\b/i.test(o.name) },
    { label: "XR", pred: (o) => /\bXR\b|X-RAY/i.test(o.name) },
    { label: "NM", pred: (o) => /\bNM\b/i.test(o.name) },
    { label: "PET", pred: (o) => /\bPET\b/i.test(o.name) },
  ];
  const ctl = useChips(chips, all);
  return (
    <>
      <FilterRow chips={chips} ctl={ctl} tab="Rad" total={all.length} shown={ctl.filtered.length} />
      <OrderGrid
        items={ctl.filtered}
        keyOf={(o) => o.id}
        testid="cr-rad"
        reportKind="rad"
        rowTestid={(o) => `cr-rad-${o.id}`}
        icon="🩻"
        cols={[
          { h: "Ordered", v: (o) => o.date },
          { h: "Procedure", v: (o) => o.name },
          { h: "Status", v: (o) => (noteFor(o) ? "Final result" : o.status) },
          { h: "Resulted by", v: (o) => noteFor(o)?.author ?? "" },
          { h: "Order Class", v: (o) => (/OUTSIDE|OUT$/i.test(o.cpt ?? "") || o.name === "IMAGING" ? "Outside Records" : "Normal") },
        ]}
        preview={(o) => <ImagingReport c={c} order={o} note={noteFor(o)} />}
        previewTitle={(o) => `${o.name} · ${o.date}`}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Referrals — e-consult + outpatient referral records (the design notes); the
// e-consult body (note.type === "E-Consult Order") is the linked documentation.
// ---------------------------------------------------------------------------
function Referrals({ c }: { c: Case }) {
  const all = referralOrders(c);
  const noteFor = (o: OrderHistoryItem): ClinicalNote | undefined =>
    (c.notes ?? []).find((n) => n.type === "E-Consult Order" && noteWhen(n).slice(0, 10) === o.date && o.type === "E-Consult");
  const chips: Chip<OrderHistoryItem>[] = [{ label: "Hide Denied", kind: "scope", pred: () => true }];
  const ctl = useChips(chips, all);
  return (
    <>
      <FilterRow chips={chips} ctl={ctl} tab="Referrals" total={all.length} shown={ctl.filtered.length} />
      <OrderGrid
        items={ctl.filtered}
        keyOf={(o) => o.id}
        testid="cr-referrals"
        reportKind="ref"
        rowTestid={(o) => `cr-ref-${o.id}`}
        icon="↗"
        cols={[
          { h: "Date", v: (o) => o.date },
          { h: "Rfl type", v: (o) => o.type },
          { h: "Procedure", v: (o) => o.name },
          { h: "To Dept. Speciality", v: () => "" },
          { h: "Diagnosis", v: () => "" },
          { h: "Auth. Status", v: () => "" },
          { h: "Scheduling Status", v: () => "" },
        ]}
        preview={(o) => <OrderReport c={c} order={o} note={noteFor(o)} />}
        previewTitle={(o) => `${o.type} · ${o.name}`}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Proc — manual-entry / external procedures (the design notes).
// ---------------------------------------------------------------------------
function Proc({ c }: { c: Case }) {
  const all = procOrders(c);
  const chips: Chip<OrderHistoryItem>[] = [{ label: "Hide Discontinued", defaultOn: true, kind: "scope", pred: (o) => o.status !== "discontinued" }];
  const ctl = useChips(chips, all);
  return (
    <>
      <FilterRow chips={chips} ctl={ctl} tab="Proc" total={all.length} shown={ctl.filtered.length} />
      <OrderGrid
        items={ctl.filtered}
        keyOf={(o) => o.id}
        testid="cr-proc"
        reportKind="proc"
        rowTestid={(o) => `cr-proc-${o.id}`}
        cols={[
          { h: "Ordered", v: (o) => o.date },
          { h: "Description", v: (o) => o.name },
          { h: "Status", v: (o) => o.status },
          { h: "Legal Status", v: () => "" },
          { h: "Patient Sharing", v: () => "" },
        ]}
        preview={(o) => <OrderReport c={c} order={o} />}
        previewTitle={(o) => o.name}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Other Orders — residual orderHistory (immunization order lands here; PR Charge never does).
// ---------------------------------------------------------------------------
function OtherOrders({ c }: { c: Case }) {
  const all = otherOrders(c);
  const chips: Chip<OrderHistoryItem>[] = [{ label: "Hide Discontinued", defaultOn: true, kind: "scope", pred: (o) => o.status !== "discontinued" }];
  const ctl = useChips(chips, all);
  return (
    <>
      <FilterRow chips={chips} ctl={ctl} tab="Other Orders" total={all.length} shown={ctl.filtered.length} />
      <OrderGrid
        items={ctl.filtered}
        keyOf={(o) => o.id}
        testid="cr-other-orders"
        reportKind="other"
        rowTestid={(o) => `cr-oo-${o.id}`}
        cols={[
          { h: "Ordered Date", v: (o) => o.date },
          { h: "Description", v: (o) => o.name },
          { h: "Type", v: (o) => o.type },
          { h: "Status", v: (o) => o.status },
        ]}
        preview={(o) => <OrderReport c={c} order={o} />}
        previewTitle={(o) => o.name}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Encounters — grid + encounter summary report (Level of Service = PR Charge surface).
// ---------------------------------------------------------------------------
function Encounters({ c }: { c: Case }) {
  const [sel, setSel] = useState<string | null>(null);
  const all = c.encounters ?? [];
  // Chip set: Hide Other Enc ☑ · Admissions · Tel/Email · Visits ·
  // Ancillary Visits · Procedure · Hide Canceled · Hide External Claims ☑ — type chips union.
  const chips: Chip<Encounter>[] = [
    { label: "Hide Unrelated", defaultOn: true, kind: "scope", pred: () => true },
    { label: "Admissions", pred: (x) => x.class === "inpatient" || /admission|hospital/i.test(x.type) },
    { label: "Phone/Email", pred: (x) => /tel|email|phone|message/i.test(x.type) },
    { label: "Visits", pred: (x) => /visit|consult/i.test(x.type) },
    { label: "Ancillary Visits", pred: (x) => /lab|imaging|ancillary/i.test(x.type) },
    { label: "Procedure", pred: (x) => /procedure/i.test(x.type) },
    { label: "Hide Canceled", kind: "scope", pred: (x) => !/canceled/i.test(x.type) },
    { label: "Hide Billing", defaultOn: true, kind: "scope", pred: () => true },
  ];
  const ctl = useChips(chips, all);
  const e = ctl.filtered;
  const selected = e.find((x) => x.id === sel) ?? e[0];
  if (!all.length) return <NoRecords />;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <FilterRow chips={chips} ctl={ctl} tab="Encounters" total={all.length} shown={e.length} />
      {!e.length ? (
        <NoRecords />
      ) : (
        <div data-testid="cr-encounters" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className="grid-wrap" style={{ flex: 1, minHeight: 0 }}>
            <table className="grid">
              <thead>
                <tr>
                  <th style={{ width: 16 }}></th>
                  <th>When</th>
                  <th>Type</th>
                  <th>Department</th>
                  <th>Provider</th>
                  <th>Chief Complaint / Reason</th>
                  <th>Encounter ID</th>
                  <th>Visit Type</th>
                </tr>
              </thead>
              <tbody>
                {e.map((x) => (
                  <tr
                    key={x.id}
                    className={"row" + (selected?.id === x.id ? " selected" : "")}
                    data-testid={`cr-enc-${x.id}`}
                    onClick={() => setSel(x.id)}
                    onDoubleClick={() => openReport(`enc:${x.id}`)}
                  >
                    <td className="cell-ico">📋</td>
                    <td>{x.date}</td>
                    <td>{x.type}</td>
                    <td>{x.department}</td>
                    <td>{x.provider}</td>
                    <td>{x.reason}</td>
                    <td>{x.id}</td>
                    <td>{x.visitType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <div className="cr-preview open">
              <div className="prev-tools">
                <span className="pt-ico" title="Print">🖨</span>
                <span className="pt-sep" />
                <span style={{ fontSize: 11, color: "#51626f", fontWeight: 600 }}>
                  {selected.type} · {selected.date}
                </span>
                <span className="pt-spacer" />
              </div>
              <div className="prev-body">
                <EncounterReport c={c} enc={selected} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes/Trans — grid (live column set) + full note report in the preview pane.
// ---------------------------------------------------------------------------
function Notes({ c }: { c: Case }) {
  const [sel, setSel] = useState<string | null>(null);
  // An encounter report's documentation line selects its note here.
  const pending = useSim((s) => s.crNoteSel);
  useEffect(() => {
    if (pending) {
      setSel(pending);
      clearChartNote();
    }
  }, [pending]);
  const all = [...(c.notes ?? [])].sort((a, b) => noteWhen(b).localeCompare(noteWhen(a)));
  // Chip set + semantics: note-type chips are a union;
  // "Me" scopes to the signed-in user's notes (sim user authored none → honest empty grid).
  const chips: Chip<ClinicalNote>[] = [
    { label: "Hide Unrelated", defaultOn: true, kind: "scope", pred: () => true },
    { label: "Me", kind: "scope", pred: () => false },
    { label: "Hide Deleted", defaultOn: true, kind: "scope", pred: (x) => x.status !== "deleted" },
    { label: "Procedures", pred: (x) => /procedure/i.test(x.type) },
    { label: "H&P", pred: (x) => /h&p|history and physical/i.test(x.type) },
    { label: "Discharge Summary", pred: (x) => /discharge|dc summary/i.test(x.type) },
    { label: "Outpatient Visit", pred: (x) => /op visit/i.test(x.type) },
  ];
  const ctl = useChips(chips, all);
  const n = ctl.filtered;
  const selected = n.find((x) => x.id === sel) ?? n[0];
  const encByCsn = new Map((c.encounters ?? []).map((e) => [e.id, e] as const));
  if (!all.length) return <NoRecords />;
  return (
    <div data-testid="cr-notes" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <FilterRow chips={chips} ctl={ctl} tab="Notes" total={all.length} shown={n.length} />
      {!n.length ? (
        <NoRecords />
      ) : (
      <>
      <div className="grid-wrap" style={{ flex: 1, minHeight: 0 }}>
        <table className="grid">
          <thead>
            <tr>
              <th style={{ width: 16 }}></th>
              <th>Encounter Date</th>
              <th>Note Date</th>
              <th>Encounter Type</th>
              <th>Type</th>
              <th>Author</th>
              <th>Status</th>
              <th>Filing Date</th>
              <th>Encounter ID</th>
            </tr>
          </thead>
          <tbody>
            {n.map((x) => {
              const enc = x.encounterId ? encByCsn.get(x.encounterId) : undefined;
              return (
                <tr
                  key={x.id}
                  className={"row" + (selected?.id === x.id ? " selected" : "")}
                  data-testid={`cr-note-${x.id}`}
                  onClick={() => setSel(x.id)}
                  onDoubleClick={() => openReport(`note:${x.id}`)}
                >
                  <td className="cell-ico">🗎</td>
                  <td>{enc?.date ?? noteWhen(x).slice(0, 10)}</td>
                  <td>{noteWhen(x).slice(0, 10)}</td>
                  <td>{enc?.type ?? ""}</td>
                  <td>{x.type}</td>
                  <td>{x.author}</td>
                  <td>{x.status}</td>
                  <td>{noteWhen(x).slice(0, 10)}</td>
                  <td>{x.encounterId}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected && (
      <div className="cr-preview open">
        <div className="prev-tools">
          <span className="pt-ico" title="Print">🖨</span>
          <span className="pt-sep" />
          <span style={{ fontSize: 11, color: "#51626f", fontWeight: 600 }}>
            {selected.type} · {selected.author}
          </span>
          <span className="pt-spacer" />
        </div>
        <div className="prev-body">
          <NoteReport c={c} note={selected} />
        </div>
      </div>
      )}
      </>
      )}
    </div>
  );
}

// Meds — live column set + per-row medication order report in the preview pane
//.
function Meds({ c }: { c: Case }) {
  const [sel, setSel] = useState<string | null>(null);
  const all = c.medications ?? [];
  const chips: Chip<Medication>[] = [
    { label: "Current Meds Only", defaultOn: true, kind: "scope", pred: medActive },
  ];
  const ctl = useChips(chips, all);
  const meds = ctl.filtered;
  const encByCsn = new Map((c.encounters ?? []).map((e) => [e.id, e] as const));
  const selected = meds.find((m) => m.id === sel) ?? meds[0];
  if (!all.length) return <NoRecords />;
  const ctx = (m: Medication) => {
    const cls = m.encounterId ? encByCsn.get(m.encounterId)?.class : undefined;
    return cls === "inpatient" || cls === "emergency" ? "IP" : "AMB";
  };
  return (
    <div data-testid="cr-meds" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <FilterRow chips={chips} ctl={ctl} tab="Meds" total={all.length} shown={meds.length} />
      {!meds.length ? (
        <NoRecords />
      ) : (
        <>
          <div className="grid-wrap" style={{ flex: 1, minHeight: 0 }}>
            <table className="grid">
              <thead>
                <tr>
                  <th style={{ width: 16 }}></th>
                  <th>Date</th>
                  <th>e-Prior Auth.?</th>
                  <th>Enc Type</th>
                  <th>Medication</th>
                  <th>Order Detail</th>
                  <th>Provider</th>
                  <th>End Date</th>
                  <th>Cancel/DC Reason</th>
                  <th>AMB/CAM/IP</th>
                  <th>Encounter ID</th>
                  <th>DC Status</th>
                </tr>
              </thead>
              <tbody>
                {meds.map((m) => {
                  const enc = m.encounterId ? encByCsn.get(m.encounterId) : undefined;
                  return (
                    <tr
                      key={m.id}
                      className={"row" + (selected?.id === m.id ? " selected" : "")}
                      data-testid={`cr-med-${m.id}`}
                      onClick={() => setSel(m.id)}
                      onDoubleClick={() => openReport(`med:${m.id}`)}
                    >
                      <td className="cell-ico">💊</td>
                      <td>{m.started ?? ""}</td>
                      <td>No</td>
                      <td>{enc?.type ?? ""}</td>
                      <td>{m.name} {m.dose ?? ""}</td>
                      <td>{m.sig ?? `${m.dose ?? ""} ${medFreq(m)}`.trim()}</td>
                      <td>{enc?.provider ?? ""}</td>
                      <td></td>
                      <td></td>
                      <td>{ctx(m)}</td>
                      <td>{m.encounterId ?? ""}</td>
                      <td>{m.status === "discontinued" ? "Discontinued" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {selected && (
            <div className="cr-preview open">
              <div className="prev-tools">
                <span className="pt-ico" title="Print">🖨</span>
                <span className="pt-sep" />
                <span style={{ fontSize: 11, color: "#51626f", fontWeight: 600 }}>
                  {selected.name} {selected.dose ?? ""}
                </span>
                <span className="pt-spacer" />
              </div>
              <div className="prev-body">
                <MedReport c={c} med={selected} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Misc Rpts — report launcher; not patient data.
const MISC_RPTS: [string, string][] = [
  ["PATIENT", "Current Meds and Allergies"],
  ["PATIENT", "Facesheet"],
  ["PATIENT", "Health Maintenance"],
  ["PATIENT", "History (summary)"],
  ["PATIENT", "Immunization History"],
  ["RECORDS", "Entire Chart"],
  ["RECORDS", "Routing History"],
  ["ACCOUNT", "Insurance (summary)"],
];
function MiscRpts() {
  return (
    <div className="grid-wrap" data-testid="cr-misc-rpts">
      <table className="grid">
        <thead>
          <tr>
            <th>Report</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {MISC_RPTS.map(([r, d]) => (
            <tr key={d} className="row">
              <td>{r}</td>
              <td>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChartReview() {
  const c = useSim((s) => s.caseData);
  const sub = useSim((s) => s.crSubtab);
  if (!c) return null;
  const isLabs = sub === "Labs";

  const PANES: Record<string, React.ReactNode> = {
    Labs: <Labs c={c} />,
    Card: <Card c={c} />,
    Rad: <Rad c={c} />,
    Referrals: <Referrals c={c} />,
    Proc: <Proc c={c} />,
    "Other Orders": <OtherOrders c={c} />,
    Encounters: <Encounters c={c} />,
    "Notes/Trans": <Notes c={c} />,
    Meds: <Meds c={c} />,
    "Misc Rpts": <MiscRpts />,
  };

  // Toolbar per live button set; "!" = grayed. Results Review / Lab Flowsheet launch for real.
  const buttons = TOOLBARS[sub] ?? ["Preview", "Refresh"];
  const glyphFor = (b: string) =>
    b === "Refresh" ? "↻" : b === "Route" || b === "Route ▾" ? "⇥" : "▦";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="cr-subtabs">
        <span className="bookmark">🔖</span>
        {SUBTABS.map((t) => (
          <div
            key={t}
            className={"cr-st" + (sub === t ? " active" : "")}
            style={SUBTAB_TINT[t] ? { boxShadow: `inset 0 -3px 0 ${SUBTAB_TINT[t]}` } : undefined}
            data-testid={`cr-subtab-${t}`}
            onClick={() => setCrSubtab(t, "human")}
          >
            {SUBTAB_LABEL[t] ?? t}
          </div>
        ))}
      </div>

      <div className="report-toolbar">
        {buttons.map((raw) => {
          const disabled = raw.startsWith("!");
          const b = disabled ? raw.slice(1) : raw;
          const onClick =
            b === "Results Review"
              ? () => switchActivity("results", "human")
              : b === "Lab Flowsheet" && isLabs
                ? () => switchActivity("flowsheets", "human")
                : undefined;
          return (
            <div
              key={b}
              className={"rt-btn" + (disabled ? " disabled" : "")}
              style={disabled ? { opacity: 0.45, cursor: "default" } : undefined}
              data-testid={
                b === "Results Review" ? "cr-launch-results-review" : b === "Lab Flowsheet" ? "cr-launch-lab-flowsheet" : undefined
              }
              onClick={onClick}
            >
              <span className="gl">{glyphFor(b)}</span> {b}
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {PANES[sub] ?? <EmptyTab tab={sub} />}
      </div>
    </div>
  );
}
