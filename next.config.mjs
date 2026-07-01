/** @type {import('next').NextConfig} */
const nextConfig = {
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
