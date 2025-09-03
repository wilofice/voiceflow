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
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3002/api/:path*', // Proxy to Backend
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude 'onnxruntime-node' from client-side bundles
      config.resolve.alias['onnxruntime-node'] = false;
      return config;
    }

    // Keep the original config for node-loader
    config.module.rules.push({
      test: /\.node$/,
      use: [
        {
          loader: 'node-loader',
          options: {
            name: '[name].[ext]',
          },
        },
      ],
    });

    // Mark onnxruntime-node as external
    config.externals.push('onnxruntime-node');

    return config;
  },
};

module.exports = nextConfig;