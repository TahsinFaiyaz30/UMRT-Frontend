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

export type CertificateLookupResult =
  | { kind: 'empty' }
  | { kind: 'not-found'; query: string }
  | {
      kind: 'found';
      query: string;
      matchedBy: 'id' | 'name';
      records: CertificateRecord[];
    };

export const certificateRegistry = registryData as CertificateRegistry;

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

  const names = new Set([record.recipient.name, ...record.recipient.aliases]);
  for (const name of names) {
    const normalizedName = normalizeName(name);
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
