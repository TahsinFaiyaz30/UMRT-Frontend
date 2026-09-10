'use client';

import type { ReactNode } from 'react';
import { useContentRecords, type SectionRecord } from '@/lib/content';
import styles from './HomeSections.module.css';

/**
 * Shared furniture for the post-mission sections.
 *
 * The rest of the site speaks a fairly specific dialect — corner brackets on
 * every panel, 7px tracked-out telemetry labels, a pulsing signal dot on
 * anything "live", spec tables as `dl`s, and a stroke-only echo of the
 * headline sitting behind it. These pieces exist so all five sections speak it
 * without repeating the markup, and so the dialect only has to be adjusted in
 * one place.
 */

export type Spec = { label: string; value: string };

/** Tiny status row: `CODE / 01` on the left, a live dot on the right. */
export function PanelHead({ code, status = 'LOGGED' }: { code: string; status?: string }) {
  return (
    <div className={styles.panelHead}>
      <span>{code}</span>
      <strong><i aria-hidden="true" />{status}</strong>
    </div>
  );
}

/** The `MISSION WINDOW / 2020—NOW` table used across the archive. */
export function SpecList({ specs, className = '' }: { specs: Spec[]; className?: string }) {
  if (specs.length === 0) return null;
  return (
    <dl className={`${styles.specs} ${className}`}>
      {specs.map((spec) => (
        <div key={spec.label}>
          <dt>{spec.label}</dt>
          <dd>{spec.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Decorative level meter. Bar heights are deterministic, not random. */
export function SignalBars({ count = 16, seed = 1 }: { count?: number; seed?: number }) {
  return (
    <div className={styles.signalBars} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <i
          key={index}
          style={{
            // A couple of out-of-phase sines read as a real readout rather
            // than a repeating sawtooth, and stay stable across renders.
            height: `${28 + Math.abs(Math.sin(index * 0.7 + seed) * 52 + Math.sin(index * 1.9) * 18)}%`,
          }}
        />
      ))}
    </div>
  );
}

export type SectionTokens = Record<string, string | number>;

/** Replaces `{token}` placeholders with live figures supplied by the caller. */
export function fillTokens(value: string, tokens: SectionTokens) {
  return value.replace(/\{(\w+)\}/g, (match, key: string) => (
    key in tokens ? String(tokens[key]) : match
  ));
}

/**
 * Loads one section's editorial copy from the content API.
 *
 * Returns null until the record arrives, which is what lets a section render
 * nothing rather than a half-built header. Against the static adapter the
 * first page is seeded synchronously, so there is no flash.
 */
export function useSection(id: string): SectionRecord | null {
  const { records } = useContentRecords('sections');
  return records.find((section) => section.id === id) ?? null;
}

export function SectionHeader({
  section,
  titleId,
  tokens = {},
}: {
  section: SectionRecord;
  titleId: string;
  tokens?: SectionTokens;
}) {
  const { title } = section;

  return (
    <header className={styles.header}>
      <div className={styles.headerMain}>
        <span className={styles.echo} aria-hidden="true">{section.echo}</span>
        <p className={styles.kicker}>
          <i className={styles.signalDot} aria-hidden="true" />
          <span aria-hidden="true">{section.index}</span>
          {section.kicker}
        </p>
        {/* Three parts, following the hero's rhythm: solid, outlined, then
            the solar-orange close. */}
        <h2 id={titleId} className={styles.heading}>
          {title.lead}
          {title.outline ? <><br /><span>{title.outline}</span></> : null}
          {title.accent ? <> <em>{title.accent}</em></> : null}
        </h2>
      </div>

      <div className={styles.headerAside}>
        {section.lede ? (
          <p className={styles.lede}>{fillTokens(section.lede, tokens)}</p>
        ) : null}
        <SpecList
          specs={section.specs.map((spec) => ({
            label: spec.label,
            value: fillTokens(spec.value, tokens),
          }))}
        />
        <div className={styles.measure} aria-hidden="true">
          <span />
          <small>{section.index} / 12</small>
          <span />
        </div>
      </div>
    </header>
  );
}
