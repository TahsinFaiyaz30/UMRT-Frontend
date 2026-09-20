/**
 * UMRT content API — public surface.
 *
 * Components import from `@/lib/content` and never from the adapters below
 * it, so swapping the static JSON for a live server touches one env var.
 */

export {
  ContentApiError,
  getContent,
  isRemoteContentApi,
  listAllContent,
  listContent,
} from './client';

export {
  filterMediaByTags,
  getMediaAsset,
  listMediaAssets,
  mediaRevision,
  pickVariant,
  resolveMediaRef,
  resolveMediaRefs,
} from './media';

export {
  useContentCollection,
  useContentRecords,
  type CollectionState,
  type CollectionStatus,
  type UseContentCollectionOptions,
} from './useContent';

export type {
  AchievementCategory,
  AchievementRecord,
  CertificateRecord,
  CertificateStatus,
  CollectionQuery,
  CollectionResponse,
  CrewMember,
  DivisionRecord,
  EventRecord,
  MediaAsset,
  MediaRef,
  MediaVariant,
  MediaVideoSource,
  PageInfo,
  PartnerRecord,
  ResourceMap,
  ResourceName,
  SectionRecord,
  SingleResponse,
  SocialLinks,
  TeamTierRecord,
} from './types';
