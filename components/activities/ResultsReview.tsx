"use client";

// Results Review — behaviors:
//  · toolbar = funnel · Select View ▾ (View Editor / New View / Manage Views) ·
//    🕐 "All Results ▾" (Filter-to dropdown) · 📅 ▾ (Go-to popover) · ▦ switch-all-to-grids ·
//    ▨ switch-all-to-graphs · ⚙ Options ▾ · ⏱ Time Mark · ↻
//  · column paging via BOTTOM arrows (⏮ ◀◀ ◀ … ▶ ▶▶ ⏭) — no top pager row
//  · per-ROW hover icons: view-as-graph + collapse; per-SECTION icons: graph + collapse
//  · reference ranges are NOT inline — they surface on cell hover + in the detail modal
//  · clicking a VALUE opens the "Result Details" modal (Collected/Result status/Resulting
//    lab/Reference range/Value chip + embedded full report + Close)
//  · tree roots are data-driven: LABORATORY (panels) and CARDIOLOGY → ECG (resulted ECG
//    renders as an icon/report cell whose modal is the ECG report — discrete values live
//    inside the report, never as flowsheet rows; schema untouched, projection-only)

import { Fragment, useMemo, useState } from "react";
import { useSim } from "@/lib/store";
import { labs, ecgObs, pendingLabs } from "@/lib/projections";
import type { Case, Observation } from "@/lib/types";

const fc = (f?: string | null) => (f === "H" ? "flag-high" : f === "L" ? "flag-low" : f === "A" ? "flag-high" : "");
const arrow = (f?: string | null) => (f === "H" ? " ↑" : f === "L" ? " ↓" : "");
const OTHERS = "Others";
const fmtD = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(2, 4)}`;

interface Row {
  key: string;
  name: string;
  code?: string;
  unit?: string;
  ref: string;
  panel: string;
  root: "LABORATORY" | "CARDIOLOGY";
  kind: "numeric" | "report"; // report → icon cell, modal = full report (ECG)
  byDate: Record<string, Observation>;
}

const refOf = (o: Observation): string =>
  o.refText ?? (o.refLow != null || o.refHigh != null ? `${o.refLow ?? ""}–${o.refHigh ?? ""}` : "");

// panel → rows; Others = panel-less components (never dropped). ECG studies form the
// CARDIOLOGY root as ONE report-row per panel ("ECG 12-Lead" icon cell).
// Columns are keyed by full result DATETIME (one column per result instant, header
// shows year row + date/time two-line).
function buildTree(c: Case) {
  const rowsByPanel = new Map<string, Row[]>();
  const rootByPanel = new Map<string, "LABORATORY" | "CARDIOLOGY">();
  const dates = new Set<string>();
  for (const o of labs(c)) {
    const panel = o.panel ?? OTHERS;
    const d = o.datetime;
    dates.add(d);
    rootByPanel.set(panel, "LABORATORY");
    let rows = rowsByPanel.get(panel);
    if (!rows) rowsByPanel.set(panel, (rows = []));
    let row = rows.find((r) => r.key === (o.code || o.name));
    if (!row)
      rows.push(
        (row = { key: o.code || o.name, name: o.name, code: o.code, unit: o.unit, ref: refOf(o), panel, root: "LABORATORY", kind: "numeric", byDate: {} }),
      );
    row.byDate[d] = o;
  }
  // CARDIOLOGY → ECG: one report-row per ECG panel; the impression obs represents the study.
  for (const o of ecgObs(c)) {
    const panel = o.panel ?? "ECG";
    const d = o.datetime;
    dates.add(d);
    rootByPanel.set(panel, "CARDIOLOGY");
    let rows = rowsByPanel.get(panel);
    if (!rows) rowsByPanel.set(panel, (rows = []));
    let row = rows.find((r) => r.key === panel);
    if (!row) rows.push((row = { key: panel, name: panel, ref: "", panel, root: "CARDIOLOGY", kind: "report", byDate: {} }));
    if (!row.byDate[d] || /impression/i.test(o.name)) row.byDate[d] = o;
  }
  const panels = [...rowsByPanel.keys()].sort(
    (a, b) => (rootByPanel.get(a) ?? "L").localeCompare(rootByPanel.get(b) ?? "L") || a.localeCompare(b),
  );
  return { panels, rowsByPanel, rootByPanel, dates: [...dates].sort().reverse() };
}

// Year-group spans for the live two-row column header (year row above date/time row).
function yearSpans(dts: string[]): [string, number][] {
  const out: [string, number][] = [];
  for (const d of dts) {
    const y = d.slice(0, 4);
    if (out.length && out[out.length - 1][0] === y) out[out.length - 1][1]++;
    else out.push([y, 1]);
  }
  return out;
}

interface Tip {
  x: number;
  y: number;
  o: Observation;
  ref: string;
}

function rangePos(o: Observation): string | null {
  if (typeof o.value !== "number" || o.refLow == null || o.refHigh == null) return null;
  const span = o.refHigh - o.refLow;
  if (span <= 0) return null;
  const pct = Math.round(((o.value - o.refLow) / span) * 100);
  if (pct < 0) return "below range";
  if (pct > 100) return "above range";
  return `${pct}% of range`;
}

// ---------------------------------------------------------------------------
// Per-section graph (legend pills + shared time axis + Single y-axis).
// ---------------------------------------------------------------------------
const PALETTE = ["#c2185b", "#1b7a32", "#5e35b1", "#0e6ba8", "#e65100", "#00838f", "#6d4c41", "#37474f", "#ad1457"];
const MARKERS = ["●", "◆", "✕", "○", "▲", "■", "◇", "△", "□"];

function SectionGraph({
  c, panel, rows, onGrid,
}: {
  c: Case;
  panel: string;
  rows: Row[];
  onGrid: () => void;
}) {
  const [singleY, setSingleY] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; text: string[] } | null>(null);
  const series = rows
    .map((r, i) => ({
      row: r,
      color: PALETTE[i % PALETTE.length],
      marker: MARKERS[i % MARKERS.length],
      pts: labs(c)
        .filter((o) => (o.code || o.name) === r.key && typeof o.value === "number")
        .sort((a, b) => a.datetime.localeCompare(b.datetime)),
    }))
    .filter((s) => s.pts.length > 0);
  const allDates = [...new Set(series.flatMap((s) => s.pts.map((p) => p.datetime)))].sort();
  const W = 760, H = Math.max(180, 40 + rows.length * 6), PADL = 10, PADR = 20, PADY = 24;
  const t0 = new Date(allDates[0] ?? "2000-01-01").getTime();
  const t1 = new Date(allDates[allDates.length - 1] ?? "2000-01-02").getTime();
  const span = t1 - t0 || 1;
  const x = (dt: string) => PADL + ((new Date(dt).getTime() - t0) / span) * (W - PADL - PADR);
  const gMin = Math.min(...series.flatMap((s) => s.pts.map((p) => p.value as number)));
  const gMax = Math.max(...series.flatMap((s) => s.pts.map((p) => p.value as number)));
  const yFor = (s: (typeof series)[number]) => {
    const vals = s.pts.map((p) => p.value as number);
    const lo = singleY ? gMin : Math.min(...vals, s.pts[0].refLow ?? vals[0]);
    const hi = singleY ? gMax : Math.max(...vals, s.pts[0].refHigh ?? vals[0]);
    const sp = hi - lo || 1;
    return (v: number) => H - PADY - ((v - lo) / sp) * (H - 2 * PADY);
  };
  if (!series.length)
    return (
      <div className="rr-card" style={{ margin: "6px 0" }}>
        <b>{panel.toUpperCase()}</b> — no graphable numeric components.{" "}
        <span className="ep-link" onClick={onGrid} style={{ cursor: "pointer" }}>Back to grid</span>
      </div>
    );
  return (
    <div style={{ margin: "6px 0", border: "1px solid var(--border-soft)" }} data-testid={`rr-graph-${panel.replace(/[^a-zA-Z0-9]+/g, "-")}`}>
      <div className="rr-section" style={{ display: "flex", alignItems: "center", background: "#dfe9f2", padding: "2px 6px" }}>
        <b style={{ fontSize: 10.5, color: "#2c4863" }}>{panel.toUpperCase()}</b>
        <span
          style={{ marginLeft: 8, cursor: "pointer" }}
          title="Switch this group back to grid"
          onClick={onGrid}
        >
          ▦
        </span>
        <label style={{ marginLeft: "auto", fontSize: 10.5 }}>
          <input type="checkbox" checked={singleY} onChange={() => setSingleY((v) => !v)} /> Single y-axis
        </label>
      </div>
      <div style={{ display: "flex" }}>
        <div style={{ width: 150, flexShrink: 0, padding: 4 }}>
          {series.map((s) => (
            <div
              key={s.row.key}
              style={{
                background: s.color + "22", borderLeft: `3px solid ${s.color}`, fontSize: 10.5,
                padding: "1px 4px", marginBottom: 2, display: "flex", justifyContent: "space-between",
              }}
            >
              {s.row.name}
              <span style={{ color: s.color }}>{s.marker}</span>
            </div>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ background: "#fff" }}>
          {allDates.map((d) => (
            <line key={d} x1={x(d)} y1={10} x2={x(d)} y2={H - PADY} stroke="#e4eaf0" />
          ))}
          {[...new Set(allDates.map((d) => d.slice(0, 10)))].map((d) => (
            <text key={d} x={x(d + "T12:00")} y={H - 8} fontSize="9.5" textAnchor="middle" fill="#5e6770">
              {fmtD(d)}
            </text>
          ))}
          {series.map((s) => {
            const y = yFor(s);
            return (
              <g key={s.row.key}>
                {s.pts.length > 1 && (
                  <polyline
                    points={s.pts.map((p) => `${x(p.datetime)},${y(p.value as number)}`).join(" ")}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="1.2"
                    opacity="0.65"
                  />
                )}
                {s.pts.map((p) => (
                  <circle
                    key={p.id}
                    cx={x(p.datetime)}
                    cy={y(p.value as number)}
                    r="5"
                    fill={s.color}
                    opacity={0.9}
                    onMouseEnter={() =>
                      setHover({
                        x: x(p.datetime),
                        y: y(p.value as number),
                        text: [
                          `${s.row.name}: ${p.value}${p.unit ? ` ${p.unit}` : ""}${p.flag ? ` (${p.flag})` : ""}`,
                          `Reference: ${s.row.ref || "—"} · ${fmtD(p.datetime.slice(0, 10))}`,
                        ],
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                  />
                ))}
              </g>
            );
          })}
          {hover && (
            <g pointerEvents="none">
              <rect x={Math.min(hover.x + 8, W - 250)} y={Math.max(hover.y - 36, 2)} width="245" height="30" fill="#fff" stroke="#9db3c8" rx="3" />
              <text x={Math.min(hover.x + 14, W - 244)} y={Math.max(hover.y - 22, 14)} fontSize="10.5" fill="#15181d">{hover.text[0]}</text>
              <text x={Math.min(hover.x + 14, W - 244)} y={Math.max(hover.y - 10, 26)} fontSize="9.5" fill="#5e6770">{hover.text[1]}</text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Result Details" modal (opens on VALUE click) — summary fields + embedded report.
// For ECG report-rows the embedded report is the ECG report (impression + discrete table).
// ---------------------------------------------------------------------------
function ResultDetails({ c, row, obs, onClose }: { c: Case; row: Row; obs: Observation; onClose: () => void }) {
  const isECG = row.kind === "report";
  const ecgRows = isECG
    ? ecgObs(c).filter((o) => o.datetime.slice(0, 10) === obs.datetime.slice(0, 10))
    : [];
  const impression = ecgRows.find((o) => /impression/i.test(o.name));
  const history = !isECG
    ? labs(c).filter((o) => (o.code || o.name) === row.key).sort((a, b) => b.datetime.localeCompare(a.datetime))
    : [];
  const status = obs.status === "final" ? "Final" : obs.status ?? "Final";
  return (
    <div className="modal-backdrop open" style={{ zIndex: 120 }} onClick={onClose} data-testid="rr-result-details">
      <div className="modal" style={{ width: 720, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Result Details — [{c.patient.name}]</span>
          <span style={{ cursor: "pointer" }} onClick={onClose}>✕</span>
        </div>
        <div className="modal-body" style={{ overflow: "auto" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ehr-blue-dk)", marginBottom: 6 }}>{row.name}</div>
          <div className="ep-kv2">
            <div className="ln"><span className="ep-k">Collected:</span> <span className="ep-v">{obs.datetime.replace("T", " ")}</span></div>
            <div className="ln"><span className="ep-k">Result status:</span> <span className="ep-v">{status}</span></div>
            <div className="ln"><span className="ep-k">Resulting lab:</span> <span className="ep-v">SIM CLINICAL LABORATORY</span></div>
            <div className="ln"><span className="ep-k">Reference range:</span> <span className="ep-v">{row.ref || "—"}</span></div>
            <div className="ln">
              <span className="ep-k">Value:</span>{" "}
              <span className={"ep-v " + fc(obs.flag)} style={{ border: "1px solid #d1ac11", background: obs.flag ? "var(--advisory-yellow)" : "#f4f7fa", padding: "0 6px", fontWeight: 700 }}>
                {obs.value}{obs.flag ? " !" : ""}
              </span>
            </div>
          </div>
          <hr style={{ border: "none", borderTop: "1px solid var(--border-soft)", margin: "8px 0" }} />
          {/* embedded report */}
          <div className="ep-letterhead">
            <div className="org">SimEHR Health Care</div>
            <div className="dept">SIM PRIMARY CARE CLINIC<br />1 Simulation Way, Anytown ST 00000</div>
            <div className="pt">
              {c.patient.name}<br />
              MRN: {c.patient.mrn}, DOB: {c.patient.dob}, Legal Sex: {c.patient.sex}
            </div>
          </div>
          <div className="ep-bighead">
            {row.panel}{obs.accession ? <span className="ref"> (Accession {obs.accession})</span> : null}
          </div>
          <div className="ep-indent">
            <div className="ep-ln"><span className="ep-dim">Status:</span> <b>{status} result</b> (Collected: {obs.datetime.replace("T", " ")})</div>
            {obs.specimen && <div className="ep-ln"><span className="ep-dim">Specimen:</span> <b>{obs.specimen}</b></div>}
          </div>
          {isECG ? (
            <>
              {impression && (
                <div className="ep-indent" style={{ marginTop: 6 }}>
                  <b>Impression:</b> {String(impression.value)}
                </div>
              )}
              <table className="rr-flowsheet" style={{ marginTop: 6 }}>
                <thead>
                  <tr><th className="comp-h">Component</th><th>Value</th><th>Units</th></tr>
                </thead>
                <tbody>
                  {ecgRows.filter((o) => o !== impression).map((o) => (
                    <tr key={o.id}>
                      <td className="comp" style={{ cursor: "default" }}>{o.name}</td>
                      <td className="val"><b>{o.value}</b></td>
                      <td>{o.unit ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <table className="rr-flowsheet" style={{ marginTop: 6 }}>
              <thead>
                <tr><th className="comp-h">Date</th><th>Value</th><th>Flag</th><th>Panel</th></tr>
              </thead>
              <tbody>
                {history.map((o) => (
                  <tr key={o.id} style={o.id === obs.id ? { outline: "2px solid var(--advisory-yellow-dk)" } : undefined}>
                    <td className="comp" style={{ cursor: "default" }}>{o.datetime.slice(0, 10)}</td>
                    <td className={"val " + fc(o.flag)}><b>{o.value}</b></td>
                    <td className={"val " + fc(o.flag)}>{o.flag ? `${o.flag}${arrow(o.flag)}` : ""}</td>
                    <td>{o.panel ?? "Lab"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" data-testid="rr-details-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// Live "Filter to:" pill set. Relative ranges anchor to the newest result date (the sim's
// effective "today") so old bench charts stay usable; a live chart anchors to the wall clock.
const RANGES: [string, number | null][] = [
  ["All Results", null], ["Today", 0], ["1 Week", 7], ["1 Month", 30], ["6 Months", 182], ["1 Year", 365],
];

// Results Review opens SCOPED, not showing every result the chart has ever held.
// In the FHIR original the agent had to name a date filter before it could see anything; an unscoped
// default deleted that error mode entirely (39/40 benchmark runs never touched a filter, 40/40 never
// used Chart Search). Widening is never *harmful* here, so what this actually measures is whether the
// agent NOTICES the view is scoped — a thoroughness check, not a pick-the-right-window puzzle. Measured
// on the 20-task sample, this default changes what is visible in 13 tasks and leaves 7 untouched.
const DEFAULT_RANGE_LABEL = "1 Month";
const DEFAULT_RANGE = RANGES.find(([l]) => l === DEFAULT_RANGE_LABEL)?.[1] ?? null;

export default function ResultsReview() {
  const c = useSim((s) => s.caseData);
  const [transpose, setTranspose] = useState(false);
  const [checked, setChecked] = useState<Set<string> | null>(null); // null = all on
  const [graphSel, setGraphSel] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<number | null>(DEFAULT_RANGE);
  const [colCount, setColCount] = useState(8);
  const [colOffset, setColOffset] = useState(0);
  const [reverseChrono, setReverseChrono] = useState(false); // live default: oldest → newest
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [mostRecentOpen, setMostRecentOpen] = useState(false);
  const [graphedPanels, setGraphedPanels] = useState<Set<string>>(new Set());
  const [collapsedPanels, setCollapsedPanels] = useState<Set<string>>(new Set());
  const [hiddenRows, setHiddenRows] = useState<Set<string>>(new Set());
  const [timeMark, setTimeMark] = useState<string | null>(null);
  const [markedAt, setMarkedAt] = useState<string | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [rangeLabel, setRangeLabel] = useState(DEFAULT_RANGE_LABEL);
  const [sinceMark, setSinceMark] = useState(false);
  const [sinceLastEnc, setSinceLastEnc] = useState(false);
  const [detail, setDetail] = useState<{ row: Row; obs: Observation } | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [allRows, setAllRows] = useState(false); // live "All Rows" checkbox (grid top-left)
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // tree panel expanders
  const [loadedAt, setLoadedAt] = useState<number>(() => Date.now()); // "↻ Xm ago" chip

  const tree = useMemo(() => (c ? buildTree(c) : null), [c]);
  if (!c || !tree) return null;
  if (!tree.panels.length) return <div className="rr-empty">No results to display.</div>;

  const isOn = (p: string) => (checked ? checked.has(p) : true);
  const togglePanel = (p: string) =>
    setChecked((prev) => {
      const base = prev ?? new Set(tree.panels);
      const next = new Set(base);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  const allOn = tree.panels.every(isOn);

  const newest = tree.dates[0];
  const lastEncDate = [...(c.encounters ?? [])].map((e) => e.date).sort().reverse()[0];
  const inRange = (d: string) => {
    if (sinceMark && timeMark) return d > timeMark;
    if (sinceLastEnc && lastEncDate) return d.slice(0, 10) >= lastEncDate;
    return range == null || (new Date(newest.slice(0, 10)).getTime() - new Date(d.slice(0, 10)).getTime()) / 86400000 <= range;
  };
  const dates = tree.dates.filter(inRange); // desc, full datetimes
  const jumpToDate = (target: string) => {
    if (!target) return;
    const i = dates.findIndex((d) => d.slice(0, 10) <= target);
    if (i >= 0) setColOffset(i);
  };
  const windowed = dates.slice(colOffset, colOffset + colCount);
  const displayDates = reverseChrono ? windowed : [...windowed].reverse();
  const maxOffset = Math.max(0, dates.length - colCount);

  const activePanels = tree.panels.filter(isOn);
  const labPanels = activePanels.filter((p) => tree.rootByPanel.get(p) === "LABORATORY");
  const cardioPanels = activePanels.filter((p) => tree.rootByPanel.get(p) === "CARDIOLOGY");
  const pending = pendingLabs(c);
  const newSinceMark = timeMark ? labs(c).filter((o) => o.datetime > timeMark).length : 0;

  const latestOf = (r: Row): Observation | undefined => {
    const ds = Object.keys(r.byDate).sort().reverse();
    return ds.length ? r.byDate[ds[0]] : undefined;
  };

  // Cell rendering: resulted cells = pale-blue
  // fill + blue left-edge bar; abnormal = red text + "!" glyph (NO border); critical
  // (flag HH/LL, none in this case) = solid red chip, white text, double-chevron.
  const glyph = (f?: string | null) => (f === "HH" ? "⏶" : f === "LL" ? "⏷" : f ? "!" : "");
  const isCrit = (f?: string | null) => f === "HH" || f === "LL";
  // An observation with an empty value is NOT a result. 76 cells across 36 cases carry `value: ""` —
  // components the analyser could not compute (a differential at WBC 0.1), qualitative fields left blank
  // (Interpretation, Fasting, TV Regurg). Keying only on "does the object exist" gave them the resulted
  // styling, a pointer cursor and a "Click for Result Details" tooltip that opens an empty Value chip,
  // making them indistinguishable from a real value the reader merely failed to see.
  const Cell = ({ o, row }: { o?: Observation; row: Row }) =>
    o && String(o.value ?? "").trim() !== "" ? (
      <td
        className={"val has" + (timeMark && o.datetime > timeMark ? " rr-new" : "")}
        style={{ cursor: "pointer" }}
        title="Click for Result Details"
        onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, o, ref: row.ref })}
        onMouseLeave={() => setTip(null)}
        onClick={() => { setTip(null); setDetail({ row, obs: o }); }}
      >
        {row.kind === "report" ? (
          <span title="Report result — click to open">🖹♥</span>
        ) : o.flag ? (
          <span className={isCrit(o.flag) ? "rr-crit" : "rr-abn"}>
            {String(o.value).length > 28 ? String(o.value).slice(0, 28) + "…" : o.value} {glyph(o.flag)}
          </span>
        ) : (
          <span>{String(o.value).length > 28 ? String(o.value).slice(0, 28) + "…" : o.value}</span>
        )}
      </td>
    ) : (
      <td className="val none">–</td>
    );

  const renderSection = (p: string) => {
    const rows = (tree.rowsByPanel.get(p) ?? []).filter(
      (r) => !hiddenRows.has(r.key) && (allRows || Object.keys(r.byDate).length > 0),
    );
    const hiddenCount = (tree.rowsByPanel.get(p) ?? []).length - rows.length;
    return (
      <Fragment key={p}>
        <tr className="rr-section">
          <td colSpan={displayDates.length + 2}>
            <b>{p.toUpperCase()}</b>
            <span
              style={{ marginLeft: 8, cursor: "pointer" }}
              title="Switch this group to graph"
              data-testid={`rr-section-graph-${p.replace(/[^a-zA-Z0-9]+/g, "-")}`}
              onClick={() => setGraphedPanels((prev) => new Set(prev).add(p))}
            >
              📊
            </span>
            <span
              style={{ marginLeft: 6, cursor: "pointer" }}
              title={collapsedPanels.has(p) ? "Expand group" : "Collapse group"}
              onClick={() =>
                setCollapsedPanels((prev) => {
                  const n = new Set(prev);
                  if (n.has(p)) n.delete(p);
                  else n.add(p);
                  return n;
                })
              }
            >
              {collapsedPanels.has(p) ? "⌄" : "⌃"}
            </span>
            {hiddenCount > 0 && (
              <span
                className="ep-link"
                style={{ marginLeft: 8, cursor: "pointer", fontWeight: 400 }}
                onClick={() =>
                  setHiddenRows((prev) => {
                    const n = new Set(prev);
                    for (const r of tree.rowsByPanel.get(p) ?? []) n.delete(r.key);
                    return n;
                  })
                }
              >
                {hiddenCount} hidden — show
              </span>
            )}
          </td>
        </tr>
        {!collapsedPanels.has(p) &&
          (graphedPanels.has(p) ? (
            <tr>
              <td colSpan={displayDates.length + 2} style={{ padding: 0 }}>
                <SectionGraph
                  c={c}
                  panel={p}
                  rows={graphSel.size ? rows.filter((r) => graphSel.has(r.key)) : rows}
                  onGrid={() => {
                    setGraphedPanels((prev) => {
                      const n = new Set(prev);
                      n.delete(p);
                      return n;
                    });
                    setGraphSel(new Set());
                  }}
                />
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.key} data-testid={`flow-row-${r.code ?? r.name}`} className="rr-comp-row">
                <td className="comp" title={r.ref ? `Reference: ${r.ref}` : undefined}>
                  {r.name}
                  <span className="rr-row-icons">
                    <span
                      title="View as graph"
                      data-testid={`rr-row-graph-${(r.code ?? r.name).replace(/[^a-zA-Z0-9]+/g, "-")}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setGraphSel(new Set([r.key]));
                        setGraphedPanels((prev) => new Set(prev).add(p));
                      }}
                    >
                      📊
                    </span>
                    <span
                      title="Collapse (hide) this row"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHiddenRows((prev) => new Set(prev).add(r.key));
                      }}
                    >
                      ⌃
                    </span>
                  </span>
                </td>
                {mostRecentOpen ? <Cell o={latestOf(r)} row={r} /> : <td className="val none">…</td>}
                {displayDates.map((d) => (
                  <Cell key={d} o={r.byDate[d]} row={r} />
                ))}
              </tr>
            ))
          ))}
      </Fragment>
    );
  };

  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* toolbar — reference set */}
      <div className="report-toolbar rr-toolbar" style={{ overflow: "visible", position: "relative", zIndex: 45 }}>
        <span className="rt-btn" title="Filters">⧩</span>
        <div style={{ position: "relative" }}>
          <div className="rt-btn" data-testid="rr-select-view" onClick={() => { setViewOpen((o) => !o); setRangeOpen(false); setGotoOpen(false); }}>
            Select View ▾
          </div>
          {viewOpen && (
            <div className="rr-card" style={{ position: "absolute", top: "100%", left: 0, zIndex: 40, width: 190, padding: 4, background: "#fff", boxShadow: "0 2px 8px rgba(20,40,60,.25)" }}>
              <div style={{ fontSize: 10.5, color: "#51626f", padding: "2px 4px", borderBottom: "1px solid var(--border-soft)" }}>View Editor</div>
              <div className="rt-btn" onClick={() => setViewOpen(false)}>➕ New View</div>
              <div className="rt-btn" onClick={() => setViewOpen(false)}>👥 Manage Views</div>
            </div>
          )}
        </div>
        <span className="rt-sep" />
        <div style={{ position: "relative" }}>
          <div className="rt-btn" data-testid="rr-range-dropdown" onClick={() => { setRangeOpen((o) => !o); setGotoOpen(false); setViewOpen(false); }}>
            🕐 {rangeLabel} ▾
          </div>
          {rangeOpen && (
            <div className="rr-card" style={{ position: "absolute", top: "100%", left: 0, zIndex: 40, width: 360, padding: 8, background: "#fff", boxShadow: "0 2px 8px rgba(20,40,60,.25)" }} data-testid="rr-filter-to">
              <div style={{ fontSize: 10.5, color: "#51626f", marginBottom: 4 }}>Filter to: ⓘ</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {[
                  ["All Results", () => { setRange(null); setSinceMark(false); setSinceLastEnc(false); }],
                  ["Since Time Mark", () => { setSinceMark(true); setSinceLastEnc(false); setRange(null); }],
                  ["Since Last Encounter", () => { setSinceLastEnc(true); setSinceMark(false); setRange(null); }],
                  ...RANGES.filter(([l]) => l !== "All Results").map(([l, d]) => [l, () => { setRange(d as number | null); setSinceMark(false); setSinceLastEnc(false); }] as const),
                ].map(([label, apply]) => (
                  <span
                    key={label as string}
                    className={"rt-btn" + (rangeLabel === label ? " rt-pill active" : "")}
                    style={{ display: "inline-block" }}
                    data-testid={`rr-range-${(label as string).replace(/\s+/g, "-")}`}
                    onClick={() => {
                      (apply as () => void)();
                      setRangeLabel(label as string);
                      setColOffset(0);
                      setRangeOpen(false);
                    }}
                  >
                    {label as string}
                  </span>
                ))}
              </div>
              <div style={{ marginTop: 6 }}>
                <span className="ep-link" style={{ cursor: "pointer", fontSize: 11 }} onClick={() => { setRangeOpen(false); setGotoOpen(true); }}>
                  Specific start date
                </span>
              </div>
            </div>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <div className="rt-btn" data-testid="rr-goto" onClick={() => { setGotoOpen((o) => !o); setRangeOpen(false); setViewOpen(false); }}>
            📅 ▾
          </div>
          {gotoOpen && (
            <div className="rr-card" style={{ position: "absolute", top: "100%", left: 0, zIndex: 40, padding: 8, background: "#fff", boxShadow: "0 2px 8px rgba(20,40,60,.25)" }}>
              <label style={{ fontSize: 10.5, color: "#51626f" }}>
                Go to:{" "}
                <input
                  type="date"
                  data-testid="rr-goto-date"
                  onChange={(e) => {
                    jumpToDate(e.target.value);
                    setGotoOpen(false);
                  }}
                  style={{ fontSize: 11 }}
                />
              </label>
            </div>
          )}
        </div>
        <div
          className={"rt-btn" + (graphedPanels.size === 0 ? " rt-pill active" : "")}
          data-testid="rr-toggle-grid"
          title="Switch all groups back to grids"
          onClick={() => { setGraphedPanels(new Set()); setGraphSel(new Set()); }}
        >
          ▦
        </div>
        <div
          className={"rt-btn" + (graphedPanels.size > 0 ? " rt-pill active" : "")}
          data-testid="rr-toggle-graph"
          title="Switch all groups to graphs"
          onClick={() => { setGraphedPanels(new Set(activePanels)); setGraphSel(new Set()); }}
        >
          ▨
        </div>
        <span className="rt-spacer" />
        <div className="rt-btn" data-testid="rr-options" onClick={() => setOptionsOpen((o) => !o)}>⚙ Options ▾</div>
        <div className="rt-btn" data-testid="rr-timemark" onClick={() => { setTimeMark(newest); setMarkedAt(new Date().toLocaleTimeString()); }}>
          ⏱ Time Mark{markedAt ? ` ✓ ${markedAt}` : ""}
        </div>
        <span className="rt-btn" title="Refresh" data-testid="rr-refresh" onClick={() => setLoadedAt(Date.now())}>
          ↻ {Math.round((Date.now() - loadedAt) / 60000) < 1 ? "Just now" : `${Math.round((Date.now() - loadedAt) / 60000)}m ago`}
        </span>
      </div>

      {optionsOpen && (
        <div className="rr-card" style={{ margin: "4px 8px", padding: 8 }} data-testid="rr-options-panel">
          <label style={{ marginRight: 16 }}>
            <input type="checkbox" checked={transpose} data-testid="rr-dates-as-rows" onChange={() => setTranspose((t) => !t)} /> Dates as Rows (transpose)
          </label>
          <label style={{ marginRight: 16 }}>
            <input type="checkbox" checked={reverseChrono} onChange={() => setReverseChrono((v) => !v)} /> Trend Dates in reverse chronological order
          </label>
          <label style={{ marginRight: 16 }}>
            Default column count{" "}
            <input
              type="number"
              min={1}
              max={20}
              value={colCount}
              data-testid="rr-colcount"
              onChange={(e) => setColCount(Math.max(1, Number(e.target.value) || 8))}
              style={{ width: 44 }}
            />
          </label>
          <label>
            <input type="checkbox" checked={mostRecentOpen} data-testid="rr-mostrecent-toggle" onChange={() => setMostRecentOpen((v) => !v)} /> Most Recent column
          </label>
          {timeMark && (
            <span style={{ color: "var(--text-muted)", marginLeft: 12 }} data-testid="rr-newsince">
              {newSinceMark} new since Time Mark
            </span>
          )}
        </div>
      )}

      <div className="rr-body" style={{ flex: 1, minHeight: 0 }}>
        {/* left tree — data-driven roots; only categories with data render */}
        <div className="rr-tree" data-testid="rr-tree" style={{ display: "flex", flexDirection: "column" }}>
          <div className="rr-cat">
            <label>
              <input
                type="checkbox"
                checked={allOn}
                data-testid="rr-tree-all"
                onChange={() => setChecked(allOn ? new Set() : null)}
              />{" "}
              LABORATORY
            </label>
          </div>
          {tree.panels
            .filter((p) => tree.rootByPanel.get(p) === "LABORATORY")
            .map((p) => (
              <Fragment key={p}>
                <label className="rr-node" data-testid={`rr-tree-${p.replace(/[^a-zA-Z0-9]+/g, "-")}`}>
                  <span
                    style={{ cursor: "pointer", width: 10, display: "inline-block" }}
                    onClick={(e) => {
                      e.preventDefault();
                      setExpanded((prev) => {
                        const n = new Set(prev);
                        if (n.has(p)) n.delete(p);
                        else n.add(p);
                        return n;
                      });
                    }}
                  >
                    {expanded.has(p) ? "▼" : "▶"}
                  </span>
                  <input type="checkbox" checked={isOn(p)} onChange={() => togglePanel(p)} />{" "}
                  {p} <span style={{ color: "var(--text-muted)" }}>({tree.rowsByPanel.get(p)?.length ?? 0})</span>
                </label>
                {expanded.has(p) &&
                  (tree.rowsByPanel.get(p) ?? []).map((r) => (
                    <label key={r.key} className="rr-node" style={{ paddingLeft: 34, fontSize: 10.5 }}>
                      <input
                        type="checkbox"
                        checked={!hiddenRows.has(r.key)}
                        onChange={() =>
                          setHiddenRows((prev) => {
                            const n = new Set(prev);
                            if (n.has(r.key)) n.delete(r.key);
                            else n.add(r.key);
                            return n;
                          })
                        }
                      />{" "}
                      {r.name}
                    </label>
                  ))}
              </Fragment>
            ))}
          {tree.panels.some((p) => tree.rootByPanel.get(p) === "CARDIOLOGY") ? (
            <>
              <div className="rr-cat" style={{ marginTop: 6 }}>CARDIOLOGY</div>
              {tree.panels
                .filter((p) => tree.rootByPanel.get(p) === "CARDIOLOGY")
                .map((p) => (
                  <label key={p} className="rr-node" data-testid={`rr-tree-${p.replace(/[^a-zA-Z0-9]+/g, "-")}`}>
                    <span style={{ width: 10, display: "inline-block" }}>▶</span>
                    <input type="checkbox" checked={isOn(p)} onChange={() => togglePanel(p)} /> ECG
                  </label>
                ))}
            </>
          ) : null}
          {/* live tree footer: Expand / Collapse All + Not Resulted ⓘ + 🧪 pending count */}
          <div style={{ marginTop: "auto", paddingTop: 10 }}>
            <div style={{ display: "flex", gap: 4, padding: "4px 6px" }}>
              <span className="rt-btn" data-testid="rr-expand-all" onClick={() => setExpanded(new Set(tree.panels))}>Expand</span>
              <span className="rt-btn" data-testid="rr-collapse-all" onClick={() => setExpanded(new Set())}>Collapse All</span>
            </div>
            <div style={{ padding: "2px 8px", color: "var(--ehr-blue-dk)", fontSize: 11 }}>Not Resulted ⓘ</div>
            {pending.length > 0 && (
              <div style={{ padding: "0 8px 6px", textAlign: "center", fontSize: 11 }} data-testid="rr-pending-count">
                🧪 <b style={{ fontSize: 14 }}>{pending.length}</b>
                <div style={{ color: "var(--text-muted)" }}>Labs</div>
              </div>
            )}
          </div>
        </div>

        {/* main */}
        <div className="rr-main" style={{ overflow: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {transpose ? (
              <table className="rr-flowsheet" data-testid="flowsheet">
                <thead>
                  <tr>
                    <th className="comp-h">Date</th>
                    {[...labPanels, ...cardioPanels]
                      .flatMap((p) => (tree.rowsByPanel.get(p) ?? []).filter((r) => !hiddenRows.has(r.key)))
                      .map((r) => (
                        <th key={r.key} title={r.ref}>{r.name}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {displayDates.map((d) => (
                    <tr key={d} data-testid={`flow-date-${d}`}>
                      <td className="comp" style={{ cursor: "default" }}>{fmtD(d.slice(0, 10))} {d.slice(11, 16)}</td>
                      {[...labPanels, ...cardioPanels]
                        .flatMap((p) => (tree.rowsByPanel.get(p) ?? []).filter((r) => !hiddenRows.has(r.key)))
                        .map((r) => (
                          <Cell key={r.key} o={r.byDate[d]} row={r} />
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <>
                <div style={{ fontSize: 10.5, padding: "1px 4px" }}>
                  <label>
                    <input type="checkbox" checked={allRows} data-testid="rr-all-rows" onChange={() => setAllRows((v) => !v)} /> All Rows
                  </label>
                </div>
                <table className="rr-flowsheet" data-testid="flowsheet">
                  <thead>
                    {/* live header: year row above date/time two-line columns */}
                    <tr>
                      <th className="comp-h" style={{ borderBottom: "none" }}></th>
                      <th style={{ borderBottom: "none" }}></th>
                      {yearSpans(displayDates).map(([y, span], i) => (
                        <th key={y + i} colSpan={span} style={{ textAlign: "left", background: "#dfe6ee" }}>
                          {y}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th className="comp-h">Component</th>
                      <th
                        onClick={() => setMostRecentOpen((v) => !v)}
                        style={{ cursor: "pointer" }}
                        title={mostRecentOpen ? "Collapse Most Recent" : "Expand Most Recent"}
                      >
                        {mostRecentOpen ? "Most Recent ◂" : "▸"}
                      </th>
                      {displayDates.map((d) => (
                        <th key={d}>
                          <div>{fmtD(d.slice(0, 10))}</div>
                          <div style={{ fontWeight: 400, color: "var(--text-muted)" }}>{d.slice(11, 16)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {labPanels.map(renderSection)}
                    {cardioPanels.map(renderSection)}
                  </tbody>
                </table>
              </>
            )}

            {pending.length > 0 && (
              <div className="rr-card" style={{ marginTop: 8 }} data-testid="rr-not-resulted">
                <b>Not Resulted</b>
                {pending.map((o) => (
                  <div key={o.id} style={{ fontSize: 11 }}>
                    🧪 {o.name} — {o.status} · {o.datetime.slice(0, 10)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* bottom pager — live: ⏮ ◀◀ ◀ at far left, ▶ ▶▶ ⏭ far right, astride the scrollbar */}
          <div
            style={{ display: "flex", alignItems: "center", borderTop: "1px solid var(--border-soft)", padding: "1px 2px", background: "#f4f7fa" }}
            data-testid="rr-pager"
            title={dates.length ? `${Math.min(colOffset + 1, dates.length)}–${Math.min(colOffset + colCount, dates.length)} of ${dates.length} result columns` : "no result columns"}
          >
            <span className="rt-btn" title="Oldest" data-testid="rr-pager-oldest" onClick={() => setColOffset(maxOffset)}>⏮</span>
            <span className="rt-btn" title="Page older" onClick={() => setColOffset((o) => Math.min(maxOffset, o + colCount))}>◀◀</span>
            <span className="rt-btn" title="One older" onClick={() => setColOffset((o) => Math.min(maxOffset, o + 1))}>◀</span>
            <span style={{ flex: 1, height: 8, margin: "0 6px", background: "#dfe6ee", borderRadius: 4 }} />
            <span className="rt-btn" title="One newer" onClick={() => setColOffset((o) => Math.max(0, o - 1))}>▶</span>
            <span className="rt-btn" title="Page newer" onClick={() => setColOffset((o) => Math.max(0, o - colCount))}>▶▶</span>
            <span className="rt-btn" title="Newest" data-testid="rr-pager-newest" onClick={() => setColOffset(0)}>⏭</span>
          </div>
        </div>
      </div>

      {detail && <ResultDetails c={c} row={detail.row} obs={detail.obs} onClose={() => setDetail(null)} />}

      {tip && (
        <div className="rr-tip" style={{ position: "fixed", left: tip.x + 12, top: tip.y + 12, zIndex: 50 }} data-testid="rr-tooltip">
          <b>{tip.o.name}</b>: {tip.o.value}
          {tip.o.unit ? ` ${tip.o.unit}` : ""}
          {tip.o.flag ? ` (${tip.o.flag}${arrow(tip.o.flag)})` : ""}
          <br />
          Reference: {tip.ref || "—"}
          {rangePos(tip.o) ? <> · {rangePos(tip.o)}</> : null}
          <br />
          <span style={{ color: "var(--text-muted)" }}>{tip.o.datetime.replace("T", " ")} · {tip.o.panel}</span>
        </div>
      )}
    </div>
  );
}
