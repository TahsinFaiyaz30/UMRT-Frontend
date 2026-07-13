'use client';

import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import styles from './CertificatesArchive.module.css';

type CertificateTone = 'solar' | 'signal' | 'rust' | 'graphite';

type CertificateRecord = {
  id: string;
  category: string;
  title: string;
  sequence: string;
  tone: CertificateTone;
};

const CERTIFICATES: readonly CertificateRecord[] = [
  {
    id: 'CR-01',
    category: 'Competition',
    title: 'Competition Recognition',
    sequence: 'Archive placeholder 01',
    tone: 'solar',
  },
  {
    id: 'CR-02',
    category: 'Engineering',
    title: 'Technical Excellence',
    sequence: 'Archive placeholder 02',
    tone: 'signal',
  },
  {
    id: 'CR-03',
    category: 'International',
    title: 'International Participation',
    sequence: 'Archive placeholder 03',
    tone: 'rust',
  },
  {
    id: 'CR-04',
    category: 'Innovation',
    title: 'Innovation Citation',
    sequence: 'Archive placeholder 04',
    tone: 'graphite',
  },
  {
    id: 'CR-05',
    category: 'Team',
    title: 'Team Distinction',
    sequence: 'Archive placeholder 05',
    tone: 'signal',
  },
  {
    id: 'CR-06',
    category: 'Qualification',
    title: 'Mission Qualification',
    sequence: 'Archive placeholder 06',
    tone: 'solar',
  },
  {
    id: 'CR-07',
    category: 'Outreach',
    title: 'Community Outreach',
    sequence: 'Archive placeholder 07',
    tone: 'graphite',
  },
  {
    id: 'CR-08',
    category: 'Engineering',
    title: 'Engineering Achievement',
    sequence: 'Archive placeholder 08',
    tone: 'rust',
  },
] as const;

function CertificateDocument({
  record,
  decorative = false,
}: {
  record: CertificateRecord;
  decorative?: boolean;
}) {
  const label = `Placeholder for ${record.title} certificate`;

  return (
    <div
      className={styles.document}
      data-tone={record.tone}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      data-cosmic-document
    >
      <span className={styles.documentGrain} aria-hidden="true" />
      <div className={styles.documentCosmos} aria-hidden="true">
        <span className={styles.cosmicMarsLimb} />
        <span className={styles.cosmicContours} />
        <i className={styles.cosmicProbe} />
      </div>
      <div className={styles.documentReticle} aria-hidden="true">
        <span><i /></span>
        <b>Orbital lock / {record.id}</b>
      </div>
      <span className={styles.documentFrame} aria-hidden="true" />
      <span className={styles.documentCornerA} aria-hidden="true" />
      <span className={styles.documentCornerB} aria-hidden="true" />

      <header className={styles.documentHeader}>
        <span>UIU Mars Rover Team</span>
        <span>Record / {record.id}</span>
      </header>

      <div className={styles.documentBody}>
        <div className={styles.documentMark} aria-hidden="true">
          <span />
          <i />
        </div>
        <p>Certificate of</p>
        <h3>{record.title}</h3>
        <span className={styles.documentRecipient}>UIU Mars Rover Team</span>
        <small>
          Reserved for the official certificate and verified document details.
        </small>
      </div>

      <footer className={styles.documentFooter}>
        <div>
          <i />
          <span>Authorized signature</span>
        </div>
        <div className={styles.documentSeal} aria-hidden="true">
          <b>UMRT</b>
          <span>Archive</span>
        </div>
        <div>
          <i />
          <span>Issue date / 20—</span>
        </div>
      </footer>

      <div className={styles.documentPlaceholder}>
        <span>Placeholder</span>
        <b>Original scan pending</b>
      </div>
    </div>
  );
}

function setCosmicPointer(event: ReactPointerEvent<HTMLElement>) {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (event.pointerType === 'touch' || !finePointer || reducedMotion) return;
  const element = event.currentTarget;
  const document = element.querySelector<HTMLElement>('[data-cosmic-document]');
  const bounds = document?.getBoundingClientRect() ?? element.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
  const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / Math.max(1, bounds.height)));

  element.style.setProperty('--scan-x', `${(x * 100).toFixed(1)}%`);
  element.style.setProperty('--scan-y', `${(y * 100).toFixed(1)}%`);
  element.style.setProperty('--drift-x', `${((x - 0.5) * -12).toFixed(1)}px`);
  element.style.setProperty('--drift-y', `${((y - 0.5) * -8).toFixed(1)}px`);
}

function resetCosmicPointer(event: ReactPointerEvent<HTMLElement>) {
  const element = event.currentTarget;
  element.style.setProperty('--scan-x', '50%');
  element.style.setProperty('--scan-y', '50%');
  element.style.setProperty('--drift-x', '0px');
  element.style.setProperty('--drift-y', '0px');
}

function setStageTilt(event: ReactPointerEvent<HTMLElement>) {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (event.pointerType === 'touch' || !finePointer || reducedMotion) return;
  const element = event.currentTarget;
  const bounds = element.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5;
  const y = (event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5;

  element.style.setProperty('--tilt-x', `${(-y * 2.8).toFixed(2)}deg`);
  element.style.setProperty('--tilt-y', `${(x * 2.8).toFixed(2)}deg`);
  element.style.setProperty('--light-x', `${((x + 0.5) * 100).toFixed(1)}%`);
  element.style.setProperty('--light-y', `${((y + 0.5) * 100).toFixed(1)}%`);
}

function resetStageTilt(event: ReactPointerEvent<HTMLElement>) {
  const element = event.currentTarget;
  element.style.setProperty('--tilt-x', '0deg');
  element.style.setProperty('--tilt-y', '0deg');
  element.style.setProperty('--light-x', '50%');
  element.style.setProperty('--light-y', '50%');
}

export function CertificatesArchive() {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return undefined;

    const targets = Array.from(
      page.querySelectorAll<HTMLElement>('[data-certificate-reveal]'),
    );
    page.dataset.enhanced = 'true';

    if (!('IntersectionObserver' in window)) {
      targets.forEach((target) => { target.dataset.visible = 'true'; });
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).dataset.visible = 'true';
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={pageRef} className={styles.page}>
      <section className={styles.hero} aria-labelledby="certificate-page-title">
        <div className={styles.heroAtmosphere} aria-hidden="true">
          <span className={styles.heroOrbitA} />
          <span className={styles.heroOrbitB} />
          <span className={styles.heroSignal} />
        </div>

        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>
              <i aria-hidden="true" />
              UMRT / Mission credentials / Archive preview
            </p>
            <h1 id="certificate-page-title">
              <span>Certified</span>
              <em>in the field.</em>
            </h1>
            <p className={styles.heroDescription}>
              The paper trail behind the engineering. This archive is being
              prepared for UMRT&apos;s official competition, innovation, and
              mission certificates.
            </p>
            <a className={styles.heroAction} href="#certificate-archive">
              Inspect the archive
              <span aria-hidden="true">↓</span>
            </a>

            <dl className={styles.heroReadout} aria-label="Certificate archive status">
              <div>
                <dt>Records staged</dt>
                <dd>08</dd>
              </div>
              <div>
                <dt>Archive state</dt>
                <dd>Preview</dd>
              </div>
              <div>
                <dt>Next sync</dt>
                <dd>Official scans</dd>
              </div>
            </dl>
          </div>

          <div
            className={styles.heroStage}
            onPointerMove={setStageTilt}
            onPointerLeave={resetStageTilt}
            onPointerCancel={resetStageTilt}
            onLostPointerCapture={resetStageTilt}
            aria-hidden="true"
          >
            <div className={styles.stageOrbit}><i /><i /><i /></div>
            <div className={styles.stageSheetBack}>
              <span>CR-03</span>
            </div>
            <div className={styles.stageSheetMid}>
              <span>CR-02</span>
            </div>
            <div className={styles.stageDocument}>
              <CertificateDocument record={CERTIFICATES[0]} decorative />
            </div>
            <div className={styles.stageScan} />
            <div className={styles.stageTelemetry}>
              <span>Document / CR-01</span>
              <b>Awaiting original scan</b>
            </div>
          </div>
        </div>

        <div className={styles.heroBase} aria-hidden="true">
          <span>23.8103° N / 90.4125° E</span>
          <div><i /> Archive carrier online</div>
          <span>DHAKA / BANGLADESH / EARTH</span>
        </div>
      </section>

      <div className={styles.transmission} aria-hidden="true">
        <div>
          <span>Certificates / Evidence / Recognition / Engineering</span>
          <span>Official records incoming</span>
          <span>UMRT mission credentials</span>
          <span>Certificates / Evidence / Recognition / Engineering</span>
          <span>Official records incoming</span>
          <span>UMRT mission credentials</span>
        </div>
      </div>

      <section
        id="certificate-archive"
        className={styles.archive}
        aria-labelledby="certificate-archive-title"
      >
        <header className={styles.archiveHeader} data-certificate-reveal data-visible="false">
          <div>
            <p className={styles.kicker}>
              <i aria-hidden="true" />
              Document register / 001—008
            </p>
            <h2 id="certificate-archive-title">The paper trail.</h2>
          </div>
          <p>
            Eight positions are staged for the team&apos;s official records. Each
            placeholder will be replaced by a verified, high-resolution
            certificate scan.
          </p>
        </header>

        <div className={styles.archiveStatus} data-certificate-reveal data-visible="false">
          <div>
            <span>Archive preview</span>
            <b><i aria-hidden="true" /> Interface online</b>
          </div>
          <div>
            <span>Collection</span>
            <b>08 placeholders</b>
          </div>
          <div>
            <span>Source files</span>
            <b>Pending upload</b>
          </div>
          <div>
            <span>Public access</span>
            <b>Visible</b>
          </div>
        </div>

        <ol className={styles.grid} aria-label="Certificate placeholders">
          {CERTIFICATES.map((record, index) => (
            <li
              key={record.id}
              className={styles.card}
              data-tone={record.tone}
              data-certificate-reveal
              data-visible="false"
              onPointerMove={setCosmicPointer}
              onPointerLeave={resetCosmicPointer}
              onPointerCancel={resetCosmicPointer}
              onLostPointerCapture={resetCosmicPointer}
            >
              <article>
                <div className={styles.cardCosmos} aria-hidden="true">
                  <span className={styles.cosmicNebula} />
                  <span className={`${styles.cosmicOrbit} ${styles.cosmicOrbitA}`}><i /></span>
                  <span className={`${styles.cosmicOrbit} ${styles.cosmicOrbitB}`}><i /></span>
                  <span className={`${styles.cosmicOrbit} ${styles.cosmicOrbitC}`}><i /></span>
                  <span className={styles.cosmicStars}>
                    <i /><i /><i /><i /><i /><i /><i /><i />
                  </span>
                  <span className={styles.cosmicCore}><i /></span>
                  <b>Gravity field / {record.id}</b>
                </div>
                <div className={styles.cardVisual}>
                  <CertificateDocument record={record} />
                  <span className={styles.cardIndex} aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className={styles.cardMeta}>
                  <div>
                    <span>{record.category}</span>
                    <h3>{record.title}</h3>
                  </div>
                  <div>
                    <span>{record.sequence}</span>
                    <b>{record.id} <i aria-hidden="true">↗</i></b>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.closing} data-certificate-reveal data-visible="false">
        <div className={styles.closingGrid} aria-hidden="true" />
        <div className={styles.closingCopy}>
          <p>Archive status / Building the record</p>
          <h2>
            Real work.<br />
            <span>Real proof.</span>
          </h2>
        </div>
        <div className={styles.closingNote}>
          <span>Transmission 001</span>
          <p>
            The layout is ready. Official certificate scans, dates, and issuing
            bodies can drop into this archive as soon as they are available.
          </p>
          <a href="mailto:marsrover@uiu.ac.bd?subject=UMRT%20Certificate%20Archive">
            Submit an archive record <i aria-hidden="true">→</i>
          </a>
        </div>
      </section>
    </div>
  );
}

export default CertificatesArchive;
