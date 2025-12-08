// next.config.js - SIMPLE VERSION
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ HATA DO: output: 'standalone'
  reactStrictMode: true,
  
  // ✅ Railway ke liye important
  experimental: {
    serverComponentsExternalPackages: ['pg', 'bcryptjs'],
  },
  
  // ✅ Environment variables expose karo
  env: {
    UPWORK_CLIENT_ID: process.env.UPWORK_CLIENT_ID,
    UPWORK_CLIENT_SECRET: process.env.UPWORK_CLIENT_SECRET,
    UPWORK_REDIRECT_URI: process.env.UPWORK_REDIRECT_URI,
    JWT_SECRET: process.env.JWT_SECRET,
  }
}

module.exports = nextConfig