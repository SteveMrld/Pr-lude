import './globals.css';

export const metadata = {
  title: 'Prélude · Plateforme d\'instruction',
  description: 'Plateforme d\'instruction VC européenne. Analyse rigoureuse de pitch decks et business plans, cadre des angles morts et des singularités contrariennes du métier VC.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
