const MONEY_RE = /^\d+(?:\.\d{1,2})?$/

export function requireText(value: unknown, field: string, maxLength = 200) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${field} wajib diisi.`)
  if (text.length > maxLength) throw new Error(`${field} terlalu panjang.`)
  return text
}

export function optionalText(value: unknown, maxLength = 500) {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (text.length > maxLength) throw new Error('Teks terlalu panjang.')
  return text
}

export function positiveMoney(value: unknown, field = 'Nominal') {
  const raw = String(value ?? '').trim().replace(/,/g, '')
  if (!raw || !MONEY_RE.test(raw)) throw new Error(`${field} tidak valid.`)
  const cents = parseMoneyCents(raw)
  if (cents <= 0n) throw new Error(`${field} harus lebih besar dari 0.`)
  return { cents, decimal: centsToDecimal(cents) }
}

export function nonNegativeMoney(value: unknown, field = 'Nominal') {
  const raw = String(value ?? '').trim().replace(/,/g, '')
  if (!raw || !MONEY_RE.test(raw)) throw new Error(`${field} tidak valid.`)
  const cents = parseMoneyCents(raw)
  if (cents < 0n) throw new Error(`${field} tidak boleh negatif.`)
  return { cents, decimal: centsToDecimal(cents) }
}

export function parseMoneyCents(value: string) {
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
}

export function centsToDecimal(cents: bigint) {
  const sign = cents < 0n ? '-' : ''
  const abs = cents < 0n ? -cents : cents
  const whole = abs / 100n
  const fraction = String(abs % 100n).padStart(2, '0')
  return `${sign}${whole}.${fraction}`
}

export function dateOnly(value: unknown, field: string) {
  const raw = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${field} harus berformat YYYY-MM-DD.`)
  const date = new Date(`${raw}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new Error(`${field} tidak valid.`)
  return date
}

export function positiveInt(value: unknown, field: string) {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${field} harus bilangan bulat positif.`)
  return n
}

export function lineItemsTotalCents(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('Minimal satu item diperlukan.')
  return items.reduce((sum: bigint, item: any) => {
    const qty = positiveInt(item?.qty, 'Qty')
    const unit = positiveMoney(item?.unitPrice, 'Harga satuan')
    return sum + BigInt(qty) * unit.cents
  }, 0n)
}


export function normalizeBudgetPeriod(value: unknown) {
  const period = requireText(value, 'Periode', 7)
  if (/^\d{4}$/.test(period)) return period
  if (/^\d{4}-\d{2}$/.test(period)) {
    const month = Number(period.slice(5, 7))
    if (month < 1 || month > 12) throw new Error('Periode bulan tidak valid. Gunakan YYYY-MM.')
    return period
  }
  throw new Error('Periode harus berbentuk YYYY atau YYYY-MM.')
}

export function budgetPeriodRange(period: string) {
  if (/^\d{4}$/.test(period)) {
    const year = Number(period)
    return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) }
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const year = Number(period.slice(0, 4))
    const monthIndex = Number(period.slice(5, 7)) - 1
    return { start: new Date(Date.UTC(year, monthIndex, 1)), end: new Date(Date.UTC(year, monthIndex + 1, 1)) }
  }
  throw new Error('Periode budget tidak valid.')
}
