// Adapter BODACC (Bulletin officiel des annonces civiles et commerciales).
// API publique gratuite, sans cle, via le portail data.economie.gouv.fr.
//
// Utilise pour :
//   - Detecter procedures collectives (sauvegarde, redressement, liquidation)
//   - Suivre creations, immatriculations, modifications
//   - Croiser les annonces de cession ou changement de dirigeants
//   - Verifier l absence d alerte legale sur une entreprise cible
//
// La detection d une procedure collective est un signal RISQUES
// majeur a faire remonter immediatement dans le moteur Risques & Plan.
//
// Documentation : https://bodacc-datadila.opendatasoft.com/api/v2/console
//
// Note : pas de cle requise, mais quotas raisonnables (~10 req/sec).
// L API est tres permissive en termes de filtres (date, type, region).

import type { AdapterContext, AdapterCitation } from './types';
import { safeJsonFetch } from './types';

const BODACC_BASE = 'https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records';

export type BodaccAnnouncementType =
  | 'creation'
  | 'modification'
  | 'radiation'
  | 'procedure-collective'
  | 'depot-comptes'
  | 'cession'
  | 'autre';

export interface BodaccAnnouncement {
  /** Date de publication au BODACC (ISO YYYY-MM-DD). */
  publicationDate: string;
  /** Type d annonce normalise. */
  type: BodaccAnnouncementType;
  /** Titre legal d origine (familledecree). */
  rawType: string;
  /** Identifiant numero de l annonce dans son edition. */
  numAnnonce: string;
  /** Tribunal d immatriculation. */
  tribunal: string;
  /** Description ou resume de l annonce, si disponible. */
  description: string;
  /** Departement (numero). */
  department: string;
  /** URL de la fiche BODACC. */
  url: string;
}

function normalizeType(raw: string): BodaccAnnouncementType {
  const r = raw.toLowerCase();
  if (r.includes('creation')) return 'creation';
  if (r.includes('immatriculation')) return 'creation';
  if (r.includes('radiation')) return 'radiation';
  if (r.includes('depot des comptes') || r.includes('comptes annuels')) return 'depot-comptes';
  if (r.includes('cession') || r.includes('vente')) return 'cession';
  if (
    r.includes('redressement') ||
    r.includes('liquidation') ||
    r.includes('sauvegarde') ||
    r.includes('cessation')
  ) return 'procedure-collective';
  if (r.includes('modification')) return 'modification';
  return 'autre';
}

/**
 * Recherche les annonces BODACC pour une entreprise par SIREN.
 * Retourne les n plus recentes (defaut 20). Tri par date de publication
 * descendante.
 *
 * Si on suspecte une procedure collective, filtrer cote appelant sur
 * type === 'procedure-collective'.
 */
export async function searchBodaccBySiren(
  siren: string,
  opts: AdapterContext & { maxResults?: number } = {},
): Promise<BodaccAnnouncement[]> {
  const cleanSiren = siren.replace(/\s+/g, '');
  if (!/^\d{9}$/.test(cleanSiren)) return [];

  const max = Math.min(opts.maxResults ?? 20, 50);
  const params = new URLSearchParams({
    where: `registre LIKE "${cleanSiren}*"`,
    limit: String(max),
    order_by: 'dateparution DESC',
  });

  opts.emit?.('adapter:start', { source: 'bodacc', siren: cleanSiren });

  const json = await safeJsonFetch<any>(`${BODACC_BASE}?${params.toString()}`, {
    budgetMs: opts.budgetMs ?? 8000,
  });

  if (!json || !Array.isArray(json.results)) {
    opts.emit?.('adapter:miss', { source: 'bodacc', siren: cleanSiren });
    return [];
  }

  const out: BodaccAnnouncement[] = json.results.map((r: any) => {
    const rawType = r.familleavis_lib || r.familleavis || '';
    return {
      publicationDate: r.dateparution || '',
      type: normalizeType(rawType),
      rawType,
      numAnnonce: r.numeroannonce || '',
      tribunal: r.tribunal || '',
      description: r.publicationavis_facette || r.commercant || '',
      department: r.departement_nom_officiel || r.departement_code || '',
      url: r.url_complete || r.publicationlien_pdf ||
           `https://www.bodacc.fr/pages/annonces-commerciales-bilans-detail/?q.id=id:${r.id || ''}`,
    };
  });

  opts.emit?.('adapter:hit', { source: 'bodacc', count: out.length });
  return out;
}

/**
 * Recherche les annonces de procedure collective recentes (utiles pour
 * detecter un signal de risque sur l ecosysteme d une cible : clients
 * en defaillance, concurrents en liquidation, etc.).
 */
export async function searchBodaccProceduresByCompanyName(
  companyName: string,
  opts: AdapterContext & { maxResults?: number; afterDate?: string } = {},
): Promise<BodaccAnnouncement[]> {
  const max = Math.min(opts.maxResults ?? 20, 50);
  // Filtre sur les familles d annonces qui sont des procedures collectives.
  // Les libelles BODACC contiennent 'procedures-collectives' explicite.
  const filters = [
    'familleavis = "procedures-collectives"',
    `commercant LIKE "%${companyName.replace(/"/g, '')}%"`,
  ];
  if (opts.afterDate) filters.push(`dateparution >= date'${opts.afterDate}'`);

  const params = new URLSearchParams({
    where: filters.join(' AND '),
    limit: String(max),
    order_by: 'dateparution DESC',
  });

  opts.emit?.('adapter:start', { source: 'bodacc', name: companyName });

  const json = await safeJsonFetch<any>(`${BODACC_BASE}?${params.toString()}`, {
    budgetMs: opts.budgetMs ?? 8000,
  });

  if (!json || !Array.isArray(json.results)) {
    opts.emit?.('adapter:miss', { source: 'bodacc', name: companyName });
    return [];
  }

  const out: BodaccAnnouncement[] = json.results.map((r: any) => ({
    publicationDate: r.dateparution || '',
    type: 'procedure-collective' as const,
    rawType: r.familleavis_lib || r.familleavis || '',
    numAnnonce: r.numeroannonce || '',
    tribunal: r.tribunal || '',
    description: r.publicationavis_facette || r.commercant || '',
    department: r.departement_nom_officiel || r.departement_code || '',
    url: r.url_complete || `https://www.bodacc.fr/pages/annonces-commerciales-bilans-detail/?q.id=id:${r.id || ''}`,
  }));

  opts.emit?.('adapter:hit', { source: 'bodacc', count: out.length });
  return out;
}

export function bodaccToCitation(rec: BodaccAnnouncement): AdapterCitation {
  return {
    sourceId: 'bodacc',
    url: rec.url,
    title: `BODACC ${rec.publicationDate} — ${rec.rawType || rec.type}`,
    date: rec.publicationDate,
    tier: 1,
  };
}
