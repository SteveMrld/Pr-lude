// ============================================================
// PAGE ADMIN ERROR LOGS
// ------------------------------------------------------------
// Visualisation des logs d erreurs serveur captures dans la
// table error_logs. Reservee aux super-admins Prelude.
//
// Cote serveur : check d auth + isSuperAdmin avant rendu.
// Cote client : appel direct a /api/admin/error-logs avec
// filtres severity et source. Affichage en table editoriale.
// ============================================================

import { redirect } from 'next/navigation';
import { getCurrentUser, isSuperAdmin, isAuthEnabled } from '@/lib/auth';
import ErrorLogsClient from './ErrorLogsClient';

export const dynamic = 'force-dynamic';

export default async function AdminErrorLogsPage() {
  if (!isAuthEnabled()) {
    redirect('/');
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const isAdmin = await isSuperAdmin(user.id);
  if (!isAdmin) {
    // On ne reveal pas l existence de la page aux non-admins.
    redirect('/');
  }

  return <ErrorLogsClient userEmail={user.email} />;
}
