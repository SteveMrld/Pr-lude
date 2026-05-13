// ============================================================
// PAGE ADMIN SECTORAL INTELLIGENCE
// ------------------------------------------------------------
// Cartographie sectorielle vivante. Reservee aux super-admins
// Prelude. Liste les 13 secteurs catalogues avec date de derniere
// regeneration, etat de fraicheur (a jour, recommandee, perimee),
// nombre de sources citees, distribution rapide des huit scores
// en mini-barres. Bouton "Regenerer la fiche complete" par
// secteur, plus bouton "Regenerer une dimension" qui ouvre un
// selecteur. Log de regenerations recentes en bas de page.
//
// Cote serveur : check d auth + isSuperAdmin avant rendu, comme
// pour /admin/errors. Cote client : appel direct a
// /api/admin/sectoral, polling discret apres declenchement pour
// voir la nouvelle fiche apparaitre dans la table.
// ============================================================

import { redirect } from 'next/navigation';
import { getCurrentUser, isSuperAdmin, isAuthEnabled } from '@/lib/auth';
import SectoralAdminClient from './SectoralAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminSectoralPage() {
  if (!isAuthEnabled()) {
    redirect('/');
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const isAdmin = await isSuperAdmin(user.id);
  if (!isAdmin) {
    // Comme pour /admin/errors : on ne reveal pas l existence de
    // la page aux non-admins.
    redirect('/');
  }

  return <SectoralAdminClient userEmail={user.email} />;
}
