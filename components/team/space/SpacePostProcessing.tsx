'use client';

import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { HalfFloatType, NoToneMapping } from 'three';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  type Effect,
  type Pass,
} from 'postprocessing';

// The installed SMAA implementation emits "load" after decoding its embedded
// lookup images; its public types currently inherit only Effect's "change" event.
type SmaaWithLoadEvent = SMAAEffect & {
  addEventListener(type: 'load', listener: () => void): void;
  removeEventListener(type: 'load', listener: () => void): void;
};

/** Explicit ownership keeps every framebuffer and effect inside this lifetime. */
export function SpacePostProcessing() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const composerRef = useRef<EffectComposer | null>(null);

  useLayoutEffect(() => {
    const previousToneMapping = gl.toneMapping;
    const previousAutoClear = gl.autoClear;
    let composer: EffectComposer | undefined;
    let smaa: SmaaWithLoadEvent | undefined;
    let smaaLoaded = false;
    let retired = false;
    const orphanEffects = new Set<Effect>();
    const orphanPasses = new Set<Pass>();

    const onSmaaLoad = () => {
      smaaLoaded = true;
      smaa?.removeEventListener('load', onSmaaLoad);
      if (retired) {
        // SMAA decodes embedded lookup images asynchronously. If StrictMode or
        // navigation retired the pass first, release those late-created textures
        // without disposing the already-retired passes a second time.
        smaa?.weightsMaterial.searchTexture?.dispose();
        smaa?.weightsMaterial.areaTexture?.dispose();
      } else {
        invalidate();
      }
    };

    const dispose = () => {
      if (retired) return;
      retired = true;
      if (composerRef.current === composer) composerRef.current = null;
      if (smaaLoaded) smaa?.removeEventListener('load', onSmaaLoad);
      try {
        // postprocessing 6.39 owns passes -> effects -> internal targets. Calling
        // their dispose methods separately would release the same assets twice.
        composer?.dispose();
        for (const pass of orphanPasses) pass.dispose();
        for (const effect of orphanEffects) effect.dispose();
      } finally {
        orphanPasses.clear();
        orphanEffects.clear();
        gl.toneMapping = previousToneMapping;
        gl.autoClear = previousAutoClear;
      }
    };

    const addPass = (pass: Pass) => {
      orphanPasses.add(pass);
      try {
        composer!.addPass(pass);
      } finally {
        // addPass can throw either before or after attaching its pass (for
        // example while creating the depth target). Keep exactly one owner.
        if (composer!.passes.includes(pass)) orphanPasses.delete(pass);
      }
    };
    const effectPass = (...effects: Effect[]) => {
      const pass = new EffectPass(camera, ...effects);
      orphanPasses.add(pass);
      for (const effect of effects) orphanEffects.delete(effect);
      addPass(pass);
    };

    try {
      gl.toneMapping = NoToneMapping;
      // Attach the renderer after ownership is established, so initialization
      // errors can still release the allocated targets and restore renderer state.
      composer = new EffectComposer(undefined, {
        frameBufferType: HalfFloatType,
        multisampling: 0,
        depthBuffer: true,
        stencilBuffer: false,
      });
      composer.setRenderer(gl);
      addPass(new RenderPass(scene, camera));

      smaa = new SMAAEffect({ preset: SMAAPreset.ULTRA }) as SmaaWithLoadEvent;
      orphanEffects.add(smaa);
      smaa.addEventListener('load', onSmaaLoad);
      effectPass(smaa);

      const bloom = new BloomEffect({
        intensity: 0.45,
        luminanceThreshold: 1.1,
        luminanceSmoothing: 0.4,
        mipmapBlur: true,
        radius: 0.6,
      });
      orphanEffects.add(bloom);
      const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
      orphanEffects.add(toneMapping);
      effectPass(bloom, toneMapping);

      composerRef.current = composer;
      // The composer disables autoClear when attached. Limit that mutation to
      // each explicit render below, rather than leaking it to other scene work.
      gl.autoClear = previousAutoClear;
      invalidate();
    } catch (error) {
      dispose();
      throw error;
    }
    return dispose;
  }, [gl, scene, camera, invalidate]);

  useLayoutEffect(() => {
    // CSS dimensions only: the composer reads the renderer's actual drawing
    // buffer after DPR changes and resizes every owned target consistently.
    composerRef.current?.setSize(size.width, size.height, false);
  }, [size.width, size.height, dpr]);

  useFrame((_, delta) => {
    const composer = composerRef.current;
    if (!composer) return;
    const previousAutoClear = gl.autoClear;
    const previousTarget = gl.getRenderTarget();
    gl.autoClear = true;
    try {
      composer.render(delta);
    } finally {
      // Preserve render errors while restoring state even if a pass throws.
      gl.autoClear = previousAutoClear;
      gl.setRenderTarget(previousTarget);
    }
  }, 1);

  return null;
}
