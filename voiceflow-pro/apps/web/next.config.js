/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // During development, we'll ignore type errors for faster iteration
    ignoreBuildErrors: true,
  },
  eslint: {
    // During development, we'll ignore ESLint errors
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;