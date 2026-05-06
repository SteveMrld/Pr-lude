import './globals.css';
import type { Metadata, Viewport } from 'next';

// ============================================================
// ROOT LAYOUT
// ------------------------------------------------------------
// Metadata complete pour partage en messagerie, ajout aux raccourcis
// mobile, presence dans les onglets et lecteurs RSS / Slack / Notion.
// Favicon : app/icon.svg (32x32) et app/apple-icon.svg (180x180)
// pris en charge automatiquement par Next.js 14 App Router.
// ============================================================

const SITE_URL = 'https://pr-lude.vercel.app';
const SITE_NAME = 'Prélude';
const SITE_TITLE = 'Prélude · Plateforme d\'instruction VC';
const SITE_DESCRIPTION = 'Moteur d\'instruction de dossiers d\'investissement. Quatorze moteurs analytiques produisent en quelques minutes une note d\'investissement IC-ready, structurée comme l\'aurait fait un partner senior.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s · Prélude',
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: 'Prélude' }],
  generator: 'Next.js',
  keywords: [
    'capital-risque',
    'venture capital',
    'instruction',
    'due diligence',
    'pitch deck',
    'note d\'investissement',
    'comité d\'investissement',
    'IC',
  ],
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  referrer: 'strict-origin-when-cross-origin',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1e3a8a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
