'use client';

/**
 * Client boundary for the space field and cinematic observation HUD.
 *
 * The team layout is a Server Component (it owns `metadata`), and
 * `next/dynamic` with `ssr: false` is only legal on the client — so the lazy
 * import lives here.
 */

import dynamic from 'next/dynamic';
import { CinematicObservationHUD } from './CinematicObservationHUD';

const TeamSpaceField = dynamic(
  () => import('./TeamSpaceField').then((m) => m.TeamSpaceField),
  { ssr: false },
);

export function TeamSpaceMount() {
  return (
    <>
      <TeamSpaceField />
      <CinematicObservationHUD />
    </>
  );
}
