"use client";

// The permission sheet's one button: the browser's own print dialog, which can also save it as a PDF.
export default function SignOffPrint() {
  return <button type="button" className="button block" onClick={() => window.print()}>Print</button>;
}
