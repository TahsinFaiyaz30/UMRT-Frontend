'use client';

import dynamic from 'next/dynamic';

// MarsExperience must run client-only because it boots WebGL + Lenis +
// ScrollTrigger. The dynamic() import is required for ssr:false.
//
// The fallback below is what the user sees during the very first paint
// (typically < 1 frame on warm devices, at most a couple of frames
// while the dynamic-imported chunk streams in). It is deliberately a
// CONTINUATION of the live scene's clear color and a static Mars sky
// gradient — NOT a spinner or shimmer — so there is no visual "loading"
// stage. The instant SceneCanvas mounts inside MarsExperience it paints
// the same gradient as its first frame, and Suspense within R3F keeps
// the same colour visible until the GLB finishes parsing.
const MarsExperience = dynamic(
  () => import('@/components/experience/MarsExperience'),
  {
    ssr: false,
    loading: () => <div className="page-pre-paint" />,
  },
);

export default function Page() {
  return (
    <>
      {/* Keep the large rover asset route-local: the achievements journey is
          now entirely model-free and should never pay this network cost. */}
      <link
        rel="preload"
        as="fetch"
        crossOrigin="anonymous"
        href="/models/curiosity_v4_semantic_external.glb"
      />
      <MarsExperience />
    </>
  );
}
