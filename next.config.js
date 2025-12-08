// next.config.js - CORRECT VERSION
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Railway ke liye yeh configuration use karo
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['pg', 'bcryptjs', 'jsonwebtoken'],
  },
  // Images optimization off karo
  images: {
    unoptimized: true,
  },
  // Environment variables expose karo
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    UPWORK_CLIENT_ID: process.env.UPWORK_CLIENT_ID,
    UPWORK_CLIENT_SECRET: process.env.UPWORK_CLIENT_SECRET,
    UPWORK_REDIRECT_URI: process.env.UPWORK_REDIRECT_URI,
    JWT_SECRET: process.env.JWT_SECRET,
  },
  // API routes ke liye
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  }
}

module.exports = nextConfig