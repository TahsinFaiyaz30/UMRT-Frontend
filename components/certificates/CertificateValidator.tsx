'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  certificateRegistry,
  lookupCertificates,
  type CertificateLookupResult,
  type CertificateRecord,
} from '@/lib/certificateRegistry';
import styles from './CertificateValidator.module.css';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

function getResultAnnouncement(result: CertificateLookupResult | null) {
  if (!result) return '';
  if (result.kind === 'empty') return 'Enter a name or certificate ID to run verification.';
  if (result.kind === 'not-found') {
    return `Certificate not found for ${result.query}. Check the value and try again.`;
  }

  const validRecords = result.records.filter((record) => record.status === 'valid').length;
  if (validRecords === result.records.length) {
    return result.records.length === 1
      ? `Certificate verified for ${result.records[0].recipient.name}.`
      : `${result.records.length} certificates verified for ${result.records[0].recipient.name}.`;
  }

  return 'A certificate record was found, but its registry status requires review.';
}

function ResultCard({ record, index }: { record: CertificateRecord; index: number }) {
  const valid = record.status === 'valid';

  return (
    <article className={styles.credential} data-status={record.status}>
      <span className={styles.credentialScan} aria-hidden="true" />
      <header className={styles.credentialHeader}>
        <div className={styles.verificationSeal} aria-hidden="true">
          <span>{valid ? '✓' : '!'}</span>
          <i />
        </div>
        <div>
          <p>{valid ? 'Authenticated record' : 'Registry record located'}</p>
          <h3>{record.title}</h3>
        </div>
        <span className={styles.resultIndex}>{String(index + 1).padStart(2, '0')}</span>
      </header>

      <p className={styles.credentialDescription}>{record.description}</p>

      <dl className={styles.details}>
        <div className={styles.detailWide}>
          <dt>Recipient</dt>
          <dd>{record.recipient.name}</dd>
        </div>
        <div>
          <dt>Certificate ID</dt>
          <dd>{record.id}</dd>
        </div>
        <div>
          <dt>Issue date</dt>
          <dd>{formatDate(record.issuedOn)}</dd>
        </div>
        <div>
          <dt>Program</dt>
          <dd>{record.program}</dd>
        </div>
        <div>
          <dt>Role / contribution</dt>
          <dd>{record.role}</dd>
        </div>
        <div>
          <dt>Issued by</dt>
          <dd>{certificateRegistry.issuer.name}</dd>
        </div>
        <div>
          <dt>Registry status</dt>
          <dd className={valid ? styles.validStatus : styles.revokedStatus}>
            <i aria-hidden="true" />
            {valid ? 'Valid / active' : 'Revoked'}
          </dd>
        </div>
      </dl>

      <footer className={styles.credentialFooter}>
        <span>UMRT / Official certificate registry</span>
        <span>{certificateRegistry.issuer.location}</span>
      </footer>
    </article>
  );
}

function RegistryResponse({ result }: { result: CertificateLookupResult | null }) {
  if (!result) {
    return (
      <div className={styles.idleState}>
        <div className={styles.radar} aria-hidden="true">
          <span />
          <i />
          <b />
        </div>
        <p>Registry standing by</p>
        <h2 id="certificate-result-heading">
          Awaiting a credential.
        </h2>
        <span>Enter one exact certificate ID or recipient name to begin the verification sequence.</span>
      </div>
    );
  }

  if (result.kind === 'empty') {
    return (
      <div className={styles.errorState}>
        <span className={styles.errorCode}>INPUT / 00</span>
        <div className={styles.errorMark} aria-hidden="true">!</div>
        <p>Verification paused</p>
        <h2 id="certificate-result-heading">
          Enter a name or certificate ID.
        </h2>
        <span>The registry needs one exact value before it can run a validation check.</span>
      </div>
    );
  }

  if (result.kind === 'not-found') {
    return (
      <div className={styles.errorState}>
        <span className={styles.errorCode}>NO MATCH / 404</span>
        <div className={styles.errorMark} aria-hidden="true">×</div>
        <p>Registry response</p>
        <h2 id="certificate-result-heading">
          Certificate not found.
        </h2>
        <span>
          No certificate matches “{result.query}”. Check the spelling or enter the complete
          certificate ID and try again.
        </span>
      </div>
    );
  }

  const allValid = result.records.every((record) => record.status === 'valid');
  const resultCount = result.records.length;

  return (
    <div className={styles.foundState}>
      <header className={styles.foundHeader}>
        <div>
          <p>{allValid ? 'Registry response / verified' : 'Registry response / review required'}</p>
          <h2 id="certificate-result-heading">
            {allValid
              ? resultCount === 1
                ? 'Certificate verified.'
                : `${resultCount} certificates verified.`
              : 'Certificate record located.'}
          </h2>
        </div>
        <span>
          Matched by {result.matchedBy === 'id' ? 'certificate ID' : 'recipient name'}
        </span>
      </header>

      <div className={styles.resultList}>
        {result.records.map((record, index) => (
          <ResultCard key={record.id} record={record} index={index} />
        ))}
      </div>
    </div>
  );
}

export function CertificateValidator() {
  const pageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const responseRef = useRef<HTMLElement>(null);
  const pointerFrame = useRef(0);
  const pointerPosition = useRef({ x: 0, y: 0 });
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<CertificateLookupResult | null>(null);

  useEffect(() => {
    if (!result) return undefined;
    if (result.kind === 'empty') {
      inputRef.current?.focus();
      return undefined;
    }
    if (!window.matchMedia('(max-width: 820px)').matches) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const panel = responseRef.current;
      if (!panel) return;

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panel.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [result]);

  useEffect(() => () => {
    if (pointerFrame.current) window.cancelAnimationFrame(pointerFrame.current);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(lookupCertificates(query));
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    pointerPosition.current.x = event.clientX;
    pointerPosition.current.y = event.clientY;
    if (pointerFrame.current) return;

    pointerFrame.current = window.requestAnimationFrame(() => {
      pointerFrame.current = 0;
      const page = pageRef.current;
      if (!page) return;
      const x = pointerPosition.current.x / Math.max(window.innerWidth, 1) - 0.5;
      const y = pointerPosition.current.y / Math.max(window.innerHeight, 1) - 0.5;
      page.style.setProperty('--pointer-x', x.toFixed(3));
      page.style.setProperty('--pointer-y', y.toFixed(3));
    });
  };

  const handlePointerLeave = () => {
    if (pointerFrame.current) window.cancelAnimationFrame(pointerFrame.current);
    pointerFrame.current = 0;
    pageRef.current?.style.setProperty('--pointer-x', '0');
    pageRef.current?.style.setProperty('--pointer-y', '0');
  };

  const updatedAt = formatDate(certificateRegistry.updatedAt);
  const activeRecords = certificateRegistry.certificates.filter(
    (certificate) => certificate.status === 'valid',
  ).length;
  const responseState = !result
    ? 'idle'
    : result.kind !== 'found'
      ? 'error'
      : result.records.every((record) => record.status === 'valid')
        ? 'valid'
        : 'review';
  const resultAnnouncement = getResultAnnouncement(result);

  return (
    <div
      ref={pageRef}
      className={styles.page}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <section className={styles.hero} aria-labelledby="certificate-verification-title">
        <div className={styles.atmosphere} aria-hidden="true">
          <span className={styles.grid} />
          <span className={styles.glow} />
          <span className={styles.orbitOne}><i /></span>
          <span className={styles.orbitTwo}><i /></span>
          <span className={styles.scanLine} />
          <span className={styles.stars} />
        </div>

        <div className={styles.heroInner}>
          <header className={styles.intro}>
            <div>
              <p className={styles.kicker}>
                <i aria-hidden="true" />
                UMRT / Certificate registry / Online
              </p>
              <h1 id="certificate-verification-title">
                Verify<br />
                <span>the record.</span>
              </h1>
            </div>
            <div className={styles.introCopy}>
              <p>
                Confirm an official UIU Mars Rover Team credential in seconds. Search the
                registry with one certificate ID or the recipient&apos;s full name.
              </p>
              <div className={styles.protocol}>
                <span>Validation protocol</span>
                <b><i aria-hidden="true" /> Registry link stable</b>
              </div>
            </div>
          </header>

          <div className={styles.console}>
            <div className={styles.searchPanel} data-state={responseState}>
              <div className={styles.panelHeader}>
                <span>01 / Submit credential</span>
                <span>Exact match protocol</span>
              </div>

              <form className={styles.form} onSubmit={handleSubmit} noValidate>
                <label htmlFor="certificate-query">Certificate ID or recipient name</label>
                <div className={styles.inputShell}>
                  <span aria-hidden="true">⌕</span>
                  <input
                    ref={inputRef}
                    id="certificate-query"
                    name="certificate-query"
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      if (result) setResult(null);
                    }}
                    placeholder="UMRT-CERT-2025-001 or Arafat Rahman"
                    aria-describedby="certificate-query-hint"
                    aria-invalid={responseState === 'error'}
                    autoComplete="off"
                    maxLength={120}
                    spellCheck={false}
                  />
                </div>
                <p id="certificate-query-hint" className={styles.hint}>
                  Search is case-insensitive. Use the complete ID or the recipient&apos;s full name.
                </p>
                <button type="submit">
                  Run verification
                  <span aria-hidden="true">→</span>
                </button>
              </form>

              <dl className={styles.registryReadout} aria-label="Certificate registry status">
                <div>
                  <dt>Registry source</dt>
                  <dd>Static JSON mirror</dd>
                </div>
                <div>
                  <dt>Active records</dt>
                  <dd>{String(activeRecords).padStart(2, '0')}</dd>
                </div>
                <div>
                  <dt>Snapshot</dt>
                  <dd>{updatedAt}</dd>
                </div>
              </dl>
            </div>

            <section
              ref={responseRef}
              className={styles.responsePanel}
              data-state={responseState}
              aria-label="Certificate verification result"
              aria-labelledby="certificate-result-heading"
            >
              <div className={styles.panelHeader}>
                <span>02 / Registry response</span>
                <span>{result ? 'Sequence complete' : 'Listening'}</span>
              </div>
              <p className={styles.srOnly} role="status" aria-live="polite">
                {resultAnnouncement}
              </p>
              <RegistryResponse result={result} />
            </section>
          </div>

          <div className={styles.baseRail} aria-hidden="true">
            <span>23.8103° N / 90.4125° E</span>
            <span><i /> Verification channel open</span>
            <span>UIU / DHAKA / BANGLADESH</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default CertificateValidator;
