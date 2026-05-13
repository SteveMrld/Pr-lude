// ============================================================
// PAGE PORTFOLIO SECTEURS
// ------------------------------------------------------------
// Onglet Secteurs du dashboard partner. Liste les treize fiches
// sectorielles du catalogue Prelude avec leur date de derniere
// generation et un mini spider chart. Clic ouvre la fiche
// complete avec option superposition et option comparaison
// temporelle.
//
// Server component : charge en parallele les dernieres fiches
// pour les treize secteurs depuis Supabase via
// getLatestBriefForSector, et passe le tableau au client.
// ============================================================

import { redirect } from 'next/navigation';
import { isAuthEnabled, getCurrentUser, getCurrentOrganization } from '@/lib/auth';
import {
  SECTORS,
  getLatestBriefForSector,
  type SectoralBrief,
} from '@/lib/engines/sectoral-intelligence';
import SecteursClient, { type SectorListItem } from './SecteursClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function SecteursPage() {
  if (!isAuthEnabled()) {
    redirect('/');
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const org = await getCurrentOrganization(user.id);
  if (!org) redirect('/onboarding');

  // Charge en parallele les dernieres fiches pour les treize secteurs.
  // Toute erreur Supabase sur une fiche donnee est isolee : on retourne
  // un item brief=null et le client affiche la mention "aucune fiche".
  const items: SectorListItem[] = await Promise.all(
    SECTORS.map(async (sector) => {
      let brief: SectoralBrief | null = null;
      try {
        brief = await getLatestBriefForSector(sector.slug);
      } catch (err: any) {
        console.warn(`[secteurs] fetch ${sector.slug} echec : ${err?.message ?? err}`);
      }
      return {
        slug: sector.slug,
        label: sector.label,
        perimeter: sector.perimeter_brief,
        brief,
      };
    }),
  );

  return (
    <SecteursClient
      items={items}
      orgName={org.name}
      userEmail={user.email}
    />
  );
}
