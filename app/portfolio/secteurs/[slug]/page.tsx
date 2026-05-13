// ============================================================
// PAGE FICHE SECTORIELLE COMPLETE
// ------------------------------------------------------------
// Drill-down d une fiche sectorielle. Affiche le spider chart en
// taille pleine avec la lecture editoriale dépliable des huit
// dimensions. Options de visualisation :
//
//   - Vue Fiche isolee (defaut)         : single mode
//   - Superposition avec un autre secteur : overlay mode, le slug
//     secondaire est selectionnable parmi les douze autres
//   - Comparaison temporelle T versus T-N : temporal mode, la
//     fiche historique est la plus recente anterieure de plus de
//     six mois
//
// Server component qui charge la fiche courante, l historique de
// son secteur et toutes les fiches secondaires disponibles, puis
// rend le client.
// ============================================================

import { redirect, notFound } from 'next/navigation';
import { isAuthEnabled, getCurrentUser, getCurrentOrganization } from '@/lib/auth';
import {
  SECTORS,
  getSectorBySlug,
  getLatestBriefForSector,
  listBriefsForSector,
  type SectoralBrief,
} from '@/lib/engines/sectoral-intelligence';
import SecteurDetailClient from './SecteurDetailClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
}

export default async function SecteurDetailPage({ params }: PageProps) {
  if (!isAuthEnabled()) {
    redirect('/');
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const org = await getCurrentOrganization(user.id);
  if (!org) redirect('/onboarding');

  const sector = getSectorBySlug(params.slug);
  if (!sector) notFound();

  const current = await getLatestBriefForSector(params.slug);
  if (!current) {
    return (
      <SecteurDetailClient
        sector={{ slug: sector.slug, label: sector.label, perimeter: sector.perimeter_brief }}
        current={null}
        history={[]}
        otherSectors={[]}
        orgName={org.name}
        userEmail={user.email}
      />
    );
  }

  // Historique : prendre les fiches anterieures pour permettre la
  // comparaison temporelle. On limite a 5 fiches pour ne pas
  // saturer le selecteur.
  const historyAll = await listBriefsForSector(params.slug, 6);
  const history = historyAll.filter((b) => b.id !== current.id).slice(0, 5);

  // Autres secteurs (12 max) pour le selecteur de superposition.
  // On charge en parallele la derniere fiche de chacun.
  const otherSectors: Array<{ slug: string; label: string; brief: SectoralBrief | null }> =
    await Promise.all(
      SECTORS.filter((s) => s.slug !== params.slug).map(async (s) => {
        let brief: SectoralBrief | null = null;
        try {
          brief = await getLatestBriefForSector(s.slug);
        } catch {
          // ignore : carte affichee en disabled si pas de fiche
        }
        return { slug: s.slug, label: s.label, brief };
      }),
    );

  return (
    <SecteurDetailClient
      sector={{ slug: sector.slug, label: sector.label, perimeter: sector.perimeter_brief }}
      current={current}
      history={history}
      otherSectors={otherSectors}
      orgName={org.name}
      userEmail={user.email}
    />
  );
}
