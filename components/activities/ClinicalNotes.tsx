"use client";

import { useState } from "react";
import { useSim, togglePill, applyNormalExam, clearExam, saveDeliverable, signNote, setNoteDraft, log } from "@/lib/store";
import { EXAM_SECTIONS, examProse } from "@/lib/noteTemplate";

export default function ClinicalNotes() {
  const c = useSim((s) => s.caseData);
  const exam = useSim((s) => s.noteExam);
  const ap = useSim((s) => s.noteDraft);
  const [examOpen, setExamOpen] = useState(true);
  if (!c) return null;
  const prose = examProse(exam);

  return (
    <div className="pane-pad" data-testid="notewriter">
      <div className="nw-toolbar">
        <button className="btn" data-testid="nw-clear" onClick={() => clearExam("human")}>
          ⌫ Clear Exam
        </button>
        <button className="btn macro-play" data-testid="nw-macro-normal" onClick={() => applyNormalExam("human")}>
          ▶ Apply &ldquo;Normal Exam&rdquo;
        </button>
        <button
          className="btn"
          data-testid="nw-toggle-exam"
          title="Hide or show the exam picker"
          onClick={() => {
            log("human", "toggle_exam_panel", examOpen ? "hidden" : "shown");
            setExamOpen((v) => !v);
          }}
        >
          {examOpen ? "Hide Exam" : "Show Exam"}
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>Multi-select. Pills → prose on right.</span>
      </div>

      <div className="nw-layout" style={examOpen ? undefined : { gridTemplateColumns: "1fr" }}>
        {examOpen && (
        <div className="nw-picker">
          {EXAM_SECTIONS.map((s) => (
            <div className="nw-section" key={s.id}>
              <div className="label">{s.label}</div>
              <div className="pills">
                {s.pills.map((p) => {
                  const selected = (exam[s.id] ?? []).includes(p);
                  return (
                    <span
                      key={p}
                      className={"pill" + (selected ? " selected" : "")}
                      data-testid={`pill-${s.id}-${p.replace(/[^a-z0-9]/gi, "")}`}
                      onClick={() => togglePill(s.id, p, "human")}
                    >
                      {p}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        )}

        <div>
          <div style={{ fontWeight: 700, color: "#2c4863", fontSize: "11.5px", marginBottom: 4 }}>Generated Note Preview</div>
          <div className="nw-prose" data-testid="nw-prose">
            {prose ? prose : <div className="empty">Click pills on the left to compose the note. Or click &ldquo;Apply Normal Exam&rdquo; to start from baseline.</div>}
          </div>

          <div className="nw-freetext-label">Assessment &amp; Plan (free text)</div>
          <textarea
            data-testid="note-ap"
            value={ap}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Document your assessment and plan..."
          />
          {/* Both buttons persist the text (grading reads state.deliverable either way); only the audit
              trail distinguishes a saved draft from a signed note. The labels avoid benchmark vocabulary
              such as "deliverable", which would tell the agent which artifact is graded. */}
          <div style={{ marginTop: 4 }}>
            <button className="btn" data-testid="save-note" onClick={() => saveDeliverable(ap, "human")}>
              📝 Save Draft
            </button>{" "}
            <button
              className="btn primary"
              data-testid="save-deliverable"
              onClick={() => {
                saveDeliverable(ap, "human");
                signNote("human");
              }}
            >
              ✔ Sign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
