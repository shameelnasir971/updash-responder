// next.config.js - NEW FILE
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return []
  },
  async rewrites() {
    return []
  },
  images: {
    domains: ['www.upwork.com'],
  },
}

module.exports = nextConfig