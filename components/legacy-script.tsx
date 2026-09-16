'use client'

import Script from 'next/script'

export default function LegacyFinoraScript() {
  return <Script src="/finora/app.js" strategy="afterInteractive" />
}
