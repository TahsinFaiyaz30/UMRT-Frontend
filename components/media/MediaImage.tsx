'use client';

import { useCallback, useState, type CSSProperties } from 'react';
import type { MediaAsset } from '@/lib/content';
import styles from './MediaImage.module.css';

/**
 * Renders one asset from the generated media library.
 *
 * The pipeline already emitted the width ladder and an inline blur, so this
 * is deliberately a plain <img>: `next/image` would re-derive both at request
 * time and is a no-op under the project's static export. What it does add is
 * the two things a hand-rolled <img> usually gets wrong — an intrinsic aspect
 * ratio so the layout never shifts, and a blur that is replaced only once the
 * real bitmap has decoded.
 */
export function MediaImage({
  asset,
  sizes,
  className = '',
  priority = false,
  /** Override the box ratio; defaults to the asset's own. */
  ratio,
  alt,
}: {
  asset: MediaAsset;
  sizes: string;
  className?: string;
  priority?: boolean;
  ratio?: number;
  alt?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  // A cached image can finish decoding before React attaches onLoad. Catching
  // that on the ref keeps the blur from staying up forever; the callback is
  // memoised so an inline function does not detach the ref every render.
  const captureNode = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <div
      className={`${styles.frame} ${className}`}
      data-loaded={loaded ? 'true' : undefined}
      style={{
        '--media-ratio': String(ratio ?? asset.aspectRatio),
        backgroundImage: `url("${asset.blurDataUrl}")`,
      } as CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.src}
        srcSet={asset.srcSet}
        sizes={sizes}
        alt={alt ?? asset.alt}
        width={asset.width}
        height={asset.height}
        loading={priority ? 'eager' : 'lazy'}
        // `priority` assets are above the fold; everything else waits its turn.
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        ref={captureNode}
      />
    </div>
  );
}
