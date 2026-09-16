import { positiveMoney } from '@/lib/validation/finance'

export const EXPENSE_CATEGORY_OPTIONS = [
  { value: 'MATERIAL', label: 'Material' },
  { value: 'CONSUMABLE', label: 'Consumable / Bahan habis pakai' },
  { value: 'BBM', label: 'BBM / Fuel' },
  { value: 'TRANSPORT', label: 'Transport / Tol / Parkir' },
  { value: 'JASA_SUBKON', label: 'Jasa / Subkontraktor' },
  { value: 'SEWA_PERALATAN', label: 'Sewa Peralatan' },
  { value: 'KONSUMSI', label: 'Konsumsi / Meeting' },
  { value: 'AKOMODASI', label: 'Akomodasi' },
  { value: 'LOGISTIK', label: 'Logistik / Pengiriman' },
  { value: 'OPERASIONAL_UMUM', label: 'Operasional Umum' },
  { value: 'LAINNYA', label: 'Lainnya' },
] as const

export type ExpenseItemInput = {
  description: string
  quantity: number | string
  unit: string
  unitPrice: number | string
}

export type ExpenseAllocationInput = { projectId: string; percentage: number; note?: string | null }

export function parseAllocationPercentage(value: unknown) {
  const raw = String(value ?? '').trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Persentase allocation tidak valid.')
  const [whole, fraction = ''] = raw.split('.')
  const basisPoints = Number(whole) * 100 + Number((fraction + '00').slice(0, 2))
  if (!Number.isInteger(basisPoints) || basisPoints <= 0 || basisPoints > 10000) throw new Error('Persentase allocation harus > 0 dan <= 100.')
  return basisPoints
}

function parsePositiveQuantity(value: unknown) {
  const raw = String(value ?? '').trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,3})?$/.test(raw)) throw new Error('Qty harus berupa angka positif maksimal 3 desimal.')
  const thousandths = Math.round(Number(raw) * 1000)
  if (!Number.isSafeInteger(thousandths) || thousandths <= 0) throw new Error('Qty harus lebih besar dari 0.')
  return { thousandths: BigInt(thousandths), decimal: (thousandths / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '') }
}

export function normalizeExpenseItems(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Minimal satu item biaya harus diisi.')
  if (raw.length > 50) throw new Error('Maksimal 50 item biaya per transaksi.')

  let totalCents = 0n
  const items = raw.map((item: ExpenseItemInput) => {
    const description = String(item?.description ?? '').trim().slice(0, 240)
    const unit = String(item?.unit ?? '').trim().slice(0, 40)
    if (!description) throw new Error('Nama/detail item wajib diisi.')
    if (!unit) throw new Error(`Satuan untuk item "${description}" wajib diisi.`)

    const quantity = parsePositiveQuantity(item?.quantity)
    const unitPrice = positiveMoney(item?.unitPrice, `Harga satuan item "${description}"`)
    const lineTotalCents = (quantity.thousandths * unitPrice.cents + 500n) / 1000n
    if (lineTotalCents <= 0n) throw new Error(`Total item "${description}" harus lebih besar dari 0.`)
    totalCents += lineTotalCents

    return {
      description,
      quantity: quantity.decimal,
      unit,
      unitPrice: unitPrice.decimal,
      totalAmount: centsToDecimalString(lineTotalCents),
      totalAmountCents: lineTotalCents,
    }
  })

  if (totalCents <= 0n) throw new Error('Total biaya harus lebih besar dari 0.')
  return { items, totalCents }
}

export function normalizeExpenseAllocations(allocationType: string, raw: unknown, amountValue: unknown) {
  const type = String(allocationType || 'UNALLOCATED').toUpperCase()
  const amount = positiveMoney(amountValue, 'Nominal')
  if (!['DIRECT', 'SHARED', 'OVERHEAD', 'UNALLOCATED'].includes(type)) throw new Error('Jenis pembebanan biaya tidak valid.')
  if (type === 'OVERHEAD' || type === 'UNALLOCATED') return []
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Project allocation wajib dipilih.')
  if (type === 'DIRECT' && raw.length !== 1) throw new Error('Biaya langsung hanya boleh memiliki satu project.')
  if (type === 'SHARED' && raw.length < 2) throw new Error('Biaya gabungan minimal memiliki dua project.')

  const rows = raw.map((item: any) => ({
    projectId: String(item?.projectId || '').trim(),
    basisPoints: parseAllocationPercentage(item?.percentage),
    note: item?.note ? String(item.note).trim().slice(0, 500) : null,
  }))
  if (rows.some((x) => !x.projectId)) throw new Error('Semua allocation harus memiliki project.')
  if (new Set(rows.map((x) => x.projectId)).size !== rows.length) throw new Error('Project allocation tidak boleh duplikat.')
  const totalBp = rows.reduce((sum, row) => sum + row.basisPoints, 0)
  if (totalBp !== 10000) throw new Error(`Total allocation harus 100%. Saat ini ${ (totalBp / 100).toFixed(2) }%.`)

  let remaining = amount.cents
  return rows.map((row, index) => {
    const allocated = index === rows.length - 1 ? remaining : (amount.cents * BigInt(row.basisPoints)) / 10000n
    remaining -= allocated
    return { projectId: row.projectId, percentage: row.basisPoints / 100, amountCents: allocated, note: row.note }
  })
}

export function centsToDecimalString(cents: bigint) {
  const negative = cents < 0n
  const abs = negative ? -cents : cents
  const whole = abs / 100n
  const fraction = String(abs % 100n).padStart(2, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}
