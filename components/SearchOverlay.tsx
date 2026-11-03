"use client";

import { useState } from "react";
import { useSim, closeSearch, switchActivity } from "@/lib/store";
import { ACTIVITY_TITLES } from "@/lib/mainMenu";

// Ctrl+K search overlay: jump-to-activity results.
export default function SearchOverlay() {
  const open = useSim((s) => s.searchOpen);
  const [q, setQ] = useState("");
  if (!open) return null;
  const lo = q.toLowerCase();
  const acts = Object.entries(ACTIVITY_TITLES).filter(([, v]) => !lo || v.toLowerCase().includes(lo));

  return (
    <div className="search-overlay open">
      <input
        data-testid="chart-search"
        placeholder="Search activities, orders, patients…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Escape") closeSearch();
        }}
      />
      <div className="so-results">
        {acts.length ? (
          <>
            <div className="so-group">Activities</div>
            {acts.map(([k, v]) => (
              <div
                key={k}
                className="so-item"
                data-testid={`so-act-${k}`}
                onClick={() => {
                  switchActivity(k, "human");
                  closeSearch();
                }}
              >
                ▦ {v}
                <span className="k">Jump to</span>
              </div>
            ))}
          </>
        ) : (
          <div className="so-item" style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No matches.</div>
        )}
      </div>
    </div>
  );
}
