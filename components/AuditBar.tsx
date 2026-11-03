"use client";

import { useState } from "react";
import { useSim } from "@/lib/store";

export default function AuditBar() {
  const audit = useSim((s) => s.audit);
  const [open, setOpen] = useState(false);
  const latest = audit.length ? audit[audit.length - 1] : null;

  return (
    <>
      <div className="audit-bar" data-testid="audit-bar" onClick={() => setOpen((o) => !o)}>
        <span className="label">AUDIT</span>
        <span className="latest">
          {latest ? `${latest.actor} · ${latest.action}${latest.detail ? ` · ${latest.detail}` : ""}` : "No actions yet."}
        </span>
        <span className="hint">click to {open ? "collapse ▼" : "expand ▲"}</span>
      </div>
      <div className={"audit-panel" + (open ? " open" : "")}>
        <div>
          {audit.map((a, i) => (
            <div key={i} className="audit-entry">
              <span className="ts">{a.ts.slice(11, 19)}</span>
              <span className={"actor-" + a.actor}>{a.actor}</span>
              <span>{a.action}</span>
              <span style={{ color: "#7a8a99" }}>{a.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
