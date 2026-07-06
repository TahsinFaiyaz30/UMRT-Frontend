/**
 * Mega-menu configuration for <PremiumNavbar />.
 *
 * Each entry corresponds to a center-zone nav link. Hovering the link
 * opens a wide multi-column panel with a featured spotlight, quick links
 * and a short blurb. Content is data-driven so the navbar can be
 * edited without touching component logic.
 */

export type MegaMenuLink = {
  /** Display label. */
  label: string;
  /** Short description rendered under the label. */
  description?: string;
  /** Anchor or route to navigate to. */
  href: string;
  /** Optional small badge (e.g. "New", "Beta"). */
  badge?: string;
};

export type MegaMenuGroup = {
  /** Column heading. */
  heading: string;
  /** Links rendered in this column. */
  links: MegaMenuLink[];
};

export type MegaMenuSpotlight = {
  /** Tiny eyebrow label. */
  eyebrow: string;
  /** Big headline. */
  title: string;
  /** Supporting paragraph. */
  body: string;
  /** CTA link rendered at the bottom of the spotlight. */
  ctaLabel: string;
  ctaHref: string;
};

export type MegaMenuConfig = {
  /** Key used by React for the open menu state. */
  id: string;
  /** Text shown on the trigger link. */
  triggerLabel: string;
  /** Optional icon name from <Icon /> in the navbar component. */
  triggerIcon?: 'compass' | 'cube' | 'terminal' | 'spark';
  /** Groups of links rendered left-to-right. */
  groups: MegaMenuGroup[];
  /** Right-hand spotlight card. */
  spotlight: MegaMenuSpotlight;
};

export const megaMenus: MegaMenuConfig[] = [
  {
    id: 'products',
    triggerLabel: 'Products',
    triggerIcon: 'cube',
    groups: [
      {
        heading: 'Platform',
        links: [
          { label: 'Mars Rover Suite', description: 'Mission control for ground robotics.', href: '#products' },
          { label: 'Terrain Mapper', description: '3D reconstruction from stereo + LIDAR.', href: '#products' },
          { label: 'Sample Handler', description: 'Automated coring and caching.', href: '#products' },
        ],
      },
      {
        heading: 'Tools',
        links: [
          { label: 'Mission Planner', description: 'Schedule sols and science goals.', href: '#products', badge: 'Beta' },
          { label: 'Telemetry Lake', description: 'Time-series store for rover data.', href: '#products' },
          { label: 'Operations Console', description: 'Live cockpit for the surface team.', href: '#products' },
        ],
      },
    ],
    spotlight: {
      eyebrow: 'Featured',
      title: 'Curiosity Telemetry v4',
      body: 'Stream every instrument reading, drill torque, and motor current at mission-frame rates.',
      ctaLabel: 'Read the launch notes',
      ctaHref: '#products',
    },
  },
  {
    id: 'solutions',
    triggerLabel: 'Solutions',
    triggerIcon: 'compass',
    groups: [
      {
        heading: 'By mission',
        links: [
          { label: 'Sample Return', description: 'End-to-end caching workflows.', href: '#solutions' },
          { label: 'Long-duration', description: 'Year-long autonomous science ops.', href: '#solutions' },
          { label: 'Human precursor', description: 'Pathfinder rovers for crewed missions.', href: '#solutions' },
        ],
      },
      {
        heading: 'By team',
        links: [
          { label: 'Engineering', description: 'Hardware-in-the-loop validation.', href: '#solutions' },
          { label: 'Science', description: 'Planetary geology workflows.', href: '#solutions' },
          { label: 'Operations', description: 'Shift handover & anomaly response.', href: '#solutions' },
        ],
      },
    ],
    spotlight: {
      eyebrow: 'Case study',
      title: 'UMRT Gale Crater ops',
      body: 'How our team kept the rover productive across 4,000 sols of remote operations.',
      ctaLabel: 'Read the case study',
      ctaHref: '#solutions',
    },
  },
  {
    id: 'developers',
    triggerLabel: 'Developers',
    triggerIcon: 'terminal',
    groups: [
      {
        heading: 'Build',
        links: [
          { label: 'API Reference', description: 'REST + gRPC for rover telemetry.', href: '#developers' },
          { label: 'SDKs', description: 'TypeScript, Python and Rust clients.', href: '#developers' },
          { label: 'Webhooks', description: 'Real-time event streams.', href: '#developers' },
        ],
      },
      {
        heading: 'Learn',
        links: [
          { label: 'Quickstart', description: 'First command in under five minutes.', href: '#developers' },
          { label: 'Guides', description: 'Patterns for autonomy, science, ops.', href: '#developers' },
          { label: 'Changelog', description: 'Latest SDK + API releases.', href: '#developers', badge: 'New' },
        ],
      },
    ],
    spotlight: {
      eyebrow: 'For developers',
      title: 'Mission SDK 4.0',
      body: 'A unified surface for commanding the rover, subscribing to telemetry, and shipping science.',
      ctaLabel: 'Browse the docs',
      ctaHref: '#developers',
    },
  },
];