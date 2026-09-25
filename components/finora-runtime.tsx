'use client'

import { useClerk } from '@clerk/nextjs'
import { useEffect, useState } from 'react'

export type FinoraRuntimeViewer = {
  name: string | null
  email: string
  role: string
}

type NotificationSummary = {
  overdueInvoices: number
  pendingExpenses: number
}

const EMPTY_NOTIFICATIONS: NotificationSummary = {
  overdueInvoices: 0,
  pendingExpenses: 0,
}

export default function FinoraRuntime({ viewer }: { viewer: FinoraRuntimeViewer }) {
  const { signOut } = useClerk()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [notificationSummary, setNotificationSummary] =
    useState<NotificationSummary>(EMPTY_NOTIFICATIONS)
  const [notificationsLoading, setNotificationsLoading] = useState(false)

  const isProduction = process.env.NODE_ENV === 'production'

  useEffect(() => {
    let cancelled = false
    window.__FINORA_MANAGED_USER_MENU__ = true
    let cleanup: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | undefined

    const bindLegacyControls = () => {
      if (cancelled) return

      const userButton = document.getElementById('userMenuBtn')
      const notificationButton = document.getElementById('notificationBtn')

      if (!userButton || !notificationButton) {
        timer = setTimeout(bindLegacyControls, 100)
        return
      }

      const onUserClick = (event: Event) => {
        event.preventDefault()
        event.stopPropagation()
        setNotificationsOpen(false)
        setUserMenuOpen((open) => !open)
      }

      const onNotificationClick = (event: Event) => {
        event.preventDefault()
        event.stopPropagation()
        setUserMenuOpen(false)
        setNotificationsOpen((open) => !open)
      }

      userButton.addEventListener('click', onUserClick, true)
      notificationButton.addEventListener('click', onNotificationClick, true)

      cleanup = () => {
        userButton.removeEventListener('click', onUserClick, true)
        notificationButton.removeEventListener('click', onNotificationClick, true)
      }
    }

    bindLegacyControls()

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const navItem = target?.closest<HTMLElement>('[data-view="clients"]')
      if (navItem) {
        event.preventDefault()
        event.stopPropagation()
        window.location.href = '/clients'
        return
      }
      if (!target?.closest('[data-finora-runtime-popover]') && !target?.closest('#userMenuBtn')) {
        setUserMenuOpen(false)
      }
      if (!target?.closest('[data-finora-runtime-popover="notifications"]') && !target?.closest('#notificationBtn')) {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('click', onDocumentClick, true)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      cleanup?.()
      document.removeEventListener('click', onDocumentClick, true)
      delete window.__FINORA_MANAGED_USER_MENU__
    }
  }, [])

  useEffect(() => {
    if (!notificationsOpen) return

    let cancelled = false
    setNotificationsLoading(true)

    Promise.all([
      fetch('/api/invoices', { cache: 'no-store' }),
      fetch('/api/expenses', { cache: 'no-store' }),
    ])
      .then(async ([invoiceResponse, expenseResponse]) => {
        const [invoiceData, expenseData] = await Promise.all([
          invoiceResponse.ok ? invoiceResponse.json() : Promise.resolve({ invoices: [] }),
          expenseResponse.ok ? expenseResponse.json() : Promise.resolve({ expenses: [] }),
        ])

        const overdueInvoices = Array.isArray(invoiceData.invoices)
          ? invoiceData.invoices.filter((item: { status?: string }) => item.status === 'OVERDUE').length
          : 0

        const pendingExpenses = Array.isArray(expenseData.expenses)
          ? expenseData.expenses.filter((item: { status?: string }) => item.status === 'PENDING').length
          : 0

        if (!cancelled) {
          setNotificationSummary({ overdueInvoices, pendingExpenses })
        }
      })
      .catch(() => {
        if (!cancelled) setNotificationSummary(EMPTY_NOTIFICATIONS)
      })
      .finally(() => {
        if (!cancelled) setNotificationsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [notificationsOpen])

  const firstName =
    viewer.name?.trim()?.split(/\s+/)[0] || viewer.email.split('@')[0] || 'Pengguna'

  async function handleSignOut() {
    await signOut({ redirectUrl: '/sign-in' })
  }

  function resetDemoData() {
    window.localStorage.removeItem('finora_state')
    setToast('Data browser direset. Halaman akan dimuat ulang.')
    window.setTimeout(() => window.location.reload(), 600)
  }

  const totalNotifications =
    notificationSummary.overdueInvoices + notificationSummary.pendingExpenses

  return (
    <>
      {!isProduction && (
        <div className="finora-preview-chip" aria-label="Mode data">
          <span className="finora-preview-dot" />
          Development · Data demo
        </div>
      )}

      {userMenuOpen && (
        <div
          className="finora-runtime-popover finora-user-popover"
          data-finora-runtime-popover="user"
          role="menu"
        >
          <div className="finora-popover-head">
            <div className="finora-runtime-avatar">{firstName.slice(0, 2).toUpperCase()}</div>
            <div className="finora-popover-identity">
              <strong>{viewer.name || firstName}</strong>
              <span>{viewer.email}</span>
              <small>{viewer.role === 'OWNER' ? 'Owner / Admin' : viewer.role}</small>
            </div>
          </div>
          <div className="finora-session-status">
            <span className="finora-session-dot" />
            Sesi aktif melalui Clerk
          </div>
          {!isProduction && (
            <button className="finora-menu-action" onClick={resetDemoData} type="button">
              <span>↻</span>
              <span>
                <strong>Reset data demo</strong>
                <small>Kembalikan data browser ke kondisi awal</small>
              </span>
            </button>
          )}
          <button className="finora-menu-action danger" onClick={handleSignOut} type="button">
            <span>↪</span>
            <span>
              <strong>Keluar</strong>
              <small>Akhiri sesi Clerk di perangkat ini</small>
            </span>
          </button>
        </div>
      )}

      {notificationsOpen && (
        <div
          className="finora-runtime-popover finora-notification-popover"
          data-finora-runtime-popover="notifications"
          role="dialog"
          aria-label="Notifikasi"
        >
          <div className="finora-notification-head">
            <div>
              <strong>Notifikasi</strong>
              <span>Prioritas berdasarkan data workspace</span>
            </div>
            {totalNotifications > 0 && (
              <span className="finora-count-pill">{totalNotifications > 9 ? '9+' : totalNotifications}</span>
            )}
          </div>

          {notificationsLoading ? (
            <div className="finora-notification-item">
              <div>
                <strong>Memuat notifikasi…</strong>
                <span>Memeriksa invoice overdue dan biaya pending.</span>
              </div>
            </div>
          ) : totalNotifications === 0 ? (
            <div className="finora-notification-item">
              <span className="finora-notification-icon info">i</span>
              <div>
                <strong>Tidak ada prioritas aktif</strong>
                <span>Tidak ada invoice overdue atau biaya menunggu approval.</span>
              </div>
            </div>
          ) : (
            <>
              {notificationSummary.overdueInvoices > 0 && (
                <div className="finora-notification-item">
                  <span className="finora-notification-icon warning">!</span>
                  <div>
                    <strong>{notificationSummary.overdueInvoices} invoice overdue</strong>
                    <span>Perlu ditindaklanjuti dari modul Piutang.</span>
                  </div>
                </div>
              )}
              {notificationSummary.pendingExpenses > 0 && (
                <div className="finora-notification-item">
                  <span className="finora-notification-icon approval">✓</span>
                  <div>
                    <strong>{notificationSummary.pendingExpenses} biaya menunggu approval</strong>
                    <span>Review dari modul Biaya sebelum settlement.</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {toast && <div className="finora-runtime-toast">{toast}</div>}
    </>
  )
}
