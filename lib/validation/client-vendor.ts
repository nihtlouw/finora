const ALLOWED_TYPES = ['CLIENT', 'VENDOR'] as const
export type ClientVendorType = (typeof ALLOWED_TYPES)[number]

export const CLIENT_CATEGORIES = [
  'OWNER / END USER',
  'KONTRAKTOR',
  'DEVELOPER',
  'INSTANSI / PEMERINTAH',
  'PERUSAHAAN SWASTA',
  'RESELLER / DISTRIBUTOR',
  'LAINNYA',
] as const

export const VENDOR_CATEGORIES = [
  'SUPPLIER MATERIAL',
  'PENYEDIA JASA',
  'SUBKONTRAKTOR',
  'TRANSPORTASI / LOGISTIK',
  'PERALATAN / SEWA',
  'OPERASIONAL',
  'TENAGA AHLI / FREELANCER',
  'LAINNYA',
] as const

export function normalizeClientVendorType(value: unknown): ClientVendorType {
  const type = String(value ?? '').trim().toUpperCase()
  if (!ALLOWED_TYPES.includes(type as ClientVendorType)) {
    throw new Error('Tipe kontak harus CLIENT atau VENDOR.')
  }
  return type as ClientVendorType
}

export function validateClientVendorPayload(input: Record<string, unknown>) {
  const name = String(input.name ?? '').trim()
  const type = normalizeClientVendorType(input.type)
  const category = String(input.category ?? '').trim()
  const offerings = String(input.offerings ?? '').trim()
  const email = String(input.email ?? '').trim()
  const phone = String(input.phone ?? '').trim()
  const picName = String(input.picName ?? '').trim()
  const address = String(input.address ?? '').trim()
  const npwp = String(input.npwp ?? '').trim()
  const isActive = input.isActive === undefined ? true : Boolean(input.isActive)

  if (name.length < 2) throw new Error('Nama perusahaan minimal 2 karakter.')
  if (name.length > 140) throw new Error('Nama perusahaan terlalu panjang.')
  if (category.length > 80) throw new Error('Kategori kontak terlalu panjang.')
  if (offerings.length > 1000) throw new Error('Produk/jasa terlalu panjang.')
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Format email tidak valid.')

  return {
    name,
    type,
    category: category || null,
    offerings: offerings || null,
    email: email || null,
    phone: phone || null,
    picName: picName || null,
    address: address || null,
    npwp: npwp || null,
    isActive,
  }
}
