import * as THREE from 'three';

type MaterialLike = THREE.Material | THREE.Material[] | null | undefined;

type DisposeObjectOptions = {
  geometries?: boolean;
  materials?: boolean;
  textures?: boolean;
};

function textureValues(material: THREE.Material) {
  return Object.values(material).filter(
    (value): value is THREE.Texture => Boolean((value as THREE.Texture | undefined)?.isTexture),
  );
}

/** Release a texture and its decoded ImageBitmap when this route owns it. */
export function disposeTexture(
  texture: THREE.Texture,
  disposed = new Set<THREE.Texture>(),
) {
  if (disposed.has(texture)) return;
  disposed.add(texture);
  texture.dispose();

  const image = texture.source?.data as { close?: () => void } | undefined;
  if (typeof image?.close === 'function') image.close();
}

/** Dispose materials, optionally including the textures referenced by them. */
export function disposeMaterials(
  materialLike: MaterialLike,
  disposeTextures = false,
  disposedMaterials = new Set<THREE.Material>(),
  disposedTextures = new Set<THREE.Texture>(),
) {
  const materials = Array.isArray(materialLike) ? materialLike : materialLike ? [materialLike] : [];
  materials.forEach((material) => {
    if (disposedMaterials.has(material)) return;
    disposedMaterials.add(material);
    if (disposeTextures) {
      textureValues(material).forEach((texture) => disposeTexture(texture, disposedTextures));
    }
    material.dispose();
  });
}

/**
 * Dispose resources attached to an imperative Three.js subtree. R3F only owns
 * JSX-created children, so objects added with Object3D.add need explicit care.
 */
export function disposeObjectResources(
  root: THREE.Object3D,
  {
    geometries = true,
    materials = true,
    textures = false,
  }: DisposeObjectOptions = {},
) {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (geometries && mesh.geometry && !disposedGeometries.has(mesh.geometry)) {
      disposedGeometries.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    if (materials) {
      disposeMaterials(mesh.material, textures, disposedMaterials, disposedTextures);
    }
  });
}
