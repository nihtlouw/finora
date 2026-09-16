'use client'

export default function DocumentPrintButton() {
  return <button className="f-btn primary no-print" onClick={() => window.print()}>Cetak / Simpan PDF</button>
}
