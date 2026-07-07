'use client';

import type { CSSProperties } from 'react';
import { megaMenus, type MegaMenuConfig } from './megaMenuConfig';
import { ArrowRightIcon, IconByName } from './NavbarIcons';

/**
 * MegaMenuPanel
 * -------------
 * The dropdown panel rendered under a center-zone trigger.
 *
 * - Wrapped in a `pointer-events-none` container when closed so it
 *   never blocks clicks on the canvas / hero behind it. Re-enabled
 *   with `pointer-events-auto` when mounted.
 * - The `::after` pseudo-element on the wrapper is a transparent
 *   12px "safe triangle" that lets the cursor cross from the
 *   trigger to the panel without losing the hover.
 * - Fade + 6px slide-down via Tailwind transition utilities, gated
 *   on the `mounted` boolean so the enter animation plays once the
 *   panel is actually in the DOM.
 */
export function MegaMenuPanel({
  menu,
  mounted,
  onPanelEnter,
  onPanelLeave,
}: {
  menu: MegaMenuConfig;
  mounted: boolean;
  onPanelEnter: (id: string) => void;
  onPanelLeave: () => void;
}) {
  return (
    <div
      onMouseEnter={() => onPanelEnter(menu.id)}
      onMouseLeave={onPanelLeave}
      // `relative` so the ::after safe-bridge is anchored to this box.
      className={[
        'mega-panel relative w-[min(1120px,calc(100vw-3rem))]',
        'transition-all duration-200 ease-out',
        mounted
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none -translate-y-1.5 opacity-0',
      ].join(' ')}
      // The safe triangle: a transparent strip above the panel that
      // overlaps the trigger so diagonal cursor travel never escapes
      // the hover state.
      style={SAFE_TRIANGLE_STYLE}
      role="region"
      aria-label={`${menu.triggerLabel} menu`}
    >
      <div className="relative overflow-hidden rounded-2xl border border-mars-200/15 bg-black/55 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        {/* Soft glow ring along the top to mark the panel's edge */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mars-300/60 to-transparent"
        />

        <div className="grid gap-10 px-8 py-8 md:grid-cols-[1fr_1fr_minmax(0,360px)] md:px-10 md:py-10">
          {menu.groups.map((group) => (
            <div key={group.heading}>
              <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-mars-200/70">
                {group.heading}
              </p>
              <ul className="flex flex-col gap-1">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-mars-500/10 focus:bg-mars-500/10 focus:outline-none"
                    >
                      <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-mars-300/60 transition-colors duration-150 group-hover:bg-mars-300" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-medium text-mars-50">
                          {link.label}
                          {link.badge ? (
                            <span className="rounded-full border border-mars-300/40 bg-mars-300/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-mars-200">
                              {link.badge}
                            </span>
                          ) : null}
                        </span>
                        {link.description ? (
                          <span className="mt-0.5 block text-xs leading-relaxed text-mars-100/65">
                            {link.description}
                          </span>
                        ) : null}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Spotlight card */}
          <aside className="relative isolate overflow-hidden rounded-xl border border-mars-200/15 bg-gradient-to-br from-mars-700/30 via-mars-800/30 to-mars-900/40 p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-mars-400/20 blur-3xl"
            />
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mars-200/80">
              {menu.spotlight.eyebrow}
            </p>
            <h3 className="mt-3 font-display text-2xl leading-tight text-mars-50">
              {menu.spotlight.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-mars-100/75">
              {menu.spotlight.body}
            </p>
            <a
              href={menu.spotlight.ctaHref}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-mars-300/40 bg-mars-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-mars-50 transition-colors duration-150 hover:bg-mars-300/20 focus:bg-mars-300/20 focus:outline-none"
            >
              {menu.spotlight.ctaLabel}
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </a>
          </aside>
        </div>
      </div>
    </div>
  );
}

/**
 * `::after` style: a 100%×12px transparent strip stacked on top of
 * the panel. It overlaps the bottom of the trigger link so the
 * cursor never has to traverse empty space.
 *
 * Tailwind can't reach pseudo-elements from arbitrary utility
 * classes portably, so we hand the rule through a CSS variable +
 * inline `<style>` block on first render.
 */
const SAFE_TRIANGLE_STYLE: CSSProperties = {
  ['--mega-bridge' as string]: '14px',
};

/**
 * Mounted-once CSS — adds the safe triangle and a small entrance
 * gradient mask. Rendered as a `<style>` tag from the navbar so it
 * only ships with the component.
 */
export function MegaMenuStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      .mega-panel::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: -14px;
        height: 14px;
        background: transparent;
      }
      .mega-trigger::after {
        content: '';
        position: absolute;
        left: 12px;
        right: 12px;
        top: 100%;
        height: 14px;
        background: transparent;
      }
      .mega-trigger[data-open='true']::after {
        background: transparent;
      }
    `,
      }}
    />
  );
}

export { megaMenus };