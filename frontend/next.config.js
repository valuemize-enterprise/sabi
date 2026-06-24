/** @type {import('next').NextConfig} */
const nextConfig = {
  // BUG-013 FIX: Remote image domains for logo_url and avatar_url
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',       // Supabase Storage
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
      },
      {
        protocol: 'https',
        hostname: '**.r2.dev',            // Cloudflare R2
      },
      {
        protocol: 'https',
        hostname: 'uploads.cerebre.media', // Custom R2 domain
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com', // GitHub avatars
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',     // Google profile pics
      },
    ],
  },

  // Environment variable exposure to browser
  env: {
    NEXT_PUBLIC_APP_NAME:     process.env.NEXT_PUBLIC_APP_NAME     || 'Sabi Intelligence Suite',
    NEXT_PUBLIC_COMPANY_NAME: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Cerebre Media Africa',
    NEXT_PUBLIC_SUPPORT_EMAIL:process.env.NEXT_PUBLIC_SUPPORT_EMAIL|| 'hello@cerebre.media',
  },

  // Recommended for production
  poweredByHeader:    false,
  reactStrictMode:    true,
  compress:           true,

  // Suppress harmless hydration warnings from Zustand
  experimental: {
    serverComponentsExternalPackages: [],
  },
};

module.exports = nextConfig;
