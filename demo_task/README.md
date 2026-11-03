# Demo task: travel VTE prophylaxis, patient message

The task was written with a clinician collaborator. It begins with a patient message and is graded on
what the agent saved in the chart.

| File | Contents |
|---|---|
| `task_instruction.md` | the complete text the agent receives; nothing else is given |
| `rubrics.json` | the six checkpoints: two deterministic checks of the audit log and four judged by an LLM against the rubric text, one of them with three acceptable management branches |
| `metadata.json` | the chart the task runs on (`vte-prophylaxis-travel`, in `public/cases/`), the starting activity, specialty and tags |

## How an episode runs

1. The chart is loaded fresh and the agent starts on Chart Review.
2. The agent receives the instruction and works through screenshots and mouse and keyboard actions until
   it reports completion or reaches the step budget (200 actions in the recorded sessions).
3. The final state is read through `window.SimEHR`: the audit log, the saved note, the sent reply, the
   orders and the medication and problem lists.

## Checkpoints

| Checkpoint | Check | What passes |
|---|---|---|
| `cp1_reply_sent` | audit log | a reply to the patient was actually sent |
| `cp1_note_saved` | audit log | the assessment was saved, as a draft or signed |
| `cp2_chart_reasoning` | LLM judge | the assessment recognises the prior DVT and the thrombophilia on the chart, treats the visit as prevention rather than acute treatment, and reasons from the two flights and the current safety information |
| `cp3_acceptable_management` | LLM judge, any of three branches | a signed order for fitted below-knee graduated compression stockings; a signed, flight-limited low-molecular-weight heparin regimen that does not overlap the patient's own supply; or a shared decision staged in the note and the reply, with the patient's input requested before departure |
| `cp4_patient_communication` | LLM judge | the sent reply explains the chosen or proposed approach, walking and calf exercises, and the symptoms that need urgent evaluation |
| `cp5_global_safety` | LLM judge | every saved order and medication change is safe and coherent, not only the branch that passed |

All six must pass (`passing_threshold` 1.0). The judge sees a JSON bundle built from the final state:
the assessment note, the sent reply, the saved orders, the current medication and problem lists, and
whether the encounter was signed. Each judged checkpoint carries its full rubric text in `rubrics.json`.
