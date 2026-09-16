'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type TipPosition = {
  top: number
  left: number
  placement: 'top' | 'bottom'
}

export default function InfoTip({
  text,
  label = 'Tentang bagian ini',
}: {
  text: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<TipPosition>({ top: 0, left: 0, placement: 'bottom' })
  const rootRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const updatePosition = () => {
    const trigger = triggerRef.current
    const popover = popoverRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const margin = 12
    const viewportPadding = 16
    const width = Math.min(340, window.innerWidth - viewportPadding * 2)
    const height = popover?.getBoundingClientRect().height || 108
    const roomBelow = window.innerHeight - rect.bottom
    const placeAbove = roomBelow < height + margin && rect.top > height + margin
    const idealLeft = rect.left + rect.width / 2 - width / 2
    const maxLeft = Math.max(viewportPadding, window.innerWidth - width - viewportPadding)
    const left = Math.min(Math.max(viewportPadding, idealLeft), maxLeft)
    const top = placeAbove ? rect.top - height - margin : rect.bottom + margin

    setPosition({
      top: Math.max(viewportPadding, top),
      left,
      placement: placeAbove ? 'top' : 'bottom',
    })
  }

  useLayoutEffect(() => {
    if (!open || !mounted) return
    updatePosition()
    const onResize = () => updatePosition()
    const onScroll = () => updatePosition()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, mounted])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  const popover = open && mounted
    ? createPortal(
        <div
          ref={popoverRef}
          className={`f-info-tip-popover is-open${position.placement === 'top' ? ' is-top' : ''}`}
          role="tooltip"
          style={{ top: position.top, left: position.left }}
        >
          <strong>{label}</strong>
          <span>{text}</span>
        </div>,
        document.body,
      )
    : null

  return (
    <span className="f-info-tip" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="f-info-tip-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      {popover}
    </span>
  )
}
