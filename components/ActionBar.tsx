"use client";

import { switchActivity, openModal } from "@/lib/store";

export default function ActionBar() {
  return (
    <div className="actionbar">
      <button className="ab-btn" data-testid="ab-add-order" onClick={() => switchActivity("orders", "human")}>
        <span className="glyph">＋</span> ADD ORDER
      </button>
      <button className="ab-btn" data-testid="ab-add-dx" onClick={() => switchActivity("problem-list", "human")}>
        <span className="glyph">＋</span> ADD DX
      </button>
      <div className="spacer" />
      <button className="ab-btn" data-testid="ab-print-avs">🖨 PRINT SUMMARY</button>
      <button className="ab-btn sign" data-testid="ab-sign-visit" onClick={() => openModal("signvisit")}>
        <span className="glyph">✓</span> SIGN ENCOUNTER
      </button>
    </div>
  );
}
