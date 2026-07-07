// ============================================================
// Configuration Next.js
// ------------------------------------------------------------
// Les headers HTTP de securite sont poses ici sur toutes les
// routes. Objectif : score B minimum sur Mozilla Observatory /
// securityheaders.com, ce qui debloque les DSI clientes qui
// bloquent la mise en production tant que le scan est en F.
//
// Choix de la CSP : Next.js 14 injecte des scripts inline pour
// hydrater les composants clients, ce qui exige 'unsafe-inline'
// et 'unsafe-eval' sur script-src. Le passage a une CSP a nonce
// stricte demande un middleware dedie et une refonte des Server
// Components, hors perimetre de ce durcissement. Ce qu on serre
// ici sans risque : frame-ancestors, object-src, base-uri.
//
// connect-src laisse passer les domaines Supabase et Anthropic
// parce que le pipeline attaque directement ces API depuis le
// client dans certaines pages (upload storage, streaming SSE
// mediated par notre propre backend, auth Supabase).
// ============================================================

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
