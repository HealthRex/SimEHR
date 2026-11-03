"use client";

import { useState } from "react";
import { useSim, openMainMenu, openSearch, openAlert, ackAlert, log } from "@/lib/store";

// No case switcher or reset control in the title bar.
// Cases are switched via ?case=<id>, window.SimEHR.loadCase(), or Patient Lists → Open Chart.
// The signed-in clinician + department come from the loaded case (per task), not a hardcoded user.
export default function TitleBar() {
  const c = useSim((s) => s.caseData);
  const [notif, setNotif] = useState(false);
  const acked = useSim((s) => s.alertsAcked);
  const dept = c?.department ?? "General Medicine";
  const provider = c?.provider ?? "SIM Physician";
  // The bell lists recent activity: the same items the patient sidebar shows, so the
  // control works without putting anything new in front of the agent. Each can be opened and acknowledged.
  const items = c?.recentActivity ?? [];
  const open = items.filter((_, i) => !acked.includes(i)).length;
  function toggleNotif() {
    if (!notif) log("human", "open_notifications", `${open} open`);
    setNotif((v) => !v);
  }
  return (
    <div className="titlebar">
      {/* The wordmark is SimEHR, not the vendor this environment is modelled on: the layout is an
          imitation for research, and shipping the real trademark in a published artifact would
          misrepresent it as the vendor's product. */}
      <div className="hamburger" title="SimEHR menu" data-testid="main-menu-button" onClick={() => openMainMenu("human")}>≡</div>
      <div className="logo-cell" data-testid="app-logo" onClick={() => openMainMenu("human")}>
        <span className="e">S</span>SimEHR
      </div>
      <div className="crumb" data-testid="env-crumb">{dept} – {provider}</div>
      <div className="t-spacer" />
      <div className="search" data-testid="topbar-search" title="Search (Ctrl+K)" onClick={() => openSearch("human")}>
        <span>🔍</span>
        <span className="ph">Search (Ctrl+K)</span>
      </div>
      <div className="t-spacer" />
      <div className="icons">
        <div className="tico" data-testid="topbar-alerts" title="Alerts" onClick={toggleNotif}>
          🔔{open > 0 && <span className="badge" data-testid="alerts-badge">{open}</span>}
        </div>
        {notif && (
          <>
            <div className="notif-backdrop" data-testid="notifications-backdrop" onClick={() => setNotif(false)} />
            <div className="notif-pop" data-testid="notifications">
              <div className="nh">Alerts · recent activity</div>
              {items.length ? (
                items.map((t, i) => {
                  const done = acked.includes(i);
                  return (
                    <div key={i} className={"ni" + (done ? " done" : "")} data-testid={`alert-${i}`}>
                      <div className="nt">{t}</div>
                      <div className="na">
                        <span className="ep-link" data-testid={`alert-open-${i}`} onClick={() => { setNotif(false); openAlert(i, "human"); }}>Open</span>
                        {done ? (
                          <span className="ack">✓ Acknowledged</span>
                        ) : (
                          <span className="ep-link" data-testid={`alert-ack-${i}`} onClick={() => ackAlert(i, "human")}>Acknowledge</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="ni dim">No alerts.</div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="win">
        <span title="Help">?</span>
      </div>
    </div>
  );
}
