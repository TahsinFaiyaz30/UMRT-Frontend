'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useMegaMenu — engineered hover state for the navbar's mega-menu.
 *
 * The UX goal is to feel instant when the user actually means to hover,
 * but to be patient when they're merely brushing past a link on the
 * way to something else.
 *
 *   INTENT  DELAY (open)  : wait `openDelayMs` after pointerenter
 *                            before flipping `open` to true.
 *   EXIT  GRACE  (close)  : wait `closeDelayMs` after pointerleave
 *                            before flipping `open` back to false.
 *   BRIDGE                : the rendered tree includes a transparent
 *                            "safe triangle" between trigger + panel
 *                            so diagonal cursor movement doesn't
 *                            re-trigger the close path.
 *
 * Timeouts are tracked in refs so a fast pointerenter→pointerleave
 * burst cancels the pending open and only one timer is ever armed at
 * a time.
 */
export function useMegaMenu({
  openDelayMs = 150,
  closeDelayMs = 300,
}: { openDelayMs?: number; closeDelayMs?: number } = {}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // `mounted` lags one rAF after `active` flips so we can play the
  // enter animation (Tailwind data-state transitions).
  const [mounted, setMounted] = useState(false);

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const setOpen = useCallback(
    (id: string | null) => {
      clearTimers();
      if (id) {
        // Intent delay before opening.
        openTimer.current = setTimeout(() => {
          openTimer.current = null;
          setActiveId(id);
        }, openDelayMs);
      } else {
        // Grace period before closing.
        closeTimer.current = setTimeout(() => {
          closeTimer.current = null;
          setActiveId(null);
        }, closeDelayMs);
      }
    },
    [clearTimers, openDelayMs, closeDelayMs],
  );

  const cancel = useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setActiveId(null);
    }, closeDelayMs);
  }, [clearTimers, closeDelayMs]);

  // Drive `mounted` so the panel can fade + translate in/out.
  useEffect(() => {
    if (activeId) {
      const raf = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(raf);
    }
    setMounted(false);
    return undefined;
  }, [activeId]);

  // Tear down on unmount.
  useEffect(() => () => clearTimers(), [clearTimers]);

  // Allow ESC to dismiss while focused.
  useEffect(() => {
    if (!activeId) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearTimers();
        setActiveId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeId, clearTimers]);

  return {
    activeId,
    mounted,
    isOpen: (id: string) => activeId === id,
    onTriggerEnter: (id: string) => setOpen(id),
    onTriggerLeave: () => cancel(),
    onPanelEnter: (id: string) => setOpen(id),
    onPanelLeave: () => cancel(),
    onCloseNow: () => {
      clearTimers();
      setActiveId(null);
    },
  };
}