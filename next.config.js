// next.config.js - SIMPLE VERSION (Railway compatible)
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ❌ REMOVE THIS LINE COMPLETELY: output: 'standalone'
  // Railway doesn't need standalone mode for Node.js apps
  reactStrictMode: true,
  swcMinify: true,
  
  // Allow external packages
  experimental: {
    serverComponentsExternalPackages: ['pg', 'bcryptjs'],
  },
  
  // Disable image optimization if not needed
  images: {
    unoptimized: true,
  }
}

module.exports = nextConfig