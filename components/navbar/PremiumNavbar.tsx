'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { megaMenus } from './megaMenuConfig';
import { useMegaMenu } from './useMegaMenu';
import { MegaMenuPanel, MegaMenuStyles } from './MegaMenuPanel';
import {
  BrandMark,
  ChevronDownIcon,
  ProfileIcon,
  SearchIcon,
  IconByName,
} from './NavbarIcons';

/**
 * PremiumNavbar
 * -------------
 * Frosted-glass top bar with:
 *   • left-zone brand wordmark
 *   • center-zone mega-menu triggers
 *   • right-zone utility icons + CTA
 *
 * Implementation notes
 * --------------------
 * • The bar is `position: fixed` so it stays in view on scroll but
 *   starts fully transparent; once the user scrolls past 8px the
 *   background saturates to the frosted-glass tint.
 * • No CSS `:hover` drives the mega-menu — every open/close is
 *   React state (useMegaMenu) with an intent delay on enter and a
 *   grace period on leave, plus a transparent "safe triangle" that
 *   lets the cursor travel diagonally from trigger to panel.
 * • Color tokens come from the project's `mars` palette so the bar
 *   visually belongs to the existing site without hardcoding a theme.
 */
export function PremiumNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const {
    activeId,
    mounted,
    isOpen,
    onTriggerEnter,
    onTriggerLeave,
    onPanelEnter,
    onPanelLeave,
    onCloseNow,
  } = useMegaMenu({ openDelayMs: 150, closeDelayMs: 300 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <MegaMenuStyles />
      <header
        className={[
          // Position: fixed bar that never leaves the top of the viewport.
          'fixed inset-x-0 top-0 z-50',
          // Frosted-glass surface. Heavy transparency + backdrop blur so
          // the underlying Mars scene bleeds through and the bar never
          // feels like a hard horizontal slab.
          'border-b transition-colors duration-300',
          scrolled
            ? 'border-mars-200/10 bg-black/45 backdrop-blur-xl supports-[backdrop-filter]:bg-black/35'
            : 'border-transparent bg-transparent backdrop-blur-0',
        ].join(' ')}
      >
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-6 px-6 lg:h-[72px] lg:px-10">
          {/* Left zone — brand */}
          <Link
            href="/"
            className="group inline-flex items-center gap-2.5 text-mars-50"
            aria-label="UMRT home"
          >
            <span
              className="grid h-9 w-9 place-items-center rounded-lg border border-mars-200/15 bg-black/35 text-mars-300 transition-colors duration-200 group-hover:border-mars-300/40 group-hover:text-mars-200"
              aria-hidden
            >
              <BrandMark className="h-5 w-5" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-display text-[15px] font-semibold tracking-tight">
                UMRT
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-mars-200/70">
                Mars Rover
              </span>
            </span>
          </Link>

          {/* Center zone — mega-menu triggers */}
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Primary"
          >
            {megaMenus.map((menu) => {
              const open = isOpen(menu.id);
              const isActive = activeId === menu.id;
              return (
                <div
                  key={menu.id}
                  className="relative"
                  onMouseEnter={() => onTriggerEnter(menu.id)}
                  onMouseLeave={onTriggerLeave}
                  onFocus={() => onTriggerEnter(menu.id)}
                >
                  <button
                    type="button"
                    data-open={isActive}
                    aria-haspopup="true"
                    aria-expanded={open}
                    onClick={() => {
                      if (open) onCloseNow();
                      else onTriggerEnter(menu.id);
                    }}
                    className={[
                      'mega-trigger group relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200',
                      open
                        ? 'bg-mars-500/15 text-mars-50'
                        : 'text-mars-100/85 hover:bg-white/5 hover:text-mars-50',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-mars-300/60',
                    ].join(' ')}
                  >
                    {menu.triggerIcon ? (
                      <IconByName
                        name={menu.triggerIcon}
                        className={[
                          'h-4 w-4 transition-colors duration-200',
                          open ? 'text-mars-300' : 'text-mars-200/70 group-hover:text-mars-200',
                        ].join(' ')}
                      />
                    ) : null}
                    {menu.triggerLabel}
                    <ChevronDownIcon
                      className={[
                        'h-3.5 w-3.5 transition-transform duration-200',
                        open ? 'rotate-180 text-mars-300' : 'text-mars-200/60',
                      ].join(' ')}
                    />
                  </button>
                </div>
              );
            })}

            {/* Achievements — direct link, no mega-menu */}
            <Link
              href="/achievements"
              className="group relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-mars-100/85 transition-colors duration-200 hover:bg-white/5 hover:text-mars-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-mars-300/60"
            >
              <svg
                className="h-4 w-4 text-mars-200/70 transition-colors duration-200 group-hover:text-mars-200"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
              Achievements
            </Link>
          </nav>

          {/* Right zone — utility icons + CTA */}
          <div className="flex items-center gap-2">
            <IconButton label="Search">
              <SearchIcon className="h-4 w-4" />
            </IconButton>
            <IconButton label="Account">
              <ProfileIcon className="h-4 w-4" />
            </IconButton>
            <a
              href="#download"
              className={[
                'ml-1 hidden items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200 sm:inline-flex',
                // High-contrast CTA — bright Mars 300 ring on a near-black
                // pill so it stands out from the rest of the bar.
                'border border-mars-300/40 bg-mars-300/15 text-mars-50 shadow-[0_0_0_1px_rgba(255,138,77,0.2)] hover:bg-mars-300/25 hover:shadow-[0_0_24px_-4px_rgba(255,138,77,0.6)]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-mars-300',
              ].join(' ')}
            >
              Download
            </a>
          </div>
        </div>

        {/* Mega-menu layer — sits in normal flow below the bar */}
        <div className="pointer-events-none absolute inset-x-0 top-full flex justify-center px-6">
          {megaMenus.map((menu) => (
            <MegaMenuPanel
              key={menu.id}
              menu={menu}
              mounted={mounted && activeId === menu.id}
              onPanelEnter={onPanelEnter}
              onPanelLeave={onPanelLeave}
            />
          ))}
        </div>
      </header>
    </>
  );
}

/**
 * Small icon-only button used in the right zone. Local component so
 * the navbar markup stays declarative.
 */
function IconButton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full border border-transparent text-mars-100/80 transition-colors duration-200 hover:border-mars-200/20 hover:bg-white/5 hover:text-mars-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-mars-300/60"
    >
      {children}
    </button>
  );
}

export default PremiumNavbar;