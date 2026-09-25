import * as THREE from 'three';

/** Each encounter acquires only its own maps. Entries disappear with the last
 * resident/preparing user; an aborted fetch never leaves a decoded bitmap. */
interface Entry {
  users: number;
  controller: AbortController;
  ready: Promise<THREE.Texture>;
  texture?: THREE.Texture;
  bitmap?: ImageBitmap;
  decodedBytes: number;
}

const maps = new Map<string, Entry>();

export interface SolarTextureLease {
  ready: Promise<THREE.Texture>;
  release: () => void;
}

export function acquireSolarTexture(id: string, data = false): SolarTextureLease {
  const key = `${id}:${data}`;
  let entry = maps.get(key);
  if (!entry) {
    const controller = new AbortController();
    const created: Entry = { users: 0, controller, decodedBytes: 0, ready: Promise.resolve(null as unknown as THREE.Texture) };
    const decode = async () => {
      const response = await fetch(`/textures/solar/${id}.webp`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Unable to load Solar System map ${id} (${response.status})`);
      const blob = await response.blob();
      controller.signal.throwIfAborted();
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
      if (controller.signal.aborted || created.users === 0) {
        bitmap.close();
        throw new DOMException('Solar texture retired', 'AbortError');
      }
      created.bitmap = bitmap;
      created.decodedBytes = bitmap.width * bitmap.height * 4;
      const texture = new THREE.Texture(bitmap);
      created.texture = texture;
      texture.name = `solar-${id}`;
      texture.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.anisotropy = 8;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      return texture;
    };
    let onAbort: () => void;
    const timeout = setTimeout(() => controller.abort(new DOMException('Solar map request timed out', 'TimeoutError')), 12_000);
    // Decoders cannot be cancelled, so readiness races the owned abort event.
    // decode() still observes retirement and closes a bitmap arriving late.
    created.ready = new Promise<THREE.Texture>((resolve, reject) => {
      onAbort = () => reject(controller.signal.reason ?? new DOMException('Solar texture retired', 'AbortError'));
      controller.signal.addEventListener('abort', onAbort, { once: true });
      void decode().then(resolve, reject);
    }).finally(() => {
      clearTimeout(timeout);
      controller.signal.removeEventListener('abort', onAbort);
    });
    entry = created;
    maps.set(key, created);
  }
  entry.users++;
  const acquired = entry;
  let released = false;
  return {
    ready: acquired.ready,
    release() {
      if (released) return;
      released = true;
      acquired.users--;
      if (acquired.users !== 0) return;
      acquired.controller.abort();
      acquired.texture?.dispose();
      acquired.bitmap?.close();
      acquired.texture = undefined;
      acquired.bitmap = undefined;
      acquired.decodedBytes = 0;
      if (maps.get(key) === acquired) maps.delete(key);
    },
  };
}

export function solarTextureStats() {
  let users = 0, decodedBytes = 0;
  for (const entry of maps.values()) { users += entry.users; decodedBytes += entry.decodedBytes; }
  return { residentMaps: maps.size, users, decodedBytes, estimatedGpuBytes: Math.ceil(decodedBytes * 4 / 3) };
}
