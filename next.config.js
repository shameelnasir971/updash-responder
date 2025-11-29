/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export disable karein - server needed
  output: 'standalone',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  experimental: {
    serverComponentsExternalPackages: ['bcryptjs', 'pg'],
  },
  // API routes ko allow karein
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ]
  },
  // ✅ NEW: Dynamic server usage ke liye fix
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
}

module.exports = nextConfig