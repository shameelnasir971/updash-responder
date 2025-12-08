// next.config.js - FINAL WORKING VERSION
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ HATA DO: output: 'standalone' (Railway doesn't need it)
  reactStrictMode: true,
  
  // ✅ Trailing slash disable karo
  trailingSlash: false,
  
  // ✅ Railway ke liye important
  experimental: {
    serverComponentsExternalPackages: ['pg', 'bcryptjs'],
  },
  
  // ✅ API routes ko optimize karo
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ]
  }
}

module.exports = nextConfig