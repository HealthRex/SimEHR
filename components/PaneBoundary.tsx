"use client";
import React from "react";

/**
 * Contains a render error to the one activity pane that threw.
 *
 * Without this, a single unguarded dereference unmounts the ENTIRE React root — title bar, patient sidebar,
 * right rail, everything — and the page stays dead for the rest of the browser session. That is not a
 * hypothetical: four cases shipped notes keyed `date` instead of `datetime`, so the Notes/Trans sort
 * comparator threw on `b.datetime.localeCompare`, and because the harness reuses one Playwright page per
 * job, the blank screen was inherited by all 14 subsequent tasks. They scored 0 with an empty deliverable
 * and were recorded as ordinary agent failures — window.SimEHR lives on `window`, independent of the React
 * tree, so the grading oracle kept answering normally against a dead DOM.
 *
 * Production EHRs behave this way too: an activity that fails shows an error inside its workspace, it does not blank
 * the chart. Keeping the shell alive also keeps the harness's liveness probe (the patient sidebar's `pt-name`)
 * meaningful — a probe that only fires when the whole app is gone cannot distinguish the two cases.
 *
 * Resets on `resetKey`, which must identify the CASE as well as the activity. Keying on the activity alone
 * made a tripped boundary CONTAGIOUS across benchmark episodes: all 100 tasks open on "chart-review" and
 * the harness's reset() returns there too, so the error state survived resetState() + loadCase() and the
 * next episode inherited a dead pane on a perfectly good chart — the same cascade the boundary was added
 * to stop, one level down.
 */
export class PaneBoundary extends React.Component<
  { children: React.ReactNode; resetKey?: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="pane-error" data-testid="pane-error" style={{ padding: 24, color: "#7a2020" }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>This activity could not be displayed.</div>
        <div style={{ fontSize: 12, color: "#666" }}>
          The chart is still open — use another activity, or contact your system administrator.
        </div>
        <div style={{ fontSize: 11, color: "#999", marginTop: 10, fontFamily: "monospace" }}>
          {this.state.error.message}
        </div>
      </div>
    );
  }
}
