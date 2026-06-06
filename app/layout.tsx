import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Source_Serif_4, Inter } from 'next/font/google';

// ============================================================
// ROOT LAYOUT
// ------------------------------------------------------------
// Metadata complete pour partage en messagerie, ajout aux raccourcis
// mobile, presence dans les onglets et lecteurs RSS / Slack / Notion.
// Favicon : app/icon.svg (32x32) et app/apple-icon.svg (180x180)
// pris en charge automatiquement par Next.js 14 App Router.
//
// Typographie : Source Serif 4 (serif editorial, utilisation premiere)
// et Inter (sans-serif UI, micro-elements). Charges via next/font/google
// pour stabiliser le rendu cross-OS. Auparavant la stack reposait sur
// Iowan Old Style (Apple uniquement) avec fallback Cambria/Georgia,
// ce qui produisait trois rendus tres differents selon l OS du
// partner. Source Serif 4 est concue par Adobe pour la lecture
// editoriale longue, exactement le registre Le Grand Continent.
// ============================================================

const sourceSerif = Source_Serif_4({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
  preload: true,
});

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
  preload: false,
});

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
    { media: '(prefers-color-scheme: dark)', color: '#1a1612' },
  ],
};

// Script pose en tete du <head> pour appliquer le theme avant le
// premier paint et eviter le flash blanc en mode sombre. Lit
// localStorage prelude_theme et pose data-theme="dark" sur <html>
// si le user a explicitement choisi sombre, ou si 'system' et que
// la prefers-color-scheme est dark. Si rien en localStorage, on
// laisse vide et la media query @prefers-color-scheme prend le relais.
const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('prelude_theme');
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else if (t === 'system' || !t) document.documentElement.setAttribute('data-theme', 'system');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sourceSerif.variable} ${inter.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
