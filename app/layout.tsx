import './globals.css';

export const metadata = {
  title: 'Prélude · Plateforme d\'instruction',
  description: 'Sept moteurs interconnectés pour l\'analyse rigoureuse de pitch decks. Cadre des angles morts du métier VC européen.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
