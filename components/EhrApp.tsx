"use client";

// The whole EHR, as one component. The root route (app/page.tsx) renders it with the defaults: install
// window.SimEHR and load the case named by ?case= (or the manifest default). Other entry points can
// render it with both switched off and load a case themselves.

import { useEffect } from "react";
import { installAgentApi } from "@/lib/agentApi";
import { fetchIndex, fetchCase } from "@/lib/cases";
import { loadCase, switchActivity, openSearch, closeMainMenu, closeSearch, closeModal, useSim } from "@/lib/store";
import MainMenu from "@/components/MainMenu";
import SearchOverlay from "@/components/SearchOverlay";
import TitleBar from "@/components/TitleBar";
import Toolbar from "@/components/Toolbar";
import PatientTabStrip from "@/components/PatientTabStrip";
import PatientSidebar from "@/components/PatientSidebar";
import ActivityTabs from "@/components/ActivityTabs";
import RightRail from "@/components/RightRail";
import { PaneBoundary } from "@/components/PaneBoundary";
import ActionBar from "@/components/ActionBar";
import AuditBar from "@/components/AuditBar";
import PatientSummary from "@/components/activities/PatientSummary";
import ChartReview from "@/components/activities/ChartReview";
import ResultsReview from "@/components/activities/ResultsReview";
import ProblemList from "@/components/activities/ProblemList";
import Medications from "@/components/activities/Medications";
import Orders from "@/components/activities/Orders";
import Demographics from "@/components/activities/Demographics";
import ClinicalNotes from "@/components/activities/ClinicalNotes";
import Flowsheets from "@/components/activities/Flowsheets";
import PatientLists from "@/components/workbenches/PatientLists";
import Schedule from "@/components/workbenches/Schedule";
import ModalHost from "@/components/ModalHost";

const PANES: Record<string, React.ComponentType> = {
  snapshot: PatientSummary,
  "chart-review": ChartReview,
  results: ResultsReview,
  "problem-list": ProblemList,
  medications: Medications,
  orders: Orders,
  notewriter: ClinicalNotes,
  demographics: Demographics,
  flowsheets: Flowsheets,
};

const WORKBENCHES: Record<string, React.ComponentType> = {
  "patient-lists": PatientLists,
  schedule: Schedule,
};

const TITLES: Record<string, string> = {
  snapshot: "Patient Summary",
  "chart-review": "Chart Review",
  results: "Results Review",
  "problem-list": "Problem List",
  medications: "Medications",
  orders: "Orders",
  notewriter: "Clinical Notes",
  demographics: "Demographics",
  flowsheets: "Flowsheets",
  "patient-lists": "Patient Lists",
  schedule: "Schedule",
};

const WORKBENCH_IDS = new Set(["patient-lists", "schedule"]);

function NotPorted({ name }: { name: string }) {
  return (
    <div className="pane-pad" style={{ paddingTop: 16, color: "var(--text-muted)" }}>
      &ldquo;{name}&rdquo; is not available in this build.
    </div>
  );
}

export default function EhrApp({ autoload = true, installApi = true }: { autoload?: boolean; installApi?: boolean }) {
  const caseData = useSim((s) => s.caseData);
  const activity = useSim((s) => s.activity);

  useEffect(() => {
    if (installApi) installAgentApi();
    if (!autoload) return;
    (async () => {
      // Honor ?case=<id> and ?act=<activity> from the URL.
      const sp = new URLSearchParams(window.location.search);
      const idx = await fetchIndex();
      const c = await fetchCase(sp.get("case") || idx.default);
      if (c) loadCase(c);
      const act = sp.get("act");
      if (act) switchActivity(act, "system");
    })();
  }, [autoload, installApi]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch("human");
      }
      if (e.key === "Escape") {
        closeMainMenu();
        closeSearch();
        closeModal();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!caseData) {
    return (
      <div data-testid="loading" style={{ padding: 24, color: "#888" }}>
        Loading SimEHR…
      </div>
    );
  }

  // Pre-chart workbenches (Patient Lists / Schedule): full-width, no patient context.
  if (WORKBENCH_IDS.has(activity)) {
    const W = WORKBENCHES[activity];
    return (
      <>
        <TitleBar />
        <Toolbar />
        <PatientTabStrip />
        <div className="app workbench">
          <main className="workspace">
            <div className="activity-head">
              <h1>{TITLES[activity] ?? activity}</h1>
            </div>
            <div className="activity-body" data-testid={`pane-${activity}`}>
              <section className="pane active">
                <PaneBoundary resetKey={`${caseData.id}:${activity}`}>
                  {W ? <W /> : <NotPorted name={TITLES[activity] ?? activity} />}
                </PaneBoundary>
              </section>
            </div>
          </main>
        </div>
        <AuditBar />
        <MainMenu />
        <SearchOverlay />
      </>
    );
  }

  const Pane = PANES[activity];
  return (
    <>
      <TitleBar />
      <Toolbar />
      <PatientTabStrip />
      <div className="app">
        <PatientSidebar />
        <main className="workspace">
          <ActivityTabs />
          <div className="activity-head">
            <h1 id="activity-title">{TITLES[activity] ?? activity}</h1>
            <div className="ah-spacer" />
            <span className="ah-ico" title="Help">?</span>
            <span className="ah-ico" title="Close activity">✕</span>
          </div>
          <div className="activity-body" data-testid={`pane-${activity}`}>
            <section className="pane active">
              <PaneBoundary resetKey={`${caseData.id}:${activity}`}>
                {Pane ? <Pane /> : <NotPorted name={TITLES[activity] ?? activity} />}
              </PaneBoundary>
            </section>
          </div>
        </main>
        {/* The rail renders on EVERY patient activity and its key-labs projection sorts on a raw
            `datetime`, so an unguarded throw here would blank the app before the agent could navigate
            anywhere — a wider blast radius than any single pane. */}
        <PaneBoundary resetKey={`${caseData.id}:${activity}`}>
          <RightRail />
        </PaneBoundary>
      </div>
      <ActionBar />
      <AuditBar />
      <ModalHost />
      <MainMenu />
      <SearchOverlay />
    </>
  );
}
