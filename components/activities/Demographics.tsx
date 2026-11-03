"use client";

// Demographics — layout: section jump-nav +
// 9 pill-headed sections (Basics · Employer and Identification · Patient Contacts ·
// Pharmacies and Labs · SimEHR Information · Patient Lists · Advance Directives ·
// Code Status · PO/NPO Status). Entirely data-driven; absent data renders the native
// empty forms ("—", "(None on File)") — never fabricated.

import { useRef } from "react";
import { useSim } from "@/lib/store";
import type { Encounter, Patient } from "@/lib/types";

function fmtDob(d?: string): string {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${+m[2]}/${+m[3]}/${m[1]}` : d;
}

function mostRecentEncounter(encounters?: Encounter[]): Encounter | undefined {
  if (!encounters?.length) return undefined;
  return [...encounters].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
}

const legalSex = (sex?: Patient["sex"]) => (sex === "F" ? "Female" : sex === "M" ? "Male" : sex ?? "—");

const SECTIONS = [
  "Basics", "Employer and Identification", "Patient Contacts", "Pharmacies and Labs",
  "SimEHR Information", "Patient Lists", "Advance Directives", "Code Status", "PO/NPO Status",
];
const slug = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();

// Teal pill section header + white card .
function Section({ title, icon, edit, children }: { title: string; icon?: string; edit?: boolean; children: React.ReactNode }) {
  return (
    <div
      id={`demo-sec-${slug(title)}`}
      style={{ background: "#fff", border: "1px solid var(--border-soft)", borderLeft: "3px solid #0e8a8a", marginBottom: 10 }}
    >
      <div style={{ padding: "6px 8px 0" }}>
        <span
          style={{
            background: "#d9efef", color: "#0e6b6b", fontWeight: 700, fontSize: 12,
            padding: "2px 10px", borderRadius: 12, display: "inline-block",
          }}
        >
          {icon ? `${icon} ` : ""}{title} {edit !== false && <span style={{ fontWeight: 400 }}>✎</span>}
        </span>
      </div>
      <div style={{ padding: "8px 12px 10px" }}>{children}</div>
    </div>
  );
}

// Blue underlined sub-header (live "Communication" / "Additional" / "Employer Information").
const Sub = ({ t, right }: { t: string; right?: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #9db3c8", margin: "6px 0 4px" }}>
    <span style={{ color: "#1c5f8f", fontWeight: 700, fontSize: 11.5 }}>{t}</span>
    <span style={{ flex: 1 }} />
    {right}
  </div>
);

// Live renders plain values under gray labels (no input-style boxes).
const KV = ({ l, v, k }: { l: string; v?: React.ReactNode; k?: string }) => (
  <div className="demo-field">
    <label>{l}</label>
    <div
      className="val"
      style={{ border: "none", background: "transparent", padding: "1px 0", minHeight: 16 }}
      data-testid={k ? `demo-${k}` : undefined}
    >
      {v || "—"}
    </div>
  </div>
);

// Empty-table helper (column headers render even with no rows).
const HeadTable = ({ cols, row }: { cols: string[]; row?: React.ReactNode[] }) => (
  <table className="mini" style={{ marginTop: 2 }}>
    <thead>
      <tr>{cols.map((h) => <th key={h}>{h}</th>)}</tr>
    </thead>
    <tbody>
      {row ? <tr>{row.map((r, i) => <td key={i}>{r}</td>)}</tr> : null}
    </tbody>
  </table>
);

export default function Demographics() {
  const c = useSim((s) => s.caseData);
  const wrap = useRef<HTMLDivElement>(null);
  if (!c) return null;
  const p = c.patient;
  const enc = mostRecentEncounter(c.encounters);
  const initials = (p.preferred?.[0] ?? p.name[0] ?? "") + (p.name.split(",")[0]?.[0] ?? "");

  const jump = (t: string) =>
    wrap.current?.querySelector(`#demo-sec-${slug(t)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div ref={wrap} data-testid="demographics" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* section jump-nav (live strip under the activity title) */}
      <div style={{ display: "flex", gap: 14, padding: "4px 12px", borderBottom: "1px solid var(--border-soft)", background: "#eef4fa", fontSize: 11.5, flexWrap: "wrap" }} data-testid="demo-nav">
        {SECTIONS.map((s) => (
          <span key={s} style={{ cursor: "pointer", color: "#1c5f8f" }} onClick={() => jump(s)}>{s}</span>
        ))}
      </div>

      <div className="pane-pad" style={{ flex: 1, overflow: "auto", background: "#f4f7fa" }}>
        {/* 1 · Basics */}
        <Section title="Basics" icon="🪪">
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <div
              style={{
                width: 84, height: 84, borderRadius: "50%", background: "#e4ebf1", color: "#8ba0b0",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div className="demo-grid" style={{ flex: 1 }} data-testid="demographics-grid">
              <KV l="Name" v={p.legal ?? p.name} k="legal-name" />
              <KV l="Date of Birth" v={`${fmtDob(p.dob)}${p.age != null ? ` (${p.age} y)` : ""}`} k="dob" />
              <KV l="Legal Sex" v={legalSex(p.sex)} k="legal-sex" />
            </div>
          </div>
          <Sub t="Communication" right={<span className="ep-link" style={{ fontSize: 11, cursor: "pointer" }}>↗ Comm. Preferences</span>} />
          <div className="demo-grid">
            <KV l="Address" v={p.address} k="address" />
            <KV l="Phone" v={(p.phones ?? []).map((x) => `${x.num} (${(x.label ?? "")[0] ?? ""})`).join(" · ")} k="phone" />
            <KV l="Email" v={p.email} k="email" />
          </div>
          <Sub t="Additional" />
          <div className="demo-grid">
            <KV l="Preferred Language" v={p.language} k="language" />
            <KV l="Written Language" />
            <KV l="Interpreter Needed" />
            <KV l="Religion" />
            <KV l="Maiden Name" />
            <KV l="Ethnicity" v={p.ethnicity} />
            <KV l="Race" v={p.race} />
            <KV l="Preferred Name" v={p.preferred} k="preferred-name" />
            <KV l="Marital Status" />
            <KV l="Comments" />
            <KV l="Pronouns" v={p.pronouns} k="pronouns" />
          </div>
        </Section>

        {/* 2 · Employer and Identification */}
        <Section title="Employer and Identification" icon="🏢">
          <div style={{ display: "flex", gap: 40 }}>
            <div style={{ flex: 1 }}>
              <Sub t="Employer Information" />
              <div className="demo-grid">
                <KV l="Employer" v={p.employer} k="employer" />
                <KV l="Employment Status" />
                <KV l="Address" />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <Sub t="Patient Identification" />
              <div className="demo-grid">
                <KV l="Patient Status" v="Alive" />
                <KV l="MRN" v={p.mrn} k="mrn" />
                <KV l="Patient Type" />
                <KV l="Encounter ID (this encounter)" v={enc?.id} k="encounter-id" />
              </div>
            </div>
          </div>
        </Section>

        {/* 3 · Patient Contacts */}
        <Section title="Patient Contacts" icon="👥">
          {p.emergencyContact ? (
            <div className="demo-grid">
              <KV l="Emergency Contact" v={p.emergencyContact} k="emergency-contact" />
            </div>
          ) : (
            <div style={{ fontSize: 11.5 }}>
              <div style={{ color: "var(--text-muted)" }}>Patient Contacts (None on File)</div>
              <div><b>Reason for no patient contacts:</b> —</div>
            </div>
          )}
        </Section>

        {/* 4 · Pharmacies and Labs */}
        <Section title="Pharmacies and Labs" icon="🏪">
          <div style={{ display: "flex", gap: 40 }}>
            <div style={{ flex: 1 }}>
              <Sub t="Pharmacies" />
              <HeadTable cols={["Rank", "Name", "Phone", "Address"]} />
              <div style={{ color: "var(--text-muted)" }}>None</div>
            </div>
            <div style={{ flex: 1 }}>
              <Sub t="Labs" />
              <div style={{ color: "var(--text-muted)" }}>None</div>
            </div>
          </div>
        </Section>

        {/* 5 · SimEHR Information */}
        <Section title="SimEHR Information" icon="ⓘ">
          <div className="demo-grid">
            <KV l="Primary Location" v={enc?.department} />
            <KV l="SimEHR Patient" v="Yes" />
            <KV l="Access Restrictions" v="No" />
            <KV l="PCP" v={p.pcp} k="pcp" />
            <KV l="Coverage" v={p.coverage} k="coverage" />
          </div>
        </Section>

        {/* 6 · Patient Lists */}
        <Section title="Patient Lists" icon="≡" edit={false}>
          <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>None</div>
          <span className="ep-link" style={{ fontSize: 11.5, cursor: "pointer" }}>✎ Edit patient list memberships</span>
        </Section>

        {/* 7 · Advance Directives */}
        <Section title="Advance Directives" icon="📄">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <input placeholder="Select a Document Type" style={{ fontSize: 11.5, padding: "2px 6px", border: "1px solid var(--border-soft)", width: 180 }} readOnly />
            <span className="rt-btn">➕ Add</span>
            <span style={{ flex: 1 }} />
            <label style={{ fontSize: 11 }}><input type="checkbox" /> Show All Documents</label>
            <span className="rt-btn" title="Refresh">↻</span>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            {["1 Advance Directives and Living Will", "2 Power of Attorney", "3 Admin POLST", "4 Admin Advance Directive", "5 What Matters Most Letter", "6 Admin Conservatorship/…"].map((b) => (
              <span key={b} className="rt-btn" style={{ border: "1px solid var(--border-soft)" }}>➕ {b}</span>
            ))}
          </div>
          <HeadTable cols={["ID", "Type", "Status", "Level", "Group", "Location", "Received By", "Received On", "Effective On", "Expires On"]} />
          <div style={{ fontStyle: "italic", color: "var(--text-muted)", fontSize: 10.5, margin: "4px 0" }}>
            Double-click to acquire/view a document
          </div>
          <span className="rt-btn" style={{ border: "1px solid var(--border-soft)" }}>✔ Mark Reviewed</span>{" "}
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Never Reviewed</span>
        </Section>

        {/* 8 · Code Status */}
        <Section title="Code Status" icon="📟" edit={false}>
          <Sub t="Current Code Status" />
          <HeadTable cols={["Date Active", "Code Status", "Order ID", "Comments", "User", "Context"]} row={["—", "—", "—", "—", "—", "—"]} />
          <Sub t="Code Status History" />
          <HeadTable cols={["Date Active", "Date Inactive", "Code Status", "Order ID", "Comments", "User", "Context"]} />
          <span className="ep-link" style={{ fontSize: 11.5, cursor: "pointer" }}>Advance Care Planning Activity ↗</span>
        </Section>

        {/* 9 · PO/NPO Status */}
        <Section title="PO/NPO Status" icon="🍽" edit={false}>
          <Sub t="PO/NPO Status" />
          <HeadTable cols={["Latest PO/NPO Status", "Start Time", "End Time", "Provider"]} row={["—", "—", "—", "—"]} />
        </Section>
      </div>
    </div>
  );
}
