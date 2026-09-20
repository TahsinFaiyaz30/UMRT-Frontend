import type { CertificateRecord } from '@/lib/content';

export type { CertificateRecord, CertificateStatus } from '@/lib/content';

export type CertificateLookupResult =
  | { kind: 'empty' }
  | { kind: 'not-found'; query: string }
  | {
      kind: 'found';
      query: string;
      matchedBy: 'id' | 'name';
      records: CertificateRecord[];
    };

/**
 * Structural checks on a record fetched from the content API.
 *
 * The committed local JSON is trusted, but a live backend is not — a bad
 * record here should not take down the verifier for every visitor. Callers
 * filter on this rather than throw, matching the rest of the content layer's
 * "degrade, don't break" behaviour (see docs/CONTENT_API.md §6).
 */
export function isValidCertificateRecord(record: CertificateRecord): boolean {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  return (
    Boolean(record.id?.trim())
    && Boolean(record.title?.trim())
    && Boolean(record.program?.trim())
    && Boolean(record.role?.trim())
    && Boolean(record.description?.trim())
    && (record.status === 'valid' || record.status === 'revoked')
    && isoDate.test(record.issuedOn)
    && !Number.isNaN(new Date(`${record.issuedOn}T00:00:00Z`).getTime())
    && Boolean(record.recipient?.name?.trim())
    && Array.isArray(record.recipient?.aliases)
  );
}

function normalizeShared(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function normalizeId(value: string) {
  return normalizeShared(value)
    .replace(/[‐-―−]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .toLocaleUpperCase('en-US');
}

function normalizeName(value: string) {
  return normalizeShared(value).toLocaleLowerCase('en-US');
}

export interface CertificateIndexes {
  idIndex: Map<string, CertificateRecord>;
  nameIndex: Map<string, CertificateRecord[]>;
}

/**
 * Builds the ID/name lookup indexes from whatever valid records the content
 * layer returned. A duplicate ID keeps the first record and logs rather than
 * throwing — one bad record from a live backend should not break lookup for
 * every other certificate.
 */
export function buildCertificateIndexes(records: CertificateRecord[]): CertificateIndexes {
  const idIndex = new Map<string, CertificateRecord>();
  const nameIndex = new Map<string, CertificateRecord[]>();

  for (const record of records) {
    if (!isValidCertificateRecord(record)) {
      console.error(`Invalid certificate record skipped: ${record?.id ?? '(no id)'}`);
      continue;
    }

    const normalizedId = normalizeId(record.id);
    if (idIndex.has(normalizedId)) {
      console.error(`Duplicate certificate ID in registry, keeping the first: ${record.id}`);
      continue;
    }
    idIndex.set(normalizedId, record);

    const normalizedNames = new Set(
      [record.recipient.name, ...record.recipient.aliases].map(normalizeName),
    );
    for (const normalizedName of normalizedNames) {
      const matches = nameIndex.get(normalizedName) ?? [];
      matches.push(record);
      nameIndex.set(normalizedName, matches);
    }
  }

  return { idIndex, nameIndex };
}

export function lookupCertificates(
  { idIndex, nameIndex }: CertificateIndexes,
  rawQuery: string,
): CertificateLookupResult {
  const query = normalizeShared(rawQuery);
  if (!query) return { kind: 'empty' };

  const idMatch = idIndex.get(normalizeId(query));
  if (idMatch) {
    return { kind: 'found', query, matchedBy: 'id', records: [idMatch] };
  }

  const nameMatches = nameIndex.get(normalizeName(query));
  if (nameMatches?.length) {
    return { kind: 'found', query, matchedBy: 'name', records: nameMatches };
  }

  return { kind: 'not-found', query };
}
