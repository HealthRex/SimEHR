// Contract guard — fails if the window.SimEHR API surface or core data-testids regress.
// The agent contract (the harness) depends on these being stable. Run: npm run contract
import { chromium } from "playwright";

const EXPECTED_API = [
  "loadCase", "listCases", "getState", "getAuditLog", "resetState", "switchActivity",
  "saveDeliverable", "getDeliverable", "addOrder", "signOrders", "addMed", "modifyMed",
  "discontinueMed", "selectPill", "applyNormalExam", "writeAP", "signNote", "openAdvisory",
  "respondAdvisory", "signVisit", "signVisitForce", "openMainMenu", "closeMainMenu", "menuSelect",
  "switchChartTab", "toggleFilter",
];

const CORE_TESTIDS = [
  "main-menu-button", "topbar-search", "pt-tab", "pt-tab-close", "pt-name", "pt-mrn",
  // "tab-snapshot" withdrawn — Patient Summary is search/menu-reachable only, see ActivityTabs.tsx
  "tab-chart-review", "tab-flowsheets", "tab-results", "tab-problem-list", "tab-medications",
  "tab-orders", "tab-notewriter", "tab-demographics",
  // "rail-advisory" withdrawn with the Best Practice Advisories card — see RightRail.tsx
  "ab-sign-visit", "ab-add-order", "audit-bar",
];

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "✓" : "✗"} ${m}`); if (!c) fail++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 820 } });
await p.goto("http://localhost:8766", { waitUntil: "networkidle" });
await p.waitForSelector('[data-testid="pt-name"]');

// 1. API surface
const methods = await p.evaluate(() => Object.keys(window.SimEHR).sort());
const missing = EXPECTED_API.filter((m) => !methods.includes(m));
ok(missing.length === 0, `window.SimEHR exposes all ${EXPECTED_API.length} contract methods${missing.length ? " — MISSING: " + missing.join(", ") : ""}`);
ok(typeof (await p.evaluate(() => window.SimEHR.getState())) === "object", "getState() returns an object");
ok(Array.isArray(await p.evaluate(() => window.SimEHR.getAuditLog())), "getAuditLog() returns an array");

// 2. Core data-testids present
for (const t of CORE_TESTIDS) {
  const present = (await p.$(`[data-testid="${t}"]`)) !== null;
  if (!present) ok(false, `MISSING data-testid: ${t}`);
}
ok(true, `${CORE_TESTIDS.length} core data-testids present`);

// 3. getState snapshot shape (grading fields)
const st = await p.evaluate(() => window.SimEHR.getState());
for (const k of ["case", "activity", "orders", "deliverable", "patientReply", "noteExam", "advisoryResponses", "visitSigned"]) {
  ok(k in st, `getState() includes '${k}'`);
}

await b.close();
console.log(fail ? `\n${fail} CONTRACT CHECK(S) FAILED` : "\nCONTRACT OK ✓");
process.exit(fail ? 1 : 0);
