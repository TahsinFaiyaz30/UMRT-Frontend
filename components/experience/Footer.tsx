'use client';

import { useMemo, useRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Footer section — Earth + starfield background, three columns of info,
 * and a "Meet Our Webmasters" button.
 *
 * The 3D backdrop is rendered inside its own <Canvas> at z-index 0
 * inside the footer so it composites behind the text. The Earth
 * rotates slowly on its tilted axis; the starfield rotates even
 * more slowly around the same axis so the parallax makes the
 * background feel deeper than the foreground.
 *
 * Procedural textures are generated on the GPU via CanvasTexture so
 * we don't need any external asset: the Earth is a sphere painted
 * from a small canvas (continents + oceans), and stars are 1500
 * random points on a sphere of points geometry.
 */
export function Footer(props: ComponentPropsWithoutRef<'footer'>) {
  return (
    <footer
      {...props}
      className={`relative isolate z-10 w-full overflow-hidden bg-black text-mars-50 ${
        props.className ?? ''
      }`}
    >
      {/* Backdrop: rotating Earth + slow starfield. */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <FooterScene />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 mx-auto flex min-h-[640px] max-w-7xl flex-col justify-between px-6 py-16 md:px-12 md:py-24">
        {/* Logo header */}
        <div className="flex justify-center pt-4">
          <RoverMark />
        </div>

        {/* Three-column grid */}
        <div className="mt-16 grid grid-cols-1 gap-12 md:mt-24 md:grid-cols-3 md:gap-16">
          {/* About */}
          <div>
            <h3 className="font-display text-3xl font-bold tracking-tight text-mars-300">
              About UMRT
            </h3>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-mars-100/80">
              The UIU Mars Rover Team (UMRT) is a group of passionate
              students dedicated to designing and building the next
              generation of Mars and Lunar rovers. We aim to push the
              boundaries of space exploration and innovation.
            </p>
          </div>

          {/* Contact */}
          <div className="text-center">
            <h3 className="font-display text-3xl font-bold tracking-tight text-mars-300">
              Contact with us
            </h3>
            <div className="mt-6 flex flex-col items-center gap-4 text-base text-mars-100/85">
              <div className="flex items-center gap-3">
                <PhoneIcon />
                <span>+880 1796-992356</span>
              </div>
              <a
                href="mailto:marsrover@uiu.ac.bd"
                className="flex items-center gap-3 transition-colors hover:text-mars-300"
              >
                <MailIcon />
                <span>marsrover@uiu.ac.bd</span>
              </a>
              <div className="mt-2 flex items-center gap-5">
                <SocialLink href="https://facebook.com" label="Facebook">
                  <FacebookIcon />
                </SocialLink>
                <SocialLink href="https://linkedin.com" label="LinkedIn">
                  <LinkedInIcon />
                </SocialLink>
                <SocialLink href="https://youtube.com" label="YouTube">
                  <YouTubeIcon />
                </SocialLink>
                <SocialLink href="https://x.com" label="X / Twitter">
                  <XIcon />
                </SocialLink>
                <SocialLink href="https://instagram.com" label="Instagram">
                  <InstagramIcon />
                </SocialLink>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="text-right md:text-right">
            <h3 className="font-display text-3xl font-bold tracking-tight text-mars-300">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-1.5 text-base text-mars-100/85">
              <li><a className="transition-colors hover:text-mars-300" href="/projects">Projects</a></li>
              <li><a className="transition-colors hover:text-mars-300" href="/achievements">Achievements</a></li>
              <li><a className="transition-colors hover:text-mars-300" href="/mission">Our Mission</a></li>
              <li><a className="transition-colors hover:text-mars-300" href="/advisors">Advisors</a></li>
              <li><a className="transition-colors hover:text-mars-300" href="/director">Director</a></li>
              <li><a className="transition-colors hover:text-mars-300" href="/members">Members</a></li>
              <li><a className="transition-colors hover:text-mars-300" href="/leadership">Leadership</a></li>
              <li><a className="transition-colors hover:text-mars-300" href="/videos">Videos</a></li>
              <li><a className="transition-colors hover:text-mars-300" href="/join">Join Us</a></li>
              <li><a className="transition-colors hover:text-mars-300" href="/sponsor">Become Sponsor!</a></li>
            </ul>
          </div>
        </div>

        {/* CTA divider */}
        <div className="mt-16 flex flex-col items-center gap-4 border-t border-mars-200/20 pt-8">
          <a
            href="/webmasters"
            className="inline-flex items-center gap-2 rounded-full border border-mars-300/40 bg-mars-700/40 px-6 py-2.5 text-sm font-medium tracking-wide text-mars-100 backdrop-blur transition-all hover:scale-[1.03] hover:border-mars-300/70 hover:bg-mars-700/60"
          >
            <CodeIcon />
            <span>Meet Our Webmasters</span>
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  3D footer scene — Earth + stars                                    */
/* ------------------------------------------------------------------ */

function FooterScene() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 4.2], fov: 45, near: 0.1, far: 100 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      style={{ background: 'radial-gradient(circle at 50% 60%, #2b1a14 0%, #0a0612 70%, #000000 100%)' }}
    >
      <ambientLight intensity={0.6} />
      {/* Key sunlight from upper-right */}
      <directionalLight position={[5, 3, 4]} intensity={1.4} color={'#fff6e0'} />
      {/* Cool fill from the back-left for limb lighting */}
      <directionalLight position={[-6, -2, -4]} intensity={0.45} color={'#7da7ff'} />

      {/* Stars rotating slowly around tilted axis */}
      <Starfield />

      {/* Earth rotating slowly on its tilted axis */}
      <Earth />
    </Canvas>
  );
}

function Earth() {
  const groupRef = useRef<THREE.Group>(null);

  const texture = useMemo(() => makeEarthTexture(), []);
  const bumpTexture = useMemo(() => makeEarthBumpTexture(), []);
  const cloudTexture = useMemo(() => makeCloudTexture(), []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      // Earth spins on a 23.4° tilted axis. We tilt the group once at
      // mount, then drive a child group's rotation.y for the spin so
      // the tilt stays stable.
      const spin = groupRef.current.children[0] as THREE.Group | undefined;
      if (spin) spin.rotation.y += delta * 0.08;
    }
  });

  return (
    <group ref={groupRef} rotation={[0, 0, THREE.MathUtils.degToRad(23.4)]} position={[0, 0.4, -1.5]}>
      <group>
        <mesh>
          <sphereGeometry args={[2.2, 64, 64]} />
          <meshStandardMaterial
            map={texture}
            bumpMap={bumpTexture}
            bumpScale={0.04}
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>
        {/* Cloud layer, slightly larger sphere, semi-transparent */}
        <mesh scale={1.012}>
          <sphereGeometry args={[2.2, 48, 48]} />
          <meshStandardMaterial
            map={cloudTexture}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

function Starfield() {
  const fieldRef = useRef<THREE.Points>(null);
  const cloudRef = useRef<THREE.Points>(null);

  const [starGeometry, cloudGeometry] = useMemo(() => {
    const makeField = (count: number, radius: number, size: number) => {
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        // Random direction on a sphere
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = radius * (0.85 + Math.random() * 0.3);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      return g;
    };
    return [makeField(1500, 14, 0.04), makeField(400, 14, 0.18)];
  }, []);

  useFrame((_, delta) => {
    if (fieldRef.current) fieldRef.current.rotation.y += delta * 0.012;
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.005;
  });

  return (
    <>
      <points ref={fieldRef} geometry={starGeometry} rotation={[0.4, 0, 0.2]}>
        <pointsMaterial color={0xffffff} size={0.018} sizeAttenuation transparent opacity={0.9} />
      </points>
      <points ref={cloudRef} geometry={cloudGeometry} rotation={[0.4, 0, 0.2]}>
        <pointsMaterial color={0xffd9a8} size={0.07} sizeAttenuation transparent opacity={0.55} />
      </points>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Procedural textures (no external assets needed)                    */
/* ------------------------------------------------------------------ */

function makeEarthTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  // Deep ocean gradient
  const ocean = ctx.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0, '#0a2540');
  ocean.addColorStop(0.5, '#0d3d6b');
  ocean.addColorStop(1, '#0a2540');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, w, h);

  // Continents — procedural blobs painted as semi-transparent green
  // so we get the look of land without an external map.
  const continents: [number, number, number, number][] = [
    // [cx, cy, rx, ry]
    [180, 160, 110, 60],   // N America top
    [220, 230, 90, 60],    // C America
    [320, 330, 70, 50],    // S America
    [480, 150, 100, 60],   // Europe
    [520, 250, 140, 90],   // Africa
    [720, 170, 200, 80],   // Asia
    [840, 320, 80, 50],    // SE Asia
    [880, 400, 60, 30],    // Australia
  ];
  for (const [cx, cy, rx, ry] of continents) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    g.addColorStop(0, '#3f7a32');
    g.addColorStop(0.5, '#2d5d23');
    g.addColorStop(1, 'rgba(20, 40, 18, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Slightly brighter noise on top to fake terrain
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(${120 + Math.random() * 50}, ${100 + Math.random() * 50}, ${50 + Math.random() * 40}, ${0.2 + Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(
        cx + (Math.random() - 0.5) * rx * 1.2,
        cy + (Math.random() - 0.5) * ry * 1.2,
        rx * (0.1 + Math.random() * 0.2),
        ry * (0.1 + Math.random() * 0.2),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  // Polar ice caps
  const ice = ctx.createLinearGradient(0, 0, 0, h);
  ice.addColorStop(0, 'rgba(255,255,255,0.95)');
  ice.addColorStop(0.08, 'rgba(255,255,255,0)');
  ice.addColorStop(0.92, 'rgba(255,255,255,0)');
  ice.addColorStop(1, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = ice;
  ctx.fillRect(0, 0, w, h);

  // Subtle city lights along continental edges (warm specks)
  for (const [cx, cy, rx, ry] of continents) {
    for (let i = 0; i < 18; i++) {
      const x = cx + (Math.random() - 0.5) * rx * 1.5;
      const y = cy + (Math.random() - 0.5) * ry * 1.5;
      ctx.fillStyle = `rgba(255, 200, 120, ${0.5 + Math.random() * 0.4})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeEarthBumpTexture(): THREE.CanvasTexture {
  // A flat, slightly noisy version of the same shape used as a bump
  // map so the surface has tiny depth from continents / oceans.
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, w, h);
  const continents: [number, number, number, number][] = [
    [90, 80, 55, 30],
    [110, 115, 45, 30],
    [160, 165, 35, 25],
    [240, 75, 50, 30],
    [260, 125, 70, 45],
    [360, 85, 100, 40],
    [420, 200, 30, 15],
    [440, 160, 40, 25],
  ];
  for (const [cx, cy, rx, ry] of continents) {
    ctx.fillStyle = '#cccccc';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 800; i++) {
    const v = Math.random() < 0.5 ? '#666' : '#999';
    ctx.fillStyle = v;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function makeCloudTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  // Soft horizontal cloud bands at random latitudes.
  for (let band = 0; band < 8; band++) {
    const y = Math.random() * h;
    const bandH = 12 + Math.random() * 26;
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * w;
      const radius = 6 + Math.random() * 22;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Inline icons (no external icon library)                           */
/* ------------------------------------------------------------------ */

function RoverMark() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-mars-300/60 bg-black/60 backdrop-blur">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] font-bold uppercase tracking-widest text-mars-50">
          <span className="text-[8px]">UMRT</span>
          <span className="-mt-1 text-[8px] opacity-80">ROVER</span>
        </div>
        <svg viewBox="0 0 100 100" className="absolute inset-3">
          <circle cx="50" cy="55" r="12" fill="#9c2a13" />
          <rect x="22" y="58" width="56" height="22" rx="6" fill="#5a1d0c" />
          <circle cx="30" cy="80" r="8" fill="#1a0a04" stroke="#9c2a13" strokeWidth="2" />
          <circle cx="50" cy="82" r="8" fill="#1a0a04" stroke="#9c2a13" strokeWidth="2" />
          <circle cx="70" cy="80" r="8" fill="#1a0a04" stroke="#9c2a13" strokeWidth="2" />
          <rect x="48" y="32" width="4" height="20" fill="#5a1d0c" />
          <rect x="40" y="28" width="20" height="6" rx="2" fill="#9c2a13" />
          <circle cx="50" cy="31" r="3" fill="#ffd9a8" />
        </svg>
      </div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mars-300">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mars-300">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-mars-200/30 bg-black/40 text-mars-100 transition-all hover:scale-110 hover:border-mars-300/70 hover:bg-mars-700/50 hover:text-mars-50"
    >
      {children}
    </a>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.396 3.98h2.396v8.01Z"/></svg>
  );
}
function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z"/></svg>
  );
}
function YouTubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73Z"/></svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  );
}
function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>
  );
}
