// ============================================================
// PAGE DASHBOARD PARTNER - ETAT SYSTEMIQUE DES SECTEURS
// ------------------------------------------------------------
// Onglet du dashboard partner qui expose le brief inter-sectoriel
// trimestriel agrege par le sous-chantier 8. Server Component :
// charge le brief demande (parametre query period, defaut latest)
// plus la liste des periodes disponibles, et passe le tout en
// props au Client Component. Aucun import direct vers le module
// engine cote client (discipline architecturale du fix Vercel
// precedent).
// ============================================================

import { redirect } from 'next/navigation';
import { isAuthEnabled, getCurrentUser, getCurrentOrganization } from '@/lib/auth';
import {
  getInterSectoralBriefByPeriod,
  getLatestInterSectoralBrief,
  listInterSectoralPeriods,
} from '@/lib/engines/sectoral-intelligence/inter-sector-store';
import type {
  InterSectoralBrief,
  InterSectoralPeriodEntry,
} from '@/lib/engines/sectoral-intelligence/client';
import EtatSystemiqueClient from './EtatSystemiqueClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: { period?: string };
}

export default async function EtatSystemiquePage({ searchParams }: PageProps) {
  if (!isAuthEnabled()) {
    redirect('/');
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const org = await getCurrentOrganization(user.id);
  if (!org) redirect('/onboarding');

  const requestedPeriod = searchParams?.period;

  let brief: InterSectoralBrief | null = null;
  let periods: InterSectoralPeriodEntry[] = [];

  try {
    if (requestedPeriod && /^\d{4}-Q[1-4]$/.test(requestedPeriod)) {
      brief = await getInterSectoralBriefByPeriod(requestedPeriod);
    } else {
      brief = await getLatestInterSectoralBrief();
    }
  } catch (err: any) {
    console.warn(`[etat-systemique] fetch brief failed : ${err?.message ?? err}`);
    brief = null;
  }

  try {
    periods = await listInterSectoralPeriods();
  } catch (err: any) {
    console.warn(`[etat-systemique] list periods failed : ${err?.message ?? err}`);
    periods = [];
  }

  return (
    <EtatSystemiqueClient
      brief={brief}
      periods={periods}
      orgName={org.name}
      userEmail={user.email}
      selectedPeriod={brief?.period_quarter ?? requestedPeriod ?? null}
    />
  );
}
