# Recorded sessions

Two frontier agents worked through the demo task in the preview build, once each, under the same
harness: screenshots of a 1280×800 viewport in, mouse and keyboard actions out, reasoning effort at its
maximum, a budget of 200 actions, and the same LLM judge for the judged checkpoints. The actions,
reasoning, final state and verdicts are the original sessions'; the screenshots were re-rendered by
replaying the recorded actions in the current build, which checks that every audit event, the saved note
and the orders come out identical. For the few clicks on activity tabs that moved when a tab was renamed,
the log carries the point clicked in the current build.

The judge was gpt-5.5, one run per checkpoint.

| Folder | Model | Access | Verdict | Checkpoints | Model turns | Actions | Wall time |
|---|---|---|---|---|---|---|---|
| `claude-opus-5.5/` | Claude Opus 5.5 | OpenRouter | FAIL | 5 of 6 | 59 | 69 | 10 min |
| `gpt-6-astra/` | GPT-6 Astra | the OpenAI API | PASS | 6 of 6 | 58 | 58 | 8 min |

## Files in each folder

| File | Contents |
|---|---|
| `trajectory_view.html` | the viewer: open it in a browser and step through the session |
| `../../docs/trajectories/<run>/screenshots/step_NNN.jpg` | what the agent saw before each action; the JPEG copies are shared with the project page's viewer, so the repository stores each screenshot once |
| `trajectory.jsonl` | one JSON object per line, in order: `screenshot`, `thinking`, `text`, `action` and `stop` entries, keyed by step |
| `snapshot.json` | the final chart state (`state`) and the audit log (`auditLog`), as read through `window.SimEHR` |
| `eval.json` | the verdict and the per-checkpoint results |
| `run.json` | the run configuration: model, provider, reasoning effort, budget, judge, timing and token usage |
