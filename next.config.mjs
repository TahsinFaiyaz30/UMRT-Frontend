import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isSitesStaticExport = process.env.SITES_STATIC_EXPORT === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isSitesStaticExport ? 'export' : undefined,
  outputFileTracingRoot: path.join(__dirname, './'),
  reactStrictMode: true,
  transpilePackages: ['three'],
  // Aggressive cache headers for static GLB/KTX2 assets so the model
  // is served from disk-cache after the very first download. Browsers
  // will not re-fetch them on subsequent page loads — that's the second
  // half of the "load it once, never wait again" promise.
  ...(isSitesStaticExport
    ? {}
    : {
        async headers() {
          return [
            {
              source: '/models/:path*',
              headers: [
                { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                { key: 'Access-Control-Allow-Origin', value: '*' },
                { key: 'Timing-Allow-Origin', value: '*' },
                { key: 'Vary', value: 'Accept-Encoding' },
              ],
            },
          ];
        },
      }),
  webpack: (config) => {
    // Allow importing .glb / .gltf / .hdr / .ktx2 files
    config.module.rules.push({
      test: /\.(glb|gltf|hdr|ktx2|drc)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/models/[name].[hash][ext]',
      },
    });
    return config;
  },
};

export default nextConfig;
