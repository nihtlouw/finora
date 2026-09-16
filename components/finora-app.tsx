import { readFile } from 'node:fs/promises'
import path from 'node:path'
import FinoraRuntime from '@/components/finora-runtime'
import LegacyFinoraScript from '@/components/legacy-script'
import { roleLabel, type FinoraRole } from '@/lib/auth/current-user'

type FinoraViewer = {
  name: string | null
  email: string
  role: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function displayName(name: string, email: string) {
  const cleanName = name.trim()
  if (cleanName && !cleanName.includes('@')) return cleanName
  return email.split('@')[0] || 'Pengguna Finora'
}

function firstNameOf(name: string) {
  return name.trim().split(/\s+/)[0] || name
}

function greetingForNow(hour: number) {
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

function indonesianDate(date: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: process.env.FINORA_TIMEZONE || 'Asia/Jakarta',
  }).format(date)
}

function hourInTimeZone(date: Date) {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hour12: false,
      timeZone: process.env.FINORA_TIMEZONE || 'Asia/Jakarta',
    }).format(date),
  )
}

export default async function FinoraApp({ viewer }: { viewer: FinoraViewer }) {
  let markup = await readFile(path.join(process.cwd(), 'public/finora/markup.html'), 'utf8')

  const now = new Date()
  const safeDisplayName = escapeHtml(displayName(viewer.name || '', viewer.email))
  const safeFirstName = escapeHtml(firstNameOf(displayName(viewer.name || '', viewer.email)))
  const safeRole = escapeHtml(roleLabel(viewer.role))
  const currentDate = escapeHtml(indonesianDate(now))
  const greeting = escapeHtml(greetingForNow(hourInTimeZone(now)))

  markup = markup
    .replaceAll('Aditya Saputra', safeDisplayName)
    .replaceAll('Aditya', safeFirstName)
    .replaceAll('Owner / Admin', safeRole)
    .replaceAll('Jumat, 11 September 2026', currentDate)
    .replaceAll('Selamat sore, ' + safeFirstName, `${greeting}, ${safeFirstName}`)

  return (
    <div
      data-finora-user-role={viewer.role as FinoraRole}
      data-finora-user-email={viewer.email}
      data-finora-app
    >
      <div dangerouslySetInnerHTML={{ __html: markup }} />
      <LegacyFinoraScript />
      <FinoraRuntime viewer={viewer} />
    </div>
  )
}
