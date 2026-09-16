import { centsToDecimal } from '@/lib/validation/finance'

export function percentageBps(value: unknown, field = 'Persentase') {
  const raw = String(value ?? '').trim().replace(/,/g, '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error(`${field} tidak valid.`)
  const [whole, fraction = ''] = raw.split('.')
  const bps = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
  if (bps < 0n || bps > 10000n) throw new Error(`${field} harus antara 0% dan 100%.`)
  return bps
}

export function bpsToPercent(bps: bigint) {
  return Number(bps) / 100
}

export function bpsToDecimal(bps: bigint) {
  const whole = bps / 100n
  const fraction = String(bps % 100n).padStart(2, '0')
  return `${whole}.${fraction}`
}

export function percentAmountCents(amountCents: bigint, bps: bigint) {
  if (amountCents < 0n || bps < 0n) throw new Error('Perhitungan persentase tidak valid.')
  return (amountCents * bps + 5000n) / 10000n
}

export function calculateCommercialTotals(subtotalCents: bigint, discountPercentBps: bigint, taxPercentBps: bigint) {
  const discountCents = percentAmountCents(subtotalCents, discountPercentBps)
  const taxableCents = subtotalCents > discountCents ? subtotalCents - discountCents : 0n
  const taxCents = percentAmountCents(taxableCents, taxPercentBps)
  const totalCents = taxableCents + taxCents
  return {
    subtotalCents,
    discountPercentBps,
    discountCents,
    taxPercentBps,
    taxCents,
    totalCents,
    subtotalAmount: centsToDecimal(subtotalCents),
    discountAmount: centsToDecimal(discountCents),
    taxAmount: centsToDecimal(taxCents),
    totalAmount: centsToDecimal(totalCents),
  }
}
