'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { MediaAsset } from '@/lib/content';
import styles from './MediaImage.module.css';

/**
 * Renders one asset from the generated media library.
 *
 * The pipeline already emitted the width ladder and an inline blur, so this is
 * deliberately a plain <img>: `next/image` would re-derive both at request time
 * and is a no-op under the project's static export. What it adds is the two
 * things a hand-rolled <img> usually gets wrong.
 *
 * First, an intrinsic aspect ratio, so the box is reserved before the bytes
 * arrive and a page of lazy photography never shifts under the reader.
 *
 * Second, the swap waits on `decode()` rather than `load`. `load` only means
 * the bytes are in — the browser still has to turn a WebP into a bitmap, and
 * doing that during the same frame it becomes visible is what produces the
 * flash-then-settle you get from a naive fade-in. Decoding first means the
 * frame that reveals the photograph is the frame that can already paint it.
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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const reveal = useCallback((node: HTMLImageElement) => {
    const settle = () => {
      if (mountedRef.current) setLoaded(true);
    };
    // A browser without decode(), or a decode that rejects because the element
    // was detached mid-flight, must still reveal rather than hold the blur.
    if (typeof node.decode !== 'function') {
      settle();
      return;
    }
    node.decode().then(settle, settle);
  }, []);

  // A cached image can finish before React attaches onLoad, so the ref has to
  // catch that case too. Memoised so an inline callback does not detach and
  // reattach the ref on every render.
  const captureNode = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) reveal(node);
  }, [reveal]);

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
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        draggable={false}
        onLoad={(event) => reveal(event.currentTarget)}
        ref={captureNode}
      />
    </div>
  );
}
