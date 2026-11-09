"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn-secondary" onClick={() => window.print()}>
      Imprimer / PDF
    </button>
  );
}
