import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, './'),
  reactStrictMode: true,
  transpilePackages: ['three'],
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
