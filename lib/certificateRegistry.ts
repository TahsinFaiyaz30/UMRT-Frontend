import registryData from '@/data/certificates.json';

export type CertificateStatus = 'valid' | 'revoked';

export type CertificateRecord = {
  id: string;
  recipient: {
    name: string;
    aliases: string[];
  };
  title: string;
  program: string;
  role: string;
  issuedOn: string;
  status: CertificateStatus;
  description: string;
};

type CertificateRegistry = {
  schemaVersion: number;
  updatedAt: string;
  issuer: {
    name: string;
    shortName: string;
    location: string;
  };
  certificates: CertificateRecord[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid certificate registry field: ${field}`);
  }
}

function assertIsoDate(value: unknown, field: string): asserts value is string {
  assertNonEmptyString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid certificate registry date: ${field}`);
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid certificate registry date: ${field}`);
  }
}

function assertCertificateRegistry(value: unknown): asserts value is CertificateRegistry {
  if (!isObject(value) || value.schemaVersion !== 1) {
    throw new Error('Unsupported certificate registry schema');
  }
  assertIsoDate(value.updatedAt, 'updatedAt');

  if (!isObject(value.issuer)) throw new Error('Invalid certificate registry issuer');
  assertNonEmptyString(value.issuer.name, 'issuer.name');
  assertNonEmptyString(value.issuer.shortName, 'issuer.shortName');
  assertNonEmptyString(value.issuer.location, 'issuer.location');

  if (!Array.isArray(value.certificates)) {
    throw new Error('Invalid certificate registry certificates collection');
  }

  value.certificates.forEach((certificate, index) => {
    const prefix = `certificates[${index}]`;
    if (!isObject(certificate)) throw new Error(`Invalid certificate registry record: ${prefix}`);
    assertNonEmptyString(certificate.id, `${prefix}.id`);
    assertNonEmptyString(certificate.title, `${prefix}.title`);
    assertNonEmptyString(certificate.program, `${prefix}.program`);
    assertNonEmptyString(certificate.role, `${prefix}.role`);
    assertIsoDate(certificate.issuedOn, `${prefix}.issuedOn`);
    assertNonEmptyString(certificate.description, `${prefix}.description`);

    if (certificate.status !== 'valid' && certificate.status !== 'revoked') {
      throw new Error(`Invalid certificate registry status: ${prefix}.status`);
    }
    if (!isObject(certificate.recipient)) {
      throw new Error(`Invalid certificate registry recipient: ${prefix}.recipient`);
    }
    assertNonEmptyString(certificate.recipient.name, `${prefix}.recipient.name`);
    if (!Array.isArray(certificate.recipient.aliases)) {
      throw new Error(`Invalid certificate registry aliases: ${prefix}.recipient.aliases`);
    }
    certificate.recipient.aliases.forEach((alias, aliasIndex) => {
      assertNonEmptyString(alias, `${prefix}.recipient.aliases[${aliasIndex}]`);
    });
  });
}

export type CertificateLookupResult =
  | { kind: 'empty' }
  | { kind: 'not-found'; query: string }
  | {
      kind: 'found';
      query: string;
      matchedBy: 'id' | 'name';
      records: CertificateRecord[];
    };

const rawRegistry: unknown = registryData;
assertCertificateRegistry(rawRegistry);
export const certificateRegistry = rawRegistry;

function normalizeShared(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function normalizeId(value: string) {
  return normalizeShared(value)
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .toLocaleUpperCase('en-US');
}

function normalizeName(value: string) {
  return normalizeShared(value).toLocaleLowerCase('en-US');
}

const idIndex = new Map<string, CertificateRecord>();
const nameIndex = new Map<string, CertificateRecord[]>();

for (const record of certificateRegistry.certificates) {
  const normalizedId = normalizeId(record.id);
  if (idIndex.has(normalizedId)) {
    throw new Error(`Duplicate certificate ID in registry: ${record.id}`);
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

export function lookupCertificates(rawQuery: string): CertificateLookupResult {
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
